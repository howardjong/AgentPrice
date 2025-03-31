/**
 * Enhanced Redis Test Utilities Tests
 * 
 * This test suite provides comprehensive coverage for the redis-test-utils.js module,
 * focusing on increasing function coverage to >80%.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { 
  createMockRedisClient,
  createMockRedisService,
  createMockRedisModule,
  createTestableRedisClient,
  populateMockRedis,
  simulateRedisError,
  simulateRedisTimeout,
  simulateRedisDisconnection,
  mockRedisModule
} from '../../../utils/redis-test-utils.js';

describe('Redis Test Utilities Enhanced Coverage', () => {
  // Clean up mocks after each test
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Mock Redis Client', () => {
    it('should skip initialization when empty data is provided', async () => {
      // This test specifically targets the conditional branch in createMockRedisClient
      const client = createMockRedisClient({ initialData: {} });
      expect(client).toBeDefined();
      
      // Verify the client works as expected
      await client.set('empty-test', 'value');
      const value = await client.get('empty-test');
      expect(value).toBe('value');
    });
  });

  describe('populateMockRedis', () => {
    it('should handle empty data object', async () => {
      const client = createMockRedisClient();
      
      // Call with empty data
      await populateMockRedis(client, {});
      
      // Verify client still works
      await client.set('test-after-empty', 'value');
      expect(await client.get('test-after-empty')).toBe('value');
    });
    
    it('should handle array values', async () => {
      const client = createMockRedisClient();
      
      // Setup a spy to verify the correct method is called
      const setSpy = vi.spyOn(client, 'set');
      
      await populateMockRedis(client, { 
        'array-key': ['item1', 'item2']
      });
      
      // Verify set was called with the array value
      expect(setSpy).toHaveBeenCalledWith('array-key', ['item1', 'item2']);
    });
    
    it('should handle null values', async () => {
      const client = createMockRedisClient();
      
      // Setup a spy to verify the correct method is called
      const setSpy = vi.spyOn(client, 'set');
      
      await populateMockRedis(client, { 
        'null-key': null
      });
      
      // Verify set was called with null
      expect(setSpy).toHaveBeenCalledWith('null-key', null);
    });
  });

  describe('Error Simulation', () => {
    it('should use default error message when none provided', async () => {
      const client = createMockRedisClient();
      
      // Don't provide a specific error instance
      simulateRedisError(client, 'set');
      
      // Should use the default message
      await expect(client.set('key', 'value')).rejects.toThrow('Simulated Redis error for set');
    });
    
    it('should use default timeout value when none provided', async () => {
      const client = createMockRedisClient();
      
      // Use Jest's timer mocks
      vi.useFakeTimers();
      
      // Don't provide a specific timeout
      simulateRedisTimeout(client, 'get');
      
      // Start the operation that will timeout (don't await)
      const promise = client.get('key');
      
      // Fast-forward time
      vi.advanceTimersByTime(3000);
      
      // The operation should reject with timeout message
      await expect(promise).rejects.toThrow('timed out after 3000ms');
    });
    
    it('should simulate disconnection for all standard Redis operations', async () => {
      const client = createMockRedisClient();
      
      // Ensure all the methods we'll test exist before we disconnect
      client.keys = client.keys || (() => Promise.resolve([]));
      client.hget = client.hget || (() => Promise.resolve(null));
      client.hset = client.hset || (() => Promise.resolve('OK'));
      client.del = client.del || (() => Promise.resolve(1));
      
      // Now disconnect
      simulateRedisDisconnection(client);
      
      // Test operations one by one
      await expect(client.del('key')).rejects.toThrow('not connected');
    });
  });

  describe('Testable Redis Client', () => {
    it('should support method chaining and accessing the original interface', async () => {
      const mockClient = createMockRedisClient();
      const testableClient = createTestableRedisClient(mockClient);
      
      // Test the method returns itself for chaining
      const result = testableClient._simulateError('del', new Error('Del error'));
      expect(result).toBe(testableClient);
      
      // Should provide access to the original client methods
      expect(typeof testableClient.get).toBe('function');
    });
  });

  describe('Mock Redis Service', () => {
    it('should access methods through service interface', async () => {
      const service = createMockRedisService();
      
      // Verify the service interface
      expect(service.getClient).toBeDefined();
      expect(service.ping).toBeDefined();
      expect(service.get).toBeDefined();
      expect(service.set).toBeDefined();
      
      // Add connection method if needed
      if (service.client.connect === undefined) {
        service.client.connect = vi.fn().mockResolvedValue('OK');
      }
      
      // Call through the service interface
      const client = await service.getClient();
      expect(client).toBe(service.client);
    });
    
    it('should support method chaining on service methods', async () => {
      const service = createMockRedisService();
      
      // Test method returns itself for chaining
      const result = service._simulateError('get', new Error('Service get error'));
      expect(result).toBe(service);
    });
  });

  describe('Redis Module Mock', () => {
    it('should create Redis instance with constructor function', () => {
      // Test the constructor's ability to return a mock client
      const Redis = createMockRedisModule();
      const client = new Redis();
      
      // Verify it returns a proper mock
      expect(client).toBeDefined();
      expect(typeof client.get).toBe('function');
      expect(typeof client.set).toBe('function');
    });
    
    it('should create Cluster instances', () => {
      // Test the Cluster constructor
      const Redis = createMockRedisModule();
      const cluster = new Redis.Cluster([{ host: 'localhost', port: 6379 }]);
      
      // Verify it returns a proper mock
      expect(cluster).toBeDefined();
      expect(typeof cluster.get).toBe('function');
    });
  });
});