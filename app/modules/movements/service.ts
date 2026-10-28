import { query, withTransaction } from '@/bd/connection';
import { MovementInput, MovementBatchItem } from '@/lib/schemas';

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
