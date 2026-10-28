import pg from 'pg';
const { Pool } = pg;

let url = process.env.DATABASE_URL?.trim() || '';
if (url.startsWith('psql ')) url = url.slice(5).trim();
if ((url.startsWith("'") && url.endsWith("'")) || (url.startsWith('"') && url.endsWith('"'))) {
  url = url.slice(1, -1).trim();
}

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

const keepMovementIds = [86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 208, 209];
const keepProductIds = [108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122];

async function cleanDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Limpieza de movimientos redundantes/test
    const delMov = await client.query('DELETE FROM movements WHERE NOT (id = ANY($1::int[]))', [keepMovementIds]);
    console.log(`[OK] Movimientos eliminados: ${delMov.rowCount}`);

    // 2. Limpieza de productos de prueba/duplicados
    const delProd = await client.query('DELETE FROM products WHERE NOT (id = ANY($1::int[]))', [keepProductIds]);
    console.log(`[OK] Productos eliminados: ${delProd.rowCount}`);

    // 3. Limpieza de inquilinos/usuarios de testing huérfanos
    const delUsers = await client.query("DELETE FROM users WHERE username != 'admin'");
    console.log(`[OK] Usuarios de prueba eliminados: ${delUsers.rowCount}`);

    // 4. Verificación de conteos finales
    const movCount = await client.query('SELECT count(*)::int as count FROM movements');
    const prodCount = await client.query('SELECT count(*)::int as count FROM products');
    const remCount = await client.query('SELECT count(*)::int as count FROM reminders');
    const userCount = await client.query('SELECT count(*)::int as count FROM users');

    console.log('\n--- CONTEO FINAL TRAS LIMPIEZA ---');
    console.log(`Productos: ${prodCount.rows[0].count} (Máximo permitido: 20)`);
    console.log(`Movimientos: ${movCount.rows[0].count} (Máximo permitido: 20)`);
    console.log(`Recordatorios: ${remCount.rows[0].count} (Solicitado: 5)`);
    console.log(`Usuarios: ${userCount.rows[0].count} (Admin principal)`);

    if (
      prodCount.rows[0].count <= 20 &&
      movCount.rows[0].count <= 20 &&
      remCount.rows[0].count === 5
    ) {
      await client.query('COMMIT');
      console.log('\n>>> Transacción confirmada (COMMIT) con éxito. Base de datos limpia y consistente.');
    } else {
      await client.query('ROLLBACK');
      console.error('\n[ERROR] Los conteos no coinciden con las restricciones. Operación revertida (ROLLBACK).');
      process.exit(1);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n[ERROR] Error durante la limpieza, transacción revertida:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanDatabase();
