/* ================================
  TL;DR  -->  postgres connection + query helper

  - creates a single pg pool
  - provides query() wrapper used by services/seed
================================ */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log('✅ Connected to Supabase database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Query executed', { 
        text,
        duration,
        rows: res.rowCount
      });
    }
    
    return res;
    
  } catch (error) {
    console.error('❌ Query error:', error);
    throw error;
  }
};

export default pool;