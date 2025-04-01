/**
 * @file apiClient.circuit-recovery.vitest.js
 * @description Advanced tests for the integration between API Client and Circuit Breaker
 * 
 * This file contains tests specifically focused on the circuit breaker recovery patterns
 * within the RobustAPIClient, including half-open state transitions, success thresholds,
 * and recovery after failures.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { createTimeController } from '../../test-helpers/time-controller.js';

// Import the actual modules (not mocked for this integration test)
import { RobustAPIClient } from '../../../utils/apiClient.js';
import { CircuitBreaker } from '../../../utils/circuitBreaker.js';

// Spy on certain methods without mocking them
const originalForceState = CircuitBreaker.prototype.forceState;
const originalGetState = CircuitBreaker.prototype.getState;
const originalIsOpen = CircuitBreaker.prototype.isOpen;
const originalRecordSuccess = CircuitBreaker.prototype.recordSuccess;
const originalRecordFailure = CircuitBreaker.prototype.recordFailure;

beforeEach(() => {
  // Spy on the methods
  vi.spyOn(CircuitBreaker.prototype, 'forceState').mockImplementation(function(state, reason) {
    return originalForceState.call(this, state, reason);
  });
  
  vi.spyOn(CircuitBreaker.prototype, 'getState').mockImplementation(function() {
    return originalGetState.call(this);
  });
  
  vi.spyOn(CircuitBreaker.prototype, 'isOpen').mockImplementation(function() {
    return originalIsOpen.call(this);
  });
  
  vi.spyOn(CircuitBreaker.prototype, 'recordSuccess').mockImplementation(function() {
    return originalRecordSuccess.call(this);
  });
  
  vi.spyOn(CircuitBreaker.prototype, 'recordFailure').mockImplementation(function() {
    return originalRecordFailure.call(this);
  });
});

// Mock logger to avoid console noise during tests
vi.mock('../../../utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('API Client Circuit Breaker Recovery', () => {
  let apiClient;
  let mockAxios;
  let timeController;
  
  // Helper function to create a new API client with a circuit breaker
  const createClient = (options = {}) => {
    return new RobustAPIClient({
      baseURL: 'https://api.example.com',
      timeout: 500,
      maxRetries: 1, // Use lower retry count for faster tests
      retryDelay: 100,
      circuitBreakerThreshold: 3,
      circuitBreakerResetTimeout: 1000, // 1 second for faster tests
      name: 'CircuitRecoveryTestAPI',
      ...options
    });
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a mock adapter for axios
    mockAxios = new MockAdapter(axios);
    
    // Set up time controller to manage time in tests
    timeController = createTimeController();
    timeController.setup();
    
    // Create client instance
    apiClient = createClient();
    
    // Fix random for deterministic jitter calculation
    vi.spyOn(Math, 'random').mockImplementation(() => 0.5);
  });
  
  afterEach(() => {
    mockAxios.reset();
    timeController.teardown();
  });
  
  /**
   * Tests for circuit recovery from open to half-open state
   */
  describe('Open to Half-Open Transition', () => {
    it('should transition from open to half-open after timeout', async () => {
      // First force the circuit to open state
      apiClient.circuitBreaker.forceState('OPEN');
      
      // Verify initial state
      expect(apiClient.circuitBreaker.getState()).toBe('OPEN');
      
      // Attempt to make a request - should be blocked
      try {
        await apiClient.get('/test');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('Circuit breaker open');
      }
      
      // Advance time past reset timeout
      timeController.advanceTimersByTime(apiClient.options.circuitBreakerResetTimeout + 100);
      
      // Mock a successful response for when circuit transitions to half-open
      mockAxios.onGet('https://api.example.com/test').reply(200, { data: 'success' });
      
      // Make another request - should now be allowed through as circuit should go half-open
      const response = await apiClient.get('/test');
      
      // Verify response
      expect(response).toEqual({ data: 'success' });
      
      // Verify circuit breaker transitioned to half-open and recorded success
      expect(apiClient.circuitBreaker.getState()).toBe('HALF_OPEN');
      expect(apiClient.circuitBreaker.recordSuccess).toHaveBeenCalled();
    });
    
    it('should remain blocked while in open state before timeout', async () => {
      // Force the circuit to open state
      apiClient.circuitBreaker.forceState('OPEN');
      
      // Advance time, but not enough to trigger timeout
      timeController.advanceTimersByTime(apiClient.options.circuitBreakerResetTimeout / 2);
      
      // Attempt to make a request - should still be blocked
      try {
        await apiClient.get('/test');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('Circuit breaker open');
      }
      
      // Verify circuit remained open
      expect(apiClient.circuitBreaker.getState()).toBe('OPEN');
    });
  });
  
  /**
   * Tests for successful recovery from half-open to closed state
   */
  describe('Half-Open to Closed Recovery', () => {
    it('should transition from half-open to closed after success threshold', async () => {
      // Setup a circuit breaker with success threshold of 2
      apiClient = createClient({
        circuitBreakerThreshold: 3,
        successThreshold: 2
      });
      
      // Force circuit to half-open state
      apiClient.circuitBreaker.forceState('HALF_OPEN');
      
      // Mock successful responses
      mockAxios.onGet('https://api.example.com/test').reply(200, { data: 'success' });
      
      // Make first successful request
      await apiClient.get('/test');
      
      // Verify still in half-open state
      expect(apiClient.circuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Make second successful request
      await apiClient.get('/test');
      
      // Verify circuit transitioned to closed
      expect(apiClient.circuitBreaker.getState()).toBe('CLOSED');
    });
    
    it('should reset success counter if a failure occurs during half-open', async () => {
      // Setup client with success threshold of 2
      apiClient = createClient({
        circuitBreakerThreshold: 3,
        successThreshold: 2
      });
      
      // Force circuit to half-open state
      apiClient.circuitBreaker.forceState('HALF_OPEN');
      
      // Mock first request successful, second request fails
      let requestCount = 0;
      mockAxios.onGet('https://api.example.com/test').reply(() => {
        requestCount++;
        if (requestCount === 1) {
          return [200, { data: 'success' }];
        } else {
          return [503, { error: 'Service unavailable' }];
        }
      });
      
      // Make first successful request
      await apiClient.get('/test');
      
      // Verify still in half-open state
      expect(apiClient.circuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Make second request that fails
      try {
        await apiClient.get('/test');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('HTTP error 503');
      }
      
      // Verify circuit went back to open
      expect(apiClient.circuitBreaker.getState()).toBe('OPEN');
      
      // Advance time to allow circuit to go half-open again
      timeController.advanceTimersByTime(apiClient.options.circuitBreakerResetTimeout + 100);
      
      // Mock successful responses for remaining tests
      mockAxios.resetHistory();
      mockAxios.onGet('https://api.example.com/test').reply(200, { data: 'success' });
      
      // Make another request - circuit should go half-open again
      await apiClient.get('/test');
      
      // Verify circuit is half-open
      expect(apiClient.circuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Make another successful request
      await apiClient.get('/test');
      
      // Verify circuit is now closed (reached success threshold)
      expect(apiClient.circuitBreaker.getState()).toBe('CLOSED');
    });
  });
  
  /**
   * Tests for complex recovery scenarios
   */
  describe('Complex Recovery Patterns', () => {
    it('should handle intermittent failures during recovery', async () => {
      // Setup with higher thresholds for more complex testing
      apiClient = createClient({
        circuitBreakerThreshold: 2,
        successThreshold: 3,
        maxRetries: 1
      });
      
      // Force circuit to open state
      apiClient.circuitBreaker.forceState('OPEN');
      
      // Advance time to allow half-open transition
      timeController.advanceTimersByTime(apiClient.options.circuitBreakerResetTimeout + 100);
      
      // Pattern of responses: success, error, success, success, success
      const responses = [
        [200, { data: 'success-1' }],
        [500, { error: 'Internal server error' }],
        [200, { data: 'success-2' }],
        [200, { data: 'success-3' }],
        [200, { data: 'success-4' }]
      ];
      
      let requestCount = 0;
      mockAxios.onGet('https://api.example.com/recovery').reply(() => {
        return responses[requestCount++] || [200, { data: 'default' }];
      });
      
      // First request - should succeed
      await apiClient.get('/recovery');
      expect(apiClient.circuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Second request - should fail
      try {
        await apiClient.get('/recovery');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('HTTP error 500');
      }
      
      // Circuit should go back to open
      expect(apiClient.circuitBreaker.getState()).toBe('OPEN');
      
      // Advance time again to trigger half-open state
      timeController.advanceTimersByTime(apiClient.options.circuitBreakerResetTimeout + 100);
      
      // Next three requests should all succeed
      await apiClient.get('/recovery');
      expect(apiClient.circuitBreaker.getState()).toBe('HALF_OPEN');
      
      await apiClient.get('/recovery');
      expect(apiClient.circuitBreaker.getState()).toBe('HALF_OPEN');
      
      await apiClient.get('/recovery');
      
      // Circuit should now be closed after 3 consecutive successes
      expect(apiClient.circuitBreaker.getState()).toBe('CLOSED');
    });
    
    it('should maintain circuit state across multiple API clients that share the same circuit breaker', async () => {
      // This test simulates multiple API clients sharing the same underlying circuit breaker
      
      // Create a shared circuit breaker
      const sharedCircuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000,
        name: 'SharedCircuit'
      });
      
      // Create two clients that will use this circuit breaker
      const clientA = new RobustAPIClient({
        baseURL: 'https://api-a.example.com',
        circuitBreaker: sharedCircuitBreaker,
        name: 'ClientA'
      });
      
      const clientB = new RobustAPIClient({
        baseURL: 'https://api-b.example.com',
        circuitBreaker: sharedCircuitBreaker,
        name: 'ClientB'
      });
      
      // Mock responses for both clients
      mockAxios.onGet('https://api-a.example.com/test').reply(500, { error: 'Server error' });
      mockAxios.onGet('https://api-b.example.com/test').reply(200, { data: 'success' });
      
      // Make failing requests with clientA to open the circuit
      try {
        await clientA.get('/test');
        // Should retry once then fail
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('HTTP error 500');
      }
      
      try {
        await clientA.get('/test');
        // Should fail again
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('HTTP error 500');
      }
      
      // CircuitBreaker should now be open
      expect(sharedCircuitBreaker.getState()).toBe('OPEN');
      
      // Try to use clientB - should be blocked by the same circuit breaker
      try {
        await clientB.get('/test');
        // Should be blocked
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('Circuit breaker open');
      }
      
      // Advance time to allow circuit to go half-open
      timeController.advanceTimersByTime(1100);
      
      // Now clientB should be able to make a request
      const response = await clientB.get('/test');
      expect(response).toEqual({ data: 'success' });
      
      // Circuit should be in half-open state
      expect(sharedCircuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Make another successful request with clientB
      await clientB.get('/test');
      
      // Circuit should be closed now (with default success threshold of 2)
      expect(sharedCircuitBreaker.getState()).toBe('CLOSED');
    });
  });
  
  /**
   * Tests for concurrent request behavior during state transitions
   */
  describe('Concurrent Requests During Recovery', () => {
    it('should handle concurrent requests during half-open state', async () => {
      // Force circuit to half-open state
      apiClient.circuitBreaker.forceState('HALF_OPEN');
      
      // Mock successful responses
      mockAxios.onGet('https://api.example.com/concurrent').reply(200, { data: 'success' });
      
      // Make 3 concurrent requests during half-open state
      const promises = [
        apiClient.get('/concurrent'),
        apiClient.get('/concurrent'),
        apiClient.get('/concurrent')
      ];
      
      // Wait for all requests to complete
      const results = await Promise.all(promises);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result).toEqual({ data: 'success' });
      });
      
      // Circuit should be closed after 2 successful requests (default success threshold)
      expect(apiClient.circuitBreaker.getState()).toBe('CLOSED');
      
      // recordSuccess should have been called 3 times
      expect(apiClient.circuitBreaker.recordSuccess).toHaveBeenCalledTimes(3);
    });
  });
});