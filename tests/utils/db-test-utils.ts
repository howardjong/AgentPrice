/**
 * Database Testing Utilities
 * 
 * This module provides utilities for safely testing database operations
 * with transaction isolation and proper cleanup.
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import crypto from 'crypto';

export class DbTestUtils {
  private pool: Pool | null = null;
  private client: PoolClient | null = null;
  private inTransaction: boolean = false;
  private queryTimeoutMs: number = 5000; // 5 second default timeout for queries

  /**
   * Connect to the database using the DATABASE_URL environment variable
   */
  async connect(): Promise<void> {
    if (this.pool) {
      return; // Already connected
    }

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1, // Limit pool size for tests
      idleTimeoutMillis: 10000, // Close idle connections after 10 seconds
      connectionTimeoutMillis: 5000, // Connection timeout after 5 seconds
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      client.release();
    } catch (error) {
      throw new Error(`Failed to connect to database: ${error.message}`);
    }
  }

  /**
   * Disconnect from the database, cleaning up all resources
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      // Roll back any open transaction before disconnecting
      if (this.inTransaction) {
        try {
          await this.client.query('ROLLBACK');
          this.inTransaction = false;
        } catch (error) {
          console.error('Error rolling back transaction during disconnect:', error);
        }
      }
      
      this.client.release();
      this.client = null;
    }
    
    if (this.pool) {
      try {
        await this.pool.end();
      } catch (error) {
        console.error('Error ending pool during disconnect:', error);
      }
      this.pool = null;
    }
  }

  /**
   * Begin a new transaction
   * Will roll back any existing transaction if one exists
   */
  async beginTransaction(): Promise<void> {
    if (!this.pool) {
      throw new Error('Call connect() before beginTransaction()');
    }
    
    // If we already have a client with an open transaction, roll it back first
    if (this.client && this.inTransaction) {
      try {
        await this.client.query('ROLLBACK');
      } catch (error) {
        console.error('Error rolling back existing transaction:', error);
      }
      
      this.client.release();
      this.client = null;
      this.inTransaction = false;
    }
    
    // Get a new client from the pool
    this.client = await this.pool.connect();
    
    // Start a new transaction
    await this.client.query('BEGIN');
    this.inTransaction = true;
  }

  /**
   * Roll back the current transaction
   */
  async rollbackTransaction(): Promise<void> {
    if (this.client && this.inTransaction) {
      await this.client.query('ROLLBACK');
      this.inTransaction = false;
      
      // Release the client back to the pool
      this.client.release();
      this.client = null;
    }
  }

  /**
   * Commit the current transaction
   * Note: This should rarely be used in tests, as most tests should roll back transactions
   */
  async commitTransaction(): Promise<void> {
    if (this.client && this.inTransaction) {
      await this.client.query('COMMIT');
      this.inTransaction = false;
      
      // Release the client back to the pool
      this.client.release();
      this.client = null;
    }
  }

  /**
   * Execute a SQL query with parameters
   * @param query The SQL query string
   * @param params The query parameters
   * @returns The query result
   */
  async executeQuery(query: string, params: any[] = []): Promise<QueryResult> {
    if (!this.client && !this.pool) {
      throw new Error('Call connect() before executeQuery()');
    }
    
    // Since we've checked that at least one of client or pool is not null,
    // and we know that they both have a query method, we can safely assert
    // that the queryClient will also have a query method
    const queryClient = this.client || this.pool;
    
    // TypeScript doesn't understand our logic, so we'll help it with a non-null assertion
    // This is safe because we've checked above that at least one is not null
    const client = queryClient!;
    
    // Execute query with timeout to prevent tests from hanging
    const timeout = setTimeout(() => {
      throw new Error(`Query timeout after ${this.queryTimeoutMs}ms: ${query}`);
    }, this.queryTimeoutMs);
    
    try {
      const result = await client.query(query, params);
      clearTimeout(timeout);
      return result;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * Get a dedicated client with an active transaction
   * Note: The caller is responsible for rolling back the transaction and releasing the client
   * @returns A client with an active transaction
   */
  async getClientWithTransaction(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Call connect() before getClientWithTransaction()');
    }
    
    const client = await this.pool.connect();
    await client.query('BEGIN');
    
    return client;
  }

  /**
   * Set the timeout for query execution
   * @param timeoutMs Timeout in milliseconds
   */
  setQueryTimeout(timeoutMs: number): void {
    this.queryTimeoutMs = timeoutMs;
  }

  /**
   * Generate a unique ID for test data
   * @returns A UUID string
   */
  generateUniqueId(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate a unique timestamp string for test data
   * @returns A timestamp string
   */
  generateTimestamp(): string {
    return Date.now().toString();
  }

  /**
   * Verify we're connected to a test database
   * @throws Error if not connected to a test database
   */
  verifyTestDatabase(): void {
    if (!process.env.DATABASE_URL?.includes('test')) {
      throw new Error('Tests should only run against a test database');
    }
  }

  /**
   * Generate a unique test table name with a timestamp
   * This helps avoid collisions between concurrent test runs
   * @param baseTableName The base table name
   * @returns A unique table name with a timestamp
   */
  generateTestTableName(baseTableName: string): string {
    return `${baseTableName}_test_${this.generateTimestamp()}`;
  }

  /**
   * Clean up test data that might have been created outside transactions
   * @param tableName The table to clean
   * @param columnName The column to filter on
   * @param pattern The LIKE pattern to match
   */
  async cleanupTestData(tableName: string, columnName: string, pattern: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Call connect() before cleanupTestData()');
    }
    
    try {
      await this.executeQuery(`DELETE FROM ${tableName} WHERE ${columnName} LIKE $1`, [pattern]);
    } catch (error) {
      console.error(`Error cleaning up test data in ${tableName}:`, error);
    }
  }
}