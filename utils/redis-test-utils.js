/**
 * Redis Test Utilities
 * 
 * This module provides utilities for testing Redis-dependent code
 * without requiring a real Redis instance. It includes:
 * 
 * 1. Functions to mock Redis for unit testing
 * 2. Utilities to simulate Redis errors and timeouts
 * 3. Helper methods for setting up test scenarios 
 */

import { vi } from 'vitest';
import RedisMock from './redis-mock.js';
import RedisMockAdapter from './redis-mock-adapter.js';

/**
 * Create a mocked Redis client
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoConnect - Automatically connect the client
 * @param {string} options.namespace - Namespace for the Redis keys
 * @param {Object} options.initialData - Initial data to populate the mock with
 * @returns {Object} Mocked Redis client
 */
export function createMockRedisClient(options = {}) {
  const {
    autoConnect = true,
    namespace = 'test',
    initialData = {}
  } = options;
  
  // Create a new mock client
  const mockClient = new RedisMockAdapter({ namespace });
  
  // Connect if needed
  if (autoConnect) {
    mockClient.connect();
  }
  
  // Populate with initial data if provided
  if (initialData && Object.keys(initialData).length > 0) {
    populateMockRedis(mockClient, initialData);
  }
  
  return mockClient;
}

/**
 * Populate a mock Redis client with data
 * @param {Object} mockClient - Redis mock client
 * @param {Object} data - Data to populate, where keys are Redis keys and values are Redis values
 */
export async function populateMockRedis(mockClient, data) {
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Handle hash maps
      await mockClient.hmset(key, value);
    } else {
      // Handle simple key-value
      await mockClient.set(key, value);
    }
  }
}

/**
 * Create a simulated Redis error scenario
 * @param {Object} mockClient - Redis mock client
 * @param {string} method - Method to simulate error for
 * @param {Error} error - Error to throw
 */
export function simulateRedisError(mockClient, method, error) {
  // Return a promise rejection instead of throwing directly
  vi.spyOn(mockClient, method).mockImplementation(() => {
    return Promise.reject(error || new Error(`Simulated Redis error for ${method}`));
  });
}

/**
 * Create a simulated Redis timeout scenario
 * @param {Object} mockClient - Redis mock client
 * @param {string} method - Method to simulate timeout for
 * @param {number} timeout - Timeout in milliseconds
 */
export function simulateRedisTimeout(mockClient, method, timeout = 3000) {
  vi.spyOn(mockClient, method).mockImplementation(() => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Redis ${method} operation timed out after ${timeout}ms`));
      }, timeout);
    });
  });
}

/**
 * Create a simulated Redis disconnection scenario
 * @param {Object} mockClient - Redis mock client
 */
export function simulateRedisDisconnection(mockClient) {
  vi.spyOn(mockClient, 'connect').mockImplementation(() => {
    mockClient.status = 'connecting';
    return Promise.reject(new Error('Failed to connect to Redis'));
  });
  
  mockClient.status = 'end';
  
  // Simulate an error on any operation
  const methods = ['get', 'set', 'del', 'keys', 'hget', 'hset'];
  for (const method of methods) {
    vi.spyOn(mockClient, method).mockImplementation(() => {
      return Promise.reject(new Error('Redis client is not connected'));
    });
  }
}

/**
 * Create a Redis client instance patched with test methods
 * @param {Object} mockClient - Redis mock client
 * @returns {Object} Enhanced mock client
 */
export function createTestableRedisClient(mockClient) {
  return {
    ...mockClient,
    
    // Add test-specific methods
    _simulateError(method, error) {
      simulateRedisError(mockClient, method, error);
      return this;
    },
    
    _simulateTimeout(method, timeout) {
      simulateRedisTimeout(mockClient, method, timeout);
      return this;
    },
    
    _simulateDisconnection() {
      simulateRedisDisconnection(mockClient);
      return this;
    },
    
    _populate(data) {
      populateMockRedis(mockClient, data);
      return this;
    },
    
    _inspect() {
      return {
        status: mockClient.status,
        store: mockClient.mock.store,
        listeners: mockClient.listeners
      };
    }
  };
}

/**
 * Create a mock for the redisService module
 * @param {Object} options - Configuration options
 * @returns {Object} Mocked Redis service
 */
export function createMockRedisService(options = {}) {
  const mockClient = createMockRedisClient(options);
  const testableClient = createTestableRedisClient(mockClient);
  
  // Create a mock that resembles the redisService
  const redisService = {
    client: testableClient,
    
    async connect() {
      await this.client.connect();
      return this;
    },
    
    async getClient() {
      return this.client;
    },
    
    async ping() {
      try {
        return await this.client.ping() === 'PONG';
      } catch (error) {
        return false;
      }
    },
    
    async get(key, options = {}) {
      try {
        return await this.client.get(key);
      } catch (error) {
        return null;
      }
    },
    
    async getWithFallback(key, fallbackValue, options = {}) {
      try {
        const result = await this.get(key, options);
        return result !== null ? result : fallbackValue;
      } catch (error) {
        return fallbackValue;
      }
    },
    
    async set(key, value, expirySecs = null, timeoutMs = 3000) {
      try {
        if (expirySecs) {
          await this.client.set(key, value, 'EX', expirySecs);
        } else {
          await this.client.set(key, value);
        }
        return true;
      } catch (error) {
        return false;
      }
    },
    
    async stop() {
      try {
        await this.client.quit();
        return true;
      } catch (error) {
        return false;
      }
    },
    
    // Add the test methods to the service as well
    _simulateError(method, error) {
      this.client._simulateError(method, error);
      return this;
    },
    
    _simulateTimeout(method, timeout) {
      this.client._simulateTimeout(method, timeout);
      return this;
    },
    
    _simulateDisconnection() {
      this.client._simulateDisconnection();
      return this;
    },
    
    _populate(data) {
      this.client._populate(data);
      return this;
    },
    
    _inspect() {
      return this.client._inspect();
    }
  };
  
  return redisService;
}

/**
 * Create a mock for the 'ioredis' module
 * @returns {Function} Constructor for the Redis mock
 */
export function createMockRedisModule() {
  // Create a constructor function that returns a mock client
  const Redis = function(options) {
    return createMockRedisClient(options);
  };
  
  // Add static methods and properties that exist on the real Redis class
  Redis.Cluster = function(nodes, options) {
    return createMockRedisClient(options);
  };
  
  return Redis;
}

/**
 * Complete mock for the Redis module
 */
export const mockRedisModule = createMockRedisModule();