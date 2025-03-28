/**
 * Redis Client Service Tests
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import redisClient, { InMemoryStore } from '../../../services/redisService.js';

// Mock logger to prevent console output during tests
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

describe('RedisClient', () => {
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
  });

  describe('Initialization', () => {
    it('should initialize with an in-memory store when REDIS_MODE is memory', async () => {
      // Initialize redis client
      await redisClient.connect();
      
      // Check type of client
      expect(redisClient.client).toBeInstanceOf(InMemoryStore);
    });

    it('should create an in-memory store on getClient() if none exists', async () => {
      // Ensure there's no client
      redisClient.client = null;

      // Get client
      const client = await redisClient.getClient();

      // Verify client created
      expect(client).toBeInstanceOf(InMemoryStore);
    });
  });

  describe('Basic Operations', () => {
    it('should successfully set and get a value', async () => {
      const testKey = 'test-key';
      const testValue = 'test-value';

      // Set value
      const setResult = await redisClient.set(testKey, testValue);
      expect(setResult).toBe(true);

      // Get value
      const value = await redisClient.get(testKey);
      expect(value).toBe(testValue);
    });

    it('should return null for non-existent keys', async () => {
      const value = await redisClient.get('nonexistent-key');
      expect(value).toBe(null);
    });

    it('should handle ping operations', async () => {
      const pingResult = await redisClient.ping();
      expect(pingResult).toBe(true);
    });
  });

  describe('Timeout handling', () => {
    it('should handle timeouts for get operations', async () => {
      // Use real timers for this test
      vi.useRealTimers();
      
      // Mock the client's get method to delay longer than timeout
      const client = await redisClient.getClient();
      const originalGet = client.get;
      
      // Create a mock that delays longer than timeout
      client.get = vi.fn().mockImplementation(async (key) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'delayed-value';
      });
      
      // Try to get with a short timeout (100ms)
      const result = await redisClient.get('test-key', { timeout: 100 });
      
      // Should return null due to timeout
      expect(result).toBe(null);
      
      // Restore original method
      client.get = originalGet;
    });

    it('should handle timeouts for set operations', async () => {
      // Use real timers for this test
      vi.useRealTimers();
      
      // Mock the client's set method to delay longer than timeout
      const client = await redisClient.getClient();
      const originalSet = client.set;
      
      // Create a mock that delays longer than timeout
      client.set = vi.fn().mockImplementation(async (...args) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'OK';
      });
      
      // Try to set with a short timeout (100ms)
      const result = await redisClient.set('test-key', 'test-value', null, 100);
      
      // Should return false due to timeout
      expect(result).toBe(false);
      
      // Restore original method
      client.set = originalSet;
    });
  });

  describe('Expiry functionality', () => {
    it('should respect expiry time for keys', async () => {
      // Use real timers for this test
      vi.useRealTimers();
      
      const testKey = 'expiry-test-key';
      const testValue = 'test-value';
      
      // Set value with 1 second expiry
      const setResult = await redisClient.set(testKey, testValue, 1);
      expect(setResult).toBe(true);
      
      // Value should exist immediately
      let value = await redisClient.get(testKey);
      expect(value).toBe(testValue);
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Value should no longer exist
      value = await redisClient.get(testKey);
      expect(value).toBe(null);
    });
  });

  describe('Fallback functionality', () => {
    it('should use fallback value when key does not exist', async () => {
      const fallbackValue = 'fallback-value';
      
      // Get with fallback for non-existent key
      const result = await redisClient.getWithFallback('nonexistent-key', fallbackValue);
      
      // Should return fallback value
      expect(result).toBe(fallbackValue);
    });

    it('should use real value when key exists', async () => {
      const testKey = 'existing-key';
      const testValue = 'real-value';
      const fallbackValue = 'fallback-value';
      
      // Set a real value
      await redisClient.set(testKey, testValue);
      
      // Get with fallback for existing key
      const result = await redisClient.getWithFallback(testKey, fallbackValue);
      
      // Should return real value
      expect(result).toBe(testValue);
    });

    it('should use fallback value when get operation fails', async () => {
      const fallbackValue = 'fallback-for-error';
      
      // Mock get to throw an error
      vi.spyOn(redisClient, 'get').mockImplementationOnce(() => {
        throw new Error('Simulated Redis error');
      });
      
      // Get with fallback that should fail
      const result = await redisClient.getWithFallback('error-key', fallbackValue);
      
      // Should return fallback value
      expect(result).toBe(fallbackValue);
    });
  });

  describe('InMemoryStore', () => {
    let store;
    
    beforeEach(() => {
      store = new InMemoryStore();
    });
    
    afterEach(() => {
      store = null;
    });

    it('should correctly implement get and set', async () => {
      const key = 'memory-test-key';
      const value = 'memory-test-value';
      
      // Set value
      await store.set(key, value);
      
      // Get value
      const result = await store.get(key);
      expect(result).toBe(value);
    });

    it('should honor expiry when set with EX option as array', async () => {
      // Use real timers for this test
      vi.useRealTimers();
      
      const key = 'expiring-key';
      const value = 'expiring-value';
      
      // Set with 1 second expiry using Redis command format
      await store.set(key, value, 'EX', 1);
      
      // Value should exist immediately
      let result = await store.get(key);
      expect(result).toBe(value);
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Value should be gone
      result = await store.get(key);
      expect(result).toBe(null);
    });

    it('should honor expiry when set with object options', async () => {
      // Use real timers for this test
      vi.useRealTimers();
      
      const key = 'expiring-key-object';
      const value = 'expiring-value-object';
      
      // Set with 1 second expiry using options object format
      await store.set(key, value, { EX: 1 });
      
      // Value should exist immediately
      let result = await store.get(key);
      expect(result).toBe(value);
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Value should be gone
      result = await store.get(key);
      expect(result).toBe(null);
    });

    it('should implement hash operations', async () => {
      const hashKey = 'test-hash';
      
      // Set hash fields
      await store.hSet(hashKey, 'field1', 'value1');
      await store.hSet(hashKey, 'field2', 'value2');
      
      // Get individual field
      const field1 = await store.hGet(hashKey, 'field1');
      expect(field1).toBe('value1');
      
      // Get all fields
      const allFields = await store.hGetAll(hashKey);
      expect(allFields).toEqual({
        field1: 'value1',
        field2: 'value2'
      });
    });

    it('should implement key pattern matching', async () => {
      // Set multiple keys
      await store.set('test:key1', 'value1');
      await store.set('test:key2', 'value2');
      await store.set('other:key', 'value3');
      
      // Get all keys
      let keys = await store.keys('*');
      expect(keys.length).toBe(3);
      expect(keys).toEqual(expect.arrayContaining(['test:key1', 'test:key2', 'other:key']));
      
      // Get keys with prefix
      keys = await store.keys('test:*');
      expect(keys.length).toBe(2);
      expect(keys).toEqual(expect.arrayContaining(['test:key1', 'test:key2']));
      
      // Get exact key
      keys = await store.keys('test:key1');
      expect(keys).toEqual(['test:key1']);
    });

    it('should quit and clear store', async () => {
      // Set some values
      await store.set('key1', 'value1');
      await store.set('key2', 'value2');
      
      // Quit
      await store.quit();
      
      // Store should be empty
      const value = await store.get('key1');
      expect(value).toBe(null);
    });

    it('should fire connect event immediately', () => {
      return new Promise(resolve => {
        // Test event callbacks
        store.on('connect', () => {
          // This should be called almost immediately
          resolve();
        });
      });
    });
  });
});