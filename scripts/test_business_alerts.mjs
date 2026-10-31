import fs from 'fs';
import pg from 'pg';

// Cargar variables de entorno
const envPath = './.env.local';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (key === 'DATABASE_URL' && val.includes('sslmode=require') && !val.includes('uselibpqcompat')) {
        val = val.replace('sslmode=require', 'sslmode=require&uselibpqcompat=true');
      }
      process.env[key] = val;
    }
  }
}

// Importar servicio de alertas y pool de aplicación
const { getBusinessAlerts } = await import('../app/modules/analytics/alerts.ts');
const { pool: appPool } = await import('../bd/connection.ts');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runAlertsTests() {
  console.log('========================================================');
  console.log('   BUSINESS ALERTS & NOTIFICATIONS VERIFICATION SUITE   ');
  console.log('========================================================');

  const client = await pool.connect();
  const results = [];

  try {
    // TEST 1: Validación de userId inválido
    try {
      await getBusinessAlerts(0);
      results.push({ test: '1. Guard: Rechazar userId = 0', passed: false });
    } catch {
      results.push({ test: '1. Guard: Rechazar userId = 0', passed: true });
    }

    try {
      await getBusinessAlerts(-5);
      results.push({ test: '2. Guard: Rechazar userId negativo', passed: false });
    } catch {
      results.push({ test: '2. Guard: Rechazar userId negativo', passed: true });
    }

    // Crear Tenant de prueba aislado
    const testUsername = `alert_tenant_${Date.now()}`;
    const userRes = await client.query(
      `INSERT INTO users (username, password_hash, business_name)
       VALUES ($1, 'hash_dummy', 'Negocio Test Alertas') RETURNING id`,
      [testUsername]
    );
    const tenantId = userRes.rows[0].id;

    // Crear segundo tenant vacío para probar multi-tenancy
    const emptyTenantRes = await client.query(
      `INSERT INTO users (username, password_hash, business_name)
       VALUES ($1, 'hash_dummy', 'Negocio Test Vacio') RETURNING id`,
      [`empty_tenant_${Date.now()}`]
    );
    const emptyTenantId = emptyTenantRes.rows[0].id;

    // TEST 3: Multi-tenancy - Tenant vacío debe tener 0 alertas
    const emptyAlerts = await getBusinessAlerts(emptyTenantId);
    results.push({
      test: '3. Multi-Tenancy: Tenant sin actividad tiene 0 alertas',
      passed: emptyAlerts.totalCount === 0 && emptyAlerts.alerts.length === 0,
      detail: emptyAlerts,
    });

    // --- SETUP PARA TENANT DE PRUEBA ---

    // 1. Productos para alertas de Inventario
    // Prod 1: Agotado (stock = 0) -> DANGER
    const p1Res = await client.query(
      `INSERT INTO products (user_id, name, supply_model, unit_cost, sale_price, stock, active)
       VALUES ($1, 'Producto Agotado Test', 'REVENTA', 10000, 20000, 0, TRUE) RETURNING id`,
      [tenantId]
    );
    const p1Id = p1Res.rows[0].id;

    // Prod 2: Stock Crítico (stock = 2) y Estancado (sin ventas en 30 días) -> WARNING stock + WARNING stagnant
    const p2Res = await client.query(
      `INSERT INTO products (user_id, name, supply_model, unit_cost, sale_price, stock, active)
       VALUES ($1, 'Producto Critico Test', 'REVENTA', 15000, 30000, 2, TRUE) RETURNING id`,
      [tenantId]
    );
    const p2Id = p2Res.rows[0].id;

    // Prod 3: Con stock suficiente pero Estancado (stock = 10, 0 ventas en 30 días) -> WARNING stagnant
    const p3Res = await client.query(
      `INSERT INTO products (user_id, name, supply_model, unit_cost, sale_price, stock, active)
       VALUES ($1, 'Producto Estancado Test', 'REVENTA', 5000, 10000, 10, TRUE) RETURNING id`,
      [tenantId]
    );
    const p3Id = p3Res.rows[0].id;

    // Prod 4: Con ventas recientes en los últimos 30 días (NO estancado, stock = 20)
    const p4Res = await client.query(
      `INSERT INTO products (user_id, name, supply_model, unit_cost, sale_price, stock, active)
       VALUES ($1, 'Producto Activo Test', 'REVENTA', 8000, 16000, 20, TRUE) RETURNING id`,
      [tenantId]
    );
    const p4Id = p4Res.rows[0].id;

    // Venta reciente para Prod 4 (ayer)
    await client.query(
      `INSERT INTO movements (user_id, type, category, amount, description, product_id, quantity, movement_date)
       VALUES ($1, 'ENTRADA', 'VENTA_PRODUCTO', 32000, 'Venta ayer', $2, 2, CURRENT_TIMESTAMP - INTERVAL '1 day')`,
      [tenantId, p4Id]
    );

    // TEST 4: Verificación de Alertas de Inventario
    const inventoryOnlyAlerts = await getBusinessAlerts(tenantId);
    const stockEmptyAlert = inventoryOnlyAlerts.alerts.find((a) => a.id === `stock-empty-${p1Id}`);
    const stockCriticalAlert = inventoryOnlyAlerts.alerts.find((a) => a.id === `stock-critical-${p2Id}`);
    const stagnantAlertP3 = inventoryOnlyAlerts.alerts.find((a) => a.id === `inventory-stagnant-${p3Id}`);
    const stagnantAlertP4 = inventoryOnlyAlerts.alerts.find((a) => a.id === `inventory-stagnant-${p4Id}`);

    results.push({
      test: '4. Inventario: DANGER por Producto Agotado (stock = 0)',
      passed: !!stockEmptyAlert && stockEmptyAlert.level === 'DANGER' && stockEmptyAlert.actionHref === '/productos',
      detail: stockEmptyAlert,
    });

    results.push({
      test: '5. Inventario: WARNING por Stock Crítico (stock <= 2)',
      passed: !!stockCriticalAlert && stockCriticalAlert.level === 'WARNING' && stockCriticalAlert.actionHref === '/productos',
      detail: stockCriticalAlert,
    });

    results.push({
      test: '6. Inventario: WARNING por Producto Estancado sin ventas en 30 días',
      passed: !!stagnantAlertP3 && stagnantAlertP3.level === 'WARNING' && stagnantAlertP3.actionHref === '/productos',
      detail: stagnantAlertP3,
    });

    results.push({
      test: '7. Inventario: Producto con ventas en 30 días NO genera alerta de estancado',
      passed: !stagnantAlertP4,
      detail: { stagnantAlertP4 },
    });

    // 2. Gastos para Alertas de Salto Inusual de Gasto
    // Gasto mes pasado en GASTO_GENERAL: $100.000
    // Gasto mes actual en GASTO_GENERAL: $150.000 (+50% > +20%) -> DANGER
    await client.query(
      `INSERT INTO movements (user_id, type, category, amount, description, movement_date)
       VALUES ($1, 'SALIDA', 'GASTO_GENERAL', 100000, 'Gasto mes pasado', date_trunc('month', CURRENT_DATE) - INTERVAL '10 days')`,
      [tenantId]
    );
    await client.query(
      `INSERT INTO movements (user_id, type, category, amount, description, movement_date)
       VALUES ($1, 'SALIDA', 'GASTO_GENERAL', 150000, 'Gasto mes actual', CURRENT_TIMESTAMP)`,
      [tenantId]
    );

    // Gasto semana pasada en SERVICIOS_ARRIENDO: $50.000
    // Gasto semana actual en SERVICIOS_ARRIENDO: $80.000 (+60% > +15%) -> WARNING
    // Nota: Ambas en el mes actual para aislar el salto semanal
    await client.query(
      `INSERT INTO movements (user_id, type, category, amount, description, movement_date)
       VALUES ($1, 'SALIDA', 'SERVICIOS_ARRIENDO', 50000, 'Servicios semana pasada', date_trunc('week', CURRENT_DATE) - INTERVAL '2 days')`,
      [tenantId]
    );
    await client.query(
      `INSERT INTO movements (user_id, type, category, amount, description, movement_date)
       VALUES ($1, 'SALIDA', 'SERVICIOS_ARRIENDO', 80000, 'Servicios semana actual', CURRENT_TIMESTAMP)`,
      [tenantId]
    );

    const expenseSpikeAlerts = await getBusinessAlerts(tenantId);
    const monthSpikeAlert = expenseSpikeAlerts.alerts.find((a) => a.id === 'expense-spike-month-GASTO_GENERAL');
    const weekSpikeAlert = expenseSpikeAlerts.alerts.find((a) => a.id === 'expense-spike-week-SERVICIOS_ARRIENDO');

    results.push({
      test: '8. Gastos: DANGER por Salto Inusual Mensual (> 20%)',
      passed: !!monthSpikeAlert && monthSpikeAlert.level === 'DANGER' && monthSpikeAlert.actionHref === '/movimientos',
      detail: monthSpikeAlert,
    });

    results.push({
      test: '9. Gastos: WARNING por Salto Inusual Semanal (> 15%)',
      passed: !!weekSpikeAlert && weekSpikeAlert.level === 'WARNING' && weekSpikeAlert.actionHref === '/movimientos',
      detail: weekSpikeAlert,
    });

    // 3. Gastos no planeados: Fuga de gastos imprevistos
    // Registramos 4 gastos no planeados pequeños de $30.000 cada uno (total $120.000 > $100.000 y count = 4 >= 4)
    for (let i = 1; i <= 4; i++) {
      await client.query(
        `INSERT INTO movements (user_id, type, category, amount, description, is_unplanned, movement_date)
         VALUES ($1, 'SALIDA', 'GASTO_NO_PLANEADO', 30000, $2, TRUE, CURRENT_TIMESTAMP)`,
        [tenantId, `Gasto imprevisto #${i}`]
      );
    }

    const unplannedAlerts = await getBusinessAlerts(tenantId);
    const unplannedLeak = unplannedAlerts.alerts.find((a) => a.id === 'unplanned-expenses-leak');

    results.push({
      test: '10. Gastos: WARNING por Fuga de Gastos No Planeados (>= $100.000 y >= 4 salidas)',
      passed: !!unplannedLeak && unplannedLeak.level === 'WARNING' && unplannedLeak.actionLabel === 'Auditar Gastos',
      detail: unplannedLeak,
    });

    // 4. Liquidez: Obligaciones pendientes vencidas o próximas
    // Insertamos un recordatorio por vencer en 2 días por $1.000.000
    // Como los ingresos del tenant son solo $32.000 (y salidas > $400.000), la caja disponible es negativa o insuficiente.
    // Esto DEBE disparar DANGER por riesgo de liquidez!
    const remRes = await client.query(
      `INSERT INTO reminders (user_id, title, amount, category, frequency, due_date, is_completed)
       VALUES ($1, 'Pago Arriendo Local', 1000000, 'SERVICIOS_ARRIENDO', 'MENSUAL', CURRENT_DATE + INTERVAL '2 days', FALSE)
       RETURNING id`,
      [tenantId]
    );
    const remId = remRes.rows[0].id;

    const liquidityDeficitAlerts = await getBusinessAlerts(tenantId);
    const liquidityRiskAlert = liquidityDeficitAlerts.alerts.find((a) => a.id === 'liquidity-risk-obligations');

    results.push({
      test: '11. Liquidez: DANGER cuando obligaciones próximas superan la caja disponible',
      passed: !!liquidityRiskAlert && liquidityRiskAlert.level === 'DANGER' && liquidityRiskAlert.scope === 'LIQUIDEZ',
      detail: liquidityRiskAlert,
    });

    // Ahora inyectamos un aporte de capital suficiente de $5.000.000 para que la caja cubra holgadamente la obligación
    await client.query(
      `INSERT INTO movements (user_id, type, category, amount, description, movement_date)
       VALUES ($1, 'ENTRADA', 'APORTE_CAPITAL', 5000000, 'Inyección de liquidez', CURRENT_TIMESTAMP)`,
      [tenantId]
    );

    const liquidityCoveredAlerts = await getBusinessAlerts(tenantId);
    const liquidityUpcomingAlert = liquidityCoveredAlerts.alerts.find((a) => a.id === 'liquidity-upcoming-obligations');

    results.push({
      test: '12. Liquidez: WARNING cuando la caja sí cubre las obligaciones próximas',
      passed:
        !!liquidityUpcomingAlert &&
        liquidityUpcomingAlert.level === 'WARNING' &&
        (liquidityUpcomingAlert.actionLabel === 'Ver Pagos Recurrentes' ||
          liquidityUpcomingAlert.actionLabel === 'Ver Pagos'),
      detail: liquidityUpcomingAlert,
    });

    // Completar el recordatorio para probar que ya no genera alerta
    await client.query(`UPDATE reminders SET is_completed = TRUE WHERE id = $1`, [remId]);
    const liquidityCompletedAlerts = await getBusinessAlerts(tenantId);
    const hasRemainingLiquidityAlert = liquidityCompletedAlerts.alerts.some((a) => a.scope === 'LIQUIDEZ');

    results.push({
      test: '13. Liquidez: Al completar el recordatorio desaparece la alerta de liquidez',
      passed: !hasRemainingLiquidityAlert,
      detail: { hasRemainingLiquidityAlert },
    });

    // 5. Verificación de Ordenamiento Estricto: DANGER primero, luego WARNING, luego INFO
    const sortedAlerts = liquidityDeficitAlerts.alerts;
    let orderValid = true;
    let seenLevels = [];
    const levelOrder = { DANGER: 0, WARNING: 1, INFO: 2 };

    for (let i = 0; i < sortedAlerts.length - 1; i++) {
      const currentLevelWeight = levelOrder[sortedAlerts[i].level];
      const nextLevelWeight = levelOrder[sortedAlerts[i + 1].level];
      if (currentLevelWeight > nextLevelWeight) {
        orderValid = false;
        break;
      }
    }

    results.push({
      test: '14. Ordenamiento: DANGER primero, WARNING segundo, INFO tercero',
      passed: orderValid,
      detail: sortedAlerts.map((a) => `${a.level}: ${a.title}`),
    });

    // 6. Verificación de Integridad de Conteos en DTO
    const { totalCount, dangerCount, warningCount, infoCount, alerts } = liquidityDeficitAlerts;
    const computedDanger = alerts.filter((a) => a.level === 'DANGER').length;
    const computedWarning = alerts.filter((a) => a.level === 'WARNING').length;
    const computedInfo = alerts.filter((a) => a.level === 'INFO').length;

    const countsMatch =
      totalCount === alerts.length &&
      dangerCount === computedDanger &&
      warningCount === computedWarning &&
      infoCount === computedInfo &&
      totalCount === dangerCount + warningCount + infoCount;

    results.push({
      test: '15. DTO Invariants: totalCount === dangerCount + warningCount + infoCount',
      passed: countsMatch,
      detail: { totalCount, dangerCount, warningCount, infoCount },
    });

    // Limpieza de datos de prueba
    await client.query('DELETE FROM movements WHERE user_id = $1', [tenantId]);
    await client.query('DELETE FROM reminders WHERE user_id = $1', [tenantId]);
    await client.query('DELETE FROM products WHERE user_id = $1', [tenantId]);
    await client.query('DELETE FROM users WHERE id IN ($1, $2)', [tenantId, emptyTenantId]);

    console.log(JSON.stringify(results, null, 2));

    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;

    console.log(`\nTOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Error durante la ejecución del test suite:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    if (appPool) {
      await appPool.end();
    }
    process.exit(0);
  }
}

runAlertsTests();
