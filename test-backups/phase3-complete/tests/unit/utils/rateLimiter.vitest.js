import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the logger before importing the rate limiter
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Import the module under test
import perplexityRateLimiter from '../../../utils/rateLimiter.js';

describe('PerplexityRateLimiter', () => {
  // Store original setTimeout/setInterval
  const originalSetTimeout = global.setTimeout;
  const originalDateNow = Date.now;
  
  // Mock time functions
  beforeEach(() => {
    let currentTime = 1000;
    
    // Mock Date.now
    global.Date.now = vi.fn(() => currentTime);
    
    // Mock setTimeout to execute immediately
    global.setTimeout = vi.fn((callback, _delay) => {
      // Advance time
      currentTime += _delay || 0;
      callback();
      return 'timeout-id';
    });
    
    // Reset rate limiter for each test
    perplexityRateLimiter.requestTimestamps = [];
    perplexityRateLimiter.pendingRequests = [];
    perplexityRateLimiter.processing = false;
  });
  
  afterEach(() => {
    // Restore original functions
    global.setTimeout = originalSetTimeout;
    global.Date.now = originalDateNow;
    
    // Clear mocks
    vi.clearAllMocks();
  });
  
  describe('schedule', () => {
    it('should execute a task immediately if no rate limiting is needed', async () => {
      const mockTask = vi.fn().mockResolvedValue('success');
      
      const result = await perplexityRateLimiter.schedule(mockTask);
      
      expect(mockTask).toHaveBeenCalledTimes(1);
      expect(result).toBe('success');
      expect(perplexityRateLimiter.requestTimestamps.length).toBe(1);
    });
    
    it('should handle failed tasks and propagate errors', async () => {
      const mockError = new Error('Task failed');
      const mockTask = vi.fn().mockRejectedValue(mockError);
      
      await expect(perplexityRateLimiter.schedule(mockTask)).rejects.toThrow(mockError);
      expect(mockTask).toHaveBeenCalledTimes(1);
    });
    
    it('should rate limit requests when limit is reached', async () => {
      // Configure for testing - 2 requests per minute with no cooldown
      perplexityRateLimiter.requestsPerMinute = 2;
      perplexityRateLimiter.cooldownPeriod = 0;
      
      // Create mock tasks
      const mockTask1 = vi.fn().mockResolvedValue('result1');
      const mockTask2 = vi.fn().mockResolvedValue('result2');
      const mockTask3 = vi.fn().mockResolvedValue('result3');
      
      // Execute first task - should run immediately
      const promise1 = perplexityRateLimiter.schedule(mockTask1);
      
      // Execute second task - should also run immediately
      const promise2 = perplexityRateLimiter.schedule(mockTask2);
      
      // Execute third task - should be rate limited and delayed
      const promise3 = perplexityRateLimiter.schedule(mockTask3);
      
      // Wait for all tasks to complete
      const results = await Promise.all([promise1, promise2, promise3]);
      
      // Verify all tasks were executed
      expect(results).toEqual(['result1', 'result2', 'result3']);
      expect(mockTask1).toHaveBeenCalledTimes(1);
      expect(mockTask2).toHaveBeenCalledTimes(1);
      expect(mockTask3).toHaveBeenCalledTimes(1);
      
      // Verify the timestamps were recorded (indicating the requests were processed)
      expect(perplexityRateLimiter.requestTimestamps.length).toBe(3);
    });
  });
  
  describe('getWaitTime', () => {
    it('should return 0 when no rate limiting is needed', () => {
      expect(perplexityRateLimiter.getWaitTime()).toBe(0);
    });
    
    it('should calculate wait time when rate limit is reached', () => {
      // Set up the rate limiter with some timestamps
      perplexityRateLimiter.requestsPerMinute = 2;
      perplexityRateLimiter.requestTimestamps = [1000, 2000]; // Two requests at 1s and 2s
      
      // Set current time to 10s
      Date.now = vi.fn(() => 10000);
      
      // The oldest timestamp is at 1s, so it will expire at 61s
      // From our current time at 10s, that's 51s of wait time
      const expectedWaitTime = 51000;
      
      expect(perplexityRateLimiter.getWaitTime()).toBe(expectedWaitTime);
    });
  });
  
  describe('getStatus', () => {
    it('should return current status', () => {
      // Set up test state
      perplexityRateLimiter.requestsPerMinute = 3;
      perplexityRateLimiter.requestTimestamps = [1000, 2000];
      perplexityRateLimiter.pendingRequests = [{}, {}]; // Two pending requests
      
      const status = perplexityRateLimiter.getStatus();
      
      expect(status).toEqual({
        activeRequests: 2,
        queuedRequests: 2,
        isRateLimited: false, // 2 < 3
        nextAvailableSlot: 0 // No wait time needed
      });
    });
    
    it('should indicate rate limited status when limit reached', () => {
      // Set up test state
      perplexityRateLimiter.requestsPerMinute = 2;
      perplexityRateLimiter.requestTimestamps = [1000, 2000]; // Two requests at limit
      
      const status = perplexityRateLimiter.getStatus();
      
      expect(status.isRateLimited).toBe(true);
    });
  });
});