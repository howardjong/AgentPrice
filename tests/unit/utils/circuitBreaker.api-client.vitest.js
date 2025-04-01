/**
 * @file circuitBreaker.api-client.vitest.js
 * @description Tests for CircuitBreaker integration with API clients
 * 
 * This file focuses on how CircuitBreaker works with HTTP clients, simulating
 * various API response scenarios and error conditions.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker } from '../../../utils/circuitBreaker.js';
import { createTimeController } from '../../utils/time-testing-utils.js';
import axios from 'axios';

// Mock logger to reduce test noise
vi.mock('../../../utils/logger.js', () => {
  return {
    default: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  };
});

// Mock axios
vi.mock('axios');

describe('CircuitBreaker with API Clients', () => {
  let breaker;
  let timeController;
  
  // Default breaker options for these tests
  const defaultOptions = {
    failureThreshold: 2,
    resetTimeout: 1000,
    successThreshold: 2,
    name: 'TestAPIBreaker'
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up time controller
    timeController = createTimeController().setup();
    
    // Create fresh circuit breaker
    breaker = new CircuitBreaker(defaultOptions);
    
    // Reset axios mock
    axios.mockReset();
  });
  
  afterEach(() => {
    timeController.restore();
  });
  
  /**
   * Helper function to execute an API request with circuit breaker protection
   */
  async function executeRequest(url) {
    if (breaker.isOpen()) {
      throw new Error('Circuit breaker is open');
    }
    
    try {
      const response = await axios.get(url);
      breaker.recordSuccess();
      return response;
    } catch (error) {
      breaker.recordFailure();
      throw error;
    }
  }
  
  describe('Successful API Requests', () => {
    it('should handle successful requests', async () => {
      // Mock successful axios response
      axios.get.mockResolvedValue({ 
        data: { success: true },
        status: 200
      });
      
      // Execute a request
      const response = await executeRequest('https://api.example.com/data');
      
      // Should have gotten the successful response
      expect(response.data.success).toBe(true);
      expect(response.status).toBe(200);
      
      // Circuit should remain closed
      expect(breaker.getState()).toBe('CLOSED');
    });
    
    it('should handle multiple successful requests', async () => {
      // Mock multiple successful responses
      axios.get.mockResolvedValue({ 
        data: { success: true },
        status: 200
      });
      
      // Execute multiple requests
      await executeRequest('https://api.example.com/data');
      await executeRequest('https://api.example.com/data');
      await executeRequest('https://api.example.com/data');
      
      // Axios should have been called multiple times
      expect(axios.get).toHaveBeenCalledTimes(3);
      
      // Circuit should remain closed
      expect(breaker.getState()).toBe('CLOSED');
    });
    
    it('should handle non-200 but successful responses', async () => {
      // Mock 201 Created response
      axios.get.mockResolvedValue({ 
        data: { created: true },
        status: 201
      });
      
      // Execute a request
      const response = await executeRequest('https://api.example.com/create');
      
      // Should have gotten the successful response
      expect(response.data.created).toBe(true);
      expect(response.status).toBe(201);
      
      // Circuit should remain closed
      expect(breaker.getState()).toBe('CLOSED');
    });
  });
  
  describe('API Failures', () => {
    it('should handle server errors (5xx)', async () => {
      // Mock 500 Server Error
      axios.get.mockRejectedValue({ 
        response: {
          status: 500,
          data: { error: 'Internal Server Error' }
        }
      });
      
      // Execute a request - should fail
      try {
        await executeRequest('https://api.example.com/data');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail
      }
      
      // Circuit should still be closed after one failure
      expect(breaker.getState()).toBe('CLOSED');
      
      // Second failure should open the circuit
      try {
        await executeRequest('https://api.example.com/data');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail
      }
      
      // Circuit should now be open
      expect(breaker.getState()).toBe('OPEN');
    });
    
    it('should handle network errors', async () => {
      // Mock network error
      axios.get.mockRejectedValue(new Error('Network Error'));
      
      // Execute a request - should fail
      try {
        await executeRequest('https://api.example.com/data');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail
      }
      
      // Circuit should still be closed after one failure
      expect(breaker.getState()).toBe('CLOSED');
      
      // Second failure should open the circuit
      try {
        await executeRequest('https://api.example.com/data');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail
      }
      
      // Circuit should now be open
      expect(breaker.getState()).toBe('OPEN');
    });
    
    it('should handle timeout errors', async () => {
      // Mock timeout error
      axios.get.mockRejectedValue(new Error('timeout of 3000ms exceeded'));
      
      // Execute a request - should fail
      try {
        await executeRequest('https://api.example.com/data');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail
      }
      
      // Circuit should still be closed after one failure
      expect(breaker.getState()).toBe('CLOSED');
      
      // Second failure should open the circuit
      try {
        await executeRequest('https://api.example.com/data');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail
      }
      
      // Circuit should now be open
      expect(breaker.getState()).toBe('OPEN');
    });
    
    it('should block requests when circuit is open', async () => {
      // Open the circuit
      breaker.forceState('OPEN');
      
      // Try to execute a request
      try {
        await executeRequest('https://api.example.com/data');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail with circuit breaker error
        expect(error.message).toBe('Circuit breaker is open');
      }
      
      // Axios should not have been called
      expect(axios.get).not.toHaveBeenCalled();
    });
  });
  
  describe('Client Error Handling', () => {
    it('should not open circuit for 4xx errors', async () => {
      // Use a special version that treats 4xx as client errors
      function executeWithClientErrorHandling(url) {
        if (breaker.isOpen()) {
          throw new Error('Circuit breaker is open');
        }
        
        return axios.get(url)
          .then(response => {
            breaker.recordSuccess();
            return response;
          })
          .catch(error => {
            // Only circuit break on server errors or network issues
            // Don't circuit break on client errors (4xx)
            if (!error.response || error.response.status >= 500) {
              breaker.recordFailure();
            }
            throw error;
          });
      }
      
      // Mock 404 Not Found
      axios.get.mockRejectedValue({ 
        response: {
          status: 404,
          data: { error: 'Not Found' }
        }
      });
      
      // Execute multiple 404 requests
      try {
        await executeWithClientErrorHandling('https://api.example.com/not-found');
      } catch (error) {
        // Expected to fail
      }
      
      try {
        await executeWithClientErrorHandling('https://api.example.com/not-found');
      } catch (error) {
        // Expected to fail
      }
      
      // Circuit should still be closed despite multiple 4xx failures
      expect(breaker.getState()).toBe('CLOSED');
      
      // Now try with a server error (500)
      axios.get.mockRejectedValue({ 
        response: {
          status: 500,
          data: { error: 'Server Error' }
        }
      });
      
      // Execute enough server error requests to open circuit
      try {
        await executeWithClientErrorHandling('https://api.example.com/server-error');
      } catch (error) {
        // Expected to fail
      }
      
      try {
        await executeWithClientErrorHandling('https://api.example.com/server-error');
      } catch (error) {
        // Expected to fail
      }
      
      // Circuit should now be open
      expect(breaker.getState()).toBe('OPEN');
    });
  });
  
  describe('API Recovery', () => {
    it('should recover after API becomes available again', async () => {
      // First mock failures to open the circuit
      axios.get.mockRejectedValue(new Error('Service Unavailable'));
      
      // Cause enough failures to open circuit
      try {
        await executeRequest('https://api.example.com/data');
      } catch (error) {
        // Expected
      }
      
      try {
        await executeRequest('https://api.example.com/data');
      } catch (error) {
        // Expected
      }
      
      // Circuit should be open
      expect(breaker.getState()).toBe('OPEN');
      
      // Advance time past reset timeout
      timeController.advanceTime(defaultOptions.resetTimeout + 1);
      
      // Next check should transition to HALF_OPEN
      expect(breaker.isOpen()).toBe(false);
      expect(breaker.getState()).toBe('HALF_OPEN');
      
      // Now mock successful responses
      axios.get.mockResolvedValue({ 
        data: { success: true },
        status: 200
      });
      
      // Execute successful requests to close circuit
      await executeRequest('https://api.example.com/data');
      await executeRequest('https://api.example.com/data');
      
      // Circuit should be closed
      expect(breaker.getState()).toBe('CLOSED');
      
      // Additional requests should work
      const response = await executeRequest('https://api.example.com/data');
      expect(response.data.success).toBe(true);
    });
    
    it('should reopen circuit on failure during recovery', async () => {
      // First mock failures to open the circuit
      axios.get.mockRejectedValue(new Error('Service Unavailable'));
      
      // Cause enough failures to open circuit
      try {
        await executeRequest('https://api.example.com/data');
      } catch (error) {
        // Expected
      }
      
      try {
        await executeRequest('https://api.example.com/data');
      } catch (error) {
        // Expected
      }
      
      // Circuit should be open
      expect(breaker.getState()).toBe('OPEN');
      
      // Advance time past reset timeout
      timeController.advanceTime(defaultOptions.resetTimeout + 1);
      
      // Next check should transition to HALF_OPEN
      expect(breaker.isOpen()).toBe(false);
      expect(breaker.getState()).toBe('HALF_OPEN');
      
      // Mock a failure for the test request
      axios.get.mockRejectedValue(new Error('Still Unavailable'));
      
      // Execute a request - should fail
      try {
        await executeRequest('https://api.example.com/data');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail
      }
      
      // Circuit should be open again
      expect(breaker.getState()).toBe('OPEN');
    });
  });
  
  describe('Mixed Success/Failure Patterns', () => {
    it('should handle intermittent failures without opening circuit', async () => {
      // Mock alternating success/failure
      axios.get
        .mockRejectedValueOnce(new Error('Temporary Error'))
        .mockResolvedValueOnce({ data: { success: true }, status: 200 })
        .mockRejectedValueOnce(new Error('Another Temporary Error'))
        .mockResolvedValueOnce({ data: { success: true }, status: 200 });
      
      // First request - expect failure
      try {
        await executeRequest('https://api.example.com/data');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected
      }
      
      // Circuit should still be closed after one failure
      expect(breaker.getState()).toBe('CLOSED');
      
      // Second request - should succeed
      const response1 = await executeRequest('https://api.example.com/data');
      expect(response1.data.success).toBe(true);
      
      // Failure count should be reset
      expect(breaker.getStats().failureCount).toBe(0);
      
      // Third request - expect failure
      try {
        await executeRequest('https://api.example.com/data');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected
      }
      
      // Still should not have opened circuit
      expect(breaker.getState()).toBe('CLOSED');
      
      // Fourth request - should succeed
      const response2 = await executeRequest('https://api.example.com/data');
      expect(response2.data.success).toBe(true);
    });
    
    it('should open circuit with consecutive failures despite past successes', async () => {
      // Mock pattern: many successes then consecutive failures
      axios.get
        .mockResolvedValueOnce({ data: { success: true }, status: 200 })
        .mockResolvedValueOnce({ data: { success: true }, status: 200 })
        .mockResolvedValueOnce({ data: { success: true }, status: 200 })
        .mockRejectedValueOnce(new Error('Service Failed'))
        .mockRejectedValueOnce(new Error('Service Failed Again'));
      
      // Execute successful requests
      await executeRequest('https://api.example.com/data');
      await executeRequest('https://api.example.com/data');
      await executeRequest('https://api.example.com/data');
      
      // Circuit should be closed
      expect(breaker.getState()).toBe('CLOSED');
      
      // Now encounter failures
      try {
        await executeRequest('https://api.example.com/data');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected
      }
      
      // One failure shouldn't open circuit
      expect(breaker.getState()).toBe('CLOSED');
      
      // Second consecutive failure
      try {
        await executeRequest('https://api.example.com/data');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected
      }
      
      // Should now be open
      expect(breaker.getState()).toBe('OPEN');
    });
  });
});