import { query, withTransaction } from '@/bd/connection';
import { MovementInput, MovementBatchItem } from '@/lib/schemas';
import { formatCategory } from '@/lib/formatters';
import { getActiveReminders, ReminderRow } from '@/app/modules/reminders/service';

export function formatDescriptionWithPaymentMethod(
  description: string,
  paymentMethod?: string | null
): string {
  const trimmedDesc = (description || '').trim();
  if (!paymentMethod || typeof paymentMethod !== 'string') {
    return trimmedDesc;
  }
  const cleanMethod = paymentMethod.trim().replace(/^\[+|\]+$/g, '').toUpperCase();
  if (!cleanMethod) {
    return trimmedDesc;
  }
  const prefix = `[${cleanMethod}]`;
  if (trimmedDesc.toUpperCase().startsWith(prefix)) {
    return trimmedDesc;
  }
  return trimmedDesc ? `${prefix} ${trimmedDesc}` : prefix;
}

export interface MovementRow {
  id: number;
  user_id: number;
  type: 'ENTRADA' | 'SALIDA';
  category: string;
  amount: number;
  description: string;
  product_id?: number | null;
  quantity: number;
  is_unplanned: boolean;
  movement_date: string;
  product_name?: string | null;
}

export async function getCashVision(userId: number) {
  const res = await query(
    `
    SELECT
      COALESCE(SUM(CASE WHEN type = 'ENTRADA' THEN amount ELSE 0 END), 0)::FLOAT AS total_entradas,
      COALESCE(SUM(CASE WHEN type = 'SALIDA' THEN amount ELSE 0 END), 0)::FLOAT AS total_salidas,
      COALESCE(SUM(CASE WHEN type = 'ENTRADA' THEN amount ELSE -amount END), 0)::NUMERIC(12, 2) AS disponible_actual,
      COALESCE(SUM(CASE WHEN type = 'ENTRADA' AND movement_date >= date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS entradas_mes,
      COALESCE(SUM(CASE WHEN type = 'SALIDA' AND movement_date >= date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS salidas_mes
    FROM movements
    WHERE user_id = $1
  `,
    [userId]
  );

  const row = res.rows[0];
  return {
    total_entradas: row.total_entradas,
    total_salidas: row.total_salidas,
    disponible_actual: Number(row.disponible_actual),
    entradas_mes: row.entradas_mes,
    salidas_mes: row.salidas_mes,
  };
}

export async function getRecentMovements(userId: number, limit = 50): Promise<MovementRow[]> {
  const res = await query<MovementRow>(
    `
    SELECT 
      m.id, m.user_id, m.type, m.category, m.amount::FLOAT, m.description,
      m.product_id, m.quantity, m.is_unplanned, m.movement_date,
      p.name AS product_name
    FROM movements m
    LEFT JOIN products p ON m.product_id = p.id AND p.user_id = $1
    WHERE m.user_id = $1
    ORDER BY m.movement_date DESC, m.id DESC
    LIMIT $2
  `,
    [userId, limit]
  );
  return res.rows;
}

export async function getBarChartStats(userId: number) {
  const monthly = await query(
    `
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
        date_trunc('month', CURRENT_DATE),
        INTERVAL '1 month'
      ) AS m_date
    )
    SELECT
      TO_CHAR(m.m_date, 'YYYY-MM') AS periodo,
      TO_CHAR(m.m_date, 'Mon YYYY') AS etiqueta,
      COALESCE(SUM(CASE WHEN mov.type = 'ENTRADA' THEN mov.amount ELSE 0 END), 0)::FLOAT AS entradas,
      COALESCE(SUM(CASE WHEN mov.type = 'SALIDA' THEN mov.amount ELSE 0 END), 0)::FLOAT AS salidas
    FROM months m
    LEFT JOIN movements mov 
      ON date_trunc('month', mov.movement_date) = m.m_date AND mov.user_id = $1
    GROUP BY m.m_date
    ORDER BY m.m_date ASC
  `,
    [userId]
  );

  const weekly = await query(
    `
    WITH weeks AS (
      SELECT generate_series(
        date_trunc('week', CURRENT_DATE) - INTERVAL '5 weeks',
        date_trunc('week', CURRENT_DATE),
        INTERVAL '1 week'
      ) AS w_date
    )
    SELECT
      TO_CHAR(w.w_date, 'DD Mon') AS etiqueta,
      COALESCE(SUM(CASE WHEN mov.type = 'ENTRADA' THEN mov.amount ELSE 0 END), 0)::FLOAT AS entradas,
      COALESCE(SUM(CASE WHEN mov.type = 'SALIDA' THEN mov.amount ELSE 0 END), 0)::FLOAT AS salidas
    FROM weeks w
    LEFT JOIN movements mov 
      ON date_trunc('week', mov.movement_date) = w.w_date AND mov.user_id = $1
    GROUP BY w.w_date
    ORDER BY w.w_date ASC
  `,
    [userId]
  );

  return {
    mensual: monthly.rows,
    semanal: weekly.rows,
  };
}

export async function createMovement(userId: number, data: MovementInput) {
  const {
    type,
    category,
    amount,
    description,
    product_id = null,
    quantity = 1,
    is_unplanned = false,
    movement_date,
  } = data;

  const rawPaymentMethod =
    (data as any).payment_method ||
    (data as any).paymentMethod ||
    (data as any).medio_pago ||
    (data as any).medioPago;
  const finalDescription = formatDescriptionWithPaymentMethod(description, rawPaymentMethod);

  return await withTransaction(async (client) => {
    // Si está asociado a un producto, verificar pertenencia al usuario y bloquear fila
    if (product_id) {
      const prodRes = await client.query(
        `SELECT id, name, stock, active FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [product_id, userId]
      );

      if (prodRes.rowCount === 0) {
        throw new Error(`El producto con ID ${product_id} no existe o no pertenece a tu cuenta.`);
      }

      const product = prodRes.rows[0];

      if (product.active === false) {
        throw new Error('El producto se encuentra desactivado y no admite nuevos movimientos.');
      }

      // Verificación estricta de stock para ventas
      if (type === 'ENTRADA' && category === 'VENTA_PRODUCTO') {
        if (product.stock < quantity) {
          throw new Error(
            `Stock insuficiente: "${product.name}" solo tiene ${product.stock} unidad(es) disponible(s) e intentas registrar la venta de ${quantity}.`
          );
        }
        await client.query(
          `UPDATE products SET stock = stock - $1 WHERE id = $2 AND user_id = $3`,
          [quantity, product_id, userId]
        );
      } else if (
        type === 'SALIDA' &&
        (category === 'COMPRA_CATALOGO' || category === 'MATERIA_PRIMA')
      ) {
        // Incremento de stock por compra
        await client.query(
          `UPDATE products SET stock = stock + $1 WHERE id = $2 AND user_id = $3`,
          [quantity, product_id, userId]
        );
      }
    }

    const movRes = await client.query(
      `
      INSERT INTO movements (user_id, type, category, amount, description, product_id, quantity, is_unplanned, movement_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::TIMESTAMPTZ, CURRENT_TIMESTAMP))
      RETURNING *
    `,
      [
        userId,
        type,
        category,
        amount,
        finalDescription,
        product_id || null,
        quantity,
        is_unplanned,
        movement_date || null,
      ]
    );

    return movRes.rows[0];
  });
}

export interface MovementBatchPayload {
  payment_method?: string | null;
  paymentMethod?: string | null;
  medio_pago?: string | null;
  type?: 'ENTRADA' | 'SALIDA';
  category?: string;
  movement_date?: string;
  is_unplanned?: boolean;
  description?: string;
  items: MovementBatchItem[];
}

export async function createMovementsBatch(
  userId: number,
  batchInput: MovementBatchPayload | MovementBatchItem[]
): Promise<MovementRow[]> {
  const isArray = Array.isArray(batchInput);
  const items = isArray ? batchInput : batchInput.items;
  const batchMeta = isArray ? ({} as Partial<MovementBatchPayload>) : batchInput;

  const defaultPaymentMethod =
    batchMeta.payment_method ||
    batchMeta.paymentMethod ||
    batchMeta.medio_pago;
  const defaultType = batchMeta.type || 'ENTRADA';
  const defaultCategory = batchMeta.category;
  const defaultDate = batchMeta.movement_date || null;
  const defaultUnplanned = batchMeta.is_unplanned || false;
  const defaultDescription = batchMeta.description?.trim();

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Se requiere al menos un ítem o producto para registrar la venta.');
  }

  return await withTransaction(async (client) => {
    // 1. Bloquear y verificar todos los productos en orden ascendente por ID para prevenir deadlocks
    const distinctProductIds = Array.from(
      new Set(
        items
          .map((i) => (i.product_id != null ? Number(i.product_id) : null))
          .filter((id): id is number => typeof id === 'number' && !isNaN(id) && id > 0)
      )
    ).sort((a, b) => a - b);

    const productMap = new Map<number, { id: number; name: string; stock: number; active: boolean }>();

    for (const prodId of distinctProductIds) {
      const prodRes = await client.query(
        `SELECT id, name, stock, active FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [prodId, userId]
      );

      if (prodRes.rowCount === 0) {
        throw new Error(`El producto con ID ${prodId} no existe o no pertenece a tu cuenta.`);
      }

      const product = prodRes.rows[0];
      if (product.active === false) {
        throw new Error(`El producto "${product.name}" se encuentra desactivado y no admite nuevos movimientos.`);
      }

      productMap.set(prodId, product);
    }

    // 2. Calcular los deltas de inventario por producto
    const stockDeltas = new Map<number, number>();

    for (const item of items) {
      const itemType = item.type || defaultType;
      const itemCategory = item.category || defaultCategory || (item.product_id ? 'VENTA_PRODUCTO' : 'OTRO_INGRESO');
      const itemQty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const prodId = item.product_id != null && Number(item.product_id) > 0 ? Number(item.product_id) : null;

      if (prodId && productMap.has(prodId)) {
        if (itemType === 'ENTRADA' && itemCategory === 'VENTA_PRODUCTO') {
          const current = stockDeltas.get(prodId) || 0;
          stockDeltas.set(prodId, current - itemQty);
        } else if (
          itemType === 'SALIDA' &&
          (itemCategory === 'COMPRA_CATALOGO' || itemCategory === 'MATERIA_PRIMA')
        ) {
          const current = stockDeltas.get(prodId) || 0;
          stockDeltas.set(prodId, current + itemQty);
        }
      }
    }

    // Verificar si algún producto tiene stock insuficiente para la venta
    for (const [prodId, delta] of stockDeltas.entries()) {
      if (delta < 0) {
        const prod = productMap.get(prodId)!;
        const requiredQty = -delta;
        if (prod.stock < requiredQty) {
          throw new Error(
            `Stock insuficiente: "${prod.name}" solo tiene ${prod.stock} unidad(es) disponible(s) e intentas registrar la venta de ${requiredQty}.`
          );
        }
      }
    }

    // Aplicar las reducciones o aumentos de stock atómicamente
    for (const [prodId, delta] of stockDeltas.entries()) {
      if (delta !== 0) {
        await client.query(
          `UPDATE products SET stock = stock + $1 WHERE id = $2 AND user_id = $3`,
          [delta, prodId, userId]
        );
      }
    }

    // 3. Crear cada registro de movimiento
    const createdMovements: MovementRow[] = [];

    for (const item of items) {
      const itemType = item.type || defaultType;
      const itemCategory = item.category || defaultCategory || (item.product_id ? 'VENTA_PRODUCTO' : 'OTRO_INGRESO');
      const itemAmount = Number(item.amount);

      if (isNaN(itemAmount) || itemAmount <= 0) {
        throw new Error('El monto de cada ítem debe ser un valor mayor a cero.');
      }

      const itemQty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const prodId = item.product_id != null && Number(item.product_id) > 0 ? Number(item.product_id) : null;
      const prod = prodId ? productMap.get(prodId) : null;

      let baseDesc = (item.description || '').trim();
      if (!baseDesc) {
        if (prod) {
          baseDesc = `${itemType === 'ENTRADA' ? 'Venta' : 'Compra'}: ${prod.name}${itemQty > 1 ? ` (x${itemQty})` : ''}`;
        } else if (defaultDescription) {
          baseDesc = defaultDescription;
        } else {
          baseDesc = itemType === 'ENTRADA' ? 'Venta libre' : 'Gasto general';
        }
      }

      const itemPaymentMethod =
        item.payment_method ||
        item.paymentMethod ||
        item.medio_pago ||
        defaultPaymentMethod;

      const finalDescription = formatDescriptionWithPaymentMethod(baseDesc, itemPaymentMethod);
      const isUnplanned = item.is_unplanned ?? defaultUnplanned;
      const movementDate = item.movement_date || defaultDate;

      const movRes = await client.query(
        `
        INSERT INTO movements (user_id, type, category, amount, description, product_id, quantity, is_unplanned, movement_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::TIMESTAMPTZ, CURRENT_TIMESTAMP))
        RETURNING *
      `,
        [
          userId,
          itemType,
          itemCategory,
          itemAmount,
          finalDescription,
          prodId || null,
          itemQty,
          isUnplanned,
          movementDate,
        ]
      );

      createdMovements.push(movRes.rows[0]);
    }

    return createdMovements;
  });
}

export async function deleteMovement(userId: number, movementId: number) {
  return await withTransaction(async (client) => {
    const movRes = await client.query(
      `SELECT * FROM movements WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [movementId, userId]
    );

    if (movRes.rowCount === 0) {
      throw new Error('Movimiento no encontrado o no autorizado.');
    }

    const mov = movRes.rows[0];

    // Revertir efecto en inventario
    if (mov.product_id) {
      const prodRes = await client.query(
        `SELECT id, stock FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [mov.product_id, userId]
      );

      if (prodRes.rowCount && prodRes.rowCount > 0) {
        if (mov.type === 'ENTRADA' && mov.category === 'VENTA_PRODUCTO') {
          await client.query(
            `UPDATE products SET stock = stock + $1 WHERE id = $2 AND user_id = $3`,
            [mov.quantity, mov.product_id, userId]
          );
        } else if (
          mov.type === 'SALIDA' &&
          (mov.category === 'COMPRA_CATALOGO' || mov.category === 'MATERIA_PRIMA')
        ) {
          if (prodRes.rows[0].stock < mov.quantity) {
            throw new Error(
              `No se puede anular la compra: el stock actual (${prodRes.rows[0].stock}) es menor a la cantidad registrada (${mov.quantity}), lo que indica que las unidades ya fueron vendidas.`
            );
          }
          await client.query(
            `UPDATE products SET stock = stock - $1 WHERE id = $2 AND user_id = $3`,
            [mov.quantity, mov.product_id, userId]
          );
        }
      }
    }

    await client.query(`DELETE FROM movements WHERE id = $1 AND user_id = $2`, [
      movementId,
      userId,
    ]);
    return { ok: true, deletedId: movementId };
  });
}


export interface ReconciliationMovement {
  id: number;
  type: 'ENTRADA' | 'SALIDA';
  category: string;
  amount: number;
  description: string;
  movement_date: string;
  payment_method: string;
  method?: string;
  time?: string;
}

export interface CashReconciliationDTO {
  date: string;
  totalEntradas: number;
  totalSalidas: number;
  flujoNeto: number;
  entradasEfectivo: number;
  entradasDigital: number;
  salidasEfectivo: number;
  salidasDigital: number;
  saldoTeoricoEfectivo: number;
  saldoTeoricoDigital: number;
  // Campos de compatibilidad con frontend y componentes de auditoría
  saldoDigital?: number;
  saldo_teorico_efectivo?: number;
  saldo_digital?: number;
  total_entradas?: number;
  total_entradas_efectivo?: number;
  total_entradas_digital?: number;
  total_salidas?: number;
  total_salidas_efectivo?: number;
  total_salidas_digital?: number;
  entradas?: {
    total: number;
    efectivo: number;
    digital: number;
  };
  salidas?: {
    total: number;
    efectivo: number;
    digital: number;
  };
  movements: ReconciliationMovement[];
}

export interface ExtractedPaymentMethod {
  paymentMethod: string;
  isDigital: boolean;
}

export function extractPaymentMethod(description?: string | null): ExtractedPaymentMethod {
  if (!description || typeof description !== 'string') {
    return { paymentMethod: 'EFECTIVO', isDigital: false };
  }

  const match = description.trim().match(/^\[([^\]]+)\]/);
  if (!match) {
    return { paymentMethod: 'EFECTIVO', isDigital: false };
  }

  const rawTag = match[1].trim().toUpperCase();

  if (rawTag === 'EFECTIVO') {
    return { paymentMethod: 'EFECTIVO', isDigital: false };
  }

  const isDigital = /(TRANSFERENCIA|NEQUI|DAVIPLATA|TARJETA|BANCO|DIGITAL)/.test(rawTag);
  if (isDigital) {
    return { paymentMethod: rawTag, isDigital: true };
  }

  return { paymentMethod: 'EFECTIVO', isDigital: false };
}

function roundMoney(value: number): number {
  const rounded = Number(value.toFixed(2));
  return rounded === 0 ? 0 : rounded;
}

interface ReconciliationDbRow {
  id: number;
  type: 'ENTRADA' | 'SALIDA';
  category: string;
  amount: number;
  description: string;
  movement_date: Date | string;
}

export async function getCashReconciliation(
  userId: number,
  dateStr?: string
): Promise<CashReconciliationDTO> {
  let targetDate: string;

  if (dateStr && dateStr.trim()) {
    const trimmed = dateStr.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new Error('Formato de fecha inválido. Utilice el formato YYYY-MM-DD.');
    }
    const d = new Date(`${trimmed}T00:00:00Z`);
    if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== trimmed) {
      throw new Error('Fecha calendario inválida. Utilice el formato YYYY-MM-DD.');
    }
    targetDate = trimmed;
  } else {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    targetDate = `${year}-${month}-${day}`;
  }

  const res = await query<ReconciliationDbRow>(
    `
    SELECT 
      id,
      type,
      category,
      amount::FLOAT AS amount,
      description,
      movement_date
    FROM movements
    WHERE user_id = $1 AND movement_date::date = $2::date
    ORDER BY movement_date DESC, id DESC
    `,
    [userId, targetDate]
  );

  let rawEntradasEfectivo = 0;
  let rawEntradasDigital = 0;
  let rawSalidasEfectivo = 0;
  let rawSalidasDigital = 0;

  const movements: ReconciliationMovement[] = res.rows.map((row) => {
    const { paymentMethod, isDigital } = extractPaymentMethod(row.description);
    const amount = Number(row.amount) || 0;

    if (row.type === 'ENTRADA') {
      if (isDigital) {
        rawEntradasDigital += amount;
      } else {
        rawEntradasEfectivo += amount;
      }
    } else if (row.type === 'SALIDA') {
      if (isDigital) {
        rawSalidasDigital += amount;
      } else {
        rawSalidasEfectivo += amount;
      }
    }

    const movementDateStr =
      row.movement_date instanceof Date
        ? row.movement_date.toISOString()
        : String(row.movement_date);

    return {
      id: row.id,
      type: row.type,
      category: row.category,
      amount: roundMoney(amount),
      description: row.description,
      movement_date: movementDateStr,
      payment_method: paymentMethod,
    };
  });

  const entradasEfectivo = roundMoney(rawEntradasEfectivo);
  const entradasDigital = roundMoney(rawEntradasDigital);
  const salidasEfectivo = roundMoney(rawSalidasEfectivo);
  const salidasDigital = roundMoney(rawSalidasDigital);

  const totalEntradas = roundMoney(entradasEfectivo + entradasDigital);
  const totalSalidas = roundMoney(salidasEfectivo + salidasDigital);
  const flujoNeto = roundMoney(totalEntradas - totalSalidas);
  const saldoTeoricoEfectivo = roundMoney(entradasEfectivo - salidasEfectivo);
  const saldoTeoricoDigital = roundMoney(entradasDigital - salidasDigital);

  return {
    date: targetDate,
    totalEntradas,
    totalSalidas,
    flujoNeto,
    entradasEfectivo,
    entradasDigital,
    salidasEfectivo,
    salidasDigital,
    saldoTeoricoEfectivo,
    saldoTeoricoDigital,
    saldoDigital: saldoTeoricoDigital,
    saldo_teorico_efectivo: saldoTeoricoEfectivo,
    saldo_digital: saldoTeoricoDigital,
    total_entradas: totalEntradas,
    total_entradas_efectivo: entradasEfectivo,
    total_entradas_digital: entradasDigital,
    total_salidas: totalSalidas,
    total_salidas_efectivo: salidasEfectivo,
    total_salidas_digital: salidasDigital,
    entradas: {
      total: totalEntradas,
      efectivo: entradasEfectivo,
      digital: entradasDigital,
    },
    salidas: {
      total: totalSalidas,
      efectivo: salidasEfectivo,
      digital: salidasDigital,
    },
    movements,
  };
}

export type ExecutivePeriod = 'ESTE_MES' | 'MES_ANTERIOR' | 'ULTIMOS_30_DIAS' | 'ESTE_ANO';

export interface ExpenseCategoryBreakdown {
  category: string;
  label: string;
  amount: number;
  percentage: number;
  categoria?: string;
  nombre?: string;
  monto?: number;
  porcentaje?: number;
}

export interface UnplannedExpensesSummary {
  total: number;
  percentage: number;
}

export interface CashFlowPoint {
  fecha: string;
  etiqueta: string;
  entradas: number;
  salidas: number;
  neto: number;
}

export interface ExecutiveDashboardDTO {
  period: ExecutivePeriod;
  periodo: ExecutivePeriod;
  disponible_actual: number;
  disponible_hoy: number;
  entradas_periodo: number;
  total_entradas_periodo: number;
  salidas_periodo: number;
  total_salidas_periodo: number;
  flujo_neto_periodo: number;
  rendimiento_neto: number;
  ganancia_bruta_real: number;
  margen_bruto_pct: number;
  ventas_productos: number;
  costo_mercancia_vendida: number;
  desglose_gastos: ExpenseCategoryBreakdown[];
  gastos_no_planeados: UnplannedExpensesSummary;
  gastos_no_planeados_total: number;
  gastos_no_planeados_pct: number;
  alerta_fuga_no_planeados: {
    hay_fuga: boolean;
    total_no_planeado: number;
    porcentaje_sobre_salidas: number;
    conteo: number;
  };
  serie_flujo_caja: CashFlowPoint[];
  urgentes_count: number;
  urgentes_total: number;
  obligaciones_pendientes: {
    total_urgentes: number;
    monto_total: number;
    vencidas_conteo: number;
    items: ReminderRow[];
  };
  vision?: {
    disponible_actual: number;
    total_entradas: number;
    total_salidas: number;
    entradas_mes: number;
    salidas_mes: number;
  };
  movements?: MovementRow[];
  reminders?: ReminderRow[];
}

function getPeriodDateBounds(period: ExecutivePeriod, column = 'movement_date'): string {
  switch (period) {
    case 'ESTE_MES':
      return `${column} >= date_trunc('month', CURRENT_DATE) AND ${column} < date_trunc('day', CURRENT_DATE) + INTERVAL '1 day'`;
    case 'MES_ANTERIOR':
      return `${column} >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND ${column} < date_trunc('month', CURRENT_DATE)`;
    case 'ULTIMOS_30_DIAS':
      return `${column} >= (CURRENT_DATE - INTERVAL '30 days') AND ${column} < date_trunc('day', CURRENT_DATE) + INTERVAL '1 day'`;
    case 'ESTE_ANO':
      return `${column} >= date_trunc('year', CURRENT_DATE) AND ${column} < date_trunc('day', CURRENT_DATE) + INTERVAL '1 day'`;
    default:
      return `${column} >= date_trunc('month', CURRENT_DATE) AND ${column} < date_trunc('day', CURRENT_DATE) + INTERVAL '1 day'`;
  }
}

function getCashFlowSeriesQuery(period: ExecutivePeriod): string {
  switch (period) {
    case 'ESTE_MES':
      return `
        WITH date_series AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE)::date,
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date AS d_date
        )
        SELECT
          TO_CHAR(s.d_date, 'YYYY-MM-DD') AS fecha,
          TO_CHAR(s.d_date, 'DD Mon') AS etiqueta,
          COALESCE(SUM(CASE WHEN m.type = 'ENTRADA' THEN m.amount ELSE 0 END), 0)::FLOAT AS entradas,
          COALESCE(SUM(CASE WHEN m.type = 'SALIDA' THEN m.amount ELSE 0 END), 0)::FLOAT AS salidas,
          (COALESCE(SUM(CASE WHEN m.type = 'ENTRADA' THEN m.amount ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN m.type = 'SALIDA' THEN m.amount ELSE 0 END), 0))::FLOAT AS neto
        FROM date_series s
        LEFT JOIN movements m
          ON m.movement_date::date = s.d_date AND m.user_id = $1
        GROUP BY s.d_date
        ORDER BY s.d_date ASC
      `;
    case 'MES_ANTERIOR':
      return `
        WITH date_series AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date,
            (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date,
            INTERVAL '1 day'
          )::date AS d_date
        )
        SELECT
          TO_CHAR(s.d_date, 'YYYY-MM-DD') AS fecha,
          TO_CHAR(s.d_date, 'DD Mon') AS etiqueta,
          COALESCE(SUM(CASE WHEN m.type = 'ENTRADA' THEN m.amount ELSE 0 END), 0)::FLOAT AS entradas,
          COALESCE(SUM(CASE WHEN m.type = 'SALIDA' THEN m.amount ELSE 0 END), 0)::FLOAT AS salidas,
          (COALESCE(SUM(CASE WHEN m.type = 'ENTRADA' THEN m.amount ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN m.type = 'SALIDA' THEN m.amount ELSE 0 END), 0))::FLOAT AS neto
        FROM date_series s
        LEFT JOIN movements m
          ON m.movement_date::date = s.d_date AND m.user_id = $1
        GROUP BY s.d_date
        ORDER BY s.d_date ASC
      `;
    case 'ULTIMOS_30_DIAS':
      return `
        WITH date_series AS (
          SELECT generate_series(
            (CURRENT_DATE - INTERVAL '30 days')::date,
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date AS d_date
        )
        SELECT
          TO_CHAR(s.d_date, 'YYYY-MM-DD') AS fecha,
          TO_CHAR(s.d_date, 'DD Mon') AS etiqueta,
          COALESCE(SUM(CASE WHEN m.type = 'ENTRADA' THEN m.amount ELSE 0 END), 0)::FLOAT AS entradas,
          COALESCE(SUM(CASE WHEN m.type = 'SALIDA' THEN m.amount ELSE 0 END), 0)::FLOAT AS salidas,
          (COALESCE(SUM(CASE WHEN m.type = 'ENTRADA' THEN m.amount ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN m.type = 'SALIDA' THEN m.amount ELSE 0 END), 0))::FLOAT AS neto
        FROM date_series s
        LEFT JOIN movements m
          ON m.movement_date::date = s.d_date AND m.user_id = $1
        GROUP BY s.d_date
        ORDER BY s.d_date ASC
      `;
    case 'ESTE_ANO':
      return `
        WITH month_series AS (
          SELECT generate_series(
            date_trunc('year', CURRENT_DATE)::date,
            date_trunc('month', CURRENT_DATE)::date,
            INTERVAL '1 month'
          ) AS m_date
        )
        SELECT
          TO_CHAR(s.m_date, 'YYYY-MM') AS fecha,
          TO_CHAR(s.m_date, 'Mon YYYY') AS etiqueta,
          COALESCE(SUM(CASE WHEN m.type = 'ENTRADA' THEN m.amount ELSE 0 END), 0)::FLOAT AS entradas,
          COALESCE(SUM(CASE WHEN m.type = 'SALIDA' THEN m.amount ELSE 0 END), 0)::FLOAT AS salidas,
          (COALESCE(SUM(CASE WHEN m.type = 'ENTRADA' THEN m.amount ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN m.type = 'SALIDA' THEN m.amount ELSE 0 END), 0))::FLOAT AS neto
        FROM month_series s
        LEFT JOIN movements m
          ON date_trunc('month', m.movement_date) = s.m_date AND m.user_id = $1
        GROUP BY s.m_date
        ORDER BY s.m_date ASC
      `;
  }
}

interface PeriodTotalsDbRow {
  entradas_periodo: number;
  salidas_periodo: number;
  total_unplanned: number;
}

interface GrossProfitDbRow {
  ventas_productos: number;
  costo_mercancia_vendida: number;
  ganancia_bruta_real: number;
}

interface ExpenseCategoryDbRow {
  category: string;
  amount: number;
}

interface CashFlowPointDbRow {
  fecha: string;
  etiqueta: string;
  entradas: number;
  salidas: number;
  neto: number;
}

export async function getExecutiveDashboardData(
  userId: number,
  period: string = 'ESTE_MES'
): Promise<ExecutiveDashboardDTO> {
  if (!userId || typeof userId !== 'number' || isNaN(userId) || userId <= 0) {
    throw new Error('Identificador de usuario inválido.');
  }

  const VALID_PERIODS: readonly ExecutivePeriod[] = [
    'ESTE_MES',
    'MES_ANTERIOR',
    'ULTIMOS_30_DIAS',
    'ESTE_ANO',
  ] as const;

  const normalizedInput = (period || '').toUpperCase().replace(/-/g, '_') as ExecutivePeriod;
  const validPeriod: ExecutivePeriod = VALID_PERIODS.includes(normalizedInput) ? normalizedInput : 'ESTE_MES';

  const [
    vision,
    periodTotalsRes,
    grossProfitRes,
    expenseCategoriesRes,
    seriesRes,
    activeReminders,
    recentMovements,
  ] = await Promise.all([
    getCashVision(userId),
    query<PeriodTotalsDbRow>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'ENTRADA' THEN amount ELSE 0 END), 0)::FLOAT AS entradas_periodo,
        COALESCE(SUM(CASE WHEN type = 'SALIDA' THEN amount ELSE 0 END), 0)::FLOAT AS salidas_periodo,
        COALESCE(SUM(CASE WHEN type = 'SALIDA' AND (is_unplanned = TRUE OR category = 'GASTO_NO_PLANEADO') THEN amount ELSE 0 END), 0)::FLOAT AS total_unplanned
      FROM movements
      WHERE user_id = $1
        AND ${getPeriodDateBounds(validPeriod, 'movement_date')}
      `,
      [userId]
    ),
    query<GrossProfitDbRow>(
      `
      SELECT
        COALESCE(SUM(m.amount), 0)::FLOAT AS ventas_productos,
        COALESCE(SUM(
          CASE
            WHEN m.product_id IS NOT NULL AND p.id IS NOT NULL
              THEN (COALESCE(p.unit_cost, 0) + COALESCE(p.extra_cost, 0)) * COALESCE(m.quantity, 1)
            ELSE 0
          END
        ), 0)::FLOAT AS costo_mercancia_vendida,
        COALESCE(SUM(
          CASE
            WHEN m.product_id IS NOT NULL AND p.id IS NOT NULL
              THEN m.amount - ((COALESCE(p.unit_cost, 0) + COALESCE(p.extra_cost, 0)) * COALESCE(m.quantity, 1))
            ELSE m.amount
          END
        ), 0)::FLOAT AS ganancia_bruta_real
      FROM movements m
      LEFT JOIN products p ON m.product_id = p.id AND p.user_id = $1
      WHERE m.user_id = $1
        AND m.type = 'ENTRADA'
        AND m.category = 'VENTA_PRODUCTO'
        AND ${getPeriodDateBounds(validPeriod, 'm.movement_date')}
      `,
      [userId]
    ),
    query<ExpenseCategoryDbRow>(
      `
      SELECT
        category,
        COALESCE(SUM(amount), 0)::FLOAT AS amount
      FROM movements
      WHERE user_id = $1
        AND type = 'SALIDA'
        AND ${getPeriodDateBounds(validPeriod, 'movement_date')}
      GROUP BY category
      ORDER BY amount DESC
      `,
      [userId]
    ),
    query<CashFlowPointDbRow>(getCashFlowSeriesQuery(validPeriod), [userId]),
    getActiveReminders(userId),
    getRecentMovements(userId, 40),
  ]);

  const totalsRow = periodTotalsRes.rows[0] || {
    entradas_periodo: 0,
    salidas_periodo: 0,
    total_unplanned: 0,
  };
  const entradas_periodo = roundMoney(Number(totalsRow.entradas_periodo) || 0);
  const salidas_periodo = roundMoney(Number(totalsRow.salidas_periodo) || 0);
  const flujo_neto_periodo = roundMoney(entradas_periodo - salidas_periodo);

  const gpRow = grossProfitRes.rows[0] || {
    ventas_productos: 0,
    costo_mercancia_vendida: 0,
    ganancia_bruta_real: 0,
  };
  const ventas_productos = roundMoney(Number(gpRow.ventas_productos) || 0);
  const costo_mercancia_vendida = roundMoney(Number(gpRow.costo_mercancia_vendida) || 0);
  const ganancia_bruta_real = roundMoney(Number(gpRow.ganancia_bruta_real) || 0);
  const margen_bruto_pct =
    ventas_productos > 0 ? roundMoney((ganancia_bruta_real / ventas_productos) * 100) : 0;

  const total_unplanned = roundMoney(Number(totalsRow.total_unplanned) || 0);
  const pct_unplanned =
    salidas_periodo > 0 ? roundMoney((total_unplanned / salidas_periodo) * 100) : 0;

  const desglose_gastos: ExpenseCategoryBreakdown[] = expenseCategoriesRes.rows.map((r) => {
    const amt = roundMoney(Number(r.amount) || 0);
    const pct = salidas_periodo > 0 ? roundMoney((amt / salidas_periodo) * 100) : 0;
    const label = formatCategory(r.category);
    return {
      category: r.category,
      label,
      amount: amt,
      percentage: pct,
      categoria: r.category,
      nombre: label,
      monto: amt,
      porcentaje: pct,
    };
  });

  const gastos_no_planeados: UnplannedExpensesSummary = {
    total: total_unplanned,
    percentage: pct_unplanned,
  };

  const serie_flujo_caja: CashFlowPoint[] = seriesRes.rows.map((r) => ({
    fecha: String(r.fecha),
    etiqueta: String(r.etiqueta),
    entradas: roundMoney(Number(r.entradas) || 0),
    salidas: roundMoney(Number(r.salidas) || 0),
    neto: roundMoney(Number(r.neto) || 0),
  }));

  const urgentList = activeReminders.filter(
    (r) => !r.is_completed && Number(r.days_remaining) <= 3
  );
  const urgentes_count = urgentList.length;
  const urgentes_total = roundMoney(
    urgentList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  );

  return {
    period: validPeriod,
    periodo: validPeriod,
    disponible_actual: roundMoney(vision.disponible_actual),
    disponible_hoy: roundMoney(vision.disponible_actual),
    entradas_periodo,
    total_entradas_periodo: entradas_periodo,
    salidas_periodo,
    total_salidas_periodo: salidas_periodo,
    flujo_neto_periodo,
    rendimiento_neto: flujo_neto_periodo,
    ganancia_bruta_real,
    margen_bruto_pct,
    ventas_productos,
    costo_mercancia_vendida,
    desglose_gastos,
    gastos_no_planeados,
    gastos_no_planeados_total: total_unplanned,
    gastos_no_planeados_pct: pct_unplanned,
    alerta_fuga_no_planeados: {
      hay_fuga: total_unplanned > 0,
      total_no_planeado: total_unplanned,
      porcentaje_sobre_salidas: pct_unplanned,
      conteo: total_unplanned > 0 ? 1 : 0,
    },
    serie_flujo_caja,
    urgentes_count,
    urgentes_total,
    obligaciones_pendientes: {
      total_urgentes: urgentes_count,
      monto_total: urgentes_total,
      vencidas_conteo: urgentList.filter((r) => Number(r.days_remaining) < 0).length,
      items: urgentList,
    },
    vision,
    movements: recentMovements,
    reminders: activeReminders,
  };
}
