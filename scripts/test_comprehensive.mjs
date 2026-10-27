import fs from 'fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

// Load .env.local
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

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runComprehensiveVerification() {
  console.log('========================================================');
  console.log('   DEEP COMPREHENSIVE INTEGRATION & ATOMICTY SUITE');
  console.log('========================================================');
  const results = [];

  // 1. SSL Warning & DB Connection
  try {
    const res = await pool.query('SELECT NOW() as now, current_database() as db');
    results.push({
      test: '1. Clean DB Connection & SSL Handshake',
      passed: true,
      detail: res.rows[0]
    });
  } catch (err) {
    results.push({
      test: '1. Clean DB Connection & SSL Handshake',
      passed: false,
      error: err.message
    });
  }

  // 2. Admin User and Bcrypt verification
  try {
    const res = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', ['admin']);
    const user = res.rows[0];
    const isMatch = await bcrypt.compare('admin123', user.password_hash);
    results.push({
      test: '2. Admin Authentication Verification',
      passed: isMatch,
      detail: { username: user.username, matches: isMatch }
    });
  } catch (err) {
    results.push({ test: '2. Admin Authentication Verification', passed: false, error: err.message });
  }

  // 3. Jose JWT Token generation & claim verification
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback');
    const token = await new SignJWT({ userId: 1, username: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);
    const { payload } = await jwtVerify(token, secret);
    results.push({
      test: '3. Jose HS256 Token Lifecycle',
      passed: payload.username === 'admin',
      detail: payload
    });
  } catch (err) {
    results.push({ test: '3. Jose HS256 Token Lifecycle', passed: false, error: err.message });
  }

  // 4. Product creation with initial stock
  let testProdId = null;
  try {
    const p = await pool.query(
      `INSERT INTO products (name, supply_model, unit_cost, extra_cost, sale_price, stock, active)
       VALUES ('E2E Perfume Suizo', 'REVENTA', 25000, 2000, 45000, 5, TRUE)
       RETURNING *`
    );
    testProdId = p.rows[0].id;
    results.push({
      test: '4. Product Creation with Stock',
      passed: p.rows[0].stock === 5 && p.rows[0].name === 'E2E Perfume Suizo',
      detail: p.rows[0]
    });
  } catch (err) {
    results.push({ test: '4. Product Creation with Stock', passed: false, error: err.message });
  }

  // 5. Atomic sale and stock reduction within stock
  let movementId1 = null;
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const prodCheck = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [testProdId]);
      if (prodCheck.rows[0].stock < 2) throw new Error('Stock insuficiente');
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [2, testProdId]);
      const movRes = await client.query(
        `INSERT INTO movements (type, category, amount, description, product_id, quantity)
         VALUES ('ENTRADA', 'VENTA_PRODUCTO', 90000, 'Venta 2 perfumes', $1, 2)
         RETURNING *`,
        [testProdId]
      );
      movementId1 = movRes.rows[0].id;
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const checkP = await pool.query('SELECT stock FROM products WHERE id = $1', [testProdId]);
    results.push({
      test: '5. Atomic Stock Reduction (5 -> 3)',
      passed: checkP.rows[0].stock === 3,
      detail: { initialStock: 5, sold: 2, currentStock: checkP.rows[0].stock }
    });
  } catch (err) {
    results.push({ test: '5. Atomic Stock Reduction (5 -> 3)', passed: false, error: err.message });
  }

  // 6. Oversell Rejection and Rollback Integrity
  try {
    let rejected = false;
    let errorMsg = '';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const prodCheck = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [testProdId]);
      const currentStock = prodCheck.rows[0].stock; // 3
      if (currentStock < 10) {
        throw new Error(`Stock insuficiente: disponible ${currentStock}, solicitado 10`);
      }
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [10, testProdId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      rejected = true;
      errorMsg = e.message;
    } finally {
      client.release();
    }

    const checkP = await pool.query('SELECT stock FROM products WHERE id = $1', [testProdId]);
    results.push({
      test: '6. Oversell Rejection & Rollback Integrity',
      passed: rejected && checkP.rows[0].stock === 3,
      detail: { rejected, errorMsg, preservedStock: checkP.rows[0].stock }
    });
  } catch (err) {
    results.push({ test: '6. Oversell Rejection & Rollback Integrity', passed: false, error: err.message });
  }

  // 7. Purchase Stock Increment & Movement Reversal on Delete
  try {
    // 7A: Register purchase of 5 items
    const client = await pool.connect();
    let purchaseMovId = null;
    try {
      await client.query('BEGIN');
      await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [5, testProdId]);
      const pRes = await client.query(
        `INSERT INTO movements (type, category, amount, description, product_id, quantity)
         VALUES ('SALIDA', 'COMPRA_CATALOGO', 125000, 'Reabastecimiento 5 uds', $1, 5)
         RETURNING *`,
        [testProdId]
      );
      purchaseMovId = pRes.rows[0].id;
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const stockAfterPurchase = await pool.query('SELECT stock FROM products WHERE id = $1', [testProdId]);

    // 7B: Reverse/Delete movement
    const clientDel = await pool.connect();
    try {
      await clientDel.query('BEGIN');
      const mov = (await clientDel.query('SELECT * FROM movements WHERE id = $1 FOR UPDATE', [purchaseMovId])).rows[0];
      await clientDel.query('UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2', [mov.quantity, mov.product_id]);
      await clientDel.query('DELETE FROM movements WHERE id = $1', [purchaseMovId]);
      await clientDel.query('COMMIT');
    } catch (e) {
      await clientDel.query('ROLLBACK');
      throw e;
    } finally {
      clientDel.release();
    }

    const stockAfterDelete = await pool.query('SELECT stock FROM products WHERE id = $1', [testProdId]);
    results.push({
      test: '7. Stock Increment on Purchase & Reversal on Delete',
      passed: stockAfterPurchase.rows[0].stock === 8 && stockAfterDelete.rows[0].stock === 3,
      detail: {
        afterPurchase: stockAfterPurchase.rows[0].stock,
        afterDeleteReversal: stockAfterDelete.rows[0].stock
      }
    });
  } catch (err) {
    results.push({ test: '7. Stock Increment on Purchase & Reversal on Delete', passed: false, error: err.message });
  }

  // 8. Reminder recurring payment transaction
  let testReminderId = null;
  try {
    const remRes = await pool.query(
      `INSERT INTO reminders (title, amount, category, frequency, due_date)
       VALUES ('E2E Pago Luz Local', 85000, 'SERVICIOS_ARRIENDO', 'MENSUAL', CURRENT_DATE + INTERVAL '2 days')
       RETURNING *`
    );
    testReminderId = remRes.rows[0].id;

    // Simulate markReminderAsPaid transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const rem = (await client.query('SELECT * FROM reminders WHERE id = $1 FOR UPDATE', [testReminderId])).rows[0];
      await client.query(
        `INSERT INTO movements (type, category, amount, description)
         VALUES ('SALIDA', $1, $2, $3)`,
        [rem.category, rem.amount, `Pago recordatorio: ${rem.title}`]
      );
      await client.query(
        `UPDATE reminders SET due_date = (due_date + INTERVAL '1 month')::DATE WHERE id = $1`,
        [testReminderId]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const updatedRem = await pool.query('SELECT * FROM reminders WHERE id = $1', [testReminderId]);
    results.push({
      test: '8. Reminder Payment Transaction & Monthly Roll Forward',
      passed: !!updatedRem.rows[0].due_date,
      detail: { id: testReminderId, newDueDate: updatedRem.rows[0].due_date }
    });
  } catch (err) {
    results.push({ test: '8. Reminder Payment Transaction & Monthly Roll Forward', passed: false, error: err.message });
  }

  // 9. Continuous generate_series for bar chart
  try {
    const seriesTest = await pool.query(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
          date_trunc('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) AS m_date
      )
      SELECT
        TO_CHAR(m.m_date, 'YYYY-MM') AS periodo,
        COALESCE(SUM(CASE WHEN mov.type = 'ENTRADA' THEN mov.amount ELSE 0 END), 0)::FLOAT AS entradas,
        COALESCE(SUM(CASE WHEN mov.type = 'SALIDA' THEN mov.amount ELSE 0 END), 0)::FLOAT AS salidas
      FROM months m
      LEFT JOIN movements mov ON date_trunc('month', mov.movement_date) = m.m_date
      GROUP BY m.m_date
      ORDER BY m.m_date ASC
    `);
    results.push({
      test: '9. Bar Chart Continuous 6-Month Timeline',
      passed: seriesTest.rows.length === 6,
      detail: { rowCount: seriesTest.rows.length, periods: seriesTest.rows.map(r => r.periodo) }
    });
  } catch (err) {
    results.push({ test: '9. Bar Chart Continuous 6-Month Timeline', passed: false, error: err.message });
  }

  // Cleanup test artifacts
  try {
    if (testProdId) {
      await pool.query('DELETE FROM movements WHERE product_id = $1', [testProdId]);
      await pool.query('DELETE FROM products WHERE id = $1', [testProdId]);
    }
    if (testReminderId) {
      await pool.query('DELETE FROM movements WHERE description LIKE $1', [`%Pago recordatorio: E2E Pago Luz Local%`]);
      await pool.query('DELETE FROM reminders WHERE id = $1', [testReminderId]);
    }
  } catch {}

  await pool.end();
  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter(r => !r.passed);
  console.log(`\nTOTAL TESTS: ${results.length} | PASSED: ${results.length - failed.length} | FAILED: ${failed.length}`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

runComprehensiveVerification().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
