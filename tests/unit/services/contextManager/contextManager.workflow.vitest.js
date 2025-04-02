/**
 * Workflow Integration Tests for Context Manager
 * 
 * This file tests how the Context Manager behaves in simulated workflow scenarios,
 * focusing on multi-session management and integration with research workflows.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Auto-mock all dependencies (must be before imports)
vi.mock('../../../../services/redisService.js');
vi.mock('../../../../utils/logger.js');

// Import the module under test after mocks
import contextManager from '../../../../services/contextManager.js';
import redisClient from '../../../../services/redisService.js';
import logger from '../../../../utils/logger.js';

describe('ContextManager Workflow Integration Tests', () => {
  // Create a mock Redis client for all tests
  const mockRedisClient = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    exists: vi.fn(),
    mget: vi.fn(),
    scan: vi.fn()
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
    mockRedisClient.mget.mockResolvedValue([]);
    mockRedisClient.scan.mockResolvedValue(['0', []]);
    
    // Setup redisClient mock to return our mockRedisClient
    redisClient.getClient.mockResolvedValue(mockRedisClient);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Multi-Session Management', () => {
    it('should manage multiple simultaneous user sessions', async () => {
      // Arrange
      const sessionIds = ['user1-session', 'user2-session', 'user3-session'];
      const contexts = {
        'user1-session': { userId: 'user1', query: 'research topic 1' },
        'user2-session': { userId: 'user2', query: 'research topic 2' },
        'user3-session': { userId: 'user3', query: 'research topic 3' }
      };
      
      // Act - Store contexts for all sessions
      for (const sessionId of sessionIds) {
        await contextManager.storeContext(sessionId, contexts[sessionId]);
      }
      
      // Simulate Redis returning session keys
      mockRedisClient.keys.mockResolvedValue(
        sessionIds.map(id => `context:${id}`)
      );
      
      // Get list of active sessions
      const activeSessions = await contextManager.listSessions();
      
      // Retrieve each context
      const retrievedContexts = [];
      for (const sessionId of sessionIds) {
        // Setup mock return for each session
        mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(contexts[sessionId]));
        
        const context = await contextManager.getContext(sessionId);
        retrievedContexts.push(context);
      }
      
      // Assert
      expect(activeSessions).toEqual(sessionIds);
      expect(retrievedContexts).toEqual(Object.values(contexts));
      expect(mockRedisClient.set).toHaveBeenCalledTimes(3);
      expect(mockRedisClient.get).toHaveBeenCalledTimes(3);
    });
    
    it('should handle context updates across multiple sessions', async () => {
      // Arrange
      const sessionIds = ['user1-session', 'user2-session'];
      const initialContexts = {
        'user1-session': { userId: 'user1', stage: 'initial' },
        'user2-session': { userId: 'user2', stage: 'initial' }
      };
      
      // Setup mock returns for each session get/update cycle
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(initialContexts['user1-session']))
        .mockResolvedValueOnce(JSON.stringify(initialContexts['user2-session']))
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user1', stage: 'processing' }))
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user2', stage: 'processing' }));
      
      // Act - Multi-stage workflow with context updates
      // Stage 1: Initial context
      for (const sessionId of sessionIds) {
        await contextManager.storeContext(sessionId, initialContexts[sessionId]);
      }
      
      // Stage 2: Update to processing
      for (const sessionId of sessionIds) {
        await contextManager.updateContext(sessionId, (ctx) => ({ 
          ...ctx, 
          stage: 'processing' 
        }));
      }
      
      // Stage 3: Update to different stages based on session
      await contextManager.updateContext('user1-session', (ctx) => ({ 
        ...ctx, 
        stage: 'review',
        results: ['result1', 'result2'] 
      }));
      
      await contextManager.updateContext('user2-session', (ctx) => ({ 
        ...ctx, 
        stage: 'error',
        errorMessage: 'Processing failed' 
      }));
      
      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledTimes(6); // 2 initial + 4 updates
      expect(mockRedisClient.get).toHaveBeenCalledTimes(4); // For the 4 updates
      
      // Check the specific update calls
      expect(mockRedisClient.set).toHaveBeenNthCalledWith(
        5, // 5th call (3rd update)
        'context:user1-session',
        JSON.stringify({ 
          userId: 'user1', 
          stage: 'review',
          results: ['result1', 'result2'] 
        }),
        'EX',
        expect.any(Number)
      );
      
      expect(mockRedisClient.set).toHaveBeenNthCalledWith(
        6, // 6th call (4th update)
        'context:user2-session',
        JSON.stringify({ 
          userId: 'user2', 
          stage: 'error',
          errorMessage: 'Processing failed' 
        }),
        'EX',
        expect.any(Number)
      );
    });
  });

  describe('Research Workflow Integration', () => {
    it('should manage context through a complete research workflow lifecycle', async () => {
      // Arrange
      const sessionId = 'research-workflow';
      
      // Setup mock context returns for different stages
      const stages = {
        initial: { 
          userId: 'researcher1', 
          query: 'AI research topic', 
          stage: 'initial' 
        },
        searching: { 
          userId: 'researcher1', 
          query: 'AI research topic', 
          stage: 'searching',
          startTime: '2025-04-01T12:00:00Z' 
        },
        perplexity: { 
          userId: 'researcher1', 
          query: 'AI research topic', 
          stage: 'provider-perplexity',
          startTime: '2025-04-01T12:00:00Z',
          perplexityStatus: 'in-progress' 
        },
        claude: { 
          userId: 'researcher1', 
          query: 'AI research topic', 
          stage: 'provider-claude',
          startTime: '2025-04-01T12:00:00Z',
          perplexityStatus: 'completed',
          perplexityResults: { sources: 5, text: 'summary...' },
          claudeStatus: 'in-progress' 
        },
        completed: { 
          userId: 'researcher1', 
          query: 'AI research topic', 
          stage: 'completed',
          startTime: '2025-04-01T12:00:00Z',
          endTime: '2025-04-01T12:05:30Z',
          perplexityStatus: 'completed',
          perplexityResults: { sources: 5, text: 'summary...' },
          claudeStatus: 'completed',
          claudeResults: { analysis: 'detailed analysis...' },
          combinedResult: 'Final research output...'
        }
      };
      
      // Setup get to return different values based on call order
      let callCount = 0;
      mockRedisClient.get.mockImplementation(() => {
        const stagesArray = Object.values(stages);
        
        // For the first call, return null (no existing context)
        // For subsequent calls, return progressively more complete contexts
        if (callCount === 0) {
          callCount++;
          return Promise.resolve(null);
        } else {
          const idx = Math.min(callCount, stagesArray.length - 1);
          callCount++;
          return Promise.resolve(JSON.stringify(stagesArray[idx - 1]));
        }
      });
      
      // Act - Simulate a complete research workflow
      
      // Step 1: Initialize research session
      await contextManager.updateContext(sessionId, () => stages.initial);
      
      // Step 2: Update to searching stage
      await contextManager.updateContext(sessionId, () => stages.searching);
      
      // Step 3: Perplexity processing
      await contextManager.updateContext(sessionId, () => stages.perplexity);
      
      // Step 4: Claude processing
      await contextManager.updateContext(sessionId, () => stages.claude);
      
      // Step 5: Complete the research workflow
      await contextManager.updateContext(sessionId, () => stages.completed);
      
      // Step 6: Get the final context
      const finalContext = await contextManager.getContext(sessionId);
      
      // Assert
      expect(mockRedisClient.get).toHaveBeenCalledTimes(6); // 5 updates + 1 final get
      expect(mockRedisClient.set).toHaveBeenCalledTimes(5); // 5 context updates
      
      // Final context should be the latest get return value
      // which is the last context the mock returns
      expect(finalContext).toBeTruthy();
      // We expect specific fields to be present in the final context
      expect(finalContext).toHaveProperty('userId', 'researcher1');
      expect(finalContext).toHaveProperty('query', 'AI research topic');
      
      // Check the progression of set calls
      expect(mockRedisClient.set).toHaveBeenNthCalledWith(
        1,
        'context:research-workflow',
        JSON.stringify(stages.initial),
        'EX',
        expect.any(Number)
      );
      
      expect(mockRedisClient.set).toHaveBeenLastCalledWith(
        'context:research-workflow',
        JSON.stringify(stages.completed),
        'EX',
        expect.any(Number)
      );
    });
    
    it('should handle error recovery in a research workflow', async () => {
      // Arrange
      const sessionId = 'error-recovery-workflow';
      
      // Define context states
      const initialContext = { 
        userId: 'researcher1', 
        query: 'AI research topic', 
        stage: 'initial' 
      };
      
      const errorContext = { 
        userId: 'researcher1', 
        query: 'AI research topic', 
        stage: 'error',
        error: 'Perplexity service unavailable',
        lastSuccessfulStage: 'initial'
      };
      
      const recoveryContext = { 
        userId: 'researcher1', 
        query: 'AI research topic', 
        stage: 'recovery',
        previousError: 'Perplexity service unavailable',
        recoveryAttempt: 1
      };
      
      const completedContext = { 
        userId: 'researcher1', 
        query: 'AI research topic', 
        stage: 'completed',
        previousError: 'Perplexity service unavailable',
        recoveryAttempt: 1,
        results: 'Recovered results'
      };
      
      // Setup mock get returns
      mockRedisClient.get
        .mockResolvedValueOnce(null) // No context initially
        .mockResolvedValueOnce(JSON.stringify(initialContext))
        .mockResolvedValueOnce(JSON.stringify(errorContext))
        .mockResolvedValueOnce(JSON.stringify(recoveryContext));
      
      // Act - Simulate a workflow with error and recovery
      
      // Step 1: Initialize session
      await contextManager.updateContext(sessionId, () => initialContext);
      
      // Step 2: Error occurs
      await contextManager.updateContext(sessionId, () => errorContext);
      
      // Step 3: Begin recovery
      await contextManager.updateContext(sessionId, () => recoveryContext);
      
      // Step 4: Complete recovery
      await contextManager.updateContext(sessionId, () => completedContext);
      
      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledTimes(4);
      
      // Check progression of error handling
      expect(mockRedisClient.set).toHaveBeenNthCalledWith(
        2,
        `context:${sessionId}`,
        JSON.stringify(errorContext),
        'EX',
        expect.any(Number)
      );
      
      expect(mockRedisClient.set).toHaveBeenNthCalledWith(
        3,
        `context:${sessionId}`,
        JSON.stringify(recoveryContext),
        'EX',
        expect.any(Number)
      );
      
      expect(mockRedisClient.set).toHaveBeenNthCalledWith(
        4,
        `context:${sessionId}`,
        JSON.stringify(completedContext),
        'EX',
        expect.any(Number)
      );
    });
  });

  describe('Long-term Context Management', () => {
    it('should properly manage context with the configured expiry time', async () => {
      // Arrange
      const sessionId = 'long-term-session';
      const context = { data: 'persistent' };
      
      // Act
      await contextManager.storeContext(sessionId, context);
      
      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `context:${sessionId}`,
        JSON.stringify(context),
        'EX',
        24 * 60 * 60 // 24 hours in seconds
      );
    });
    
    it('should clean up stale sessions after research completion', async () => {
      // Arrange
      const activeSessions = ['active1', 'active2'];
      const completedSession = 'completed1';
      
      // Mock active sessions
      mockRedisClient.keys.mockResolvedValue([
        'context:active1',
        'context:active2',
        'context:completed1'
      ]);
      
      // Mock session contexts
      mockRedisClient.get.mockImplementation((key) => {
        if (key === 'context:completed1') {
          return Promise.resolve(JSON.stringify({ 
            stage: 'completed',
            completedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString() // 3 days ago
          }));
        } else {
          return Promise.resolve(JSON.stringify({ 
            stage: 'in-progress'
          }));
        }
      });
      
      // Act
      // First get all sessions
      const sessions = await contextManager.listSessions();
      
      // Then delete the completed one
      await contextManager.deleteContext(completedSession);
      
      // Assert
      expect(sessions).toEqual(['active1', 'active2', 'completed1']);
      expect(mockRedisClient.del).toHaveBeenCalledWith('context:completed1');
    });
  });
});