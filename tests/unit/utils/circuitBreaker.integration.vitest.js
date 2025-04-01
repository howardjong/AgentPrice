/**
 * @file circuitBreaker.integration.vitest.js
 * @description Tests for CircuitBreaker integration with API clients
 * 
 * This file focuses on testing the integration of CircuitBreaker with API clients,
 * testing real request execution, failure detection, and recovery patterns.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker } from '../../../utils/circuitBreaker.js';
import { createTimeController } from '../../utils/time-testing-utils.js';

// Mock logger to reduce test noise
vi.mock('../../../utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('CircuitBreaker API Integration', () => {
  let breaker;
  let timeController;
  
  // Sample API functions to test with
  let successfulRequest;
  let failingRequest;
  let intermittentRequest;
  
  // Default test configuration
  const defaultOptions = {
    failureThreshold: 2,
    resetTimeout: 500, // Short timeouts for testing
    successThreshold: 1,
    name: 'TestAPIBreaker'
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up time controller to manage time in tests
    timeController = createTimeController().setup();
    
    // Create a new circuit breaker for each test
    breaker = new CircuitBreaker(defaultOptions);
    
    // Set up test API functions
    successfulRequest = vi.fn().mockResolvedValue({ data: 'success' });
    failingRequest = vi.fn().mockRejectedValue(new Error('API Error'));
    
    // Set up intermittent failure function
    let intermittentCounter = 0;
    intermittentRequest = vi.fn().mockImplementation(() => {
      if (intermittentCounter++ % 2 === 0) {
        return Promise.reject(new Error('Intermittent Error'));
      } else {
        return Promise.resolve({ data: 'success after failure' });
      }
    });
  });
  
  afterEach(() => {
    timeController.restore();
  });
  
  /**
   * Helper function to execute a function with circuit breaker protection
   */
  async function executeWithBreaker(fn) {
    if (breaker.isOpen()) {
      throw new Error('Circuit breaker is open');
    }
    
    try {
      const result = await fn();
      breaker.recordSuccess();
      return result;
    } catch (error) {
      breaker.recordFailure();
      throw error;
    }
  }
  
  /**
   * Tests for successful requests
   */
  describe('Successful Requests', () => {
    it('should allow requests when circuit is closed', async () => {
      const result = await executeWithBreaker(successfulRequest);
      
      expect(result).toEqual({ data: 'success' });
      expect(successfulRequest).toHaveBeenCalledTimes(1);
      expect(breaker.getState()).toBe('CLOSED');
    });
    
    it('should record success', async () => {
      const recordSuccessSpy = vi.spyOn(breaker, 'recordSuccess');
      
      await executeWithBreaker(successfulRequest);
      
      expect(recordSuccessSpy).toHaveBeenCalledTimes(1);
    });
    
    it('should maintain CLOSED state with successful requests', async () => {
      // Execute multiple successful requests
      await executeWithBreaker(successfulRequest);
      await executeWithBreaker(successfulRequest);
      await executeWithBreaker(successfulRequest);
      
      // Circuit should remain closed
      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.isOpen()).toBe(false);
    });
  });
  
  /**
   * Tests for failing requests
   */
  describe('Failing Requests', () => {
    it('should record failure on error', async () => {
      const recordFailureSpy = vi.spyOn(breaker, 'recordFailure');
      
      try {
        await executeWithBreaker(failingRequest);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail
        expect(error.message).toBe('API Error');
      }
      
      expect(recordFailureSpy).toHaveBeenCalledTimes(1);
    });
    
    it('should open circuit after failure threshold is reached', async () => {
      // First attempt - should fail but circuit stays closed
      try {
        await executeWithBreaker(failingRequest);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected
      }
      
      expect(breaker.getState()).toBe('CLOSED');
      
      // Second attempt - should fail and open the circuit
      try {
        await executeWithBreaker(failingRequest);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected
      }
      
      // Circuit should now be open
      expect(breaker.getState()).toBe('OPEN');
      expect(breaker.isOpen()).toBe(true);
    });
    
    it('should reject requests immediately when circuit is open', async () => {
      // Open the circuit
      breaker.forceState('OPEN');
      
      try {
        await executeWithBreaker(successfulRequest);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Should be rejected with circuit breaker message
        expect(error.message).toBe('Circuit breaker is open');
      }
      
      // The function should not have been called
      expect(successfulRequest).not.toHaveBeenCalled();
    });
  });
  
  /**
   * Tests for recovery patterns
   */
  describe('Recovery Patterns', () => {
    it('should transition to HALF_OPEN after timeout', async () => {
      // Open the circuit
      breaker.forceState('OPEN');
      
      // Advance time past resetTimeout
      timeController.advanceTime(defaultOptions.resetTimeout + 100);
      
      // Check if the circuit is open (this should trigger transition to HALF_OPEN)
      const isOpen = breaker.isOpen();
      
      // Should be in HALF_OPEN state and not blocking requests
      expect(isOpen).toBe(false);
      expect(breaker.getState()).toBe('HALF_OPEN');
    });
    
    it('should close circuit after successful request in HALF_OPEN state', async () => {
      // Set to HALF_OPEN state
      breaker.forceState('HALF_OPEN');
      
      // Execute successful request
      await executeWithBreaker(successfulRequest);
      
      // Circuit should now be closed
      expect(breaker.getState()).toBe('CLOSED');
    });
    
    it('should reopen circuit after failed request in HALF_OPEN state', async () => {
      // Set to HALF_OPEN state
      breaker.forceState('HALF_OPEN');
      
      // Execute failing request
      try {
        await executeWithBreaker(failingRequest);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected
      }
      
      // Circuit should be open again
      expect(breaker.getState()).toBe('OPEN');
    });
    
    it('should reset success count after any failure in HALF_OPEN state', async () => {
      // Require multiple successes to close
      const customBreaker = new CircuitBreaker({
        ...defaultOptions,
        successThreshold: 2
      });
      
      // Set to HALF_OPEN state
      customBreaker.forceState('HALF_OPEN');
      
      // Record one success
      customBreaker.recordSuccess();
      
      // Get stats to verify success count
      let stats = customBreaker.getStats();
      expect(stats.successCount).toBe(1);
      
      // Record a failure
      customBreaker.recordFailure();
      
      // Should be open again
      expect(customBreaker.getState()).toBe('OPEN');
      
      // Advance time to HALF_OPEN again
      timeController.advanceTime(defaultOptions.resetTimeout + 100);
      customBreaker.isOpen(); // Trigger transition check
      
      // Get stats again - success count should be reset
      stats = customBreaker.getStats();
      expect(stats.successCount).toBe(0);
    });
  });
  
  /**
   * Tests for real-world behavior with intermittent failures
   */
  describe('Intermittent Failures', () => {
    it('should handle intermittent failures correctly', async () => {
      // First call will fail
      try {
        await executeWithBreaker(intermittentRequest);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail
        expect(error.message).toBe('Intermittent Error');
      }
      
      // Circuit should still be closed
      expect(breaker.getState()).toBe('CLOSED');
      
      // Second call will succeed
      const result = await executeWithBreaker(intermittentRequest);
      expect(result).toEqual({ data: 'success after failure' });
      
      // Circuit should still be closed and failure count should be reset
      expect(breaker.getState()).toBe('CLOSED');
      
      // Stats should show 0 failures
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(0);
    });
    
    it('should open circuit with consecutive intermittent failures', async () => {
      // Override to make consecutive failures
      intermittentRequest = vi.fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce({ data: 'too late, circuit open' });
      
      // First failure
      try {
        await executeWithBreaker(intermittentRequest);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected
      }
      
      // Circuit should still be closed
      expect(breaker.getState()).toBe('CLOSED');
      
      // Second failure - should open circuit
      try {
        await executeWithBreaker(intermittentRequest);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected
      }
      
      // Circuit should now be open
      expect(breaker.getState()).toBe('OPEN');
      
      // Third call would succeed, but circuit is open
      try {
        await executeWithBreaker(intermittentRequest);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Should be rejected with circuit breaker message
        expect(error.message).toBe('Circuit breaker is open');
      }
      
      // Third function call should not have happened
      expect(intermittentRequest).toHaveBeenCalledTimes(2);
    });
  });
});