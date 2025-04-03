/**
 * Database Testing Demo with Vitest
 * 
 * This file demonstrates best practices for database testing using Vitest
 * and the custom database utilities created for this project.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { 
  createTestDatabase, 
  seedTestData, 
  clearTestData,
  setupTestTransaction,
  createFixtures 
} from '../utils/db-test-utils.js';

// Sample database model to test
import { UserModel } from '../../models/user.js';

// This is a demo test suite for Vitest database testing
describe('Database Testing with Vitest (Demo)', () => {
  
  // Example 1: Using a test database with complete isolation
  describe('Isolated Database Tests', () => {
    let testDb;
    
    // Set up a completely isolated test database
    beforeAll(async () => {
      testDb = await createTestDatabase();
      await testDb.initialize();
    });
    
    // Clean up after all tests
    afterAll(async () => {
      await testDb.cleanup();
    });
    
    // Reset data before each test
    beforeEach(async () => {
      await clearTestData(testDb.client);
    });
    
    test('should create and retrieve records', async () => {
      // Insert test data
      await testDb.query(
        `INSERT INTO test_table (name) VALUES ($1)`,
        ['Test Record']
      );
      
      // Query the data
      const result = await testDb.query('SELECT * FROM test_table');
      
      // Assert the results
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('Test Record');
    });
    
    test('should update records correctly', async () => {
      // Insert test data
      const insertResult = await testDb.query(
        `INSERT INTO test_table (name) VALUES ($1) RETURNING id`,
        ['Original Name']
      );
      const id = insertResult.rows[0].id;
      
      // Update the record
      await testDb.query(
        `UPDATE test_table SET name = $1 WHERE id = $2`,
        ['Updated Name', id]
      );
      
      // Query the updated data
      const result = await testDb.query('SELECT * FROM test_table WHERE id = $1', [id]);
      
      // Assert the results
      expect(result.rows[0].name).toBe('Updated Name');
    });
  });
  
  // Example 2: Using transactions for test isolation
  describe('Transaction-based Database Tests', () => {
    const txHelper = setupTestTransaction();
    let client;
    
    // Start a transaction before each test
    beforeEach(async () => {
      client = await txHelper.setup();
    });
    
    // Roll back the transaction after each test
    afterEach(async () => {
      await txHelper.teardown();
    });
    
    test('should insert data within a transaction', async () => {
      // Create test tables if needed
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);
      
      // Insert data
      await client.query(
        'INSERT INTO test_users (name) VALUES ($1)',
        ['Transaction Test User']
      );
      
      // Query the data
      const result = await client.query('SELECT * FROM test_users');
      
      // Assert results
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('Transaction Test User');
      
      // This transaction will be rolled back, so the data won't persist
    });
    
    test('changes from previous test should not be visible', async () => {
      // Try to query the table from the previous test
      try {
        const result = await client.query('SELECT * FROM test_users');
        // If we get here, the table exists but should be empty
        expect(result.rows).toHaveLength(0);
      } catch (error) {
        // If the table doesn't exist, that's also fine
        expect(error.message).toContain('relation "test_users" does not exist');
      }
    });
  });
  
  // Example 3: Testing models with fixtures
  describe('Model Testing with Fixtures', () => {
    let testDb;
    let fixtures;
    
    // Set up a test database and fixtures
    beforeAll(async () => {
      testDb = await createTestDatabase();
      await testDb.initialize();
      
      // Create necessary tables for the user model
      await testDb.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE
        )
      `);
      
      // Create fixture factory
      fixtures = createFixtures(testDb.client);
    });
    
    // Clean up after tests
    afterAll(async () => {
      await testDb.cleanup();
    });
    
    // Clear data before each test
    beforeEach(async () => {
      await clearTestData(testDb.client);
    });
    
    test('should create a user through the model', async () => {
      // Set up the UserModel to use our test client
      UserModel.setClient(testDb.client);
      
      // Create a user through the model
      const user = await UserModel.create({
        name: 'Model Test User',
        email: 'model-test@example.com'
      });
      
      // Verify the user was created
      expect(user.id).toBeDefined();
      expect(user.name).toBe('Model Test User');
      
      // Verify it exists in the database
      const result = await testDb.query('SELECT * FROM users WHERE id = $1', [user.id]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].email).toBe('model-test@example.com');
    });
    
    test('should use fixtures to create test data', async () => {
      // Create a test user using the fixture
      const user = await fixtures.createUser({
        name: 'Fixture User',
        email: 'fixture@example.com'
      });
      
      // Verify the user was created
      expect(user.id).toBeDefined();
      expect(user.name).toBe('Fixture User');
      
      // Use the fixture to create related data
      await fixtures.createMessage({
        user_id: user.id,
        content: 'Test message content'
      });
      
      // Verify the message is linked to the user
      // (This would require a join query in a real implementation)
    });
  });
  
  // Example 4: Testing database migrations
  describe('Database Migration Tests', () => {
    let testDb;
    
    beforeAll(async () => {
      testDb = await createTestDatabase();
      await testDb.initialize();
    });
    
    afterAll(async () => {
      await testDb.cleanup();
    });
    
    test('should apply migrations correctly', async () => {
      // This is a simplified example of testing migrations
      
      // Step 1: Create migration function
      const runMigration = async (client) => {
        // Create a users table
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
        
        // Create an index on email
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)
        `);
        
        return true;
      };
      
      // Step 2: Run the migration
      const result = await runMigration(testDb.client);
      expect(result).toBe(true);
      
      // Step 3: Verify the migration was applied correctly
      
      // Check if users table exists
      const tableResult = await testDb.query(`
        SELECT EXISTS (
          SELECT FROM pg_tables 
          WHERE schemaname = current_schema() AND tablename = 'users'
        )
      `);
      expect(tableResult.rows[0].exists).toBe(true);
      
      // Check if index exists
      const indexResult = await testDb.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE schemaname = current_schema() AND indexname = 'idx_users_email'
        )
      `);
      expect(indexResult.rows[0].exists).toBe(true);
    });
    
    test('should roll back migrations correctly', async () => {
      // Create rollback function
      const rollbackMigration = async (client) => {
        // Drop the index
        await client.query(`
          DROP INDEX IF EXISTS idx_users_email
        `);
        
        // Drop the table
        await client.query(`
          DROP TABLE IF EXISTS users
        `);
        
        return true;
      };
      
      // Run the rollback
      const result = await rollbackMigration(testDb.client);
      expect(result).toBe(true);
      
      // Verify the table no longer exists
      const tableResult = await testDb.query(`
        SELECT EXISTS (
          SELECT FROM pg_tables 
          WHERE schemaname = current_schema() AND tablename = 'users'
        )
      `);
      expect(tableResult.rows[0].exists).toBe(false);
    });
  });
});

// Note: This is a mock implementation for demonstration purposes
// In a real application, this would be properly implemented
const UserModel = {
  client: null,
  
  setClient(client) {
    this.client = client;
  },
  
  async create(userData) {
    const result = await this.client.query(
      'INSERT INTO users(name, email) VALUES($1, $2) RETURNING *',
      [userData.name, userData.email]
    );
    return result.rows[0];
  },
  
  async findById(id) {
    const result = await this.client.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }
};