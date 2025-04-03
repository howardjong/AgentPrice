/**
 * Database client setup using Drizzle ORM
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../shared/schema';

// Environment variables should be loaded by the time this module is imported
if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL not found in environment. Database operations will fail.');
}

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Reasonable pool defaults for a Node.js server
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Add error handler to avoid unhandled promise rejections
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Export the drizzle client with our schema
export const db = drizzle(pool, { schema });

// Export the pool for direct use when needed (e.g., transactions)
export { pool };

/**
 * Helper function to run a function within a transaction
 * @param fn Function that receives a transaction client and performs operations
 * @returns Result of the function
 */
export async function withTransaction<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create a transaction db client
    const tx = drizzle(client, { schema });
    
    // Run the function with the transaction client
    const result = await fn(tx);
    
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Reset the database for testing - ONLY FOR TESTING ENVIRONMENTS
 */
export async function resetDatabase() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetDatabase can only be called in test environment');
  }
  
  const client = await pool.connect();
  try {
    // Drop all tables
    await client.query(`
      DROP TABLE IF EXISTS 
        users, 
        conversations, 
        messages, 
        research_jobs, 
        research_reports 
      CASCADE
    `);
    
    // Recreate schema (simplified example, in real app use migrations)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        title TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        service TEXT NOT NULL,
        visualization_data JSONB,
        citations JSONB,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS research_jobs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        query TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        progress INTEGER DEFAULT 0,
        job_id TEXT NOT NULL,
        options JSONB,
        result JSONB,
        error TEXT,
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS research_reports (
        id SERIAL PRIMARY KEY,
        job_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        citations JSONB,
        follow_up_questions JSONB,
        file_path TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

/**
 * Close all database connections - useful for testing
 */
export async function closeDatabaseConnections() {
  await pool.end();
}