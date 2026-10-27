import { query } from '@/bd/connection';
import { getProductsWithMetrics } from '../products/service';

export interface SmartAlert {
  id: string;
  level: 'DANGER' | 'WARNING' | 'SUCCESS' | 'INFO';
  scope: 'GASTOS' | 'PRODUCTOS';
  title: string;
  detail: string;
}

export async function generateSmartAlerts(userId: number = 1): Promise<{
  alerts: SmartAlert[];
  productInsights: Record<string, any>;
}> {
  const alerts: SmartAlert[] = [];

  // 1. ALERTA DE GASTOS: Comparación por categoría (Semana actual vs Semana pasada)
  const weeklyComparison = await query(
    `
    SELECT 
      category,
      COALESCE(SUM(CASE WHEN movement_date >= date_trunc('week', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS current_week,
      COALESCE(SUM(CASE WHEN movement_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' 
                         AND movement_date < date_trunc('week', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS prev_week
    FROM movements
    WHERE type = 'SALIDA' AND user_id = $1
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

  // 2. ALERTA DE GASTOS: Comparación por categoría (Mes actual vs Mes pasado)
  const monthlyComparison = await query(
    `
    SELECT 
      category,
      COALESCE(SUM(CASE WHEN movement_date >= date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS current_month,
      COALESCE(SUM(CASE WHEN movement_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' 
                         AND movement_date < date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS prev_month
    FROM movements
    WHERE type = 'SALIDA' AND user_id = $1
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

  // 3. ALERTA DE GASTOS HORMIGA / NO PLANEADOS
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

  // 4. INTELIGENCIA Y ALERTAS DE PRODUCTOS
  const products = await getProductsWithMetrics(userId);
  const productInsights: Record<string, any> = {
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
