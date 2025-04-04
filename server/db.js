/**
 * PostgreSQL Database Client
 * 
 * This file provides a PostgreSQL client for database operations.
 * It sets up a connection pool and exports a db object for executing queries.
 */

import pkg from 'pg';
const { Pool } = pkg;
import logger from '../utils/logger.js';

// Connection pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // how long to wait for a connection
});

// Log connection events
pool.on('connect', () => {
  logger.debug('New PostgreSQL client connected');
});

pool.on('error', (err, client) => {
  logger.error(`Unexpected error on idle PostgreSQL client: ${err.message}`);
});

// Database interface for queries
export const db = {
  /**
   * Execute a SQL query
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise} Query result
   */
  async query(text, params = []) {
    const start = Date.now();
    const client = await pool.connect();
    
    try {
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      // Log query duration if it's slow
      if (duration > 500) {
        logger.warn(`Slow query (${duration}ms): ${text.substring(0, 80)}...`);
      } else if (process.env.DEBUG_SQL === 'true') {
        logger.debug(`Query (${duration}ms): ${text.substring(0, 80)}...`);
      }
      
      return result;
    } finally {
      client.release();
    }
  },
  
  /**
   * Execute a transaction with multiple queries
   * @param {Function} callback - Transaction callback function
   * @returns {Promise} Transaction result
   */
  async transaction(callback) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
  
  /**
   * End the pool
   * @returns {Promise} End result
   */
  async end() {
    return pool.end();
  }
};