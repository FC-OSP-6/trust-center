/* ================================
  TL;DR  -->  postgres connection + query helper

  - creates a single pg pool
  - provides query() wrapper used by services/seed
================================ */

// ===========================================
// IMPORTS
// ===========================================

// Import the 'pg' library (node-postgres) - the official PostgreSQL client for Node.js
// This allows us to connect to and query PostgreSQL databases (including Supabase)
// Note: We needed to run `npm install --save-dev @types/pg` to get TypeScript type definitions
import pg from 'pg';

// Import dotenv to load environment variables from .env file
// This lets us access process.env.DATABASE_URL and other secrets without hardcoding them
import dotenv from 'dotenv';

// ===========================================
// ENVIRONMENT SETUP
// ===========================================

// Load environment variables from .env file into process.env
// Must be called before accessing any process.env variables
dotenv.config();

// Destructure the Pool class from the pg library
// Pool = a collection of database connections that can be reused
// Why use a pool? More efficient than creating a new connection for every query
const { Pool } = pg;

// ===========================================
// CONNECTION POOL CREATION
// ===========================================

// Create a single connection pool that will be shared across the entire application
// This pool maintains multiple persistent connections to the database
const pool = new Pool({
  // Connection string format: postgresql://username:password@host:port/database
  // We store this in .env for security (never commit credentials to git)
  connectionString: process.env.DATABASE_URL,
  
  // SSL configuration required for Supabase (and most cloud Postgres providers)
  ssl: {
    // rejectUnauthorized: false allows self-signed certificates
    // Supabase uses SSL but with certificates that would normally be rejected
    // In production, you might want stricter SSL verification, but this is standard for Supabase
    rejectUnauthorized: false
  }
});

// ===========================================
// CONNECTION EVENT LISTENERS
// ===========================================

// Listen for successful connection events
// 'connect' fires every time the pool establishes a new connection to the database
// Useful for debugging - confirms we can reach Supabase
pool.on('connect', () => {
  console.log('✅ Connected to Supabase database');
});

// Listen for unexpected errors on idle connections
// 'error' fires if a connection is lost unexpectedly (network issues, DB restart, etc.)
// Without this handler, the app would crash with "unhandled error" 
pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  // Exit with error code -1 to signal failure
  // In production, you might want more graceful error handling (retry logic, alerts, etc.)
  process.exit(-1);
});

// ===========================================
// QUERY WRAPPER FUNCTION
// ===========================================

/**
 * query - A reusable wrapper around pool.query()
 * 
 * Why create this instead of using pool.query() directly?
 * 1. Centralized error handling - all queries fail the same way
 * 2. Performance logging - see how long queries take (useful for optimization)
 * 3. Consistent interface - services/seed can import one function
 * 4. Future extensibility - can add retry logic, query caching, etc. in one place
 * 
 * @param text - The SQL query string (e.g., "SELECT * FROM users WHERE id = $1")
 * @param params - Optional array of values to safely inject into query (prevents SQL injection)
 *                 Example: query("SELECT * FROM users WHERE id = $1", [userId])
 *                 $1, $2, etc. are placeholders that pg will safely escape
 * @returns Promise<QueryResult> - Contains rows, rowCount, fields, etc.
 */
export const query = async (text: string, params?: any[]) => {
  // Record when query starts (for performance tracking)
  const start = Date.now();
  
  try {
    // Execute the query through the pool
    // pool.query() will:
    // 1. Grab an available connection from the pool
    // 2. Run the query
    // 3. Return the connection back to the pool for reuse
    const res = await pool.query(text, params);
    
    // Calculate how long the query took (in milliseconds)
    const duration = Date.now() - start;
    
    // Only log in development to avoid cluttering production logs
    // This helps debug slow queries during development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Query executed', { 
        text,              // The SQL query that ran
        duration,          // How long it took (ms)
        rows: res.rowCount // How many rows were affected/returned
      });
    }
    
    // Return the full result object
    // Contains: rows (array of data), rowCount, fields (column metadata), etc.
    return res;
    
  } catch (error) {
    // If query fails (syntax error, connection lost, constraint violation, etc.)
    // Log the error for debugging
    console.error('❌ Query error:', error);
    
    // Re-throw the error so calling code can handle it
    // Example: services.ts can catch this and return a GraphQL error
    throw error;
  }
};

// ===========================================
// DEFAULT EXPORT
// ===========================================

// Export the pool as default in case we need direct access
// Most code should use the `query` function, but pool export allows:
// - Transaction support (pool.connect() for BEGIN/COMMIT/ROLLBACK)
// - Streaming large result sets
// - Advanced connection management
export default pool;

/* ================================
  USAGE EXAMPLES:
  
  In services.ts:
  import { query } from './db.js';
  
  Simple query:
  const result = await query('SELECT * FROM controls');
  
  Parameterized query (safe from SQL injection):
  const result = await query(
    'SELECT * FROM controls WHERE category = $1',
    ['Security']
  );
  
  In seed.ts:
  await query(`
    CREATE TABLE IF NOT EXISTS controls (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL
    )
  `);
================================ */
