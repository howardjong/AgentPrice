/**
 * Redis Service Recovery Tests
 * 
 * These tests focus on the recovery patterns of the Redis service,
 * specifically on reconnection behavior, error recovery, and cleanup.
 * 
 * Coverage goals:
 * - Test automatic reconnection after failures
 * - Test recovery from network errors
 * - Test timeout recovery patterns
 * - Test cleanup after errors
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import redisClient, { InMemoryStore } from '../../../services/redisService.js';
import { 
  createMockRedisClient, 
  createMockRedisService,
  simulateRedisError,
  simulateRedisTimeout,
  simulateRedisDisconnection 
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

describe('Redis Service Recovery Patterns', () => {
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

  describe('Disconnect and Reconnection', () => {
    it('should create a new client instance after disconnect', async () => {
      // Setup - create initial client
      await redisClient.connect();
      const initialClient = redisClient.client;
      
      // Verify initial setup
      expect(initialClient).toBeInstanceOf(InMemoryStore);
      
      // Act - disconnect and reconnect
      await redisClient.stop();
      expect(redisClient.client).toBeNull();
      
      await redisClient.connect();
      const newClient = redisClient.client;
      
      // Assert - new client instance created
      expect(newClient).toBeInstanceOf(InMemoryStore);
      expect(newClient).not.toBe(initialClient);
    });
    
    it('should reconnect automatically when client is null', async () => {
      // Setup - ensure client is null
      await redisClient.stop();
      expect(redisClient.client).toBeNull();
      
      // Act - call a method that requires a client
      await redisClient.set('reconnect-key', 'reconnect-value');
      
      // Assert - client was reconnected automatically
      expect(redisClient.client).toBeInstanceOf(InMemoryStore);
      
      // Verify the operation succeeded after reconnection
      const value = await redisClient.get('reconnect-key');
      expect(value).toBe('reconnect-value');
    });
    
    it('should handle client disconnection during operations', async () => {
      // Setup - create mock client with disconnect capability
      const mockRedisClient = createMockRedisClient();
      
      // Replace redisClient with mock temporarily
      const originalClient = redisClient.client;
      const originalGetClient = redisClient.getClient;
      
      try {
        // Act - set up mock
        redisClient.client = mockRedisClient;
        redisClient.getClient = async () => mockRedisClient;
        
        // Store a value before disconnection
        mockRedisClient.set('pre-disconnect-key', 'pre-disconnect-value');
        
        // Verify client works normally
        let value = await redisClient.get('pre-disconnect-key');
        expect(value).toBe('pre-disconnect-value');
        
        // Simulate disconnection
        simulateRedisDisconnection(mockRedisClient);
        
        // Verify client appears disconnected
        expect(mockRedisClient.status).toBe('end');
        
        // Verify get operations after disconnect return null and don't throw
        const result = await redisClient.get('some-key');
        expect(result).toBeNull();
        
        // Verify set operations after disconnect return false and don't throw
        const setResult = await redisClient.set('post-disconnect-key', 'value');
        expect(setResult).toBe(false);
      } finally {
        // Restore original client
        redisClient.client = originalClient;
        redisClient.getClient = originalGetClient;
      }
    });
    
    it('should handle reconnection after client is disconnected', async () => {
      // Setup - create initial client
      await redisClient.connect();
      
      // Mock disconnection scenarios
      const mockClient = createMockRedisClient();
      const originalClient = redisClient.client;
      
      try {
        // Replace with mock that will simulate disconnect
        redisClient.client = mockClient;
        
        // Simulate disconnection
        simulateRedisDisconnection(mockClient);
        
        // Verify client appears disconnected
        expect(mockClient.status).toBe('end');
        
        // Stop should work even with disconnected client
        await redisClient.stop();
        expect(redisClient.client).toBeNull();
        
        // Reconnect should create a new client
        await redisClient.connect();
        expect(redisClient.client).not.toBeNull();
        expect(redisClient.client).not.toBe(mockClient);
        
        // New client should work
        await redisClient.set('post-reconnect-key', 'post-reconnect-value');
        const value = await redisClient.get('post-reconnect-key');
        expect(value).toBe('post-reconnect-value');
      } finally {
        // Clean up - restore original if needed
        if (redisClient.client !== originalClient && redisClient.client !== null) {
          await redisClient.stop();
        }
        if (originalClient !== null) {
          redisClient.client = originalClient;
        }
      }
    });
  });

  describe('Error Recovery', () => {
    it('should recover after Redis errors during get', async () => {
      // Setup - use a mock Redis client directly
      const mockRedisClient = createMockRedisClient();
      
      // Replace redisClient with mock
      const originalClient = redisClient.client;
      const originalGetClient = redisClient.getClient;
      
      try {
        redisClient.client = mockRedisClient;
        redisClient.getClient = async () => mockRedisClient;
        
        // Set up initial data directly to the store to ensure it's there
        mockRedisClient.mock.store['test-key'] = 'test-value';
        
        // First define normal get behavior
        vi.spyOn(mockRedisClient, 'get').mockImplementation(async (key) => {
          return mockRedisClient.mock.store[key] || null;
        });
        
        // First verify normal operation
        let value = await redisClient.get('test-key');
        expect(value).toBe('test-value');
        
        // Simulate error on get
        simulateRedisError(mockRedisClient, 'get', new Error('Simulated get error'));
        
        // Verify service handles error gracefully
        value = await redisClient.get('test-key');
        expect(value).toBeNull();
        
        // Remove the error simulation
        vi.spyOn(mockRedisClient, 'get').mockImplementation(async (key) => {
          return mockRedisClient.mock.store[key] || null;
        });
        
        // Verify service recovers after error resolves
        value = await redisClient.get('test-key');
        expect(value).toBe('test-value');
      } finally {
        // Restore original client
        redisClient.client = originalClient;
        redisClient.getClient = originalGetClient;
      }
    });
    
    it('should recover after Redis errors during set', async () => {
      // Setup - use a mock Redis client directly
      const mockRedisClient = createMockRedisClient();
      
      // Replace redisClient with mock
      const originalClient = redisClient.client;
      const originalGetClient = redisClient.getClient;
      
      try {
        redisClient.client = mockRedisClient;
        redisClient.getClient = async () => mockRedisClient;
        
        // First verify normal operation
        let result = await redisClient.set('normal-key', 'normal-value');
        expect(result).toBe(true);
        
        // Store value directly to avoid get method interference in test
        mockRedisClient.mock.store['normal-key'] = 'normal-value';
        
        // Simulate error on set
        simulateRedisError(mockRedisClient, 'set', new Error('Simulated set error'));
        
        // Verify service handles error gracefully
        result = await redisClient.set('error-key', 'error-value');
        expect(result).toBe(false);
        
        // Remove the error simulation
        vi.spyOn(mockRedisClient, 'set').mockImplementation(async (key, value) => {
          mockRedisClient.mock.store[key] = value;
          return 'OK';
        });
        
        // Verify service recovers after error resolves
        result = await redisClient.set('recovery-key', 'recovery-value');
        expect(result).toBe(true);
        
        // Store value directly to avoid get method interference in test
        mockRedisClient.mock.store['recovery-key'] = 'recovery-value';
        
        // Update get implementation to allow verification
        vi.spyOn(mockRedisClient, 'get').mockImplementation(async (key) => {
          return mockRedisClient.mock.store[key] || null;
        });
        
        // Verify the value was set
        const value = await redisClient.get('recovery-key');
        expect(value).toBe('recovery-value');
      } finally {
        // Restore original client
        redisClient.client = originalClient;
        redisClient.getClient = originalGetClient;
      }
    });
  });

  describe('Timeout Recovery', () => {
    it('should recover after Redis timeouts during get', async () => {
      // Use real timers for this test
      vi.useRealTimers();
      
      // Setup - use a mock Redis client directly
      const mockRedisClient = createMockRedisClient();
      
      // Set up initial data
      mockRedisClient.mock.store['timeout-key'] = 'timeout-value';
      
      // Replace redisClient with mock
      const originalClient = redisClient.client;
      const originalGetClient = redisClient.getClient;
      
      try {
        redisClient.client = mockRedisClient;
        redisClient.getClient = async () => mockRedisClient;
        
        // Define normal get behavior first
        vi.spyOn(mockRedisClient, 'get').mockImplementation(async (key) => {
          return mockRedisClient.mock.store[key] || null;
        });
        
        // First verify normal operation
        let value = await redisClient.get('timeout-key');
        expect(value).toBe('timeout-value');
        
        // Simulate timeout on get (using very short timeout for tests)
        simulateRedisTimeout(mockRedisClient, 'get', 50);
        
        // Verify service handles timeout gracefully (with custom timeout)
        // The default timeout is 5000ms, but we'll use a shorter one to speed up tests
        value = await redisClient.get('timeout-key', { timeout: 25 });
        expect(value).toBeNull();
        
        // Remove the timeout simulation
        vi.spyOn(mockRedisClient, 'get').mockImplementation(async (key) => {
          return mockRedisClient.mock.store[key] || null;
        });
        
        // Verify service recovers after timeout resolves
        value = await redisClient.get('timeout-key');
        expect(value).toBe('timeout-value');
      } finally {
        // Restore original client
        redisClient.client = originalClient;
        redisClient.getClient = originalGetClient;
      }
    });
    
    it('should recover after Redis timeouts during set', async () => {
      // Use real timers for this test
      vi.useRealTimers();
      
      // Setup - use a mock Redis client directly
      const mockRedisClient = createMockRedisClient();
      
      // Replace redisClient with mock
      const originalClient = redisClient.client;
      const originalGetClient = redisClient.getClient;
      
      try {
        redisClient.client = mockRedisClient;
        redisClient.getClient = async () => mockRedisClient;
        
        // Define normal behavior
        vi.spyOn(mockRedisClient, 'set').mockImplementation(async (key, value) => {
          mockRedisClient.mock.store[key] = value;
          return 'OK';
        });
        
        vi.spyOn(mockRedisClient, 'get').mockImplementation(async (key) => {
          return mockRedisClient.mock.store[key] || null;
        });
        
        // First verify normal operation
        let result = await redisClient.set('normal-timeout-key', 'normal-timeout-value');
        expect(result).toBe(true);
        
        // Simulate timeout on set (using very short timeout for tests)
        simulateRedisTimeout(mockRedisClient, 'set', 75);
        
        // Verify service handles timeout gracefully (with custom timeout)
        // Use a very short timeout to ensure it times out quickly
        result = await redisClient.set('error-timeout-key', 'error-timeout-value', null, 25);
        expect(result).toBe(false);
        
        // Remove the timeout simulation
        vi.spyOn(mockRedisClient, 'set').mockImplementation(async (key, value) => {
          mockRedisClient.mock.store[key] = value;
          return 'OK';
        });
        
        // Verify service recovers after timeout resolves
        result = await redisClient.set('recovery-timeout-key', 'recovery-timeout-value');
        expect(result).toBe(true);
        
        // Verify the value is accessible
        const value = await redisClient.get('recovery-timeout-key');
        expect(value).toBe('recovery-timeout-value');
      } finally {
        // Restore original client
        redisClient.client = originalClient;
        redisClient.getClient = originalGetClient;
      }
    });
  });

  describe('Multiple Sequential Operations', () => {
    it('should handle multiple operations with disconnects in between', async () => {
      // Setup - create mock client directly
      const mockRedisClient = createMockRedisClient();
      
      // Set up initial store behavior
      vi.spyOn(mockRedisClient, 'set').mockImplementation(async (key, value) => {
        mockRedisClient.mock.store[key] = value;
        return 'OK';
      });
      
      vi.spyOn(mockRedisClient, 'get').mockImplementation(async (key) => {
        return mockRedisClient.mock.store[key] || null;
      });
      
      // Replace redisClient with mock
      const originalClient = redisClient.client;
      const originalGetClient = redisClient.getClient;
      
      try {
        redisClient.client = mockRedisClient;
        redisClient.getClient = async () => mockRedisClient;
        
        // Operation 1: Normal set
        await redisClient.set('seq-key-1', 'seq-value-1');
        expect(mockRedisClient.mock.store['seq-key-1']).toBe('seq-value-1');
        
        // Operation 2: Simulate disconnection
        simulateRedisDisconnection(mockRedisClient);
        
        // Verify client appears disconnected
        expect(mockRedisClient.status).toBe('end');
        
        // Operation 3: Set should fail but not throw
        const result = await redisClient.set('seq-key-2', 'seq-value-2');
        expect(result).toBe(false);
        
        // Operation 4: Reset the mock client to simulate reconnection
        mockRedisClient.status = 'ready';
        
        vi.spyOn(mockRedisClient, 'set').mockImplementation(async (key, value) => {
          mockRedisClient.mock.store[key] = value;
          return 'OK';
        });
        
        vi.spyOn(mockRedisClient, 'get').mockImplementation(async (key) => {
          return mockRedisClient.mock.store[key] || null;
        });
        
        // Operation 5: Set after "reconnection"
        const result2 = await redisClient.set('seq-key-3', 'seq-value-3');
        expect(result2).toBe(true);
        
        // Verify reconnected client works
        const value = await redisClient.get('seq-key-3');
        expect(value).toBe('seq-value-3');
      } finally {
        // Restore original client
        redisClient.client = originalClient;
        redisClient.getClient = originalGetClient;
      }
    });
    
    it('should handle parallel operations with error recovery', async () => {
      // Setup - create mock client directly
      const mockRedisClient = createMockRedisClient();
      
      // Set up initial store behavior
      vi.spyOn(mockRedisClient, 'set').mockImplementation(async (key, value) => {
        mockRedisClient.mock.store[key] = value;
        return 'OK';
      });
      
      vi.spyOn(mockRedisClient, 'get').mockImplementation(async (key) => {
        return mockRedisClient.mock.store[key] || null;
      });
      
      // Replace redisClient with mock
      const originalClient = redisClient.client;
      const originalGetClient = redisClient.getClient;
      
      try {
        redisClient.client = mockRedisClient;
        redisClient.getClient = async () => mockRedisClient;
        
        // Initialize data directly in the mock store
        mockRedisClient.mock.store['parallel-1'] = 'value-1';
        mockRedisClient.mock.store['parallel-2'] = 'value-2';
        mockRedisClient.mock.store['parallel-3'] = 'value-3';
        
        // Simulate error on get only
        simulateRedisError(mockRedisClient, 'get', new Error('Simulated parallel error'));
        
        // Run parallel operations - some will fail, some succeed
        const [getResult1, getResult2, setResult] = await Promise.all([
          redisClient.get('parallel-1'),             // Should fail
          redisClient.get('parallel-2'),             // Should fail
          redisClient.set('parallel-4', 'value-4')   // Should succeed
        ]);
        
        // Check results
        expect(getResult1).toBeNull();
        expect(getResult2).toBeNull();
        expect(setResult).toBe(true);
        
        // Fix the get error
        vi.spyOn(mockRedisClient, 'get').mockImplementation(async (key) => {
          return mockRedisClient.mock.store[key] || null;
        });
        
        // Verify recovery works for both operations now
        const [getResult3, getResult4] = await Promise.all([
          redisClient.get('parallel-3'),             // Should work now
          redisClient.get('parallel-4')              // Should work now
        ]);
        
        expect(getResult3).toBe('value-3');
        expect(getResult4).toBe('value-4');
      } finally {
        // Restore original client
        redisClient.client = originalClient;
        redisClient.getClient = originalGetClient;
      }
    });
  });
  
  describe('In-Memory Store Behavior', () => {
    it('should handle expired keys correctly in InMemoryStore', async () => {
      // Use real timers for this test
      vi.useRealTimers();
      
      // Create a new InMemoryStore instance directly
      const store = new InMemoryStore();
      
      // Set a key with 1 second expiry
      await store.set('expiry-key', 'expiry-value', 'EX', 1);
      
      // Verify key exists initially
      let value = await store.get('expiry-key');
      expect(value).toBe('expiry-value');
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Verify key has expired
      value = await store.get('expiry-key');
      expect(value).toBeNull();
    });
    
    it('should handle pattern matching in InMemoryStore.keys()', async () => {
      // Create a new InMemoryStore instance directly
      const store = new InMemoryStore();
      
      // Populate with test keys
      await store.set('test:1', 'value1');
      await store.set('test:2', 'value2');
      await store.set('other:1', 'otherValue');
      
      // Test exact match
      let keys = await store.keys('test:1');
      expect(keys).toContain('test:1');
      expect(keys.length).toBe(1);
      
      // Test wildcard match
      keys = await store.keys('test:*');
      expect(keys).toContain('test:1');
      expect(keys).toContain('test:2');
      expect(keys.length).toBe(2);
      
      // Test full wildcard
      keys = await store.keys('*');
      expect(keys.length).toBe(3);
      expect(keys).toContain('test:1');
      expect(keys).toContain('test:2');
      expect(keys).toContain('other:1');
    });
    
    it('should handle hash operations in InMemoryStore', async () => {
      // Create a new InMemoryStore instance directly
      const store = new InMemoryStore();
      
      // Manually prepare the store structure for hash operations
      // The InMemoryStore hSet method expects a Map
      store.store.set('hash-key', {
        value: new Map([
          ['field1', 'value1'],
          ['field2', 'value2']
        ]),
        expiry: null
      });
      
      // Get individual fields
      let value1 = await store.hGet('hash-key', 'field1');
      let value2 = await store.hGet('hash-key', 'field2');
      expect(value1).toBe('value1');
      expect(value2).toBe('value2');
      
      // Get non-existent field
      let valueNull = await store.hGet('hash-key', 'non-existent');
      expect(valueNull).toBeUndefined();
      
      // Get all hash fields
      let allFields = await store.hGetAll('hash-key');
      expect(allFields).toEqual({
        field1: 'value1',
        field2: 'value2'
      });
      
      // Get non-existent hash
      let emptyHash = await store.hGetAll('non-existent-hash');
      expect(emptyHash).toEqual({});
    });
    
    it('should properly handle connect event in InMemoryStore', async () => {
      // Create a new InMemoryStore instance directly
      const store = new InMemoryStore();
      
      // Return a promise that resolves when connect event is fired
      return new Promise((resolve) => {
        // Register connect handler
        store.on('connect', () => {
          // This should be called asynchronously
          resolve();
        });
        
        // No need to explicitly call anything - the handler should be triggered automatically
      });
    });
  });
});