/**
 * Monitoring Module Tests
 * 
 * Tests for the CircuitBreaker utility in the monitoring module
 * that provides fault tolerance and timeout handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker } from '../../../utils/monitoring.js';
import logger from '../../../utils/logger.js';

// Mock dependencies
vi.mock('../../../utils/logger.js', () => {
  return {
    default: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }
  };
});

// Helper to create mock response errors with status code
function createResponseError(status = 500, headers = {}) {
  const error = new Error(`HTTP Error ${status}`);
  error.response = {
    status,
    headers
  };
  return error;
}

describe('CircuitBreaker', () => {
  let circuitBreaker;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Create a new circuit breaker with test-friendly timeouts
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 500, // short timeout for tests
      rateLimitResetTimeout: 300
    });
    
    // Prevent setInterval from running in tests
    vi.spyOn(global, 'setInterval').mockImplementation(() => 999);
    vi.spyOn(global, 'clearInterval').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Clean up the circuit breaker
    circuitBreaker.stop();
  });
  
  describe('Basic Functionality', () => {
    it('should initialize with default options', () => {
      const defaultBreaker = new CircuitBreaker();
      
      expect(defaultBreaker.failureThreshold).toBe(5);
      expect(defaultBreaker.resetTimeout).toBe(30000);
      expect(defaultBreaker.rateLimitResetTimeout).toBe(60000);
      expect(defaultBreaker.state).toEqual({});
    });
    
    it('should initialize with custom options', () => {
      expect(circuitBreaker.failureThreshold).toBe(3);
      expect(circuitBreaker.resetTimeout).toBe(500);
      expect(circuitBreaker.rateLimitResetTimeout).toBe(300);
    });
    
    it('should successfully execute a request function', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.executeRequest('testService', mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalled();
      expect(circuitBreaker.state.testService.successCount).toBe(1);
      expect(circuitBreaker.state.testService.status).toBe('CLOSED');
    });
    
    it('should initialize service state on first request', async () => {
      // Before the request
      expect(circuitBreaker.state.newService).toBeUndefined();
      
      // Execute a request
      await circuitBreaker.executeRequest('newService', () => 'result');
      
      // After the request
      expect(circuitBreaker.state.newService).toBeDefined();
      expect(circuitBreaker.state.newService.status).toBe('CLOSED');
      expect(circuitBreaker.state.newService.failures).toBe(0);
      expect(circuitBreaker.state.newService.successCount).toBe(1);
    });
  });
  
  describe('Failure Handling', () => {
    it('should track failures and open circuit after threshold', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      // First 3 failures should be tracked but circuit remains closed
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.executeRequest('failingService', mockFn);
        } catch (error) {
          // Expected to throw
        }
      }
      
      // Circuit should be open now
      expect(circuitBreaker.state.failingService.status).toBe('OPEN');
      expect(circuitBreaker.state.failingService.failures).toBe(3);
      expect(circuitBreaker.state.failingService.failureCount).toBe(3);
      
      // Next request should immediately fail with circuit open error
      try {
        await circuitBreaker.executeRequest('failingService', () => 'success');
        // This line should not execute
        expect(false).toBe(true);
      } catch (error) {
        expect(error.message).toContain('circuit breaker open');
      }
    });
    
    it('should transition to half-open state after timeout', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      // Get to open state
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.executeRequest('failingService', mockFn);
        } catch (error) {
          // Expected to throw
        }
      }
      
      // Verify open state
      expect(circuitBreaker.state.failingService.status).toBe('OPEN');
      
      // Fast-forward time
      circuitBreaker.state.failingService.lastFailure = Date.now() - 1000; // past the resetTimeout
      
      // Try a request, should be in half-open state
      try {
        mockFn.mockRejectedValueOnce(new Error('still failing'));
        await circuitBreaker.executeRequest('failingService', mockFn);
      } catch (error) {
        // Expected to throw
        expect(error.message).toBe('still failing');
      }
      
      // Verify it went to half-open before executing
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Circuit breaker half-open'));
      
      // Failed in half-open, should go back to open
      expect(circuitBreaker.state.failingService.status).toBe('OPEN');
    });
    
    it('should close circuit after successful request in half-open state', async () => {
      // First get to open state
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.executeRequest('recoveringService', mockFn);
        } catch (error) {
          // Expected
        }
      }
      
      // Verify open state
      expect(circuitBreaker.state.recoveringService.status).toBe('OPEN');
      
      // Fast-forward time
      circuitBreaker.state.recoveringService.lastFailure = Date.now() - 1000;
      
      // Now use a successful function
      const successFn = vi.fn().mockResolvedValue('recovered');
      
      // This should execute in half-open state and succeed
      const result = await circuitBreaker.executeRequest('recoveringService', successFn);
      
      // Verify success
      expect(result).toBe('recovered');
      expect(circuitBreaker.state.recoveringService.status).toBe('CLOSED');
      expect(circuitBreaker.state.recoveringService.failures).toBe(0); // Reset
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Circuit breaker closed'));
    });
  });
  
  describe('Rate Limiting', () => {
    it('should detect and handle rate limiting (429) errors', async () => {
      // Create a rate limit error
      const rateLimitError = createResponseError(429);
      const mockFn = vi.fn().mockRejectedValue(rateLimitError);
      
      try {
        await circuitBreaker.executeRequest('rateLimitedService', mockFn);
      } catch (error) {
        expect(error.message).toContain('rate limited (HTTP 429)');
      }
      
      // Check rate limit state
      expect(circuitBreaker.state.rateLimitedService.rateLimited).toBe(true);
      expect(circuitBreaker.state.rateLimitedService.consecutiveRateLimits).toBe(1);
      expect(circuitBreaker.state.rateLimitedService.rateLimitResetTime).toBeGreaterThan(Date.now());
    });
    
    it('should respect retry-after header when available', async () => {
      // Create a rate limit error with retry-after header
      const headers = { 'retry-after': '10' }; // 10 seconds
      const rateLimitError = createResponseError(429, headers);
      const mockFn = vi.fn().mockRejectedValue(rateLimitError);
      
      try {
        await circuitBreaker.executeRequest('rateLimitedService', mockFn);
      } catch (error) {
        expect(error.message).toContain('rate limited (HTTP 429)');
      }
      
      // Check that reset time respects the header (plus some jitter)
      const expectedMinTime = Date.now() + 10000; // 10 seconds in ms
      const expectedMaxTime = Date.now() + 10000 + 5000; // 10 seconds plus max jitter
      
      expect(circuitBreaker.state.rateLimitedService.rateLimitResetTime).toBeGreaterThanOrEqual(expectedMinTime);
      expect(circuitBreaker.state.rateLimitedService.rateLimitResetTime).toBeLessThanOrEqual(expectedMaxTime);
    });
    
    it('should increase backoff time for consecutive rate limits', async () => {
      const rateLimitError = createResponseError(429);
      const mockFn = vi.fn().mockRejectedValue(rateLimitError);
      
      // First rate limit
      try {
        await circuitBreaker.executeRequest('backoffService', mockFn);
      } catch (error) {
        // Expected
      }
      
      const firstResetTime = circuitBreaker.state.backoffService.rateLimitResetTime;
      
      // Fast-forward past the rate limit period
      const originalResetTime = circuitBreaker.state.backoffService.rateLimitResetTime;
      circuitBreaker.state.backoffService.rateLimitResetTime = Date.now() - 1000;
      
      // Second rate limit
      try {
        await circuitBreaker.executeRequest('backoffService', mockFn);
      } catch (error) {
        // Expected
      }
      
      const secondResetTime = circuitBreaker.state.backoffService.rateLimitResetTime;
      
      // The second backoff should be longer due to exponential backoff
      expect(secondResetTime - Date.now()).toBeGreaterThan(firstResetTime - originalResetTime);
      expect(circuitBreaker.state.backoffService.consecutiveRateLimits).toBe(2);
    });
    
    it('should open circuit after excessive consecutive rate limits', async () => {
      const rateLimitError = createResponseError(429);
      const mockFn = vi.fn().mockRejectedValue(rateLimitError);
      
      // Simulate 5 consecutive rate limits
      for (let i = 0; i < 5; i++) {
        try {
          // Reset the rate limit timer each time so we don't have to wait
          if (circuitBreaker.state.excessiveRateLimits) {
            circuitBreaker.state.excessiveRateLimits.rateLimitResetTime = Date.now() - 1000;
          }
          
          await circuitBreaker.executeRequest('excessiveRateLimits', mockFn);
        } catch (error) {
          // Expected
        }
      }
      
      // After 5 consecutive rate limits, the circuit should be open
      expect(circuitBreaker.state.excessiveRateLimits.status).toBe('OPEN');
    });
  });
  
  describe('Timeout Handling', () => {
    it('should set appropriate timeout based on service type', async () => {
      // Mock AbortController
      const abortMock = {
        abort: vi.fn(),
        signal: {}
      };
      vi.spyOn(global, 'AbortController').mockImplementation(() => abortMock);
      
      // Mock setTimeout to capture timeout values
      const originalSetTimeout = global.setTimeout;
      const mockSetTimeout = vi.fn().mockImplementation((fn, timeout) => {
        // Store the timeout but still call the original to maintain functionality
        return originalSetTimeout(fn, 10); // Use a shorter timeout for tests
      });
      global.setTimeout = mockSetTimeout;
      
      const mockSuccessFn = vi.fn().mockResolvedValue('success');
      
      try {
        // For regular service (180s timeout)
        await circuitBreaker.executeRequest('regularService', mockSuccessFn);
        
        // Verify the timeout value
        expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 180000);
        
        // Reset for next call
        mockSetTimeout.mockClear();
        
        // For deep research service (300s timeout)
        await circuitBreaker.executeRequest('deep-research', mockSuccessFn);
        
        // Verify the timeout value
        expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 300000);
      } finally {
        // Restore the original setTimeout
        global.setTimeout = originalSetTimeout;
      }
    });
  });
  
  describe('Reset and Cleanup', () => {
    it('should reset a specific service circuit state', async () => {
      // Create a failing service
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
      
      try {
        await circuitBreaker.executeRequest('resetTest', mockFn);
      } catch (error) {
        // Expected
      }
      
      // Verify we have state
      expect(circuitBreaker.state.resetTest.failureCount).toBe(1);
      
      // Reset the service
      circuitBreaker.reset('resetTest');
      
      // Verify reset state
      expect(circuitBreaker.state.resetTest.failures).toBe(0);
      expect(circuitBreaker.state.resetTest.failureCount).toBe(0);
      expect(circuitBreaker.state.resetTest.status).toBe('CLOSED');
      expect(circuitBreaker.state.resetTest.rateLimited).toBe(false);
    });
    
    it('should clean up resources when stopped', () => {
      // Mock clearTimeout
      const originalClearTimeout = global.clearTimeout;
      const mockClearTimeout = vi.fn();
      global.clearTimeout = mockClearTimeout;
      
      try {
        const pendingRequest = {
          timeout: 123,
          serviceKey: 'cleanupTest',
          abort: vi.fn()
        };
        
        // Add a pending request
        circuitBreaker.pendingPromises.set('test-request', pendingRequest);
        
        // Stop the circuit breaker
        circuitBreaker.stop();
        
        // Verify cleanup
        expect(clearInterval).toHaveBeenCalled();
        expect(mockClearTimeout).toHaveBeenCalledWith(123);
        expect(circuitBreaker.pendingPromises.size).toBe(0);
      } finally {
        // Restore original
        global.clearTimeout = originalClearTimeout;
      }
    });
  });
  
  describe('Monitoring', () => {
    it('should log circuit status periodically', () => {
      // Clear any previous calls to logger
      vi.mocked(logger.info).mockClear();
      
      // Create some state to monitor
      circuitBreaker.state.monitorTest = {
        status: 'CLOSED',
        failures: 0,
        successCount: 10,
        failureCount: 2,
        lastSuccess: Date.now() - 5000,
        lastFailure: Date.now() - 10000,
      };
      
      // Manually trigger the monitoring
      circuitBreaker.logCircuitStatus();
      
      // Verify logging
      expect(logger.info).toHaveBeenCalledWith('Circuit breaker summary', expect.any(Object));
    });
  });
});