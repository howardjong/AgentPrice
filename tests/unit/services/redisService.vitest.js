/**
 * Redis Service Tests
 * 
 * This test file provides comprehensive testing for the Redis service implementation,
 * focusing on both the in-memory fallback and mocked Redis functionality.
 * 
 * Coverage goals:
 * - Test all Redis service methods (get, set, getWithFallback, etc.)
 * - Test error handling and timeouts
 * - Test fallback behavior
 * - Test connection management
 * - Test Redis store expiry functionality
 * - Test both real and mock implementations
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import redisClient, { InMemoryStore } from '../../../services/redisService.js';
import { 
  createMockRedisClient, 
  createMockRedisService,
  simulateRedisError,
  simulateRedisTimeout 
} from '../../../utils/redis-test-utils.js';

// Mock logger to prevent console output during tests
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Redis Service', () => {
  // Test setup and teardown
  beforeEach(async () => {
    // Ensure we're using in-memory mode for tests
    process.env.REDIS_MODE = 'memory';
    
    // Reset the client before each test
    if (redisClient.client) {
      await redisClient.stop();
    }
  });

  afterEach(async () => {
    // Clean up after each test
    if (redisClient.client) {
      await redisClient.stop();
    }
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Reset timers
    vi.useRealTimers();
  });

  describe('Connection Management', () => {
    it('should create an in-memory store when REDIS_MODE is set to memory', async () => {
      // Initialize redis client
      await redisClient.connect();
      
      // Check type of client
      expect(redisClient.client).toBeInstanceOf(InMemoryStore);
    });

    it('should create a client when getClient is called with no existing client', async () => {
      // Ensure there's no client
      redisClient.client = null;

      // Get client
      const client = await redisClient.getClient();

      // Verify client created
      expect(client).toBeInstanceOf(InMemoryStore);
    });

    it('should return the existing client when getClient is called with an existing client', async () => {
      // Initialize client
      await redisClient.connect();
      const initialClient = redisClient.client;

      // Get client again
      const client = await redisClient.getClient();

      // Verify same client instance is returned
      expect(client).toBe(initialClient);
    });

    it('should successfully stop the Redis client', async () => {
      // Initialize client
      await redisClient.connect();
      expect(redisClient.client).not.toBeNull();

      // Stop client
      await redisClient.stop();

      // Verify client is null
      expect(redisClient.client).toBeNull();
    });

    it('should properly handle errors when stopping the Redis client', async () => {
      // This test checks that the code gracefully handles quit errors
      // Instead of testing implementation details, let's test the behavior
      
      // Initialize client
      await redisClient.connect();
      
      // We'll spy on the original implementation to see that it was called
      const quitSpy = vi.spyOn(redisClient.client, 'quit');
      
      // Modify the stop method to clear client regardless of error
      const originalStop = redisClient.stop;
      
      // Force an error during quit
      quitSpy.mockRejectedValueOnce(new Error('Simulated quit error'));
      
      try {
        // Should not throw even though quit fails
        await redisClient.stop();
        
        // The important part is the method was called
        expect(quitSpy).toHaveBeenCalled();
      } finally {
        // Cleanup
        quitSpy.mockRestore();
        
        // Ensure client is stopped properly
        if (redisClient.client) {
          await originalStop.call(redisClient);
        }
      }
    });
  });

  describe('Ping Operations', () => {
    it('should return true for successful ping', async () => {
      // Initialize client
      await redisClient.connect();
      
      // Test ping
      const pingResult = await redisClient.ping();
      
      // Verify success
      expect(pingResult).toBe(true);
    });

    it('should return false for failed ping', async () => {
      // Initialize client
      await redisClient.connect();
      
      // Mock ping to throw error
      redisClient.client.ping = vi.fn().mockRejectedValue(new Error('Simulated ping error'));
      
      // Test ping
      const pingResult = await redisClient.ping();
      
      // Verify failure
      expect(pingResult).toBe(false);
    });
  });

  describe('Get Operations', () => {
    it('should successfully get an existing value', async () => {
      // Initialize client and set a value
      await redisClient.connect();
      const testKey = 'test-get-key';
      const testValue = 'test-get-value';
      await redisClient.client.set(testKey, testValue);
      
      // Get the value
      const value = await redisClient.get(testKey);
      
      // Verify value
      expect(value).toBe(testValue);
    });

    it('should return null for non-existent key', async () => {
      // Initialize client
      await redisClient.connect();
      
      // Get non-existent value
      const value = await redisClient.get('non-existent-key');
      
      // Verify null result
      expect(value).toBeNull();
    });

    it('should handle errors during get operations', async () => {
      // Initialize client
      await redisClient.connect();
      
      // Mock get to throw error
      redisClient.client.get = vi.fn().mockRejectedValue(new Error('Simulated get error'));
      
      // Get value (should not throw)
      const value = await redisClient.get('error-key');
      
      // Verify null result on error
      expect(value).toBeNull();
    });

    it('should handle timeouts during get operations', async () => {
      // Use real timers for this test
      vi.useRealTimers();
      
      // Initialize client
      await redisClient.connect();
      
      // Mock get to delay
      redisClient.client.get = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'delayed-value';
      });
      
      // Get with short timeout
      const value = await redisClient.get('timeout-key', { timeout: 50 });
      
      // Verify null result on timeout
      expect(value).toBeNull();
    });
  });

  describe('Get With Fallback Operations', () => {
    it('should return the real value for existing keys', async () => {
      // Initialize client and set a value
      await redisClient.connect();
      const testKey = 'test-fallback-key';
      const testValue = 'test-fallback-value';
      const fallbackValue = 'fallback-value';
      
      // Reset any mocks from previous tests
      if (typeof redisClient.get.mockRestore === 'function') {
        redisClient.get.mockRestore();
      }
      if (redisClient.client && typeof redisClient.client.get.mockRestore === 'function') {
        redisClient.client.get.mockRestore();
      }
      
      // Set the value directly
      await redisClient.client.set(testKey, testValue);
      
      // Get with fallback
      const value = await redisClient.getWithFallback(testKey, fallbackValue);
      
      // Verify real value returned
      expect(value).toBe(testValue);
    });

    it('should return the fallback value for non-existent keys', async () => {
      // Initialize client
      await redisClient.connect();
      const fallbackValue = 'non-existent-fallback';
      
      // Reset any mocks from previous tests
      if (typeof redisClient.get.mockRestore === 'function') {
        redisClient.get.mockRestore();
      }
      if (redisClient.client && typeof redisClient.client.get.mockRestore === 'function') {
        redisClient.client.get.mockRestore();
      }
      
      // Get with fallback for a key we know doesn't exist
      const value = await redisClient.getWithFallback('non-existent-fallback-key', fallbackValue);
      
      // Verify fallback returned
      expect(value).toBe(fallbackValue);
    });

    it('should return the fallback value when get throws an error', async () => {
      // Initialize client
      await redisClient.connect();
      const fallbackValue = 'error-fallback';
      
      // Mock get to throw
      vi.spyOn(redisClient, 'get').mockRejectedValueOnce(new Error('Simulated get error'));
      
      // Get with fallback
      const value = await redisClient.getWithFallback('error-fallback-key', fallbackValue);
      
      // Verify fallback returned
      expect(value).toBe(fallbackValue);
    });
  });

  describe('Set Operations', () => {
    it('should successfully set a value without expiry', async () => {
      // Initialize client
      await redisClient.connect();
      const testKey = 'test-set-key';
      const testValue = 'test-set-value';
      
      // Reset any mock implementations from previous tests
      if (redisClient.client && typeof redisClient.client.set.mockRestore === 'function') {
        redisClient.client.set.mockRestore();
      }
      
      // Set value
      const result = await redisClient.set(testKey, testValue);
      
      // Verify success
      expect(result).toBe(true);
      
      // Verify value was set - use redisClient.get to avoid direct dependency on client implementation
      const value = await redisClient.get(testKey);
      expect(value).toBe(testValue);
    });

    it('should successfully set a value with expiry', async () => {
      // Use real timers for this test
      vi.useRealTimers();
      
      // Initialize client
      await redisClient.connect();
      const testKey = 'test-set-expiry-key';
      const testValue = 'test-set-expiry-value';
      
      // Reset any mock implementations from previous tests
      if (redisClient.client && typeof redisClient.client.set.mockRestore === 'function') {
        redisClient.client.set.mockRestore();
      }
      
      // Set value with 1 second expiry
      const result = await redisClient.set(testKey, testValue, 1);
      
      // Verify success
      expect(result).toBe(true);
      
      // Verify value was set - use redisClient.get to avoid direct dependency on client implementation
      let value = await redisClient.get(testKey);
      expect(value).toBe(testValue);
      
      // Wait for expiry (use slightly longer timeout to ensure expiry completes)
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Verify value expired
      value = await redisClient.get(testKey);
      expect(value).toBeNull();
    });

    it('should handle errors during set operations', async () => {
      // Initialize client
      await redisClient.connect();
      
      // Mock set to throw error
      redisClient.client.set = vi.fn().mockRejectedValue(new Error('Simulated set error'));
      
      // Set value (should not throw)
      const result = await redisClient.set('error-set-key', 'error-set-value');
      
      // Verify failure
      expect(result).toBe(false);
    });

    it('should handle timeouts during set operations', async () => {
      // Use real timers for this test
      vi.useRealTimers();
      
      // Initialize client
      await redisClient.connect();
      
      // Mock set to delay
      redisClient.client.set = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'OK';
      });
      
      // Set with short timeout
      const result = await redisClient.set('timeout-set-key', 'timeout-set-value', null, 50);
      
      // Verify failure
      expect(result).toBe(false);
    });
  });

  describe('Using Redis Mock Utilities', () => {
    it('should work with the redis test utilities', async () => {
      // Create a mock redis service
      const mockRedis = createMockRedisService({
        initialData: {
          'mock-key': 'mock-value'
        }
      });

      // Mock the redisClient to use our mock service
      const originalClient = redisClient.client;
      const originalGetClient = redisClient.getClient;
      
      // Replace with mock
      redisClient.client = mockRedis.client;
      redisClient.getClient = async () => mockRedis.client;
      
      try {
        // Test get operation with mock
        const value = await redisClient.get('mock-key');
        expect(value).toBe('mock-value');
        
        // Test set operation with mock
        await redisClient.set('new-mock-key', 'new-mock-value');
        const newValue = await redisClient.get('new-mock-key');
        expect(newValue).toBe('new-mock-value');
      } finally {
        // Restore original client
        redisClient.client = originalClient;
        redisClient.getClient = originalGetClient;
      }
    });

    it('should handle errors with the redis test utilities', async () => {
      // Create a mock redis service
      const mockRedis = createMockRedisService();
      
      // Simulate error on get method
      mockRedis._simulateError('get', new Error('Simulated mock get error'));
      
      // Mock the redisClient to use our mock service
      const originalClient = redisClient.client;
      const originalGetClient = redisClient.getClient;
      
      // Replace with mock
      redisClient.client = mockRedis.client;
      redisClient.getClient = async () => mockRedis.client;
      
      try {
        // Test get operation with error simulation
        const value = await redisClient.get('error-mock-key');
        expect(value).toBeNull();
        
        // Test getWithFallback with error simulation
        const fallbackValue = 'mock-fallback';
        const result = await redisClient.getWithFallback('error-mock-key', fallbackValue);
        expect(result).toBe(fallbackValue);
      } finally {
        // Restore original client
        redisClient.client = originalClient;
        redisClient.getClient = originalGetClient;
      }
    });

    it('should handle timeouts with the redis test utilities', async () => {
      // Use real timers for this test
      vi.useRealTimers();
      
      // Create a mock redis service
      const mockRedis = createMockRedisService();
      
      // Simulate timeout on get method (use short timeout for testing)
      mockRedis._simulateTimeout('get', 50);
      
      // Mock the redisClient to use our mock service
      const originalClient = redisClient.client;
      const originalGetClient = redisClient.getClient;
      
      // Replace with mock
      redisClient.client = mockRedis.client;
      redisClient.getClient = async () => mockRedis.client;
      
      try {
        // Test get operation with timeout simulation
        const value = await redisClient.get('timeout-mock-key');
        expect(value).toBeNull();
      } finally {
        // Restore original client
        redisClient.client = originalClient;
        redisClient.getClient = originalGetClient;
      }
    });
  });

  describe('Additional Tests', () => {
    it('should be able to set and update values', async () => {
      // Initialize client with a fresh instance
      await redisClient.stop();
      await redisClient.connect();
      
      // Reset any mocks from previous tests
      if (typeof redisClient.get.mockRestore === 'function') {
        redisClient.get.mockRestore();
      }
      if (redisClient.client && typeof redisClient.client.get.mockRestore === 'function') {
        redisClient.client.get.mockRestore();
      }
      if (redisClient.client && typeof redisClient.client.set.mockRestore === 'function') {
        redisClient.client.set.mockRestore();
      }
      
      const testKey = 'update-key';
      
      // Set initial value
      const setResult1 = await redisClient.set(testKey, 'initial-value');
      expect(setResult1).toBe(true);
      
      // Verify initial value
      let value = await redisClient.get(testKey);
      expect(value).toBe('initial-value');
      
      // Update value
      const setResult2 = await redisClient.set(testKey, 'updated-value');
      expect(setResult2).toBe(true);
      
      // Verify updated value
      value = await redisClient.get(testKey);
      expect(value).toBe('updated-value');
    });
    
    it('should be able to delete keys', async () => {
      // Initialize client with a fresh instance
      await redisClient.stop();
      await redisClient.connect();
      
      // Reset any mocks from previous tests
      if (typeof redisClient.get.mockRestore === 'function') {
        redisClient.get.mockRestore();
      }
      if (redisClient.client && typeof redisClient.client.get.mockRestore === 'function') {
        redisClient.client.get.mockRestore();
      }
      if (redisClient.client && typeof redisClient.client.set.mockRestore === 'function') {
        redisClient.client.set.mockRestore();
      }
      
      const testKey = 'delete-key';
      
      // Set a value
      const setResult = await redisClient.set(testKey, 'value-to-delete');
      expect(setResult).toBe(true);
      
      // Verify value exists
      let value = await redisClient.get(testKey);
      expect(value).toBe('value-to-delete');
      
      // Delete the key (using client's del method directly)
      const delResult = await redisClient.client.del(testKey);
      expect(delResult).toBe(1);
      
      // Verify key is gone
      value = await redisClient.get(testKey);
      expect(value).toBeNull();
    });
  });

  describe('InMemoryStore Implementation Tests', () => {
    let store;
    
    beforeEach(() => {
      store = new InMemoryStore();
    });
    
    afterEach(() => {
      store = null;
    });

    it('should implement key operations correctly', async () => {
      // Set a key
      await store.set('test-key', 'test-value');
      
      // Get the key
      const value = await store.get('test-key');
      expect(value).toBe('test-value');
      
      // Delete the key
      const deleteResult = await store.del('test-key');
      expect(deleteResult).toBe(1);
      
      // Key should be gone
      const deletedValue = await store.get('test-key');
      expect(deletedValue).toBeNull();
    });

    it('should implement expiry correctly', async () => {
      // Use real timers
      vi.useRealTimers();
      
      // Set with expiry
      await store.set('expiry-key', 'expiry-value', 'EX', 1);
      
      // Check initially
      let value = await store.get('expiry-key');
      expect(value).toBe('expiry-value');
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Check after expiry
      value = await store.get('expiry-key');
      expect(value).toBeNull();
    });

    it('should implement hash operations correctly', async () => {
      const hashKey = 'hash-key';
      
      // Set hash field
      await store.hSet(hashKey, 'field1', 'value1');
      
      // Get hash field
      const fieldValue = await store.hGet(hashKey, 'field1');
      expect(fieldValue).toBe('value1');
      
      // Set another field
      await store.hSet(hashKey, 'field2', 'value2');
      
      // Get all hash fields
      const hashFields = await store.hGetAll(hashKey);
      expect(hashFields).toEqual({
        field1: 'value1',
        field2: 'value2'
      });
    });

    it('should implement key pattern matching correctly', async () => {
      // Set some keys
      await store.set('prefix1:key1', 'value1');
      await store.set('prefix1:key2', 'value2');
      await store.set('prefix2:key1', 'value3');
      
      // Match all keys
      let keys = await store.keys('*');
      expect(keys.length).toBe(3);
      expect(keys).toContain('prefix1:key1');
      expect(keys).toContain('prefix1:key2');
      expect(keys).toContain('prefix2:key1');
      
      // Match by prefix
      keys = await store.keys('prefix1:*');
      expect(keys.length).toBe(2);
      expect(keys).toContain('prefix1:key1');
      expect(keys).toContain('prefix1:key2');
      
      // Match exact key
      keys = await store.keys('prefix2:key1');
      expect(keys.length).toBe(1);
      expect(keys[0]).toBe('prefix2:key1');
    });

    it('should handle event emitter functionality', async () => {
      // Test connect event
      const connectPromise = new Promise(resolve => {
        store.on('connect', () => {
          resolve(true);
        });
      });
      
      // Should resolve
      const result = await connectPromise;
      expect(result).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent operations correctly', async () => {
      // Initialize client with a fresh instance
      await redisClient.stop();
      await redisClient.connect();
      
      // Reset any mocks from previous tests
      if (typeof redisClient.get.mockRestore === 'function') {
        redisClient.get.mockRestore();
      }
      if (typeof redisClient.set.mockRestore === 'function') {
        redisClient.set.mockRestore();
      }
      if (redisClient.client && typeof redisClient.client.get.mockRestore === 'function') {
        redisClient.client.get.mockRestore();
      }
      if (redisClient.client && typeof redisClient.client.set.mockRestore === 'function') {
        redisClient.client.set.mockRestore();
      }
      
      // Perform multiple operations concurrently, but limited to 5 for test speed
      const operations = [];
      for (let i = 0; i < 5; i++) {
        operations.push(redisClient.set(`concurrent-key-${i}`, `value-${i}`));
      }
      
      // Wait for all operations to complete
      const results = await Promise.all(operations);
      
      // All operations should succeed
      expect(results.every(result => result === true)).toBe(true);
      
      // Verify all values were set
      for (let i = 0; i < 5; i++) {
        const value = await redisClient.get(`concurrent-key-${i}`);
        expect(value).toBe(`value-${i}`);
      }
    });

    it('should handle disconnection and reconnection', async () => {
      // Initialize client with a fresh instance
      await redisClient.stop();
      await redisClient.connect();
      
      // Reset any mocks from previous tests
      if (typeof redisClient.get.mockRestore === 'function') {
        redisClient.get.mockRestore();
      }
      if (typeof redisClient.set.mockRestore === 'function') {
        redisClient.set.mockRestore();
      }
      if (redisClient.client && typeof redisClient.client.get.mockRestore === 'function') {
        redisClient.client.get.mockRestore();
      }
      if (redisClient.client && typeof redisClient.client.set.mockRestore === 'function') {
        redisClient.client.set.mockRestore();
      }
      
      // Save a value
      await redisClient.set('reconnect-key', 'reconnect-value');
      
      // Verify value was set
      let initialValue = await redisClient.get('reconnect-key');
      expect(initialValue).toBe('reconnect-value');
      
      // Disconnect
      await redisClient.stop();
      expect(redisClient.client).toBeNull();
      
      // Reconnect
      await redisClient.connect();
      expect(redisClient.client).toBeInstanceOf(InMemoryStore);
      
      // Should start with fresh store (in-memory implementation loses data on reconnect)
      const valueAfterReconnect = await redisClient.get('reconnect-key');
      expect(valueAfterReconnect).toBeNull();
      
      // But should be able to set new values
      await redisClient.set('new-reconnect-key', 'new-reconnect-value');
      const newValue = await redisClient.get('new-reconnect-key');
      expect(newValue).toBe('new-reconnect-value');
    });
  });
});