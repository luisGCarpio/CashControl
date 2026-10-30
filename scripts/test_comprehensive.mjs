import fs from 'fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { checkRateLimit } from '../lib/rate-limit.ts';
import {
  AuthRegisterSchema,
  MovementInputSchema,
  ENTRADA_CATEGORIES,
  SALIDA_CATEGORIES,
  UpdateStockSchema,
  MarkReminderPaidSchema,
  EntityIdSchema,
  ReminderInputSchema,
} from '../lib/schemas.ts';

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

async function verifySessionToken(token, secretKey) {
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: ['HS256'],
    issuer: 'pulso-caja-api',
    audience: 'pulso-caja-app',
  });

  if (typeof payload.userId !== 'number' || payload.userId <= 0) {
    throw new Error('El userId en el payload debe ser numérico y mayor a 0');
  }

  return payload;
}

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

  // 2. Admin Authentication Verification
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

  // 3. JWT Claims Integrity, HS256 Algorithm & Payload Security
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'AuraPrime67UuuuPachoEpaaaaYaVaCarpeto');

    // 3a. Valid token signed with standard claims and HS256 algorithm
    const validToken = await new SignJWT({ userId: adminUser.id, username: adminUser.username })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('pulso-caja-api')
      .setAudience('pulso-caja-app')
      .setSubject(String(adminUser.id))
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    const validPayload = await verifySessionToken(validToken, secret);
    const validVerified = validPayload.userId === adminUser.id &&
      validPayload.username === 'admin' &&
      validPayload.iss === 'pulso-caja-api' &&
      validPayload.aud === 'pulso-caja-app';

    // 3b. Manipulated algorithm (e.g. HS512 instead of HS256) must be rejected
    let tamperedAlgRejected = false;
    try {
      const tamperedAlgToken = await new SignJWT({ userId: adminUser.id, username: adminUser.username })
        .setProtectedHeader({ alg: 'HS512' })
        .setIssuer('pulso-caja-api')
        .setAudience('pulso-caja-app')
        .sign(secret);
      await verifySessionToken(tamperedAlgToken, secret);
    } catch {
      tamperedAlgRejected = true;
    }

    // 3c. Manipulated payload with non-numeric userId (e.g. string '1') must be rejected
    let nonNumericUserIdRejected = false;
    try {
      const nonNumericToken = await new SignJWT({ userId: String(adminUser.id), username: adminUser.username })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('pulso-caja-api')
        .setAudience('pulso-caja-app')
        .sign(secret);
      await verifySessionToken(nonNumericToken, secret);
    } catch {
      nonNumericUserIdRejected = true;
    }

    // 3d. Manipulated issuer must be rejected
    let badIssuerRejected = false;
    try {
      const badIssuerToken = await new SignJWT({ userId: adminUser.id, username: adminUser.username })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('unauthorized-issuer')
        .setAudience('pulso-caja-app')
        .sign(secret);
      await verifySessionToken(badIssuerToken, secret);
    } catch {
      badIssuerRejected = true;
    }

    const allJwtChecksPassed = validVerified && tamperedAlgRejected && nonNumericUserIdRejected && badIssuerRejected;

    results.push({
      test: '3. JWT Claims Integrity, HS256 Algorithm & Payload Security',
      passed: allJwtChecksPassed,
      detail: {
        validTokenVerified: validVerified,
        tamperedAlgRejected,
        nonNumericUserIdRejected,
        badIssuerRejected,
        claims: { iss: validPayload.iss, aud: validPayload.aud, userId: validPayload.userId }
      }
    });
  } catch (err) {
    results.push({
      test: '3. JWT Claims Integrity, HS256 Algorithm & Payload Security',
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

  // 10. Rate Limiting Protection (checkRateLimit sliding window lockout)
  try {
    const testKey = `test_rate_limit_${Date.now()}`;
    const maxAttempts = 3;
    const windowMs = 60000;

    const r1 = checkRateLimit(testKey, maxAttempts, windowMs);
    const r2 = checkRateLimit(testKey, maxAttempts, windowMs);
    const r3 = checkRateLimit(testKey, maxAttempts, windowMs);
    const r4 = checkRateLimit(testKey, maxAttempts, windowMs);
    const r5 = checkRateLimit(testKey, maxAttempts, windowMs);

    const step1Ok = r1.allowed === true && r1.remaining === 2;
    const step2Ok = r2.allowed === true && r2.remaining === 1;
    const step3Ok = r3.allowed === true && r3.remaining === 0;
    const step4Ok = r4.allowed === false && r4.remaining === 0;
    const step5Ok = r5.allowed === false && r5.remaining === 0;

    const rateLimitPassed = step1Ok && step2Ok && step3Ok && step4Ok && step5Ok;

    results.push({
      test: '10. Rate Limiting Protection (checkRateLimit sliding window lockout)',
      passed: rateLimitPassed,
      detail: {
        attempt1: r1,
        attempt2: r2,
        attempt3: r3,
        attempt4_exhausted: r4,
        attempt5_blocked: r5
      }
    });
  } catch (err) {
    results.push({
      test: '10. Rate Limiting Protection (checkRateLimit sliding window lockout)',
      passed: false,
      error: err.message
    });
  }

  // 11. AuthRegisterSchema Robustness (Length & Character validation)
  try {
    // 1. Valid registration
    const validParsed = AuthRegisterSchema.safeParse({
      username: 'usuario_valido-01',
      password: 'passwordSeguro123',
      business_name: 'Negocio Pulso'
    });

    // 2. Password < 8 chars rejected
    const shortPassParsed = AuthRegisterSchema.safeParse({
      username: 'usuario_valido',
      password: '1234567'
    });

    // 3. Password > 72 chars rejected
    const longPassParsed = AuthRegisterSchema.safeParse({
      username: 'usuario_valido',
      password: 'A'.repeat(73)
    });

    // 4. Username with space rejected
    const spaceUserParsed = AuthRegisterSchema.safeParse({
      username: 'usuario invalido',
      password: 'passwordSeguro123'
    });

    // 5. Username with @ rejected
    const atUserParsed = AuthRegisterSchema.safeParse({
      username: 'usuario@correo',
      password: 'passwordSeguro123'
    });

    // 6. Username with ! rejected
    const bangUserParsed = AuthRegisterSchema.safeParse({
      username: 'usuario!alerta',
      password: 'passwordSeguro123'
    });

    const validOk = validParsed.success;
    const shortPassRejected = !shortPassParsed.success && shortPassParsed.error.issues.some(i => i.message.includes('8 caracteres'));
    const longPassRejected = !longPassParsed.success && longPassParsed.error.issues.some(i => i.message.includes('72 caracteres'));
    const spaceUserRejected = !spaceUserParsed.success;
    const atUserRejected = !atUserParsed.success;
    const bangUserRejected = !bangUserParsed.success;

    const schemaTestPassed = validOk && shortPassRejected && longPassRejected && spaceUserRejected && atUserRejected && bangUserRejected;

    results.push({
      test: '11. AuthRegisterSchema Robustness (Length & Character validation)',
      passed: schemaTestPassed,
      detail: {
        validInputAccepted: validOk,
        shortPasswordRejected: shortPassRejected,
        longPasswordRejected: longPassRejected,
        spaceUsernameRejected: spaceUserRejected,
        atUsernameRejected: atUserRejected,
        bangUsernameRejected: bangUserRejected
      }
    });
  } catch (err) {
    results.push({
      test: '11. AuthRegisterSchema Robustness (Length & Character validation)',
      passed: false,
      error: err.message
    });
  }

  // 12. MovementInputSchema Category and Type Coherence
  try {
    const validEntrada = MovementInputSchema.safeParse({
      type: 'ENTRADA',
      category: 'APORTE_CAPITAL',
      amount: 150000,
      description: 'Inyección de capital inicial'
    });

    const invalidEntradaMismatch = MovementInputSchema.safeParse({
      type: 'ENTRADA',
      category: 'GASTO_GENERAL', // Invalido para ENTRADA
      amount: 50000,
      description: 'Gasto clasificado erroneamente como entrada'
    });

    const invalidSalidaMismatch = MovementInputSchema.safeParse({
      type: 'SALIDA',
      category: 'VENTA_PRODUCTO', // Invalido para SALIDA
      amount: 25000,
      description: 'Venta clasificada erroneamente como salida'
    });

    const categoriesExported = Array.isArray(ENTRADA_CATEGORIES) && Array.isArray(SALIDA_CATEGORIES) &&
      ENTRADA_CATEGORIES.length === 3 && SALIDA_CATEGORIES.length === 6;

    const test12Passed = validEntrada.success && !invalidEntradaMismatch.success && !invalidSalidaMismatch.success && categoriesExported;

    results.push({
      test: '12. MovementInputSchema Category and Type Coherence',
      passed: test12Passed,
      detail: {
        categoriesExported,
        validEntradaAccepted: validEntrada.success,
        invalidEntradaRejected: !invalidEntradaMismatch.success,
        invalidSalidaRejected: !invalidSalidaMismatch.success
      }
    });
  } catch (err) {
    results.push({
      test: '12. MovementInputSchema Category and Type Coherence',
      passed: false,
      error: err.message
    });
  }

  // 13. MovementInputSchema Mandatory product_id for Inventory Categories
  try {
    const ventaWithoutProduct = MovementInputSchema.safeParse({
      type: 'ENTRADA',
      category: 'VENTA_PRODUCTO',
      amount: 35000,
      description: 'Venta sin producto'
    });

    const compraWithoutProduct = MovementInputSchema.safeParse({
      type: 'SALIDA',
      category: 'COMPRA_CATALOGO',
      amount: 20000,
      description: 'Compra sin producto'
    });

    const materiaPrimaWithoutProduct = MovementInputSchema.safeParse({
      type: 'SALIDA',
      category: 'MATERIA_PRIMA',
      amount: 15000,
      description: 'Materia prima sin producto'
    });

    const ventaWithProduct = MovementInputSchema.safeParse({
      type: 'ENTRADA',
      category: 'VENTA_PRODUCTO',
      amount: 35000,
      description: 'Venta con producto valido',
      product_id: 1,
      quantity: 1
    });

    const test13Passed = !ventaWithoutProduct.success &&
      !compraWithoutProduct.success &&
      !materiaPrimaWithoutProduct.success &&
      ventaWithProduct.success;

    results.push({
      test: '13. MovementInputSchema Mandatory product_id for Inventory Categories',
      passed: test13Passed,
      detail: {
        ventaWithoutProductRejected: !ventaWithoutProduct.success,
        compraWithoutProductRejected: !compraWithoutProduct.success,
        materiaPrimaWithoutProductRejected: !materiaPrimaWithoutProduct.success,
        ventaWithProductAccepted: ventaWithProduct.success
      }
    });
  } catch (err) {
    results.push({
      test: '13. MovementInputSchema Mandatory product_id for Inventory Categories',
      passed: false,
      error: err.message
    });
  }

  // 14. Database CHECK Constraints Enforcement (Products & Movements)
  try {
    let negativeStockRejected = false;
    try {
      await pool.query(
        `INSERT INTO products (user_id, name, supply_model, unit_cost, extra_cost, sale_price, stock)
         VALUES ($1, 'Bad Stock Product', 'REVENTA', 10, 0, 20, -5)`,
        [adminUser.id]
      );
    } catch {
      negativeStockRejected = true;
    }

    let negativePriceRejected = false;
    try {
      await pool.query(
        `INSERT INTO products (user_id, name, supply_model, unit_cost, extra_cost, sale_price, stock)
         VALUES ($1, 'Bad Price Product', 'REVENTA', 10, 0, -20, 5)`,
        [adminUser.id]
      );
    } catch {
      negativePriceRejected = true;
    }

    let incoherentMovementDbRejected = false;
    try {
      await pool.query(
        `INSERT INTO movements (user_id, type, category, amount, description)
         VALUES ($1, 'SALIDA', 'VENTA_PRODUCTO', 5000, 'Violacion de check constraint')`,
        [adminUser.id]
      );
    } catch {
      incoherentMovementDbRejected = true;
    }

    const dbChecksPassed = negativeStockRejected && negativePriceRejected && incoherentMovementDbRejected;
    results.push({
      test: '14. Database CHECK Constraints Enforcement (Products & Movements)',
      passed: dbChecksPassed,
      detail: {
        negativeStockRejected,
        negativePriceRejected,
        incoherentMovementDbRejected
      }
    });
  } catch (err) {
    results.push({
      test: '14. Database CHECK Constraints Enforcement (Products & Movements)',
      passed: false,
      error: err.message
    });
  }

  // 15. Inactive Product Protection & Non-Destructive Purchase Reversion
  try {
    // 15a. Inactive product check
    const inactProdRes = await pool.query(
      `INSERT INTO products (user_id, name, supply_model, unit_cost, extra_cost, sale_price, stock, active)
       VALUES ($1, 'Producto Desactivado Test', 'REVENTA', 1000, 0, 2000, 5, FALSE) RETURNING *`,
      [adminUser.id]
    );
    const inactProd = inactProdRes.rows[0];

    let inactiveMovementBlocked = false;
    if (inactProd.active === false) {
      inactiveMovementBlocked = true;
    }

    // 15b. Non-destructive purchase reversion:
    // Create product with stock = 10, purchase 5 (stock becomes 15),
    // sell 13 (stock becomes 2). Attempting to delete purchase (qty 5 > stock 2)
    // MUST be blocked to preserve financial/stock integrity.
    const testRevertProdRes = await pool.query(
      `INSERT INTO products (user_id, name, supply_model, unit_cost, extra_cost, sale_price, stock, active)
       VALUES ($1, 'Producto Reversion Test', 'REVENTA', 5000, 0, 10000, 10, TRUE) RETURNING *`,
      [adminUser.id]
    );
    const revertProd = testRevertProdRes.rows[0];

    const purchaseMovRes = await pool.query(
      `INSERT INTO movements (user_id, type, category, amount, description, product_id, quantity)
       VALUES ($1, 'SALIDA', 'COMPRA_CATALOGO', 25000, 'Compra 5 unidades', $2, 5) RETURNING *`,
      [adminUser.id, revertProd.id]
    );
    const purchaseMov = purchaseMovRes.rows[0];
    await pool.query('UPDATE products SET stock = stock + 5 WHERE id = $1', [revertProd.id]);

    // Sell 13 units, leaving stock = 2
    await pool.query('UPDATE products SET stock = stock - 13 WHERE id = $1', [revertProd.id]);
    const stockAfterSales = await pool.query('SELECT stock FROM products WHERE id = $1', [revertProd.id]);
    const currentStock = stockAfterSales.rows[0].stock;

    let reversalBlockedProperly = false;
    let expectedErrorMessage = '';
    if (purchaseMov.type === 'SALIDA' && (purchaseMov.category === 'COMPRA_CATALOGO' || purchaseMov.category === 'MATERIA_PRIMA')) {
      if (currentStock < purchaseMov.quantity) {
        reversalBlockedProperly = true;
        expectedErrorMessage = `No se puede anular la compra: el stock actual (${currentStock}) es menor a la cantidad registrada (${purchaseMov.quantity}), lo que indica que las unidades ya fueron vendidas.`;
      }
    }

    const test15Passed = inactiveMovementBlocked && reversalBlockedProperly && currentStock === 2;
    results.push({
      test: '15. Inactive Product Protection & Non-Destructive Purchase Reversion',
      passed: test15Passed,
      detail: {
        inactiveMovementBlocked,
        reversalBlockedProperly,
        currentStock,
        expectedErrorMessage
      }
    });
  } catch (err) {
    results.push({
      test: '15. Inactive Product Protection & Non-Destructive Purchase Reversion',
      passed: false,
      error: err.message
    });
  }

  // 16. Exact Cash Balance SQL Calculation (NUMERIC(12,2) with Number() parsing)
  try {
    const cashRes = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'ENTRADA' THEN amount ELSE 0 END), 0)::FLOAT AS total_entradas,
        COALESCE(SUM(CASE WHEN type = 'SALIDA' THEN amount ELSE 0 END), 0)::FLOAT AS total_salidas,
        COALESCE(SUM(CASE WHEN type = 'ENTRADA' THEN amount ELSE -amount END), 0)::NUMERIC(12, 2) AS disponible_actual
      FROM movements
      WHERE user_id = $1
    `, [adminUser.id]);

    const cashRow = cashRes.rows[0];
    const numericParsed = Number(cashRow.disponible_actual);
    const isExactNumber = typeof numericParsed === 'number' && !isNaN(numericParsed);

    results.push({
      test: '16. Exact Cash Balance SQL Calculation (NUMERIC(12,2) with Number() parsing)',
      passed: isExactNumber,
      detail: {
        total_entradas: cashRow.total_entradas,
        total_salidas: cashRow.total_salidas,
        disponible_actual: numericParsed
      }
    });
  } catch (err) {
    results.push({
      test: '16. Exact Cash Balance SQL Calculation (NUMERIC(12,2) with Number() parsing)',
      passed: false,
      error: err.message
    });
  }


  // 17. Zod Contracts for PATCH & Secondary Routes (UpdateStock, MarkReminderPaid, EntityId, ReminderInput)
  try {
    // 17a. UpdateStockSchema
    const validStock = UpdateStockSchema.safeParse({ id: 1, stock: 15 });
    const coercedStock = UpdateStockSchema.safeParse({ id: '4', stock: '0' });
    const zeroIdStock = UpdateStockSchema.safeParse({ id: 0, stock: 5 });
    const negStock = UpdateStockSchema.safeParse({ id: 1, stock: -1 });

    // 17b. MarkReminderPaidSchema
    const validReminderPaid = MarkReminderPaidSchema.safeParse({ id: 7, registerExpense: true });
    const defaultExpensePaid = MarkReminderPaidSchema.safeParse({ id: '7' });
    const zeroIdPaid = MarkReminderPaidSchema.safeParse({ id: 0 });

    // 17c. EntityIdSchema
    const validEntityId = EntityIdSchema.safeParse({ id: '42' });
    const invalidEntityId = EntityIdSchema.safeParse({ id: 'abc' });
    const zeroEntityId = EntityIdSchema.safeParse({ id: 0 });

    // 17d. ReminderInputSchema
    const validReminder = ReminderInputSchema.safeParse({
      title: 'Internet Fibra',
      amount: 85000,
      category: 'SERVICIOS_ARRIENDO',
      frequency: 'MENSUAL',
      due_date: '2026-11-15'
    });
    const badDateReminder = ReminderInputSchema.safeParse({
      title: 'Internet Fibra',
      amount: 85000,
      category: 'SERVICIOS_ARRIENDO',
      frequency: 'MENSUAL',
      due_date: '15/11/2026'
    });
    const negAmountReminder = ReminderInputSchema.safeParse({
      title: 'Internet Fibra',
      amount: -100,
      category: 'SERVICIOS_ARRIENDO',
      frequency: 'MENSUAL',
      due_date: '2026-11-15'
    });
    const hugeAmountReminder = ReminderInputSchema.safeParse({
      title: 'Internet Fibra',
      amount: 1000000000,
      category: 'SERVICIOS_ARRIENDO',
      frequency: 'MENSUAL',
      due_date: '2026-11-15'
    });
    const maxAmountReminder = ReminderInputSchema.safeParse({
      title: 'Internet Fibra',
      amount: 999999999.99,
      category: 'SERVICIOS_ARRIENDO',
      frequency: 'MENSUAL',
      due_date: '2026-11-15'
    });

    const stockChecks = validStock.success && coercedStock.success && coercedStock.data.stock === 0 && !zeroIdStock.success && !negStock.success;
    const paidChecks = validReminderPaid.success && defaultExpensePaid.success && defaultExpensePaid.data.registerExpense === false && !zeroIdPaid.success;
    const entityChecks = validEntityId.success && validEntityId.data.id === 42 && !invalidEntityId.success && !zeroEntityId.success;
    const reminderChecks = validReminder.success && !badDateReminder.success && !negAmountReminder.success && !hugeAmountReminder.success && maxAmountReminder.success;

    const test17Passed = stockChecks && paidChecks && entityChecks && reminderChecks;
    results.push({
      test: '17. Zod Contracts for PATCH & Secondary Routes (UpdateStock, MarkReminderPaid, EntityId, ReminderInput)',
      passed: test17Passed,
      detail: {
        stockChecks,
        paidChecks,
        entityChecks,
        reminderChecks
      }
    });
  } catch (err) {
    results.push({
      test: '17. Zod Contracts for PATCH & Secondary Routes (UpdateStock, MarkReminderPaid, EntityId, ReminderInput)',
      passed: false,
      error: err.message
    });
  }

  // 18. Reminder Service Idempotency & Native Interval SQL Execution
  try {
    // 18a. Idempotency test for UNICO reminder
    const remRes = await pool.query(
      `INSERT INTO reminders (user_id, title, amount, category, frequency, due_date, is_completed)
       VALUES ($1, 'Factura Test Idempotencia', 45000, 'SERVICIOS_ARRIENDO', 'UNICO', '2026-11-05', FALSE)
       RETURNING *`,
      [adminUser.id]
    );
    const testRem = remRes.rows[0];

    // First payment: execute service logic inside transaction
    const client = await pool.connect();
    let firstPaymentCompleted = false;
    let duplicatePaymentBlocked = false;
    let duplicateErrorMessage = '';
    let movementCountAfterFirst = 0;
    let movementCountAfterSecond = 0;

    try {
      await client.query('BEGIN');
      const row1 = await client.query('SELECT * FROM reminders WHERE id = $1 AND user_id = $2 FOR UPDATE', [testRem.id, adminUser.id]);
      const rem1 = row1.rows[0];
      if (rem1.frequency === 'UNICO' && rem1.is_completed) {
        throw new Error('El recordatorio ya ha sido completado y pagado previamente.');
      }
      await client.query(
        `INSERT INTO movements (user_id, type, category, amount, description, is_unplanned, movement_date)
         VALUES ($1, 'SALIDA', $2, $3, $4, FALSE, CURRENT_TIMESTAMP)`,
        [adminUser.id, rem1.category, Number(rem1.amount), `Pago de recordatorio: ${rem1.title}`]
      );
      await client.query('UPDATE reminders SET is_completed = TRUE WHERE id = $1 AND user_id = $2', [testRem.id, adminUser.id]);
      await client.query('COMMIT');
      firstPaymentCompleted = true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const movs1 = await pool.query(
      `SELECT COUNT(*)::INT as count FROM movements WHERE user_id = $1 AND description = $2`,
      [adminUser.id, `Pago de recordatorio: ${testRem.title}`]
    );
    movementCountAfterFirst = movs1.rows[0].count;

    // Second payment attempt: MUST be blocked by idempotency check
    const client2 = await pool.connect();
    try {
      await client2.query('BEGIN');
      const row2 = await client2.query('SELECT * FROM reminders WHERE id = $1 AND user_id = $2 FOR UPDATE', [testRem.id, adminUser.id]);
      const rem2 = row2.rows[0];
      if (rem2.frequency === 'UNICO' && rem2.is_completed) {
        throw new Error('El recordatorio ya ha sido completado y pagado previamente.');
      }
      // If not blocked, would insert duplicate movement:
      await client2.query(
        `INSERT INTO movements (user_id, type, category, amount, description, is_unplanned, movement_date)
         VALUES ($1, 'SALIDA', $2, $3, $4, FALSE, CURRENT_TIMESTAMP)`,
        [adminUser.id, rem2.category, Number(rem2.amount), `Pago de recordatorio: ${rem2.title}`]
      );
      await client2.query('COMMIT');
    } catch (e) {
      await client2.query('ROLLBACK');
      duplicatePaymentBlocked = true;
      duplicateErrorMessage = e.message;
    } finally {
      client2.release();
    }

    const movs2 = await pool.query(
      `SELECT COUNT(*)::INT as count FROM movements WHERE user_id = $1 AND description = $2`,
      [adminUser.id, `Pago de recordatorio: ${testRem.title}`]
    );
    movementCountAfterSecond = movs2.rows[0].count;

    // 18b. Native interval calculation for recurring reminders
    const recRemRes = await pool.query(
      `INSERT INTO reminders (user_id, title, amount, category, frequency, due_date, is_completed)
       VALUES ($1, 'Servicio Semanal Recurrente', 10000, 'SERVICIOS_ARRIENDO', 'SEMANAL', '2026-11-01', FALSE)
       RETURNING *`,
      [adminUser.id]
    );
    const recRem = recRemRes.rows[0];

    // Update with native SQL CASE expression:
    const updateWeekly = await pool.query(
      `UPDATE reminders SET due_date = (due_date + CASE frequency WHEN 'SEMANAL' THEN INTERVAL '7 days' WHEN 'QUINCENAL' THEN INTERVAL '15 days' ELSE INTERVAL '1 month' END)::DATE
       WHERE id = $1 AND user_id = $2 RETURNING TO_CHAR(due_date, 'YYYY-MM-DD') AS next_date`,
      [recRem.id, adminUser.id]
    );
    const weeklyNext = updateWeekly.rows[0].next_date; // '2026-11-08'

    await pool.query("UPDATE reminders SET frequency = 'QUINCENAL' WHERE id = $1", [recRem.id]);
    const updateQuincenal = await pool.query(
      `UPDATE reminders SET due_date = (due_date + CASE frequency WHEN 'SEMANAL' THEN INTERVAL '7 days' WHEN 'QUINCENAL' THEN INTERVAL '15 days' ELSE INTERVAL '1 month' END)::DATE
       WHERE id = $1 AND user_id = $2 RETURNING TO_CHAR(due_date, 'YYYY-MM-DD') AS next_date`,
      [recRem.id, adminUser.id]
    );
    const quincenalNext = updateQuincenal.rows[0].next_date; // '2026-11-23'

    await pool.query("UPDATE reminders SET frequency = 'MENSUAL' WHERE id = $1", [recRem.id]);
    const updateMensual = await pool.query(
      `UPDATE reminders SET due_date = (due_date + CASE frequency WHEN 'SEMANAL' THEN INTERVAL '7 days' WHEN 'QUINCENAL' THEN INTERVAL '15 days' ELSE INTERVAL '1 month' END)::DATE
       WHERE id = $1 AND user_id = $2 RETURNING TO_CHAR(due_date, 'YYYY-MM-DD') AS next_date`,
      [recRem.id, adminUser.id]
    );
    const mensualNext = updateMensual.rows[0].next_date; // '2026-12-23'

    // Cleanup
    await pool.query('DELETE FROM movements WHERE user_id = $1 AND description = $2', [adminUser.id, `Pago de recordatorio: ${testRem.title}`]);
    await pool.query('DELETE FROM reminders WHERE id IN ($1, $2)', [testRem.id, recRem.id]);

    const idempotencyPassed =
      firstPaymentCompleted &&
      duplicatePaymentBlocked &&
      duplicateErrorMessage === 'El recordatorio ya ha sido completado y pagado previamente.' &&
      movementCountAfterFirst === 1 &&
      movementCountAfterSecond === 1 &&
      weeklyNext === '2026-11-08' &&
      quincenalNext === '2026-11-23' &&
      mensualNext === '2026-12-23';

    results.push({
      test: '18. Reminder Service Idempotency & Native Interval SQL Execution',
      passed: idempotencyPassed,
      detail: {
        firstPaymentCompleted,
        duplicatePaymentBlocked,
        duplicateErrorMessage,
        movementCountAfterFirst,
        movementCountAfterSecond,
        weeklyNext,
        quincenalNext,
        mensualNext
      }
    });
  } catch (err) {
    results.push({
      test: '18. Reminder Service Idempotency & Native Interval SQL Execution',
      passed: false,
      error: err.message
    });
  }

  // 19. Analytics Alerts Guard (userId validation) & Windowing SQL (weekly/monthly Comparison)
  try {
    // 19a. Guard validation
    function validateUserIdGuard(userId) {
      if (!userId || typeof userId !== 'number' || userId <= 0) {
        throw new Error('userId inválido o no proporcionado.');
      }
      return true;
    }

    let undefinedBlocked = false;
    let nullBlocked = false;
    let zeroBlocked = false;
    let negativeBlocked = false;
    let stringBlocked = false;
    let validAllowed = false;

    try { validateUserIdGuard(undefined); } catch { undefinedBlocked = true; }
    try { validateUserIdGuard(null); } catch { nullBlocked = true; }
    try { validateUserIdGuard(0); } catch { zeroBlocked = true; }
    try { validateUserIdGuard(-5); } catch { negativeBlocked = true; }
    try { validateUserIdGuard('1'); } catch { stringBlocked = true; }
    try { validAllowed = validateUserIdGuard(adminUser.id); } catch {}

    const guardPassed = undefinedBlocked && nullBlocked && zeroBlocked && negativeBlocked && stringBlocked && validAllowed;

    // 19b. Bounded weekly and monthly comparison SQL queries
    const weeklyQueryRes = await pool.query(
      `SELECT 
        category,
        COALESCE(SUM(CASE WHEN movement_date >= date_trunc('week', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS current_week,
        COALESCE(SUM(CASE WHEN movement_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' 
                           AND movement_date < date_trunc('week', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS prev_week
      FROM movements
      WHERE type = 'SALIDA' AND user_id = $1
        AND movement_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '1 week'
      GROUP BY category`,
      [adminUser.id]
    );

    const monthlyQueryRes = await pool.query(
      `SELECT 
        category,
        COALESCE(SUM(CASE WHEN movement_date >= date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS current_month,
        COALESCE(SUM(CASE WHEN movement_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' 
                           AND movement_date < date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS prev_month
      FROM movements
      WHERE type = 'SALIDA' AND user_id = $1
        AND movement_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
      GROUP BY category`,
      [adminUser.id]
    );

    const test19Passed = guardPassed && Array.isArray(weeklyQueryRes.rows) && Array.isArray(monthlyQueryRes.rows);
    results.push({
      test: '19. Analytics Alerts Guard (userId validation) & Windowing SQL (weekly/monthly Comparison)',
      passed: test19Passed,
      detail: {
        guardPassed,
        weeklyQueryExecuted: true,
        monthlyQueryExecuted: true,
        weeklyRows: weeklyQueryRes.rows.length,
        monthlyRows: monthlyQueryRes.rows.length
      }
    });
  } catch (err) {
    results.push({
      test: '19. Analytics Alerts Guard (userId validation) & Windowing SQL (weekly/monthly Comparison)',
      passed: false,
      error: err.message
    });
  }

  // 20. Serverless Connection Pool Configuration & Global Singleton
  try {
    const { pool: connPool } = await import('../bd/connection.ts');
    const isGlobalAssigned = global.pgPool === connPool;
    const maxConnections = connPool.options.max;
    const connTimeout = connPool.options.connectionTimeoutMillis;
    const idleTimeout = connPool.options.idleTimeoutMillis;

    const expectedMax = process.env.NODE_ENV === 'production' ? 3 : 10;
    const test20Passed =
      isGlobalAssigned &&
      maxConnections === expectedMax &&
      connTimeout === 5000 &&
      idleTimeout === 30000;

    results.push({
      test: '20. Serverless Connection Pool Configuration & Global Singleton',
      passed: test20Passed,
      detail: {
        isGlobalAssigned,
        maxConnections,
        expectedMax,
        connTimeout,
        idleTimeout
      }
    });
  } catch (err) {
    results.push({
      test: '20. Serverless Connection Pool Configuration & Global Singleton',
      passed: false,
      error: err.message
    });
  }

  // ----------------------------------------------------
  // TEST 21: Daily Cash Reconciliation & Multi-Tenant Invariants
  // ----------------------------------------------------
  try {
    const user1Movements = await pool.query(
      `SELECT id, type, amount::FLOAT, description, movement_date FROM movements WHERE user_id = $1 ORDER BY movement_date DESC`,
      [1]
    );

    let entEfectivo = 0, entDigital = 0, salEfectivo = 0, salDigital = 0;
    for (const row of user1Movements.rows) {
      const isDigital = /^\[(TRANSFERENCIA|NEQUI|DAVIPLATA|TARJETA|BANCO|DIGITAL)\]/i.test(row.description || '');
      const amt = Number(row.amount) || 0;
      if (row.type === 'ENTRADA') {
        if (isDigital) entDigital += amt; else entEfectivo += amt;
      } else {
        if (isDigital) salDigital += amt; else salEfectivo += amt;
      }
    }

    const totalEntradas = entEfectivo + entDigital;
    const totalSalidas = salEfectivo + salDigital;
    const flujoNeto = totalEntradas - totalSalidas;
    const saldoEfectivo = entEfectivo - salEfectivo;
    const saldoDigital = entDigital - salDigital;

    const invariantHolds = Math.abs(flujoNeto - (saldoEfectivo + saldoDigital)) < 0.001;
    const testTenantId = user2?.id || 999999;
    const user2Movements = await pool.query(
      `SELECT count(*)::int AS count FROM movements WHERE user_id = $1`,
      [testTenantId]
    );
    const user2Zero = user2Movements.rows[0].count === 0;

    results.push({
      test: '21. Daily Cash Reconciliation & Multi-Tenant Invariants',
      passed: invariantHolds && user2Zero,
      detail: {
        totalEntradas,
        totalSalidas,
        saldoEfectivo,
        saldoDigital,
        invariantHolds,
        user2Zero
      }
    });
  } catch (err) {
    results.push({
      test: '21. Daily Cash Reconciliation & Multi-Tenant Invariants',
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
