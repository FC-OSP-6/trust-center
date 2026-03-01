/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  Postgres pool, env validation, and migration layer

  - creates a singleton pg pool (lazy init via getDbPool)
  - validates env with readable errors (getServerEnv + helpers)
  - provides query() wrapper used by services/seed
  - exposes pingDb() for smoke checks (not wired into routes yet)
  - runs sql migrations from server/db/migrations (runMigrations + ensureDbSchema)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

/*
  Responsibilities:
  - Owns database connectivity and lifecycle management
  - Enforces environment validation for DB configuration
  - Provides shared query abstractions for services and scripts
  - Executes and tracks SQL-based schema migrations

  Consumed by:
  - Server services (via query / createTimedQuery)
  - Seed scripts and CLI tooling
  - Dev migration scripts

  Expected environment variables:
  - DATABASE_URL (required)
  - DB_POOL_MAX (optional, number)
  - DB_POOL_IDLE_TIMEOUT_MS (optional, number)
  - DB_POOL_CONNECTION_TIMEOUT_MS (optional, number)
*/

import pg from 'pg'; // postgres driver  -->  provides Pool for connection pooling
import dotenv from 'dotenv'; // loads .env into process.env for local dev / scripts
import fs from 'node:fs/promises'; // read migration files from disk
import path from 'node:path'; // build absolute paths for migrations folder
import { fileURLToPath } from 'node:url'; // resolve current file location in ESM

// ---------- env helpers ----------

dotenv.config(); // load env once so any script importing db has access to config
const ENV_ERROR_PREFIX = 'ENV_ERROR:'; // makes env failures easy to spot in logs

// requireEnv
// Ensures a required environment variable exists and throws with a standardized prefix if missing.
// Used during database configuration assembly.
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${ENV_ERROR_PREFIX} missing ${key}`);
  return value;
}

// optionalEnv
// Returns an environment variable if defined; otherwise returns the provided fallback.
// Keeps defaulting behavior explicit at the callsite.
export function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

// parseNumberEnv
// Parses a numeric environment variable with validation.
// Throws if the value is non-numeric; otherwise returns the fallback when undefined.
export function parseNumberEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw == null || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed))
    throw new Error(`${ENV_ERROR_PREFIX} invalid ${key}`);
  return parsed;
}

// getServerEnv
// Produces the validated database configuration object used to construct the pg Pool.
// Centralizes env access to avoid scattered process.env usage.
export function getServerEnv() {
  return {
    DATABASE_URL: requireEnv('DATABASE_URL'),
    DB_POOL_MAX: parseNumberEnv('DB_POOL_MAX', 10),
    DB_POOL_IDLE_TIMEOUT_MS: parseNumberEnv('DB_POOL_IDLE_TIMEOUT_MS', 30_000),
    DB_POOL_CONNECTION_TIMEOUT_MS: parseNumberEnv(
      'DB_POOL_CONNECTION_TIMEOUT_MS',
      2_000
    )
  };
}

// ----------  db pool lifecycle  ----------

// Pool constructor  -->  creates managed/reused db connections
const { Pool } = pg;

// keep a single pool per node process to avoid too many connections
export let cachedPool: pg.Pool | null = null;

// getDbPool
// Lazily initializes and returns a singleton pg.Pool instance.
// Defers environment validation and connection setup until first use.
export function getDbPool(): pg.Pool {
  if (cachedPool) return cachedPool;

  // validate env only at first db use  -->  server can boot without DB configured
  const env = getServerEnv();

  // Enable SSL automatically for hosted providers (e.g., Supabase); leave disabled for local development
  const isSupabase = env.DATABASE_URL.includes('supabase.com');
  cachedPool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT_MS,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined
  });

  // Log when a new client successfully connects to the pool
  cachedPool.on('connect', () => {
    console.log('✅  Connected to Supabase database \n');
  });

  // Log unexpected idle client errors without crashing the process
  cachedPool.on('error', err => {
    console.error('❌ Unexpected database error:', err);
  });

  return cachedPool;
}

// heartbeat check  -->  smoke probe for DB connectivity without depending on tables or migrations
export async function pingDb(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  const pool = getDbPool();

  // minimal query to prove postgres communication
  await pool.query('SELECT 1');
  return { ok: true, latencyMs: Date.now() - start };
}

// allow scripts / tests to cleanup connections so node can exit cleanly
export async function closeDbPool(): Promise<void> {
  if (!cachedPool) return;
  await cachedPool.end();
  cachedPool = null;
}

// ----------  migrations  ----------

// resolve migrations folder relative to THIS file  -->  works even when cwd changes
function getMigrationsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, 'migrations');
}

// runMigrations
// Applies pending .sql migrations in lexical order.
// Each migration executes in its own transaction and is tracked in schema_migrations.
export async function runMigrations(): Promise<{
  applied: string[];
  skipped: string[];
}> {
  const pool = getDbPool();
  const migrationsDir = getMigrationsDir(); // Absolute path to the migrations directory adjacent to this file

  // ensure migrations folder exists so failures are obvious and readable
  await fs.access(migrationsDir).catch(() => {
    throw new Error(
      `DB_MIGRATIONS_ERROR: missing migrations folder at ${migrationsDir}`
    );
  });

  // tracking table  -->  schema_migrations prevents double-applying migrations
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // read all .sql files and sort lexically (001_init.sql, 002_..., etc.)
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const allSqlFiles = entries
    .filter(e => e.isFile() && e.name.endsWith('.sql'))
    .map(e => e.name)
    .sort((a, b) => a.localeCompare(b));

  // load applied migration names so reruns are safe
  const appliedRes = await pool.query<{ name: string }>(
    'SELECT name FROM schema_migrations ORDER BY name ASC;'
  );
  const appliedSet = new Set(appliedRes.rows.map(r => r.name));

  const applied: string[] = [];
  const skipped: string[] = [];

  // apply each migration in order  -->  each migration gets its own transaction
  console.log(''); // new line for readability
  for (const filename of allSqlFiles) {
    if (appliedSet.has(filename)) {
      skipped.push(filename);
      continue;
    }

    // read the SQL from disk  -->  keep syntax highlighting + comments in the .sql file
    const fullPath = path.join(migrationsDir, filename);
    const sql = await fs.readFile(fullPath, 'utf8');

    // use a single client so BEGIN/COMMIT stays on one connection
    const client = await pool.connect();
    const startMs = Date.now();

    try {
      await client.query('BEGIN'); // wrap each migration in a transaction for safety
      await client.query(sql); // run the migration SQL exactly as written
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1);', [
        filename
      ]); // Record migration as applied
      await client.query('COMMIT'); // finalize changes for this migration

      applied.push(filename);
      console.log(
        `🧱  Migration applied:  ${filename}  (${Date.now() - startMs} ms)`
      ); // keep logs obvious in CI/dev
    } catch (err) {
      await client.query('ROLLBACK'); // keep DB clean on failure
      console.error(`❌  Migration failed: ${filename}`); // Log migration failure for visibility in CI and production logs
      throw err;
    } finally {
      client.release(); // always return the connection to the pool
    }
  }

  // summary log for quick confidence checks
  console.log(
    `\n🧾  Migrations summary:  applied = ${applied.length}  skipped = ${skipped.length}`
  );

  return { applied, skipped };
}

// “safe entry” helper used by seed/scripts (idempotent because schema_migrations tracks state)
export async function ensureDbSchema(): Promise<void> {
  await runMigrations();
}

// query
// Primary database execution helper used across services.
// Wraps pool.query with optional development logging.
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();

  // reuse the singleton pool and validate env only when a query happens
  const pool = getDbPool();

  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // dev-only query logs for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('\n📊  Query executed', {
        text,
        duration,
        rows: res.rowCount
      });
    }

    return res;
  } catch (error) {
    console.error('\n❌  Query error:', error);
    throw error;
  }
};

// ----------  scripts (dev-only helpers)  ----------

// runDbMigrate
// CLI-oriented migration runner that logs summary output and ensures pool shutdown.
export async function runDbMigrate(): Promise<void> {
  try {
    const summary = await runMigrations(); // apply new .sql files only

    // Log successful completion
    console.log('\n✅  migrate complete');
    console.log(summary);
  } catch (error) {
    // Surface failures and set non-zero exit code
    console.error('\n❌  migrate script failed:', error);
    process.exitCode = 1;
  } finally {
    // always close pool  -->  prevents hanging node processes
    await closeDbPool();
  }
}

// cleanApplyDb
// Drops selected application tables and re-applies migrations from scratch.
// Intended for local development resets and controlled rebuild scenarios.
export async function cleanApplyDb(): Promise<{
  dropped: string[];
  migrated: { applied: string[]; skipped: string[] };
}> {
  // list the exact objects we want to drop
  const targets = [
    'public.schema_migrations', // resets migration tracking  -->  ex: allows 001_init.sql re-applies
    'public.controls',
    'public.faqs'
  ];

  const pool = getDbPool(); // reuse the singleton pool
  await pool.query('begin'); // run everything as one atomic reset

  try {
    // drop each table explicitly  -->  cascade removes indexes / constraints automatically
    for (const name of targets) {
      console.log(`🧹  Dropping:  ${name}`);
      await pool.query(`drop table if exists ${name} cascade;`);
    }

    // Commit the drop transaction before re-running migrations
    await pool.query('commit');
  } catch (error) {
    // rollback on failure  -->  prevents half-reset states
    await pool.query('rollback');
    console.error('\n❌ cleanApplyDb failed:', error);
    throw error;
  }

  // run migrations after drops  -->  recreates schema from the migration folder
  const migrated = await runMigrations();

  return { dropped: targets, migrated };
}

// runCleanApplyDb
// CLI-oriented clean reset runner that drops tables, re-migrates, and closes the pool.
export async function runCleanApplyDb(): Promise<void> {
  try {
    const summary = await cleanApplyDb(); // run the drop + migrate

    // Log successful completion
    console.log('\n✅  clean apply complete');
    console.log(summary);
  } catch (error) {
    // Log failure and set non-zero exit code
    console.error('\n❌  clean apply script failed:', error);
    process.exitCode = 1; // non-zero exit
  } finally {
    await closeDbPool(); // prevents hanging node processes
  }
}

// ----------  exports  ----------

// exposes the primary API
export default {
  getDbPool, // creates / returns the singleton pg pool
  closeDbPool, // closes the pool so node can exit cleanly
  ensureDbSchema, // idempotent schema entrypoint (runs migrations)
  pingDb, // minimal connectivity check (SELECT 1)
  query, // shared query wrapper with dev logging
  runMigrations, // applies new .sql migrations and returns summary
  runDbMigrate, // script runner for migrations (logs + closes pool)
  cleanApplyDb, // drops app tables + re-runs migrations + returns summary
  runCleanApplyDb, // script runner for clean apply (logs + closes pool + sets exit)
  createTimedQuery // request-scoped db query wrapper (DEBUG_PERF)
};
