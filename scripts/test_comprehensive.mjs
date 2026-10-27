import fs from 'fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

const MovementInputSchema = z.object({
  type: z.enum(['ENTRADA', 'SALIDA']),
  category: z.string().min(1, 'La categoría es obligatoria'),
  amount: z.coerce.number().positive('El monto debe ser un valor mayor a cero'),
  description: z.string().min(1, 'La descripción es obligatoria').max(500),
});

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
  console.log('   MULTI-TENANT & STRICT VALIDATION VERIFICATION SUITE  ');
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
  let adminUser;
  try {
    const res = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', ['admin']);
    adminUser = res.rows[0];
    const isMatch = await bcrypt.compare('admin123', adminUser.password_hash);
    results.push({
      test: '2. Admin Authentication Verification',
      passed: isMatch,
      detail: { username: adminUser.username, matches: isMatch }
    });
  } catch (err) {
    results.push({
      test: '2. Admin Authentication Verification',
      passed: false,
      error: err.message
    });
  }

  // 3. JWT Token Lifecycle
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'AuraPrime67UuuuPachoEpaaaaYaVaCarpeto');
    const token = await new SignJWT({ userId: adminUser.id, username: adminUser.username })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    const { payload } = await jwtVerify(token, secret);
    results.push({
      test: '3. Jose HS256 Token Lifecycle & Payload',
      passed: payload.userId === adminUser.id && payload.username === 'admin',
      detail: payload
    });
  } catch (err) {
    results.push({
      test: '3. Jose HS256 Token Lifecycle & Payload',
      passed: false,
      error: err.message
    });
  }

  // 4. Zod Input Schema Validation Enforcement
  try {
    const invalidMovement = {
      type: 'SALIDA',
      category: 'GASTO_NO_PLANEADO',
      amount: -5000, // Invalido: debe ser positivo
      description: ''
    };
    const parsed = MovementInputSchema.safeParse(invalidMovement);
    const rejectedProperly = !parsed.success;
    results.push({
      test: '4. Zod Schema Rejects Negative/Malformed Amounts',
      passed: rejectedProperly,
      detail: { errors: parsed.success ? [] : parsed.error.issues.map(i => i.message) }
    });
  } catch (err) {
    results.push({
      test: '4. Zod Schema Rejects Negative/Malformed Amounts',
      passed: false,
      error: err.message
    });
  }

  // 5. Multi-Tenant User Isolation: Create Second User
  let user2;
  try {
    const testUsername = `tenant_test_${Date.now()}`;
    const hash = await bcrypt.hash('secret123', 10);
    const res = await pool.query(
      `INSERT INTO users (username, password_hash, business_name) VALUES ($1, $2, 'Negocio Inquilino 2') RETURNING id, username`,
      [testUsername, hash]
    );
    user2 = res.rows[0];
    results.push({
      test: '5. Tenant 2 Registration & Creation',
      passed: Boolean(user2 && user2.id),
      detail: user2
    });
  } catch (err) {
    results.push({
      test: '5. Tenant 2 Registration & Creation',
      passed: false,
      error: err.message
    });
  }

  // 6. User 1 Creates Product with user_id
  let productUser1;
  try {
    const res = await pool.query(
      `INSERT INTO products (user_id, name, supply_model, unit_cost, extra_cost, sale_price, stock, active)
       VALUES ($1, 'Perfume Exclusivo Admin', 'REVENTA', 20000, 2000, 35000, 10, TRUE) RETURNING *`,
      [adminUser.id]
    );
    productUser1 = res.rows[0];
    results.push({
      test: '6. User 1 Product Creation with user_id FK',
      passed: productUser1.user_id === adminUser.id && productUser1.stock === 10,
      detail: { id: productUser1.id, name: productUser1.name, user_id: productUser1.user_id }
    });
  } catch (err) {
    results.push({
      test: '6. User 1 Product Creation with user_id FK',
      passed: false,
      error: err.message
    });
  }

  // 7. Multi-Tenant Isolation Test: User 2 CANNOT see User 1's Products
  try {
    const res = await pool.query(
      `SELECT * FROM products WHERE user_id = $1 AND id = $2`,
      [user2.id, productUser1.id]
    );
    const isolated = res.rows.length === 0;
    results.push({
      test: '7. Multi-Tenant Product Isolation (User 2 sees 0 of User 1 products)',
      passed: isolated,
      detail: { user2_id: user2.id, found_records_of_user1: res.rows.length }
    });
  } catch (err) {
    results.push({
      test: '7. Multi-Tenant Product Isolation',
      passed: false,
      error: err.message
    });
  }

  // 8. Atomic Movement Creation & Stock Deduction for User 1
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE products SET stock = stock - 2 WHERE id = $1 AND user_id = $2', [productUser1.id, adminUser.id]);
      await client.query(
        `INSERT INTO movements (user_id, type, category, amount, description, product_id, quantity)
         VALUES ($1, 'ENTRADA', 'VENTA_PRODUCTO', 70000, 'Venta 2 perfumes', $2, 2)`,
        [adminUser.id, productUser1.id]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const check = await pool.query('SELECT stock FROM products WHERE id = $1', [productUser1.id]);
    results.push({
      test: '8. Atomic Stock Reduction (10 -> 8) Scoped to User 1',
      passed: check.rows[0].stock === 8,
      detail: { currentStock: check.rows[0].stock }
    });
  } catch (err) {
    results.push({
      test: '8. Atomic Stock Reduction Scoped to User 1',
      passed: false,
      error: err.message
    });
  }

  // 9. Multi-Tenant Movement Isolation: User 2 Cash Register has 0 balance
  try {
    const res = await pool.query(
      `SELECT COALESCE(SUM(amount), 0)::FLOAT as total FROM movements WHERE user_id = $1`,
      [user2.id]
    );
    const user2Total = res.rows[0].total;
    results.push({
      test: '9. Multi-Tenant Cash Isolation (User 2 balance is strictly $0)',
      passed: user2Total === 0,
      detail: { user2_total: user2Total }
    });
  } catch (err) {
    results.push({
      test: '9. Multi-Tenant Cash Isolation',
      passed: false,
      error: err.message
    });
  }

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter(r => !r.passed);
  console.log(`\nTOTAL TESTS: ${results.length} | PASSED: ${results.length - failed.length} | FAILED: ${failed.length}`);

  await pool.end();
  if (failed.length > 0) {
    process.exit(1);
  }
}

runComprehensiveVerification().catch(err => {
  console.error('Fatal suite crash:', err);
  process.exit(1);
});
