import { query } from '@/bd/connection';
import { getProductsWithMetrics, ProductMetricRow } from '../products/service';

export interface BusinessAlert {
  id: string;
  level: 'DANGER' | 'WARNING' | 'INFO';
  scope: 'INVENTARIO' | 'GASTOS' | 'LIQUIDEZ';
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
}

export interface AlertsResponseDTO {
  totalCount: number;
  dangerCount: number;
  warningCount: number;
  infoCount: number;
  alerts: BusinessAlert[];
}

interface InventoryAlertRow {
  id: number;
  name: string;
  stock: number;
  units_sold_30d: number;
}

interface ExpenseComparisonRow {
  category: string;
  current_month: number;
  prev_month: number;
  current_week: number;
  prev_week: number;
}

interface UnplannedExpensesRow {
  total_unplanned_month: number;
  count_unplanned: number;
}

interface ReminderDueRow {
  id: number;
  title: string;
  amount: number;
  due_date: string;
  days_remaining: number;
}

interface CashBalanceRow {
  disponible_actual: number;
}

function formatCurrency(amount: number): string {
  return Math.round(amount).toLocaleString('es-CO');
}

function formatCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    GASTO_GENERAL: 'Gasto General',
    COMPRA_CATALOGO: 'Compra de Catálogo',
    MATERIA_PRIMA: 'Materia Prima',
    SERVICIOS_ARRIENDO: 'Servicios y Arriendo',
    GASTO_NO_PLANEADO: 'Gasto No Planeado',
    RETIRO_PERSONAL: 'Retiro Personal',
  };
  return map[category] || category.replace(/_/g, ' ');
}

/**
 * Genera alertas analíticas automáticas del negocio por inquilino (multi-tenant estricto).
 *
 * Scopes cubiertos:
 * 1. INVENTARIO: Stock crítico (<= 2 warning, 0 danger) y productos estancados sin ventas en 30 días.
 * 2. GASTOS: Saltos inusuales (>20% mensual, >15% semanal) y fugas de gastos no planeados.
 * 3. LIQUIDEZ: Obligaciones por vencer en <= 3 días o vencidas, alertando riesgo si superan la caja disponible.
 */
export async function getBusinessAlerts(userId: number): Promise<AlertsResponseDTO> {
  if (!userId || typeof userId !== 'number' || userId <= 0 || !Number.isInteger(userId)) {
    throw new Error('userId inválido o no proporcionado.');
  }

  const alerts: BusinessAlert[] = [];

  // Ejecutamos consultas optimizadas en paralelo filtradas estrictamente por user_id
  const [
    inventoryRes,
    expensesRes,
    unplannedRes,
    remindersRes,
    cashRes,
  ] = await Promise.all([
    // 1. INVENTARIO: Stock actual y unidades vendidas en los últimos 30 días
    query<InventoryAlertRow>(
      `
      SELECT 
        p.id,
        p.name,
        p.stock,
        COALESCE(SUM(CASE 
          WHEN m.type = 'ENTRADA' 
           AND m.category = 'VENTA_PRODUCTO' 
           AND m.movement_date >= CURRENT_TIMESTAMP - INTERVAL '30 days' 
          THEN m.quantity 
          ELSE 0 
        END), 0)::INT AS units_sold_30d
      FROM products p
      LEFT JOIN movements m ON p.id = m.product_id AND m.user_id = $1
      WHERE p.user_id = $1 AND p.active = TRUE
      GROUP BY p.id, p.name, p.stock
      ORDER BY p.stock ASC, p.name ASC
      `,
      [userId]
    ),

    // 2. GASTOS: Comparación mes actual vs anterior y semana actual vs previa por categoría
    query<ExpenseComparisonRow>(
      `
      SELECT 
        category,
        COALESCE(SUM(CASE WHEN movement_date >= date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS current_month,
        COALESCE(SUM(CASE WHEN movement_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' 
                           AND movement_date < date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS prev_month,
        COALESCE(SUM(CASE WHEN movement_date >= date_trunc('week', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS current_week,
        COALESCE(SUM(CASE WHEN movement_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' 
                           AND movement_date < date_trunc('week', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS prev_week
      FROM movements
      WHERE type = 'SALIDA' 
        AND user_id = $1
        AND movement_date >= LEAST(date_trunc('month', CURRENT_DATE) - INTERVAL '1 month', date_trunc('week', CURRENT_DATE) - INTERVAL '1 week')
      GROUP BY category
      `,
      [userId]
    ),

    // 3. GASTOS: Fuga de gastos imprevistos / no planeados del mes corriente
    query<UnplannedExpensesRow>(
      `
      SELECT 
        COALESCE(SUM(amount), 0)::FLOAT AS total_unplanned_month,
        COUNT(id)::INT AS count_unplanned
      FROM movements
      WHERE type = 'SALIDA'
        AND user_id = $1
        AND (is_unplanned = TRUE OR category = 'GASTO_NO_PLANEADO')
        AND movement_date >= date_trunc('month', CURRENT_DATE)
      `,
      [userId]
    ),

    // 4. LIQUIDEZ: Obligaciones pendientes vencidas o por vencer en 3 días o menos
    query<ReminderDueRow>(
      `
      SELECT 
        id,
        title,
        amount::FLOAT AS amount,
        TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date,
        (due_date - CURRENT_DATE)::INT AS days_remaining
      FROM reminders
      WHERE user_id = $1
        AND is_completed = FALSE
        AND (due_date - CURRENT_DATE) <= 3
      ORDER BY due_date ASC
      `,
      [userId]
    ),

    // 5. CAJA: Saldo disponible actual (entradas acumuladas - salidas acumuladas)
    query<CashBalanceRow>(
      `
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'ENTRADA' THEN amount ELSE -amount END), 0)::FLOAT AS disponible_actual
      FROM movements
      WHERE user_id = $1
      `,
      [userId]
    ),
  ]);

  // --- REGLAS DE NEGOCIO ---

  // 1 & 2. INVENTARIO
  for (const prod of inventoryRes.rows) {
    // 1. Stock Crítico
    if (prod.stock === 0) {
      alerts.push({
        id: `stock-empty-${prod.id}`,
        level: 'DANGER',
        scope: 'INVENTARIO',
        title: `Agotado: "${prod.name}"`,
        detail: `El producto "${prod.name}" tiene 0 unidades en inventario. Las nuevas ventas están en riesgo de quiebre.`,
        actionLabel: 'Ver Productos',
        actionHref: '/productos',
      });
    } else if (prod.stock <= 2) {
      alerts.push({
        id: `stock-critical-${prod.id}`,
        level: 'WARNING',
        scope: 'INVENTARIO',
        title: `Stock crítico: "${prod.name}"`,
        detail: `Solo quedan ${prod.stock} unidad(es) de "${prod.name}". Se sugiere reabastecer pronto.`,
        actionLabel: 'Ver Productos',
        actionHref: '/productos',
      });
    }

    // 2. Producto Estancado / Sin Rotación en 30 días
    if (prod.stock > 0 && prod.units_sold_30d === 0) {
      alerts.push({
        id: `inventory-stagnant-${prod.id}`,
        level: 'WARNING',
        scope: 'INVENTARIO',
        title: `Sin rotación (30 días): "${prod.name}"`,
        detail: `Cuentas con ${prod.stock} unidad(es) de "${prod.name}" sin ventas registradas en los últimos 30 días.`,
        actionLabel: 'Ver Inventario',
        actionHref: '/productos',
      });
    }
  }

  // 3. GASTOS: Salto inusual de gasto
  for (const row of expensesRes.rows) {
    const categoryLabel = formatCategoryLabel(row.category);

    // Salto mensual > 20%
    if (row.prev_month > 0 && row.current_month > row.prev_month * 1.2) {
      const pct = Math.round(((row.current_month - row.prev_month) / row.prev_month) * 100);
      alerts.push({
        id: `expense-spike-month-${row.category}`,
        level: 'DANGER',
        scope: 'GASTOS',
        title: `Salto inusual de gasto mensual: ${categoryLabel}`,
        detail: `En el mes corriente se han consumido $${formatCurrency(row.current_month)} en ${categoryLabel}, superando en un ${pct}% el total del mes anterior ($${formatCurrency(row.prev_month)}).`,
        actionLabel: 'Ver Movimientos',
        actionHref: '/movimientos',
      });
    }

    // Salto semanal > 15%
    if (row.prev_week > 0 && row.current_week > row.prev_week * 1.15) {
      const pct = Math.round(((row.current_week - row.prev_week) / row.prev_week) * 100);
      alerts.push({
        id: `expense-spike-week-${row.category}`,
        level: 'WARNING',
        scope: 'GASTOS',
        title: `Salto inusual de gasto semanal: ${categoryLabel}`,
        detail: `Esta semana se han registrado $${formatCurrency(row.current_week)} en ${categoryLabel}, un ${pct}% más que la semana previa ($${formatCurrency(row.prev_week)}).`,
        actionLabel: 'Ver Movimientos',
        actionHref: '/movimientos',
      });
    }
  }

  // 4. GASTOS: Fuga de gastos no planeados
  const unplannedTotal = Number(unplannedRes.rows[0]?.total_unplanned_month ?? 0);
  const unplannedCount = Number(unplannedRes.rows[0]?.count_unplanned ?? 0);

  if (unplannedTotal >= 100000 || unplannedCount >= 4) {
    alerts.push({
      id: 'unplanned-expenses-leak',
      level: 'WARNING',
      scope: 'GASTOS',
      title: 'Fuga de Dinero: Gastos no planeados recurrentes',
      detail: `Llevas $${formatCurrency(unplannedTotal)} distribuidos en ${unplannedCount} salida(s) imprevista(s) este mes. Supera el umbral presupuestal establecido.`,
      actionLabel: 'Auditar Gastos',
      actionHref: '/movimientos',
    });
  }

  // 5. LIQUIDEZ: Obligaciones próximas o vencidas vs saldo disponible de caja
  const remindersDue = remindersRes.rows;
  if (remindersDue.length > 0) {
    const totalObligations = remindersDue.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const availableCash = Number(cashRes.rows[0]?.disponible_actual ?? 0);
    const isDeficit = totalObligations > availableCash;

    const overdueCount = remindersDue.filter((r) => r.days_remaining < 0).length;
    const upcomingCount = remindersDue.length - overdueCount;

    let detailSummary = '';
    if (overdueCount > 0 && upcomingCount > 0) {
      detailSummary = `${remindersDue.length} obligaciones pendientes (${overdueCount} vencida(s) y ${upcomingCount} por vencer en ≤ 3 días)`;
    } else if (overdueCount > 0) {
      detailSummary = `${overdueCount} obligación(es) ya vencida(s)`;
    } else {
      detailSummary = `${upcomingCount} obligación(es) por vencer en los próximos 3 días`;
    }

    if (isDeficit) {
      const deficitAmount = totalObligations - availableCash;
      alerts.push({
        id: 'liquidity-risk-obligations',
        level: 'DANGER',
        scope: 'LIQUIDEZ',
        title: 'Riesgo Crítico de Liquidez: Obligaciones superan caja',
        detail: `Tienes ${detailSummary} por $${formatCurrency(totalObligations)}, superando tu saldo disponible en caja ($${formatCurrency(availableCash)}). Déficit proyectado: $${formatCurrency(deficitAmount)}.`,
        actionLabel: 'Ver Pagos Recurrentes',
        actionHref: '/recordatorios',
      });
    } else {
      alerts.push({
        id: 'liquidity-upcoming-obligations',
        level: 'WARNING',
        scope: 'LIQUIDEZ',
        title: 'Obligaciones de pago próximas o vencidas',
        detail: `Tienes ${detailSummary} por un total de $${formatCurrency(totalObligations)}. Tu caja actual disponible es de $${formatCurrency(availableCash)}.`,
        actionLabel: 'Ver Pagos Recurrentes',
        actionHref: '/recordatorios',
      });
    }
  }

  // Ordenar alertas: primero DANGER, luego WARNING, luego INFO
  const LEVEL_WEIGHT: Record<BusinessAlert['level'], number> = {
    DANGER: 0,
    WARNING: 1,
    INFO: 2,
  };

  alerts.sort((a, b) => LEVEL_WEIGHT[a.level] - LEVEL_WEIGHT[b.level]);

  const dangerCount = alerts.filter((a) => a.level === 'DANGER').length;
  const warningCount = alerts.filter((a) => a.level === 'WARNING').length;
  const infoCount = alerts.filter((a) => a.level === 'INFO').length;

  return {
    totalCount: alerts.length,
    dangerCount,
    warningCount,
    infoCount,
    alerts,
  };
}

// ==========================================
// Compatibilidad con funciones analíticas previas
// ==========================================

export interface SmartAlert {
  id: string;
  level: 'DANGER' | 'WARNING' | 'SUCCESS' | 'INFO';
  scope: 'GASTOS' | 'PRODUCTOS';
  title: string;
  detail: string;
}

export interface ProductInsights {
  masVendido: ProductMetricRow | null;
  menosVendido: ProductMetricRow | null;
  masRentable: ProductMetricRow | null;
  menosRentable: ProductMetricRow | null;
}

export async function generateSmartAlerts(userId: number): Promise<{
  alerts: SmartAlert[];
  productInsights: ProductInsights;
}> {
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    throw new Error('userId inválido o no proporcionado.');
  }

  const alerts: SmartAlert[] = [];

  const weeklyComparison = await query(
    `
    SELECT 
      category,
      COALESCE(SUM(CASE WHEN movement_date >= date_trunc('week', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS current_week,
      COALESCE(SUM(CASE WHEN movement_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' 
                         AND movement_date < date_trunc('week', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS prev_week
    FROM movements
    WHERE type = 'SALIDA' AND user_id = $1
      AND movement_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '1 week'
    GROUP BY category
  `,
    [userId]
  );

  for (const row of weeklyComparison.rows) {
    if (row.prev_week > 0 && row.current_week > row.prev_week * 1.15) {
      const pct = Math.round(((row.current_week - row.prev_week) / row.prev_week) * 100);
      alerts.push({
        id: `week-spike-${row.category}`,
        level: 'WARNING',
        scope: 'GASTOS',
        title: `Gasto semanal elevado en ${row.category}`,
        detail: `Esta semana llevas $${row.current_week.toLocaleString()} en ${row.category}, un ${pct}% más que la semana pasada ($${row.prev_week.toLocaleString()}).`,
      });
    } else if (row.prev_week === 0 && row.current_week >= 50000) {
      alerts.push({
        id: `week-new-${row.category}`,
        level: 'INFO',
        scope: 'GASTOS',
        title: `Nuevo gasto semanal en ${row.category}`,
        detail: `Esta semana se han registrado $${row.current_week.toLocaleString()} en ${row.category} (la semana anterior fue $0).`,
      });
    }
  }

  const monthlyComparison = await query(
    `
    SELECT 
      category,
      COALESCE(SUM(CASE WHEN movement_date >= date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS current_month,
      COALESCE(SUM(CASE WHEN movement_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' 
                         AND movement_date < date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS prev_month
    FROM movements
    WHERE type = 'SALIDA' AND user_id = $1
      AND movement_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
    GROUP BY category
  `,
    [userId]
  );

  for (const row of monthlyComparison.rows) {
    if (row.prev_month > 0 && row.current_month > row.prev_month * 1.2) {
      const pct = Math.round(((row.current_month - row.prev_month) / row.prev_month) * 100);
      alerts.push({
        id: `month-spike-${row.category}`,
        level: 'DANGER',
        scope: 'GASTOS',
        title: `Alerta Mensual: Salto de gasto en ${row.category}`,
        detail: `En el mes corriente se han consumido $${row.current_month.toLocaleString()} en ${row.category}, superando en un ${pct}% el total del mes anterior ($${row.prev_month.toLocaleString()}).`,
      });
    }
  }

  const unplannedExpenses = await query(
    `
    SELECT 
      COALESCE(SUM(amount), 0)::FLOAT AS total_unplanned_month,
      COUNT(id)::INT AS count_unplanned
    FROM movements
    WHERE type = 'SALIDA'
      AND user_id = $1
      AND (is_unplanned = TRUE OR category = 'GASTO_NO_PLANEADO')
      AND movement_date >= date_trunc('month', CURRENT_DATE)
  `,
    [userId]
  );

  const unplannedTotal = unplannedExpenses.rows[0]?.total_unplanned_month || 0;
  const unplannedCount = unplannedExpenses.rows[0]?.count_unplanned || 0;

  if (unplannedTotal >= 100000 || unplannedCount >= 4) {
    alerts.push({
      id: 'unplanned-leak-month',
      level: 'WARNING',
      scope: 'GASTOS',
      title: 'Fuga de Dinero: Gastos no planeados recurrentes',
      detail: `Llevas $${unplannedTotal.toLocaleString()} distribuidos en ${unplannedCount} salidas imprevistas este mes. Considera presupuestar una reserva de contingencia.`,
    });
  }

  const products = await getProductsWithMetrics(userId);
  const productInsights: ProductInsights = {
    masVendido: null,
    menosVendido: null,
    masRentable: null,
    menosRentable: null,
  };

  if (products.length > 0) {
    const sortedBySales = [...products].sort((a, b) => b.units_sold - a.units_sold);
    const sortedByProfit = [...products].sort((a, b) => b.unit_profit - a.unit_profit);

    if (sortedBySales[0]?.units_sold > 0) {
      productInsights.masVendido = sortedBySales[0];
      const withZeroOrLow = sortedBySales.filter((p) => p.units_sold === 0);
      productInsights.menosVendido = withZeroOrLow[0] || sortedBySales[sortedBySales.length - 1];
    }

    productInsights.masRentable = sortedByProfit[0];
    productInsights.menosRentable = sortedByProfit[sortedByProfit.length - 1];

    for (const p of products) {
      if (p.active && p.stock <= 2 && p.stock > 0) {
        alerts.push({
          id: `stock-low-${p.id}`,
          level: 'WARNING',
          scope: 'PRODUCTOS',
          title: `Stock bajo en "${p.name}"`,
          detail: `Solo quedan ${p.stock} unidad(es) física(s) disponible(s). Si es un producto con alta rotación, reabastécelo antes de que se agote.`,
        });
      } else if (p.active && p.stock === 0) {
        alerts.push({
          id: `stock-empty-${p.id}`,
          level: 'DANGER',
          scope: 'PRODUCTOS',
          title: `Agotado: "${p.name}"`,
          detail: `El producto está agotado en inventario. Las nuevas ventas están bloqueadas para evitar sobreventas.`,
        });
      }

      if (p.active && p.unit_profit <= 0) {
        alerts.push({
          id: `profit-negative-${p.id}`,
          level: 'DANGER',
          scope: 'PRODUCTOS',
          title: `Margen en pérdida: "${p.name}"`,
          detail: `El precio de venta ($${p.sale_price.toLocaleString()}) es menor o igual al costo total ($${p.total_unit_cost.toLocaleString()}). Pierdes dinero con cada unidad.`,
        });
      }
    }
  }

  return {
    alerts,
    productInsights,
  };
}
