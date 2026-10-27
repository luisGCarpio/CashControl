import { query } from '@/bd/connection';
import { getProductsWithMetrics } from '../products/service';

export interface SmartAlert {
  id: string;
  level: 'DANGER' | 'WARNING' | 'SUCCESS' | 'INFO';
  scope: 'GASTOS' | 'PRODUCTOS';
  title: string;
  detail: string;
}

export async function generateSmartAlerts(): Promise<{
  alerts: SmartAlert[];
  productInsights: Record<string, any>;
}> {
  const alerts: SmartAlert[] = [];

  // 1. ALERTA DE GASTOS: Comparación por categoría (Semana actual vs Semana pasada)
  const weeklyComparison = await query(`
    SELECT 
      category,
      COALESCE(SUM(CASE WHEN movement_date >= date_trunc('week', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS current_week,
      COALESCE(SUM(CASE WHEN movement_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' 
                         AND movement_date < date_trunc('week', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS prev_week
    FROM movements
    WHERE type = 'SALIDA'
    GROUP BY category
  `);

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
  const monthlyComparison = await query(`
    SELECT 
      category,
      COALESCE(SUM(CASE WHEN movement_date >= date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS current_month,
      COALESCE(SUM(CASE WHEN movement_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' 
                         AND movement_date < date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS prev_month
    FROM movements
    WHERE type = 'SALIDA'
    GROUP BY category
  `);

  for (const row of monthlyComparison.rows) {
    if (row.prev_month > 0 && row.current_month > row.prev_month * 1.15) {
      const pct = Math.round(((row.current_month - row.prev_month) / row.prev_month) * 100);
      alerts.push({
        id: `month-spike-${row.category}`,
        level: 'DANGER',
        scope: 'GASTOS',
        title: `Superaste el gasto del mes pasado en ${row.category}`,
        detail: `Este mes has gastado $${row.current_month.toLocaleString()} (+${pct}% frente a los $${row.prev_month.toLocaleString()} del mes anterior).`,
      });
    } else if (row.prev_month === 0 && row.current_month >= 100000) {
      alerts.push({
        id: `month-new-${row.category}`,
        level: 'WARNING',
        scope: 'GASTOS',
        title: `Gasto no registrado el mes anterior en ${row.category}`,
        detail: `Este mes llevas $${row.current_month.toLocaleString()} en ${row.category} (el mes pasado fue $0). Monitorea este rubro.`,
      });
    }
  }

  // 3. ALERTA DE GASTOS NO PLANEADOS / HORMIGA (Últimos 14 días)
  const unplannedRes = await query(`
    SELECT 
      COUNT(*)::INT AS count,
      COALESCE(SUM(amount), 0)::FLOAT AS total
    FROM movements
    WHERE type = 'SALIDA' 
      AND (is_unplanned = TRUE OR category = 'GASTO_NO_PLANEADO')
      AND movement_date >= CURRENT_DATE - INTERVAL '14 days'
  `);

  const unplanned = unplannedRes.rows[0];
  if (unplanned.count >= 3 || unplanned.total >= 100000) {
    alerts.push({
      id: 'unplanned-recurring',
      level: 'DANGER',
      scope: 'GASTOS',
      title: `Fuga de dinero: ${unplanned.count} gastos no planeados recientes`,
      detail: `En los últimos 14 días has registrado $${unplanned.total.toLocaleString()} en ${unplanned.count} salidas imprevistas. Controla estos gastos hormiga para no vaciar la caja.`,
    });
  }

  // 4. INTELIGENCIA Y ALERTAS DE PRODUCTOS
  const products = await getProductsWithMetrics();
  const productInsights: Record<string, any> = {
    masVendido: null,
    menosVendido: null,
    masRentable: null,
    menosRentable: null,
    enPerdida: [],
    potencialMasDinero: [],
  };

  if (products.length > 0) {
    // Más vendido y menos vendido (solo sobre productos con al menos 1 venta)
    const withSales = products.filter((p) => p.units_sold > 0);
    if (withSales.length > 0) {
      const bySales = [...withSales].sort((a, b) => b.units_sold - a.units_sold);
      productInsights.masVendido = bySales[0];
      if (bySales.length > 1) {
        productInsights.menosVendido = bySales[bySales.length - 1];
      }
    }

    // Más rentable y menos rentable por ganancia neta por unidad
    const byProfit = [...products].sort((a, b) => b.unit_profit - a.unit_profit);
    productInsights.masRentable = byProfit[0];
    if (byProfit.length > 1) {
      productInsights.menosRentable = byProfit[byProfit.length - 1];
    }

    // ¿A cuál producto le pierdo dinero? (Venta por debajo del costo unitario real)
    const lossMaking = products.filter((p) => p.unit_profit <= 0);
    productInsights.enPerdida = lossMaking;

    for (const lp of lossMaking) {
      alerts.push({
        id: `loss-unit-${lp.id}`,
        level: 'DANGER',
        scope: 'PRODUCTOS',
        title: `Pierdes dinero con cada venta de "${lp.name}"`,
        detail: `Producirlo/comprarlo cuesta $${lp.total_unit_cost.toLocaleString()} y lo vendes en $${lp.sale_price.toLocaleString()} (Resultado: -$${Math.abs(lp.unit_profit).toLocaleString()} por unidad). Ajusta su precio inmediatamente.`,
      });
    }

    // Alerta de inventario retenido (inversión en stock pendiente por amortizar)
    const slowMoving = products.filter(
      (p) => p.direct_investment > p.total_revenue && p.stock > 0 && p.unit_profit > 0
    );
    for (const sm of slowMoving) {
      const gap = sm.direct_investment - sm.total_revenue;
      if (gap > 80000) {
        alerts.push({
          id: `inventory-slow-${sm.id}`,
          level: 'WARNING',
          scope: 'PRODUCTOS',
          title: `Capital atrapado en inventario: "${sm.name}"`,
          detail: `Has invertido $${sm.direct_investment.toLocaleString()} en mercancía y has recuperado $${sm.total_revenue.toLocaleString()} en ventas (Faltan $${gap.toLocaleString()} con ${sm.stock} unidades en bodega). Impulsa su rotación.`,
        });
      }
    }

    // Alerta de STOCK CRÍTICO / AGOTADO
    const outOfStock = products.filter((p) => p.stock === 0);
    for (const o of outOfStock) {
      alerts.push({
        id: `stock-out-${o.id}`,
        level: 'DANGER',
        scope: 'PRODUCTOS',
        title: `¡Agotado! "${o.name}" sin existencias`,
        detail: `Este producto tiene 0 unidades en inventario. Reabastece o produce más para no perder clientes.`,
      });
    }

    const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 3);
    for (const ls of lowStock) {
      alerts.push({
        id: `stock-low-${ls.id}`,
        level: 'WARNING',
        scope: 'PRODUCTOS',
        title: `Stock bajo en "${ls.name}" (${ls.stock} uds restantes)`,
        detail: `Quedan únicamente ${ls.stock} unidades disponibles en inventario.`,
      });
    }

    // ¿A cuál producto sacarle más dinero?
    // Productos con ventas significativas pero margen porcentual mejorable (< 32%)
    // o productos mina de oro con excelente margen (> 45%)
    const avgUnits =
      products.reduce((acc, p) => acc + p.units_sold, 0) / products.length;
    const highPotential = products.filter(
      (p) =>
        (p.units_sold >= Math.max(1, avgUnits) &&
          p.margin_percent > 0 &&
          p.margin_percent < 32) ||
        (p.margin_percent >= 45 && p.units_sold > 0)
    );
    productInsights.potencialMasDinero = highPotential;

    for (const hp of highPotential) {
      if (hp.margin_percent < 32) {
        const suggestedPrice = Math.ceil((hp.total_unit_cost * 1.45) / 100) * 100;
        alerts.push({
          id: `opportunity-price-${hp.id}`,
          level: 'INFO',
          scope: 'PRODUCTOS',
          title: `Oportunidad en "${hp.name}": Se vende bien pero deja poco margen (${hp.margin_percent}%)`,
          detail: `Llevas ${hp.units_sold} uds vendidas. Si ajustas el precio a ~$${suggestedPrice.toLocaleString()} o negocias costos con proveedores, aumentarás tu ganancia neta.`,
        });
      } else {
        alerts.push({
          id: `opportunity-push-${hp.id}`,
          level: 'SUCCESS',
          scope: 'PRODUCTOS',
          title: `Potencia "${hp.name}": Tu producto estrella (${hp.margin_percent}% de margen)`,
          detail: `Cada unidad te deja $${hp.unit_profit.toLocaleString()} libres. Dale máxima visibilidad porque es tu mayor generador de beneficio.`,
        });
      }
    }
  }

  return { alerts, productInsights };
}