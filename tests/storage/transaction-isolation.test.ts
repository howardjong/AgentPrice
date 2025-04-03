/**
 * Transaction Isolation Tests
 * 
 * This test suite verifies that our transaction isolation pattern
 * correctly prevents test data from persisting between tests.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { DbTestUtils } from '../utils/db-test-utils';

describe('Transaction Isolation', () => {
  const dbUtils = new DbTestUtils();
  const TEST_TABLE = 'users'; // Using an existing table for testing
  
  beforeAll(async () => {
    await dbUtils.connect();
    
    // Safety check - ensure we're using a test database
    dbUtils.verifyTestDatabase();
  });

  afterAll(async () => {
    await dbUtils.disconnect();
  });
  
  beforeEach(async () => {
    await dbUtils.beginTransaction();
  });
  
  afterEach(async () => {
    await dbUtils.rollbackTransaction();
  });

  test('transaction properly isolates data - changes are visible within transaction', async () => {
    // Generate unique test data
    const uniqueUsername = `isolation-test-user-${dbUtils.generateTimestamp()}`;
    const password = 'test-password';
    
    // Insert test data
    const insertResult = await dbUtils.executeQuery(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
      [uniqueUsername, password]
    );
    
    expect(insertResult.rows).toHaveLength(1);
    expect(insertResult.rows[0].id).toBeDefined();
    
    const userId = insertResult.rows[0].id;
    
    // Verify data exists within the transaction
    const selectResult = await dbUtils.executeQuery(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    expect(selectResult.rows).toHaveLength(1);
    expect(selectResult.rows[0].username).toBe(uniqueUsername);
    expect(selectResult.rows[0].password).toBe(password);
  });

  test('transaction properly rolls back - changes are not visible after rollback', async () => {
    // Generate unique test data
    const uniqueUsername = `rollback-test-user-${dbUtils.generateTimestamp()}`;
    const password = 'test-password';
    
    // First transaction - insert data and get ID
    let userId: number;
    
    {
      // Insert test data
      const insertResult = await dbUtils.executeQuery(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
        [uniqueUsername, password]
      );
      
      expect(insertResult.rows).toHaveLength(1);
      userId = insertResult.rows[0].id;
      
      // Verify data exists within the transaction
      const selectResult = await dbUtils.executeQuery(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      
      expect(selectResult.rows).toHaveLength(1);
    }
    
    // Roll back the transaction
    await dbUtils.rollbackTransaction();
    
    // Start a new transaction
    await dbUtils.beginTransaction();
    
    // Check that data doesn't exist in the new transaction
    const afterRollbackResult = await dbUtils.executeQuery(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    expect(afterRollbackResult.rows).toHaveLength(0);
  });

  test('transactions isolate tests from each other', async () => {
    // This test simulates two separate test cases running sequentially
    
    // First transaction
    const username1 = `isolation-test-1-${dbUtils.generateTimestamp()}`;
    
    // Create test data in first transaction
    const insert1 = await dbUtils.executeQuery(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
      [username1, 'password1']
    );
    
    const userId1 = insert1.rows[0].id;
    
    // Verify it exists in the first transaction
    const select1 = await dbUtils.executeQuery(
      'SELECT * FROM users WHERE id = $1',
      [userId1]
    );
    
    expect(select1.rows).toHaveLength(1);
    
    // Roll back the first transaction
    await dbUtils.rollbackTransaction();
    
    // Start a second transaction (simulating a second test)
    await dbUtils.beginTransaction();
    
    // Create different test data in second transaction
    const username2 = `isolation-test-2-${dbUtils.generateTimestamp()}`;
    
    const insert2 = await dbUtils.executeQuery(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
      [username2, 'password2']
    );
    
    const userId2 = insert2.rows[0].id;
    
    // Verify second transaction data exists
    const select2 = await dbUtils.executeQuery(
      'SELECT * FROM users WHERE id = $1',
      [userId2]
    );
    
    expect(select2.rows).toHaveLength(1);
    
    // Verify first transaction data doesn't exist in second transaction
    const selectPrevious = await dbUtils.executeQuery(
      'SELECT * FROM users WHERE id = $1',
      [userId1]
    );
    
    expect(selectPrevious.rows).toHaveLength(0);
  });

  test('executeQuery uses the transaction client when available', async () => {
    // This test verifies that executeQuery uses the transaction client
    // by checking that data created within a transaction is visible
    // to subsequent queries within the same transaction
    
    const uniqueUsername = `query-test-${dbUtils.generateTimestamp()}`;
    
    // Execute a query to insert data
    await dbUtils.executeQuery(
      'INSERT INTO users (username, password) VALUES ($1, $2)',
      [uniqueUsername, 'password']
    );
    
    // Execute another query to select the data
    // This should use the same transaction client as the insert
    const result = await dbUtils.executeQuery(
      'SELECT * FROM users WHERE username = $1',
      [uniqueUsername]
    );
    
    // If the query used the transaction client correctly, the data should be visible
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].username).toBe(uniqueUsername);
  });

  test('timeout mechanism works correctly', async () => {
    // Set a very short timeout to test the timeout mechanism
    const originalTimeout = 5000; // Assume default is 5000ms
    dbUtils.setQueryTimeout(1); // 1ms timeout
    
    // Execute a query that will take longer than the timeout
    try {
      await dbUtils.executeQuery('SELECT pg_sleep(0.5)'); // Sleep for 0.5 seconds
      // This should not be reached because the query should timeout
      expect(true).toBe(false);
    } catch (error) {
      // The error should be a timeout error
      expect(error.message).toContain('Query timeout after 1ms');
    } finally {
      // Reset the timeout to its original value
      dbUtils.setQueryTimeout(originalTimeout);
    }
  });
});