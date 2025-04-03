/**
 * Database Connection Module
 * 
 * This module handles database connection using Drizzle ORM with PostgreSQL.
 * It includes connection pooling, query logging, and typed query execution.
 */

import { env } from '../config/env';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';

// Log queries in development mode
const queryLogging = env.NODE_ENV === 'development';

// Configuration for the PostgreSQL client
const connectionConfig = {
  max: 10, // Maximum number of connections
  idle_timeout: 30, // Idle connection timeout in seconds
  connect_timeout: 10, // Connection timeout in seconds
  prepare: false, // Use query preparation for better performance
  debug: queryLogging, // Log queries in development
};

// Create a PostgreSQL client
export const sql = postgres(env.DATABASE_URL, connectionConfig);

// Create a typed Drizzle ORM instance
export const db = drizzle(sql, { schema });

// Helper function to run transactions
export async function transaction<T>(
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  return await sql.begin(async (sqlTransaction) => {
    const tx = drizzle(sqlTransaction, { schema });
    return await callback(tx);
  });
}

// Helper function to run queries in batches
export async function batchQuery<T>(
  items: any[],
  batchSize: number,
  queryFn: (batch: any[]) => Promise<T[]>
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await queryFn(batch);
    results.push(...batchResults);
  }
  
  return results;
}

// Helper function for typed execution of raw SQL queries
export async function rawQuery<T>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  const result = await sql.unsafe(query, params);
  return result as unknown as T[];
}

// Close the database connection when the application exits
process.on('beforeExit', async () => {
  await sql.end();
});

export default db;