/* ================================
  TL;DR  -->  postgres pool + env validation + query helper

  - creates a singleton pg pool (lazy init via getDbPool)
  - validates env with readable errors (getServerEnv + helpers)
  - provides query() wrapper used by services/seed
  - exposes pingDb() for smoke checks (not wired into routes yet)
================================ */


import pg from 'pg';  // postgres driver  -->  provides Pool for connection pooling
import dotenv from 'dotenv';  // loads .env into process.env for local dev/scripts


dotenv.config();  // load env once so any script importing db has access to config
const { Pool } = pg;  // Pool constructor  -->  creates managed/reused db connections
const ENV_ERROR_PREFIX = 'ENV_ERROR:';  // makes env failures easy to spot in logs


// keep a single pool per node process to avoid too many connections
export let cachedPool: pg.Pool | null = null;


// fail fast with a readable message when a required env var is missing
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${ENV_ERROR_PREFIX} missing ${key}`);
  return value;
}


// allow optional env keys while keeping defaults explicit
export function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}


// parse numeric env safely for pool tuning (max/timeout settings)
export function parseNumberEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw == null || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${ENV_ERROR_PREFIX} invalid ${key}`);
  return parsed;
}


// centralize server-only env so the rest of the code has a single source of truth
export function getServerEnv() {
  return {
    DATABASE_URL: requireEnv('DATABASE_URL'),
    DB_POOL_MAX: parseNumberEnv('DB_POOL_MAX', 10),
    DB_POOL_IDLE_TIMEOUT_MS: parseNumberEnv('DB_POOL_IDLE_TIMEOUT_MS', 30_000),
    DB_POOL_CONNECTION_TIMEOUT_MS: parseNumberEnv('DB_POOL_CONNECTION_TIMEOUT_MS', 2_000),
  };
}


// create the pool only when needed (no db side effects at import time)
export function getDbPool(): pg.Pool {
  if (cachedPool) return cachedPool;

  // validate env only at “first db use” so server can boot without DB configured
  const env = getServerEnv();

  // enable tls for supabase while keeping local postgres simple
  const isSupabase = env.DATABASE_URL.includes('supabase.co');

  cachedPool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT_MS,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  });

  // log successful connectivity for confidence during setup
  cachedPool.on('connect', () => {
    console.log('✅ Connected to Supabase database');
  });

  // surface unexpected pool issues without killing the whole app automatically
  cachedPool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
  });

  return cachedPool;
}


// allow scripts / tests to cleanup connections so node can exit cleanly
export async function closeDbPool(): Promise<void> {
  if (!cachedPool) return;
  await cachedPool.end();
  cachedPool = null;
}


// smoke probe for DB connectivity without depending on tables or migrations
export async function pingDb(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  const pool = getDbPool();

  // minimal query to prove we can talk to postgres
  await pool.query('SELECT 1'); 
  return { ok: true, latencyMs: Date.now() - start };
}


// keep your existing “query wrapper” API so services/seed can stay consistent
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();

  // reuse the singleton pool and validate env only when a query happens
  const pool = getDbPool();

  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // dev-only query logs for debugging (keep payload small and consistent)
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Query executed', {
        text,
        duration,
        rows: res.rowCount,
      });
    }

    return res;
  } catch (error) {
    console.error('❌ Query error:', error);
    throw error;
  }
};


// default export safely exposes the primary API
export default { getDbPool, closeDbPool, pingDb, query };