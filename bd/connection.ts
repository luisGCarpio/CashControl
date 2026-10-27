import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

declare global {
  // Evita múltiples conexiones en desarrollo con Hot Reload
  var pgPool: Pool | undefined;
}

function cleanConnectionString(raw?: string): string | undefined {
  if (!raw) return undefined;
  let url = raw.trim();
  if (url.startsWith('psql ')) {
    url = url.slice(5).trim();
  }
  if ((url.startsWith("'") && url.endsWith("'")) || (url.startsWith('"') && url.endsWith('"'))) {
    url = url.slice(1, -1).trim();
  }
  // Normalizar sslmode para evitar deprecation warning de libpq semantics
  if (url.includes('sslmode=require') && !url.includes('uselibpqcompat')) {
    url = url.replace('sslmode=require', 'sslmode=require&uselibpqcompat=true');
  }
  return url;
}

export const pool =
  global.pgPool ||
  new Pool({
    connectionString: cleanConnectionString(process.env.DATABASE_URL),
    ssl: {
      rejectUnauthorized: false, // Requerido por Neon
    },
    max: process.env.NODE_ENV === 'production' ? 3 : 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });

// Asignación incondicional para reutilizar el pool en entornos serverless y desarrollo
global.pgPool = pool;

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export type DbClient = {
  query: <T extends QueryResultRow = any>(text: string, params?: any[]) => Promise<QueryResult<T>>;
};

export async function withTransaction<T>(
  callback: (client: DbClient) => Promise<T>
): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignorar error secundario en rollback
    }
    throw error;
  } finally {
    client.release();
  }
}