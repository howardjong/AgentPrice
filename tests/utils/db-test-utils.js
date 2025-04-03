/**
 * Database Test Utilities for Vitest
 * 
 * This module provides utilities for database testing with Vitest,
 * including connection management, transaction handling, and data seeding.
 */

import { db } from '../../services/database.js';

/**
 * Creates a dedicated test database with isolation
 * @returns {Object} Test database client with utility methods
 */
export async function createTestDatabase() {
  const uniqueName = `test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  const testDb = {
    // Database connection
    client: null,
    // Schema name for isolation
    schema: uniqueName,
    
    /**
     * Initialize the test database
     * @returns {Object} The test database object
     */
    async initialize() {
      this.client = await db.createConnection({
        database: 'postgres',
        application_name: 'vitest'
      });
      
      // Create a unique schema for isolation
      await this.client.query(`CREATE SCHEMA IF NOT EXISTS ${this.schema}`);
      await this.client.query(`SET search_path TO ${this.schema}`);
      
      // Create test tables
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS ${this.schema}.test_table (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);
      
      return this;
    },
    
    /**
     * Execute a SQL query
     * @param {string} sql SQL query to execute
     * @param {Array} params Query parameters
     * @returns {Object} Query result
     */
    async query(sql, params = []) {
      return this.client.query(sql, params);
    },
    
    /**
     * Start a database transaction
     */
    async beginTransaction() {
      await this.client.query('BEGIN');
    },
    
    /**
     * Commit a database transaction
     */
    async commitTransaction() {
      await this.client.query('COMMIT');
    },
    
    /**
     * Rollback a database transaction
     */
    async rollbackTransaction() {
      await this.client.query('ROLLBACK');
    },
    
    /**
     * Clean up the test database
     */
    async cleanup() {
      try {
        // Drop the schema and all its objects
        await this.client.query(`DROP SCHEMA IF EXISTS ${this.schema} CASCADE`);
      } finally {
        // Close the connection
        await this.client.end();
      }
    }
  };
  
  return testDb;
}

/**
 * Creates an in-memory database for testing
 * Note: Requires pg-mem to be installed
 * @returns {Object} In-memory database instance
 */
export async function createInMemoryDatabase() {
  try {
    // Dynamically import pg-mem to avoid dependency issues
    const { newDb } = await import('pg-mem');
    
    const inMemDb = newDb();
    
    // Configure the in-memory database
    const db = inMemDb.adapters.createPg();
    
    return {
      /**
       * Initialize the in-memory database
       */
      async initialize() {
        // Create schema and tables as needed
        await db.query(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE
          )
        `);
        return this;
      },
      
      /**
       * Execute a SQL query
       * @param {string} sql SQL query to execute
       * @param {Array} params Query parameters
       * @returns {Object} Query result
       */
      async query(sql, params = []) {
        return db.query(sql, params);
      },
      
      /**
       * Executes a statement without returning results
       * @param {string} sql SQL statement to execute
       * @param {Array} params Query parameters
       */
      async execute(sql, params = []) {
        await db.query(sql, params);
      },
      
      /**
       * Clean up resources
       */
      async cleanup() {
        // Nothing to clean up for in-memory database
      }
    };
  } catch (error) {
    console.error('Failed to create in-memory database:', error);
    throw new Error('pg-mem may not be installed. Install with: npm install pg-mem');
  }
}

/**
 * Seeds the database with test data
 * @param {Object} client Database client
 * @param {Object} data Test data to seed
 * @returns {Object} Database client
 */
export async function seedTestData(client, data = {}) {
  // Example implementation for seeding test data
  if (data.users) {
    for (const user of data.users) {
      await client.query(
        'INSERT INTO users(name, email) VALUES($1, $2) RETURNING id',
        [user.name, user.email]
      );
    }
  }
  
  if (data.conversations) {
    for (const conversation of data.conversations) {
      await client.query(
        'INSERT INTO conversations(title, user_id) VALUES($1, $2) RETURNING id',
        [conversation.title, conversation.user_id]
      );
    }
  }
  
  if (data.messages) {
    for (const message of data.messages) {
      await client.query(
        'INSERT INTO messages(content, conversation_id, role) VALUES($1, $2, $3) RETURNING id',
        [message.content, message.conversation_id, message.role || 'user']
      );
    }
  }
  
  return client;
}

/**
 * Clears all test data from tables
 * @param {Object} client Database client
 * @returns {Object} Database client
 */
export async function clearTestData(client) {
  // Get all tables in the current schema
  const tablesResult = await client.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = current_schema()
  `);
  
  // Disable triggers temporarily
  await client.query('SET session_replication_role = replica');
  
  // Truncate all tables
  for (const row of tablesResult.rows) {
    await client.query(`TRUNCATE TABLE ${row.tablename} RESTART IDENTITY CASCADE`);
  }
  
  // Re-enable triggers
  await client.query('SET session_replication_role = DEFAULT');
  
  return client;
}

/**
 * Sets up a test transaction for database tests
 * @returns {Object} Transaction helper with setup and teardown methods
 */
export function setupTestTransaction() {
  let client = null;
  
  return {
    /**
     * Begin a test transaction
     * @returns {Object} Database client with active transaction
     */
    async setup() {
      client = await db.pool.connect();
      await client.query('BEGIN');
      return client;
    },
    
    /**
     * Roll back the test transaction and release the client
     */
    async teardown() {
      if (client) {
        await client.query('ROLLBACK');
        client.release();
        client = null;
      }
    }
  };
}

/**
 * Creates database fixtures for testing
 * @param {Object} client Database client
 * @returns {Object} Fixture factory methods
 */
export function createFixtures(client) {
  return {
    /**
     * Create a test user
     * @param {Object} data User data (optional)
     * @returns {Object} Created user
     */
    async createUser(data = {}) {
      const name = data.name || 'Test User';
      const email = data.email || `test-${Date.now()}@example.com`;
      
      const result = await client.query(
        'INSERT INTO users(name, email) VALUES($1, $2) RETURNING *',
        [name, email]
      );
      
      return result.rows[0];
    },
    
    /**
     * Create a test conversation
     * @param {Object} data Conversation data
     * @returns {Object} Created conversation
     */
    async createConversation(data = {}) {
      // Create a user if not provided
      let userId = data.user_id;
      if (!userId) {
        const user = await this.createUser();
        userId = user.id;
      }
      
      const title = data.title || 'Test Conversation';
      
      const result = await client.query(
        'INSERT INTO conversations(title, user_id) VALUES($1, $2) RETURNING *',
        [title, userId]
      );
      
      return result.rows[0];
    },
    
    /**
     * Create a test message
     * @param {Object} data Message data
     * @returns {Object} Created message
     */
    async createMessage(data = {}) {
      // Create a conversation if not provided
      let conversationId = data.conversation_id;
      if (!conversationId) {
        const conversation = await this.createConversation();
        conversationId = conversation.id;
      }
      
      const content = data.content || 'Test message content';
      const role = data.role || 'user';
      
      const result = await client.query(
        'INSERT INTO messages(content, conversation_id, role) VALUES($1, $2, $3) RETURNING *',
        [content, conversationId, role]
      );
      
      return result.rows[0];
    }
  };
}