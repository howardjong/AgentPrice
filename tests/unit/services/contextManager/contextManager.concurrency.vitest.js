/**
 * Concurrency Tests for Context Manager
 * 
 * This file tests concurrency-related behaviors of the Context Manager,
 * focusing on race conditions, parallel operations, and thread safety.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Auto-mock all dependencies (must be before imports)
vi.mock('../../../../services/redisService.js');
vi.mock('../../../../utils/logger.js');

// Import the module under test after mocks
import contextManager from '../../../../services/contextManager.js';
import redisClient from '../../../../services/redisService.js';
import logger from '../../../../utils/logger.js';

describe('ContextManager Concurrency Tests', () => {
  // Create a mock Redis client for all tests
  const mockRedisClient = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    exists: vi.fn()
  };

  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();
    
    // Setup default Redis client behavior
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.del.mockResolvedValue(1);
    mockRedisClient.keys.mockResolvedValue([]);
    mockRedisClient.exists.mockResolvedValue(0);
    
    // Setup redisClient mock to return our mockRedisClient
    redisClient.getClient.mockResolvedValue(mockRedisClient);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Parallel Operations', () => {
    it('should handle multiple concurrent store operations', async () => {
      // Arrange
      const sessionId = 'concurrent-session';
      const context1 = { data: 'context1' };
      const context2 = { data: 'context2' };
      const context3 = { data: 'context3' };
      
      // Act - Run multiple store operations concurrently
      await Promise.all([
        contextManager.storeContext(sessionId, context1),
        contextManager.storeContext(sessionId, context2),
        contextManager.storeContext(sessionId, context3)
      ]);
      
      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledTimes(3);
    });
    
    it('should handle concurrent stores and retrievals', async () => {
      // Arrange
      const sessionId = 'concurrent-session';
      
      // Mock data for get operation
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ data: 'stored' }));
      
      // Act - Run store and get operations concurrently
      const results = await Promise.all([
        contextManager.storeContext(sessionId, { data: 'new' }),
        contextManager.getContext(sessionId),
        contextManager.storeContext(sessionId, { data: 'newer' }),
        contextManager.getContext(sessionId)
      ]);
      
      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.get).toHaveBeenCalledTimes(2);
      
      // The results should be in the same order as the promises
      expect(results[0]).toBe(true); // First store
      expect(results[1]).toEqual({ data: 'stored' }); // First get
      expect(results[2]).toBe(true); // Second store
      expect(results[3]).toEqual({ data: 'stored' }); // Second get
    });
    
    it('should handle multiple concurrent list operations', async () => {
      // Arrange
      const sessionKeys = [
        'context:session1',
        'context:session2',
        'context:session3'
      ];
      mockRedisClient.keys.mockResolvedValue(sessionKeys);
      
      // Act - Run multiple list operations concurrently with different limits/offsets
      const results = await Promise.all([
        contextManager.listSessions(10, 0),
        contextManager.listSessions(1, 1),
        contextManager.listSessions(2, 0)
      ]);
      
      // Assert
      expect(mockRedisClient.keys).toHaveBeenCalledTimes(3);
      expect(results[0]).toEqual(['session1', 'session2', 'session3']); // All sessions
      expect(results[1]).toEqual(['session2']); // Just the second session
      expect(results[2]).toEqual(['session1', 'session2']); // First two sessions
    });
  });

  describe('Race Conditions', () => {
    it('should handle race condition during update', async () => {
      // Arrange
      const sessionId = 'race-condition';
      let callCount = 0;
      
      // Setup get to return different values on subsequent calls
      // simulating concurrent updates
      mockRedisClient.get.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(JSON.stringify({ counter: 1 }));
        } else {
          return Promise.resolve(JSON.stringify({ counter: 2 }));
        }
      });
      
      // Act
      const result = await contextManager.updateContext(sessionId, (ctx) => {
        return { counter: ctx.counter + 1 };
      });
      
      // Assert
      expect(result).toEqual({ counter: 2 }); // The updater is applied to ctx from first get (1+1=2)
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `context:${sessionId}`,
        JSON.stringify({ counter: 2 }),
        'EX',
        expect.any(Number)
      );
    });
    
    it('should handle delete followed by immediate get', async () => {
      // Arrange
      const sessionId = 'delete-then-get';
      
      // First get call returns data, second returns null (after deletion)
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ data: 'exists' }))
        .mockResolvedValueOnce(null);
      
      // Act
      const deletePromise = contextManager.deleteContext(sessionId);
      // Don't await to simulate concurrent operations
      const getPromise = contextManager.getContext(sessionId);
      
      const [deleteResult, getResult] = await Promise.all([deletePromise, getPromise]);
      
      // Assert
      expect(deleteResult).toBe(true);
      // Get could return null or data depending on timing
      // We don't assert on the exact value as either is valid behavior
      expect(mockRedisClient.del).toHaveBeenCalledWith(`context:${sessionId}`);
    });
  });

  describe('Connection Pool Handling', () => {
    it('should reuse Redis client connection across operations', async () => {
      // Arrange
      const sessionId = 'connection-pool';
      
      // Act - Run multiple operations
      await contextManager.storeContext(sessionId, { data: 'test' });
      await contextManager.getContext(sessionId);
      await contextManager.deleteContext(sessionId);
      
      // Assert
      expect(redisClient.getClient).toHaveBeenCalledTimes(3);
    });
    
    it('should handle Redis client reconnection between operations', async () => {
      // Arrange
      const sessionId = 'reconnection';
      const context = { data: 'test' };
      
      // First call returns one client, second call simulates reconnection with new client
      const mockClient1 = { ...mockRedisClient };
      const mockClient2 = { ...mockRedisClient };
      
      redisClient.getClient
        .mockResolvedValueOnce(mockClient1)
        .mockResolvedValueOnce(mockClient2);
      
      // Act
      await contextManager.storeContext(sessionId, context);
      await contextManager.getContext(sessionId);
      
      // Assert
      expect(redisClient.getClient).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Propagation During Concurrent Operations', () => {
    it('should handle errors in one operation without affecting others', async () => {
      // Arrange
      const goodSessionId = 'good-session';
      const badSessionId = 'bad-session';
      
      // Make operations on badSessionId fail
      mockRedisClient.get.mockImplementation((key) => {
        if (key.includes(badSessionId)) {
          return Promise.reject(new Error('Simulated failure'));
        }
        return Promise.resolve(JSON.stringify({ data: 'success' }));
      });
      
      // Act - Run a good and a bad operation concurrently
      const results = await Promise.allSettled([
        contextManager.getContext(goodSessionId),
        contextManager.getContext(badSessionId)
      ]);
      
      // Assert
      expect(results[0].status).toBe('fulfilled');
      expect(results[0].value).toEqual({ data: 'success' });
      expect(results[1].status).toBe('rejected');
      expect(results[1].reason.message).toBe('Simulated failure');
    });
    
    it('should correctly log errors during concurrent operations', async () => {
      // Arrange
      const sessionIds = ['session1', 'session2', 'session3'];
      
      // Make the second operation fail
      mockRedisClient.get.mockImplementation((key) => {
        if (key.includes('session2')) {
          return Promise.reject(new Error('Error for session2'));
        }
        return Promise.resolve(JSON.stringify({ data: 'success' }));
      });
      
      // Act - Run multiple operations concurrently
      await Promise.allSettled(
        sessionIds.map(id => contextManager.getContext(id))
      );
      
      // Assert
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'Error retrieving context',
        expect.objectContaining({
          sessionId: 'session2',
          error: 'Error for session2'
        })
      );
    });
  });
});