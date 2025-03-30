/**
 * Redis Cache Mock Tests
 * 
 * These tests verify the functionality of our Redis mock implementation
 * and demonstrate how to use it in tests for Redis-dependent code.
 */

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import RedisMock from '../../../utils/redis-mock.js';
import RedisMockAdapter from '../../../utils/redis-mock-adapter.js';
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

describe('Redis Cache Mock', () => {
  // Clean up after each test
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('RedisMock Core Functionality', () => {
    let redisMock;

    beforeEach(() => {
      redisMock = new RedisMock();
      redisMock.connect();
    });

    afterEach(async () => {
      await redisMock.disconnect();
    });

    it('should set and get values correctly', async () => {
      await redisMock.set('test-key', 'test-value');
      const value = await redisMock.get('test-key');
      expect(value).toBe('test-value');
    });

    it('should handle key expiration correctly', async () => {
      // Use fake timers to control time
      vi.useFakeTimers();

      // Set a key with 10 second expiry
      await redisMock.set('expiry-key', 'expiry-value', 'EX', 10);
      
      // Check immediately
      let value = await redisMock.get('expiry-key');
      expect(value).toBe('expiry-value');
      
      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);
      
      // Key should still exist
      value = await redisMock.get('expiry-key');
      expect(value).toBe('expiry-value');
      
      // Advance time by another 6 seconds (total 11 seconds)
      vi.advanceTimersByTime(6000);
      
      // Key should be expired
      value = await redisMock.get('expiry-key');
      expect(value).toBeNull();
    });

    it('should handle hash operations correctly', async () => {
      // Set hash values
      await redisMock.hset('hash-key', 'field1', 'value1');
      await redisMock.hset('hash-key', 'field2', 'value2');
      
      // Get individual field
      const field1 = await redisMock.hget('hash-key', 'field1');
      expect(field1).toBe('value1');
      
      // Get all fields
      const allFields = await redisMock.hgetall('hash-key');
      expect(allFields).toEqual({
        field1: 'value1',
        field2: 'value2'
      });
      
      // Delete a field
      await redisMock.hdel('hash-key', 'field1');
      
      // Check field was deleted
      const deletedField = await redisMock.hget('hash-key', 'field1');
      expect(deletedField).toBeNull();
      
      // Check remaining field
      const remainingFields = await redisMock.hgetall('hash-key');
      expect(remainingFields).toEqual({
        field2: 'value2'
      });
    });

    it('should handle pattern matching for keys', async () => {
      // Set up some keys
      await redisMock.set('prefix1:key1', 'value1');
      await redisMock.set('prefix1:key2', 'value2');
      await redisMock.set('prefix2:key1', 'value3');
      
      // Match all keys
      let keys = await redisMock.keys('*');
      expect(keys.length).toBe(3);
      expect(keys).toContain('prefix1:key1');
      expect(keys).toContain('prefix1:key2');
      expect(keys).toContain('prefix2:key1');
      
      // Match by prefix
      keys = await redisMock.keys('prefix1:*');
      expect(keys.length).toBe(2);
      expect(keys).toContain('prefix1:key1');
      expect(keys).toContain('prefix1:key2');
      
      // Match exact key
      keys = await redisMock.keys('prefix2:key1');
      expect(keys.length).toBe(1);
      expect(keys[0]).toBe('prefix2:key1');
    });

    it('should support del operation', async () => {
      // Set up a key
      await redisMock.set('delete-key', 'delete-value');
      
      // Verify key exists
      let value = await redisMock.get('delete-key');
      expect(value).toBe('delete-value');
      
      // Delete the key
      const delResult = await redisMock.del('delete-key');
      expect(delResult).toBe(1);
      
      // Verify key no longer exists
      value = await redisMock.get('delete-key');
      expect(value).toBeNull();
      
      // Delete non-existent key
      const delNonExistentResult = await redisMock.del('non-existent-key');
      expect(delNonExistentResult).toBe(0);
    });

    it('should increment and decrement values', async () => {
      // Test incr on new key
      let value = await redisMock.incr('counter');
      expect(value).toBe(1);
      
      // Increment again
      value = await redisMock.incr('counter');
      expect(value).toBe(2);
      
      // Increment by custom amount
      value = await redisMock.incrby('counter', 3);
      expect(value).toBe(5);
      
      // Decrement
      value = await redisMock.decr('counter');
      expect(value).toBe(4);
      
      // Decrement by custom amount
      value = await redisMock.decrby('counter', 2);
      expect(value).toBe(2);
    });

    it('should support list operations', async () => {
      // Test lpush
      let length = await redisMock.lpush('list', 'value1', 'value2');
      expect(length).toBe(2);
      
      // Test rpush
      length = await redisMock.rpush('list', 'value3');
      expect(length).toBe(3);
      
      // Test lrange
      let values = await redisMock.lrange('list', 0, -1);
      expect(values).toEqual(['value1', 'value2', 'value3']);
      
      // Test lpop
      let value = await redisMock.lpop('list');
      expect(value).toBe('value1');
      
      // Test rpop
      value = await redisMock.rpop('list');
      expect(value).toBe('value3');
      
      // Test llen
      length = await redisMock.llen('list');
      expect(length).toBe(1);
    });
  });

  describe('RedisMockAdapter Functionality', () => {
    let redis;

    beforeEach(async () => {
      redis = new RedisMockAdapter();
      await redis.connect();
    });

    afterEach(async () => {
      await redis.disconnect();
    });

    it('should proxy all methods to the underlying mock', async () => {
      await redis.set('adapter-key', 'adapter-value');
      const value = await redis.get('adapter-key');
      expect(value).toBe('adapter-value');
    });

    it('should support IoRedis event handling', async () => {
      const redis = new RedisMockAdapter();
      
      // Return a promise instead of using done callback
      const connectionPromise = new Promise(resolve => {
        redis.once('ready', () => {
          expect(redis.status).toBe('ready');
          resolve();
        });
      });
      
      // Connect
      redis.connect();
      
      // Wait for the ready event
      await connectionPromise;
    });

    it('should support IoRedis multi commands', async () => {
      // Start a multi command
      const multi = redis.multi();
      
      // Queue commands
      multi.set('multi-key1', 'multi-value1');
      multi.set('multi-key2', 'multi-value2');
      multi.get('multi-key1');
      
      // Execute commands
      const results = await multi.exec();
      
      // Verify results
      expect(results.length).toBe(3);
      expect(results[0]).toEqual([null, 'OK']); // First set
      expect(results[1]).toEqual([null, 'OK']); // Second set
      expect(results[2]).toEqual([null, 'multi-value1']); // Get
      
      // Verify key-value pairs were actually set
      const value1 = await redis.get('multi-key1');
      const value2 = await redis.get('multi-key2');
      expect(value1).toBe('multi-value1');
      expect(value2).toBe('multi-value2');
    });
  });

  describe('Redis Test Utilities', () => {
    it('should create a mock Redis client', async () => {
      const client = createMockRedisClient();
      expect(client).toBeDefined();
      
      // Test basic operations
      await client.set('util-key', 'util-value');
      const value = await client.get('util-key');
      expect(value).toBe('util-value');
    });

    it('should create a mock Redis client with initial data', async () => {
      const client = createMockRedisClient({
        initialData: {
          'init-key1': 'init-value1',
          'init-key2': 'init-value2',
          'init-hash': { field1: 'value1', field2: 'value2' }
        }
      });
      
      // Test initial data was populated
      const value1 = await client.get('init-key1');
      expect(value1).toBe('init-value1');
      
      const value2 = await client.get('init-key2');
      expect(value2).toBe('init-value2');
      
      const hashField = await client.hget('init-hash', 'field1');
      expect(hashField).toBe('value1');
    });

    it('should simulate Redis errors', async () => {
      // Create a fresh client for this test to avoid state from other tests
      const client = createMockRedisClient();
      
      // Create an error object to throw
      const testError = new Error('Simulated set error');
      
      // Use a separate try/catch block just for the simulation setup
      try {
        // Simulate error on set
        simulateRedisError(client, 'set', testError);
      } catch (err) {
        // Ignore any errors during setup
      }
      
      // Test that error is thrown during operation
      await expect(client.set('any-key', 'any-value')).rejects.toThrow('Simulated set error');
      
      // Get method should still work
      const value = await client.get('get-key');
      expect(value).toBe(null);
    });

    it('should simulate Redis timeouts', async () => {
      const client = createMockRedisClient();
      
      // Simulate timeout on set (use a short timeout for testing)
      simulateRedisTimeout(client, 'set', 50);
      
      // Test timeout is triggered
      const start = Date.now();
      await expect(client.set('timeout-key', 'timeout-value')).rejects.toThrow('timed out');
      const duration = Date.now() - start;
      
      // Check that timeout occurred in approximately the right time
      expect(duration).toBeGreaterThanOrEqual(40);
      expect(duration).toBeLessThan(100);
    });

    it('should create a complete Redis service mock', async () => {
      const redisMock = createMockRedisService({
        initialData: {
          'service-key': 'service-value'
        }
      });
      
      // Test basic operations
      const value = await redisMock.get('service-key');
      expect(value).toBe('service-value');
      
      // Test set operation
      const setResult = await redisMock.set('new-key', 'new-value');
      expect(setResult).toBe(true);
      
      // Test get with fallback
      const existingValue = await redisMock.getWithFallback('new-key', 'fallback');
      expect(existingValue).toBe('new-value');
      
      const fallbackValue = await redisMock.getWithFallback('non-existent', 'fallback');
      expect(fallbackValue).toBe('fallback');
    });

    it('should handle error simulation in the Redis service mock', async () => {
      const redisMock = createMockRedisService();
      
      // Simulate error on get
      redisMock._simulateError('get', new Error('Service mock error'));
      
      // Test get returns null instead of throwing (error handling)
      const value = await redisMock.get('error-key');
      expect(value).toBeNull();
      
      // Test getWithFallback returns fallback value
      const fallbackValue = await redisMock.getWithFallback('error-key', 'error-fallback');
      expect(fallbackValue).toBe('error-fallback');
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should mock Redis for caching data', async () => {
      // Create a Redis mock service
      const redisMock = createMockRedisService();
      
      // Example cache function using Redis
      async function getOrCreateCachedData(key, expiry, dataFn) {
        // Try to get from cache first
        const cachedData = await redisMock.get(key);
        if (cachedData) {
          return JSON.parse(cachedData);
        }
        
        // Generate new data
        const newData = await dataFn();
        
        // Cache the result
        await redisMock.set(key, JSON.stringify(newData), expiry);
        
        return newData;
      }
      
      // Mock data function
      const dataFn = vi.fn().mockResolvedValue({ id: 1, name: 'Test Data' });
      
      // First call should generate new data
      let result = await getOrCreateCachedData('cache-key', 60, dataFn);
      expect(result).toEqual({ id: 1, name: 'Test Data' });
      expect(dataFn).toHaveBeenCalledTimes(1);
      
      // Second call should use cached data
      result = await getOrCreateCachedData('cache-key', 60, dataFn);
      expect(result).toEqual({ id: 1, name: 'Test Data' });
      expect(dataFn).toHaveBeenCalledTimes(1); // Still only called once
      
      // Reset the spy call count to test expiry properly
      dataFn.mockClear();
      
      // Reset the Redis store to simulate cache expiry
      await redisMock.client.del('cache-key');
      
      // Set up fake timers for next operations
      vi.useFakeTimers();
      
      // Call again after expiry
      result = await getOrCreateCachedData('cache-key', 60, dataFn);
      expect(result).toEqual({ id: 1, name: 'Test Data' });
      expect(dataFn).toHaveBeenCalledTimes(1); // Called once after reset
    });

    it('should mock Redis for rate limiting', async () => {
      // Create a Redis mock service
      const redisMock = createMockRedisService();
      
      // Example rate limiter using Redis
      async function checkRateLimit(key, limit, windowSeconds) {
        // Increment the counter
        const count = await redisMock.client.incr(key);
        
        // Set expiry if this is the first request
        if (count === 1) {
          await redisMock.client.expire(key, windowSeconds);
        }
        
        // Check if limit is exceeded
        return {
          allowed: count <= limit,
          current: count,
          limit: limit,
          remaining: Math.max(0, limit - count)
        };
      }
      
      // Test rate limiting
      const key = 'rate-limit:127.0.0.1';
      const limit = 5;
      const windowSeconds = 60;
      
      // First request should be allowed
      let result = await checkRateLimit(key, limit, windowSeconds);
      expect(result).toEqual({
        allowed: true,
        current: 1,
        limit: 5,
        remaining: 4
      });
      
      // Make 4 more requests (reaching the limit)
      for (let i = 0; i < 4; i++) {
        await checkRateLimit(key, limit, windowSeconds);
      }
      
      // Next request should be denied
      result = await checkRateLimit(key, limit, windowSeconds);
      expect(result).toEqual({
        allowed: false,
        current: 6,
        limit: 5,
        remaining: 0
      });
      
      // After window expires, should be allowed again
      vi.useFakeTimers();
      vi.advanceTimersByTime(61 * 1000);
      
      result = await checkRateLimit(key, limit, windowSeconds);
      expect(result).toEqual({
        allowed: true,
        current: 1,
        limit: 5,
        remaining: 4
      });
    });

    it('should mock Redis for distributed locking', async () => {
      // Create a Redis mock service
      const redisMock = createMockRedisService();
      
      // Mock Date.now() to return fixed values for testing
      const originalDateNow = Date.now;
      let lockCounter = 1000;
      Date.now = vi.fn().mockImplementation(() => lockCounter++);
      
      // Example distributed lock using Redis
      async function acquireLock(lockName, ttlSecs = 30) {
        const lockValue = Date.now().toString();
        
        // Check if lock exists already
        const existingLock = await redisMock.get(lockName);
        if (existingLock) {
          return null; // Lock is already held
        }
        
        const result = await redisMock.set(lockName, lockValue, ttlSecs, 1000);
        return result ? lockValue : null;
      }
      
      async function releaseLock(lockName, lockValue) {
        const currentValue = await redisMock.get(lockName);
        if (currentValue === lockValue) {
          const deleteResult = await redisMock.client.del(lockName);
          return deleteResult >= 1;
        }
        return false;
      }
      
      try {
        // Acquire a lock
        const lockName = 'test-lock';
        const lockValue = await acquireLock(lockName);
        expect(lockValue).not.toBeNull();
        
        // Try to acquire the same lock (should fail)
        const secondLockValue = await acquireLock(lockName);
        expect(secondLockValue).toBe(null);
        
        // Release the lock
        const releaseResult = await releaseLock(lockName, lockValue);
        expect(releaseResult).toBe(true);
        
        // Now should be able to acquire the lock again
        const newLockValue = await acquireLock(lockName);
        expect(newLockValue).not.toBeNull();
        
        // Lock should auto-expire
        vi.useFakeTimers();
        vi.advanceTimersByTime(31 * 1000);
        
        // Should be able to acquire a new lock after expiry
        const expiredLockValue = await acquireLock(lockName);
        expect(expiredLockValue).not.toBeNull();
        expect(expiredLockValue).not.toBe(newLockValue);
      } finally {
        // Restore original Date.now
        Date.now = originalDateNow;
      }
    });
  });
});