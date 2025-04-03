/**
 * Tests for Database Safety Checks
 * 
 * This file contains tests for the database safety check utilities.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  verifyTestDatabase, 
  verifySafeSql, 
  createSafeDbClient, 
  createSafeDbPool 
} from '../../../utils/db-safety-checks.js';

describe('Database Safety Checks', () => {
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Reset env vars before each test
    delete process.env.SKIP_DB_SAFETY_CHECKS;
    // Mock console.warn to prevent noise in test output
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore original env vars
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });
  
  describe('verifyTestDatabase', () => {
    test('should accept connection strings with "test" in them', () => {
      expect(() => verifyTestDatabase('postgres://user:pass@localhost/test_db')).not.toThrow();
      expect(() => verifyTestDatabase('postgres://user:pass@localhost/test-database')).not.toThrow();
      expect(() => verifyTestDatabase('postgres://user:pass@localhost/my_test')).not.toThrow();
    });
    
    test('should accept connection strings with "dev" or "development" in them', () => {
      expect(() => verifyTestDatabase('postgres://user:pass@localhost/dev_db')).not.toThrow();
      expect(() => verifyTestDatabase('postgres://user:pass@localhost/development')).not.toThrow();
    });
    
    test('should reject connection strings without test indicators', () => {
      expect(() => verifyTestDatabase('postgres://user:pass@localhost/production')).toThrow();
      expect(() => verifyTestDatabase('postgres://user:pass@localhost/main_db')).toThrow();
      expect(() => verifyTestDatabase('postgres://user:pass@localhost/users')).toThrow();
    });
    
    test('should skip checks when SKIP_DB_SAFETY_CHECKS is true', () => {
      process.env.SKIP_DB_SAFETY_CHECKS = 'true';
      expect(() => verifyTestDatabase('postgres://user:pass@localhost/production')).not.toThrow();
      expect(console.warn).toHaveBeenCalled();
    });
    
    test('should throw on missing connection string', () => {
      expect(() => verifyTestDatabase(null)).toThrow('Missing database connection string');
      expect(() => verifyTestDatabase('')).toThrow('Missing database connection string');
    });
  });
  
  describe('verifySafeSql', () => {
    test('should accept safe SQL statements', () => {
      expect(() => verifySafeSql('SELECT * FROM users')).not.toThrow();
      expect(() => verifySafeSql('INSERT INTO users (name) VALUES ($1)')).not.toThrow();
      expect(() => verifySafeSql('UPDATE users SET name = $1 WHERE id = $2')).not.toThrow();
      expect(() => verifySafeSql('DELETE FROM users WHERE id = $1')).not.toThrow();
    });
    
    test('should reject destructive SQL by default', () => {
      expect(() => verifySafeSql('DROP TABLE users')).toThrow();
      expect(() => verifySafeSql('TRUNCATE TABLE users')).toThrow();
      expect(() => verifySafeSql('DELETE FROM users')).toThrow();
    });
    
    test('should allow destructive SQL when explicitly allowed', () => {
      expect(() => verifySafeSql('DROP TABLE users', true)).not.toThrow();
      expect(() => verifySafeSql('TRUNCATE TABLE users', true)).not.toThrow();
      expect(() => verifySafeSql('DELETE FROM users', true)).not.toThrow();
    });
    
    test('should skip checks when SKIP_DB_SAFETY_CHECKS is true', () => {
      process.env.SKIP_DB_SAFETY_CHECKS = 'true';
      expect(() => verifySafeSql('DROP TABLE users')).not.toThrow();
      expect(() => verifySafeSql('TRUNCATE TABLE users')).not.toThrow();
      expect(() => verifySafeSql('DELETE FROM users')).not.toThrow();
    });
  });
  
  describe('createSafeDbClient', () => {
    test('should wrap client to intercept unsafe queries', async () => {
      // Mock client with a query method
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        connectionString: 'postgres://user:pass@localhost/test_db'
      };
      
      // Create safe client
      const safeClient = createSafeDbClient(mockClient);
      
      // Safe query should pass through
      await safeClient.query('SELECT * FROM users');
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users');
      
      // Unsafe query should throw
      await expect(safeClient.query('DROP TABLE users')).rejects.toThrow();
      
      // Reset mock
      mockClient.query.mockClear();
      
      // With allowDestructive=true, unsafe queries should pass
      const permissiveClient = createSafeDbClient(mockClient, { allowDestructive: true });
      await permissiveClient.query('DROP TABLE users');
      expect(mockClient.query).toHaveBeenCalledWith('DROP TABLE users');
    });
    
    test('should verify database type by default', async () => {
      // Mock client with production connection string
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        connectionString: 'postgres://user:pass@localhost/production'
      };
      
      const safeClient = createSafeDbClient(mockClient);
      
      // Should throw on any query due to non-test database
      await expect(safeClient.query('SELECT * FROM users')).rejects.toThrow();
      
      // With isTestDatabase=true, it should skip the database check
      const overrideClient = createSafeDbClient(mockClient, { isTestDatabase: true });
      await overrideClient.query('SELECT * FROM users');
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users');
    });
  });
  
  describe('createSafeDbPool', () => {
    test('should wrap pool and its clients with safety checks', async () => {
      // Mock client returned by connect()
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn()
      };
      
      // Mock pool
      const mockPool = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        connect: vi.fn().mockResolvedValue(mockClient),
        connectionString: 'postgres://user:pass@localhost/test_db'
      };
      
      // Create safe pool
      const safePool = createSafeDbPool(mockPool);
      
      // Test pool-level query
      await safePool.query('SELECT * FROM users');
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users');
      
      // Test client from pool
      const client = await safePool.connect();
      await client.query('SELECT * FROM users WHERE id = $1', [1]);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
      
      // Unsafe query on client should throw
      await expect(client.query('DROP TABLE users')).rejects.toThrow();
    });
  });
});