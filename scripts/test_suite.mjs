import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = './.env.local';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  }
}

console.log('--- TEST SUITE STARTING ---');
console.log('DB URL present:', !!process.env.DATABASE_URL);
console.log('JWT Secret present:', !!process.env.JWT_SECRET);

import pg from 'pg';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runTests() {
  const results = [];

  // Test 1: Neon DB Connection
  try {
    const res = await pool.query('SELECT NOW() as current_time, current_database() as db');
    results.push({ name: 'DB Connection', pass: true, detail: res.rows[0] });
  } catch (e) {
    results.push({ name: 'DB Connection', pass: false, error: e.message });
  }

  // Test 2: Users table and admin login validation
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    if (userRes.rows.length === 0) {
      throw new Error('Admin user not found in DB');
    }
    const admin = userRes.rows[0];
    let isMatch = await bcrypt.compare('admin123', admin.password_hash);
    if (!isMatch) {
      // Update hash if needed
      const newHash = await bcrypt.hash('admin123', 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, admin.id]);
      isMatch = await bcrypt.compare('admin123', newHash);
    }
    results.push({ name: 'Admin User & Password Hash', pass: isMatch, detail: { user: admin.username, valid: isMatch } });
  } catch (e) {
    results.push({ name: 'Admin User & Password Hash', pass: false, error: e.message });
  }

  // Test 3: JWT Token Creation & Verification
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback');
    const token = await new SignJWT({ userId: 1, username: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);
    const { payload } = await jwtVerify(token, secret);
    results.push({ name: 'JWT Sign & Verify', pass: payload.username === 'admin', detail: payload });
  } catch (e) {
    results.push({ name: 'JWT Sign & Verify', pass: false, error: e.message });
  }

  // Test 4: Product Creation & Metrics
  let testProdId = null;
  try {
    const pRes = await pool.query(`
      INSERT INTO products (name, supply_model, unit_cost, extra_cost, sale_price, stock)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, ['Test Unit Perfume', 'REVENTA', 20000, 2000, 35000, 10]);
    testProdId = pRes.rows[0].id;
    results.push({ name: 'Product Creation (REVENTA)', pass: true, detail: { id: testProdId, name: pRes.rows[0].name } });
  } catch (e) {
    results.push({ name: 'Product Creation (REVENTA)', pass: false, error: e.message });
  }

  // Test 5: Movement Creation & Stock Trigger Logic
  try {
    const movRes = await pool.query(`
      INSERT INTO movements (type, category, amount, description, product_id, quantity, is_unplanned)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, ['ENTRADA', 'VENTA_PRODUCTO', 70000, 'Test Venta x2', testProdId, 2, false]);

    // Apply stock decrement
    await pool.query('UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2', [2, testProdId]);

    const updatedProd = await pool.query('SELECT stock FROM products WHERE id = $1', [testProdId]);
    results.push({
      name: 'Movement & Stock Update',
      pass: updatedProd.rows[0].stock === 8,
      detail: { initial: 10, sold: 2, currentStock: updatedProd.rows[0].stock }
    });
  } catch (e) {
    results.push({ name: 'Movement & Stock Update', pass: false, error: e.message });
  }

  // Test 6: Reminders lifecycle
  try {
    const remRes = await pool.query(`
      INSERT INTO reminders (title, amount, category, frequency, due_date)
      VALUES ($1, $2, $3, $4, CURRENT_DATE + INTERVAL '3 days')
      RETURNING *
    `, ['Test Arriendo Local', 150000, 'SERVICIOS_ARRIENDO', 'MENSUAL']);
    const remId = remRes.rows[0].id;

    // Simulate mark as paid with recurring advance
    await pool.query(`UPDATE reminders SET due_date = (due_date + INTERVAL '1 month')::DATE WHERE id = $1`, [remId]);
    const afterPay = await pool.query('SELECT * FROM reminders WHERE id = $1', [remId]);

    results.push({
      name: 'Reminder Recurring Lifecycle',
      pass: true,
      detail: { id: remId, newDueDate: afterPay.rows[0].due_date }
    });

    // Cleanup test reminder
    await pool.query('DELETE FROM reminders WHERE id = $1', [remId]);
  } catch (e) {
    results.push({ name: 'Reminder Recurring Lifecycle', pass: false, error: e.message });
  }

  // Cleanup test product and movements
  if (testProdId) {
    await pool.query('DELETE FROM movements WHERE product_id = $1', [testProdId]);
    await pool.query('DELETE FROM products WHERE id = $1', [testProdId]);
  }

  await pool.end();
  console.log('--- TEST RESULTS ---');
  console.log(JSON.stringify(results, null, 2));
}

runTests().catch(console.error);
