/**
 * @file apiClient.circuit-recovery-simplified.vitest.js
 * @description Simplified tests for the circuit breaker recovery patterns in RobustAPIClient
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Import modules after mocks
import { RobustAPIClient } from '../../../utils/apiClient.js';
import { CircuitBreaker } from '../../../utils/circuitBreaker.js';
import logger from '../../../utils/logger.js';

describe('API Client with Circuit Breaker Recovery', () => {
  let apiClient;
  let circuitBreaker;
  let mockAxios;
  
  // Create a separate instance of CircuitBreaker to control states
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a real circuit breaker
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 1000, // 1 second for faster tests
      successThreshold: 2,
      name: 'TestBreaker'
    });
    
    // Create a mock adapter for axios
    mockAxios = new MockAdapter(axios);
    
    // Create a client that uses the circuit breaker
    apiClient = new RobustAPIClient({
      baseURL: 'https://api.example.com',
      timeout: 500,
      maxRetries: 1,
      retryDelay: 10,
      name: 'RecoveryTestAPI'
    });
    
    // Replace the client's circuit breaker with our controlled one
    apiClient.circuitBreaker = circuitBreaker;
    
    // Add spies to circuit breaker methods
    vi.spyOn(circuitBreaker, 'isOpen');
    vi.spyOn(circuitBreaker, 'recordSuccess');
    vi.spyOn(circuitBreaker, 'recordFailure');
    vi.spyOn(circuitBreaker, 'getState');
    
    // Mock delay method on the API client for faster tests
    vi.spyOn(apiClient, 'delay').mockImplementation(() => Promise.resolve());
    
    // Fix Math.random for deterministic jitter
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  
  afterEach(() => {
    mockAxios.reset();
  });

  describe('Circuit Breaker State Transitions', () => {
    // Since we're not controlling the exact implementation, we'll test a simpler scenario
    it('should eventually transition to open state after failures', async () => {
      // Reset the circuit breaker to a fresh state with a small threshold
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2, // Only 2 failures needed to trip
        resetTimeout: 1000,
        successThreshold: 2,
        name: 'TestBreaker'
      });
      
      // Replace the client's circuit breaker with our controlled one
      apiClient.circuitBreaker = circuitBreaker;
      
      // Add a spy to track state transitions
      vi.spyOn(circuitBreaker, 'transitionTo');
      
      // Configure mock to always fail with 500
      mockAxios.onGet('https://api.example.com/server-error').reply(500, { error: 'Server Error' });
      
      // Initial state should be closed
      expect(circuitBreaker.getState()).toBe('CLOSED');
      
      // Make multiple failing requests until circuit opens
      let attempts = 0;
      let maxAttempts = 5; // Safety limit
      
      while (circuitBreaker.getState() !== 'OPEN' && attempts < maxAttempts) {
        attempts++;
        try {
          await apiClient.get('/server-error');
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error.message).toContain('HTTP error 500');
        }
      }
      
      // Verify the circuit breaker eventually opened
      expect(circuitBreaker.getState()).toBe('OPEN');
      expect(attempts).toBeLessThanOrEqual(maxAttempts);
      
      // Next request should be blocked by circuit breaker
      try {
        await apiClient.get('/server-error');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Circuit breaker open');
      }
    });
    
    it('should remain in open state and block requests', async () => {
      // Force circuit to open state
      circuitBreaker.forceState('OPEN');
      
      // Configure a successful response
      mockAxios.onGet('https://api.example.com/success').reply(200, { data: 'Success' });
      
      // Request should be blocked
      try {
        await apiClient.get('/success');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Circuit breaker open');
      }
      
      // Circuit should still be open
      expect(circuitBreaker.getState()).toBe('OPEN');
    });
    
    it('should transition from open to half-open after timeout', async () => {
      // Force circuit to open state
      circuitBreaker.forceState('OPEN');
      
      // Set nextAttempt to now so isOpen check will transition to half-open
      circuitBreaker.nextAttempt = Date.now() - 100;
      
      // Configure a successful response
      mockAxios.onGet('https://api.example.com/success').reply(200, { data: 'Success' });
      
      // Request should now be allowed through and succeed
      const result = await apiClient.get('/success');
      expect(result).toEqual({ data: 'Success' });
      
      // Circuit should be in half-open state
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
    });
    
    it('should transition from half-open to closed after success threshold', async () => {
      // Force circuit to half-open state
      circuitBreaker.forceState('HALF_OPEN');
      
      // Configure successful responses
      mockAxios.onGet('https://api.example.com/success').reply(200, { data: 'Success' });
      
      // First successful request
      await apiClient.get('/success');
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Second successful request should close the circuit
      await apiClient.get('/success');
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
    
    it('should transition back to open if failure occurs in half-open state', async () => {
      // Force circuit to half-open state
      circuitBreaker.forceState('HALF_OPEN');
      
      // Configure a failing response
      mockAxios.onGet('https://api.example.com/error').reply(500, { error: 'Server Error' });
      
      // Request should fail and circuit should go back to open
      try {
        await apiClient.get('/error');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('HTTP error 500');
      }
      
      // Circuit should be back to open
      expect(circuitBreaker.getState()).toBe('OPEN');
    });
  });
});