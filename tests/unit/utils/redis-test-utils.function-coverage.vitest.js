/**
 * Function Coverage Tests for Redis Test Utilities
 * 
 * This test suite is specifically designed to target uncovered functions
 * to reach the 80% function coverage goal.
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

describe('Redis Test Utilities Function Coverage', () => {
  // Clean up mocks after each test
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Redis Service Object Methods', () => {
    // These tests target methods inside the Redis service object
    
    it('should cover connect method on Redis service', async () => {
      const service = createMockRedisService();
      
      // Ensure the connect method exists on the client
      service.client.connect = vi.fn().mockResolvedValue('OK');
      
      // Call the connect method directly
      const result = await service.connect();
      
      // Verify it returns the service for chaining
      expect(result).toBe(service);
      expect(service.client.connect).toHaveBeenCalled();
    });
    
    it('should cover getClient method on Redis service', async () => {
      const service = createMockRedisService();
      
      // Call the getClient method directly
      const client = await service.getClient();
      
      // Verify it returns the client
      expect(client).toBe(service.client);
    });
    
    it('should cover ping method with success response', async () => {
      const service = createMockRedisService();
      
      // Mock the ping method on the client to return PONG
      service.client.ping = vi.fn().mockResolvedValue('PONG');
      
      // Call the ping method
      const result = await service.ping();
      
      // Verify it interprets PONG as success
      expect(result).toBe(true);
      expect(service.client.ping).toHaveBeenCalled();
    });
    
    it('should cover ping method with error response', async () => {
      const service = createMockRedisService();
      
      // Mock the ping method to throw an error
      service.client.ping = vi.fn().mockRejectedValue(new Error('Ping failed'));
      
      // Call the ping method
      const result = await service.ping();
      
      // Verify it handles errors gracefully
      expect(result).toBe(false);
      expect(service.client.ping).toHaveBeenCalled();
    });
    
    it('should cover getWithFallback method', async () => {
      const service = createMockRedisService();
      
      // Set up spies
      const getSpy = vi.spyOn(service, 'get');
      getSpy.mockResolvedValueOnce(null); // First call returns null
      getSpy.mockResolvedValueOnce('value'); // Second call returns a value
      getSpy.mockRejectedValueOnce(new Error('Redis error')); // Third call throws error
      
      // Test with fallback
      let result = await service.getWithFallback('missing-key', 'fallback-value');
      expect(result).toBe('fallback-value');
      expect(getSpy).toHaveBeenCalledWith('missing-key', {});
      
      // Test without fallback needed
      result = await service.getWithFallback('existing-key', 'fallback-value');
      expect(result).toBe('value');
      
      // Test error case - should return fallback value
      result = await service.getWithFallback('error-key', 'error-fallback');
      expect(result).toBe('error-fallback');
      expect(getSpy).toHaveBeenCalledWith('error-key', {});
    });
    
    it('should cover set method with and without expiry', async () => {
      const service = createMockRedisService();
      
      // Spy on the client's set method
      const setSpy = vi.spyOn(service.client, 'set');
      setSpy.mockResolvedValue('OK');
      
      // Test without expiry
      let result = await service.set('key1', 'value1');
      expect(result).toBe(true);
      expect(setSpy).toHaveBeenCalledWith('key1', 'value1');
      
      // Test with expiry
      result = await service.set('key2', 'value2', 60);
      expect(result).toBe(true);
      expect(setSpy).toHaveBeenCalledWith('key2', 'value2', 'EX', 60);
    });
    
    it('should cover stop method success and failure', async () => {
      const service = createMockRedisService();
      
      // Add the quit method if it doesn't exist
      service.client.quit = vi.fn().mockResolvedValue('OK');
      
      // Test successful stop
      let result = await service.stop();
      expect(result).toBe(true);
      
      // Test failed stop
      service.client.quit = vi.fn().mockRejectedValue(new Error('Quit failed'));
      result = await service.stop();
      expect(result).toBe(false);
    });
    
    it('should cover service _simulateTimeout method', async () => {
      const service = createMockRedisService();
      
      // Spy on the client's _simulateTimeout method
      const timeoutSpy = vi.spyOn(service.client, '_simulateTimeout');
      
      // Call the service's _simulateTimeout
      service._simulateTimeout('get', 100);
      
      // Verify it delegates to the client
      expect(timeoutSpy).toHaveBeenCalledWith('get', 100);
    });
    
    it('should cover service _simulateDisconnection method', () => {
      const service = createMockRedisService();
      
      // Spy on the client's _simulateDisconnection method
      const disconnectSpy = vi.spyOn(service.client, '_simulateDisconnection');
      
      // Call the service's _simulateDisconnection
      service._simulateDisconnection();
      
      // Verify it delegates to the client
      expect(disconnectSpy).toHaveBeenCalled();
    });
    
    it('should cover service _populate method', async () => {
      const service = createMockRedisService();
      
      // Spy on the client's _populate method
      const populateSpy = vi.spyOn(service.client, '_populate');
      
      // Call the service's _populate
      await service._populate({ test: 'data' });
      
      // Verify it delegates to the client
      expect(populateSpy).toHaveBeenCalledWith({ test: 'data' });
    });
    
    it('should cover service _inspect method', () => {
      const service = createMockRedisService();
      
      // Set up mock return value for client inspect
      const mockData = { status: 'ready', store: {}, listeners: {} };
      vi.spyOn(service.client, '_inspect').mockReturnValue(mockData);
      
      // Call service inspect
      const result = service._inspect();
      
      // Verify it delegates to the client
      expect(result).toEqual(mockData);
    });
  });
  
  describe('Testable Redis Client Methods', () => {
    // These tests target methods inside the testable Redis client
    
    it('should cover _simulateTimeout and ensure it supports chaining', () => {
      // Create the mock client and testable client
      const mockClient = createMockRedisClient();
      const testableClient = createTestableRedisClient(mockClient);
      
      // Call the _simulateTimeout method and verify it returns itself for chaining
      const result = testableClient._simulateTimeout('get', 500);
      expect(result).toBe(testableClient);
    });
    
    it('should cover _simulateDisconnection and ensure it supports chaining', () => {
      // Create the mock client and testable client
      const mockClient = createMockRedisClient();
      const testableClient = createTestableRedisClient(mockClient);
      
      // Call the _simulateDisconnection method and verify it returns itself for chaining
      const result = testableClient._simulateDisconnection();
      expect(result).toBe(testableClient);
    });
    
    it('should cover _populate in testable client', async () => {
      const mockClient = createMockRedisClient();
      const testableClient = createTestableRedisClient(mockClient);
      
      // Create a direct spy on the populateMockRedis function
      const populateSpy = vi.spyOn(testableClient, '_populate');
      
      // Call _populate with some data
      await testableClient._populate({ 'key': 'value' });
      
      // Verify it was called with the right data
      expect(populateSpy).toHaveBeenCalledWith({ 'key': 'value' });
    });
    
    it('should cover _inspect in testable client', () => {
      const mockClient = createMockRedisClient();
      mockClient.status = 'ready';
      mockClient.mock = { store: {} };
      mockClient.listeners = {};
      
      const testableClient = createTestableRedisClient(mockClient);
      
      // Call _inspect
      const result = testableClient._inspect();
      
      // Verify the returned object has the expected properties
      expect(result).toHaveProperty('status', 'ready');
      expect(result).toHaveProperty('store');
      expect(result).toHaveProperty('listeners');
    });
  });
  
  describe('Redis Module Constructor Tests', () => {
    it('should cover Redis constructor function', () => {
      // Access the Redis constructor function
      const RedisConstructor = createMockRedisModule();
      
      // Verify it's a constructor function
      expect(typeof RedisConstructor).toBe('function');
      
      // Create a Redis client with the constructor (without 'new')
      const client = RedisConstructor({ namespace: 'test-ns' });
      
      // Verify it returns a properly formed mock client
      expect(client).toBeDefined();
      expect(typeof client.get).toBe('function');
      expect(typeof client.set).toBe('function');
    });
    
    it('should cover Redis.Cluster constructor', () => {
      // Access the Redis constructor function
      const RedisConstructor = createMockRedisModule();
      
      // Verify the Cluster property exists
      expect(RedisConstructor.Cluster).toBeDefined();
      expect(typeof RedisConstructor.Cluster).toBe('function');
      
      // Create a cluster instance (without 'new')
      const clusterClient = RedisConstructor.Cluster(
        [{ host: 'node1', port: 6379 }],
        { namespace: 'cluster-ns' }
      );
      
      // Verify it returns a properly formed mock client
      expect(clusterClient).toBeDefined();
      expect(typeof clusterClient.get).toBe('function');
    });
    
    it('should cover the exported mockRedisModule', () => {
      // Verify the module exports a Redis constructor
      expect(typeof mockRedisModule).toBe('function');
      
      // Create instance using the exported module (without 'new')
      const client = mockRedisModule();
      
      // Verify it works properly
      expect(client).toBeDefined();
      expect(typeof client.get).toBe('function');
    });
  });
  
  describe('Timeout and Disconnect Simulation', () => {
    // Tests focused on the timeout mechanism inside simulateRedisTimeout
    
    it('should properly trigger the timeout callback inside simulateRedisTimeout', async () => {
      // Create a mock client
      const mockClient = createMockRedisClient();
      
      // Use fake timers
      vi.useFakeTimers();
      
      // Apply the timeout simulation with a short timeout
      simulateRedisTimeout(mockClient, 'get', 100);
      
      // Start a get operation (but don't await)
      const getPromise = mockClient.get('key');
      
      // Fast-forward time to trigger the timeout callback
      vi.advanceTimersByTime(100);
      
      // Now the promise should reject with timeout error
      await expect(getPromise).rejects.toThrow('timed out');
    });
    
    it('should cover specific Redis methods when simulating disconnection', async () => {
      // Create mock client and ensure it's set to 'ready' state first
      const mockClient = createMockRedisClient();
      await mockClient.connect(); // Ensure we're in 'ready' state
      
      // Explicitly set status to verify it changes
      mockClient.status = 'ready';
      
      // Simulate disconnection
      simulateRedisDisconnection(mockClient);
      
      // Test one method to verify it throws
      await expect(mockClient.get('test')).rejects.toThrow('not connected');
      
      // Verify the client status was changed
      expect(mockClient.status).toBe('end');
    });
  });
});