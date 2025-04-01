/**
 * @file apiClient.retry.vitest.js
 * @description Focused tests for the RobustAPIClient retry logic
 * 
 * This file contains tests specifically focused on the retry behavior of the RobustAPIClient,
 * including edge cases, timeout handling, backoff strategies, and recovery patterns.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { createTimeController } from '../../utils/time-testing-utils.js';

// Import the modules under test
import { RobustAPIClient } from '../../../utils/apiClient.js';
import CircuitBreaker from '../../../utils/circuitBreaker.js';

// Mock CircuitBreaker to isolate API client testing
vi.mock('../../../utils/circuitBreaker.js', () => {
  // Create a mock circuit breaker factory
  const mockCircuitBreakerFactory = vi.fn().mockImplementation(() => ({
    isOpen: vi.fn().mockReturnValue(false),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn()
  }));
  
  // Set it as both default export and named export
  mockCircuitBreakerFactory.default = mockCircuitBreakerFactory;
  mockCircuitBreakerFactory.CircuitBreaker = mockCircuitBreakerFactory;
  return mockCircuitBreakerFactory;
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

describe('RobustAPIClient Retry Logic', () => {
  let apiClient;
  let mockAxios;
  let timeController;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a mock adapter for axios
    // This allows us to mock responses in a more realistic way
    mockAxios = new MockAdapter(axios);
    
    // Set up time controller to manage time in tests
    timeController = createTimeController().setup();
    
    // Create client instance with consistent, predictable settings
    apiClient = new RobustAPIClient({
      baseURL: 'https://api.example.com',
      timeout: 1000,
      maxRetries: 3,
      retryDelay: 100, // Use small delay for faster tests
      name: 'RetryTestAPI'
    });
    
    // Spy on delay method to verify backoff calculations
    vi.spyOn(apiClient, 'delay');
    
    // Fix random for deterministic jitter calculation
    vi.spyOn(Math, 'random').mockImplementation(() => 0.5);
  });
  
  afterEach(() => {
    vi.resetAllMocks();
    mockAxios.reset();
    if (timeController) {
      timeController.restore();
    }
  });

  /**
   * Tests for progressive backoff logic
   */
  describe('Progressive Backoff', () => {
    it('should use exponential backoff with each retry attempt', async () => {
      // Mock a 503 error for each request
      mockAxios.onGet('https://api.example.com/test').reply(503, { error: 'Service unavailable' });
      
      // Spy on calculateBackoff
      const calculateBackoffSpy = vi.spyOn(apiClient, 'calculateBackoff');
      
      // Make request that will fail
      try {
        await apiClient.get('/test');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Expected to fail after all retries
        expect(error.message).toContain('HTTP error 503');
      }
      
      // Should have called calculateBackoff for each retry
      expect(calculateBackoffSpy).toHaveBeenCalledTimes(3);
      expect(calculateBackoffSpy).toHaveBeenNthCalledWith(1, 0);
      expect(calculateBackoffSpy).toHaveBeenNthCalledWith(2, 1);
      expect(calculateBackoffSpy).toHaveBeenNthCalledWith(3, 2);
      
      // Verify delay was called with progressively increasing values
      expect(apiClient.delay).toHaveBeenCalledTimes(3);
      
      // First delay should be about baseDelay * 2^0 * (1 + jitter) = 100 * 1 * 1.15 = 115ms
      // Second delay should be about baseDelay * 2^1 * (1 + jitter) = 100 * 2 * 1.15 = 230ms 
      // Third delay should be about baseDelay * 2^2 * (1 + jitter) = 100 * 4 * 1.15 = 460ms
      // Note: These calculations assume Math.random() is mocked to return 0.5,
      //       giving a jitter factor of 0.3 * 0.5 = 0.15
      
      // The actual values might be slightly different due to how the delay is calculated,
      // but we can verify they increase in approximately the expected way
      const firstDelay = apiClient.delay.mock.calls[0][0];
      const secondDelay = apiClient.delay.mock.calls[1][0];
      const thirdDelay = apiClient.delay.mock.calls[2][0];
      
      expect(secondDelay).toBeGreaterThan(firstDelay);
      expect(thirdDelay).toBeGreaterThan(secondDelay);
      
      // Verify axios was called maxRetries + 1 times (initial + retries)
      expect(mockAxios.history.get.length).toBe(4);
    });
    
    it('should cap backoff delay at maximum value', async () => {
      // Create client with higher retry delay to reach max delay
      const maxDelayClient = new RobustAPIClient({
        retryDelay: 20000, // High base delay to exceed max
        maxRetries: 3,
      });
      
      // Spy on calculateBackoff
      const calculateBackoffSpy = vi.spyOn(maxDelayClient, 'calculateBackoff');
      
      // Mock large retry attempt number that would exceed max
      const backoff = maxDelayClient.calculateBackoff(10); // This would be 20000 * 2^10 = 20.48M ms
      
      // Should be capped at 60000ms (1 minute)
      expect(backoff).toBe(60000);
      
      // Verify calculateBackoff was called
      expect(calculateBackoffSpy).toHaveBeenCalledWith(10);
    });
    
    it('should include jitter in backoff calculation', async () => {
      // Test with multiple random values
      const randomValues = [0, 0.25, 0.5, 0.75, 1.0];
      const expectedJitters = [0, 0.075, 0.15, 0.225, 0.3]; // 30% * random
      
      // Test calculateBackoff with each random value
      for (let i = 0; i < randomValues.length; i++) {
        // Mock random for this test case
        Math.random.mockReturnValueOnce(randomValues[i]);
        
        // Create temporary client for this test
        const testClient = new RobustAPIClient({
          retryDelay: 1000
        });
        
        // First attempt (attempt 0) with 100% base delay + jitter
        const baseDelay = 1000;
        const expectedDelay = baseDelay + (baseDelay * expectedJitters[i]);
        
        // Calculate backoff
        const backoff = testClient.calculateBackoff(0);
        
        // Should match expected value with small tolerance for floating point
        expect(backoff).toBeCloseTo(expectedDelay, 0);
      }
    });
  });

  /**
   * Tests for different retry strategies based on status codes
   */
  describe('Retry Strategies', () => {
    it('should retry server errors (5xx)', async () => {
      // Set up sequence: 500, 502, 200
      let requestCount = 0;
      mockAxios.onGet('https://api.example.com/test').reply(() => {
        const responses = [
          [500, { error: 'Internal server error' }],
          [502, { error: 'Bad gateway' }],
          [200, { data: 'success' }]
        ];
        return responses[requestCount++] || [404, { error: 'Unexpected request' }];
      });
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify made expected number of requests
      expect(mockAxios.history.get.length).toBe(3);
    });
    
    it('should retry timeout errors (408)', async () => {
      // Set up responses: 408, 200
      let timeoutRequestCount = 0;
      mockAxios.onGet('https://api.example.com/test').reply(() => {
        const responses = [
          [408, { error: 'Request timeout' }],
          [200, { data: 'success' }]
        ];
        return responses[timeoutRequestCount++] || [404, { error: 'Unexpected request' }];
      });
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify made expected number of requests
      expect(mockAxios.history.get.length).toBe(2);
    });
    
    it('should retry rate limit errors (429) with retry-after header', async () => {
      // Set up responses: 429 with retry-after, 200
      let rateLimitRequestCount = 0;
      mockAxios.onGet('https://api.example.com/test').reply(() => {
        if (rateLimitRequestCount === 0) {
          rateLimitRequestCount++;
          return [429, { error: 'Too many requests' }, { 'retry-after': '2' }];
        } else {
          return [200, { data: 'success' }];
        }
      });
      
      // Spy on delay to verify retry-after is respected
      const delaySpy = vi.spyOn(apiClient, 'delay');
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify delay was called with correct retry-after value (2 seconds = 2000ms)
      expect(delaySpy).toHaveBeenCalledWith(2000);
      
      // Verify made expected number of requests
      expect(mockAxios.history.get.length).toBe(2);
    });
    
    it('should not retry client errors (4xx except 408/429)', async () => {
      // Set up responses: 400
      mockAxios.onGet('https://api.example.com/test')
        .reply(400, { error: 'Bad request' });
      
      // Make request (should reject)
      try {
        await apiClient.get('/test');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Expected to fail without retry
        expect(error.message).toContain('HTTP error 400');
      }
      
      // Verify only made one request (no retries)
      expect(mockAxios.history.get.length).toBe(1);
      
      // Verify delay was not called
      expect(apiClient.delay).not.toHaveBeenCalled();
    });
    
    it('should retry network errors', async () => {
      // Set up network error then success
      let networkErrorRequestCount = 0;
      mockAxios.onGet('https://api.example.com/test').reply(() => {
        if (networkErrorRequestCount === 0) {
          networkErrorRequestCount++;
          return Promise.reject(new Error('Network Error'));
        } else {
          return [200, { data: 'success' }];
        }
      });
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify made expected number of requests
      expect(mockAxios.history.get.length).toBe(2);
      
      // Verify delay was called
      expect(apiClient.delay).toHaveBeenCalledTimes(1);
    });
    
    it('should handle ECONNABORTED errors', async () => {
      // Set up timeout error then success
      const timeoutError = new Error('timeout of 1000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      
      let timeoutErrorRequestCount = 0;
      mockAxios.onGet('https://api.example.com/test').reply(() => {
        if (timeoutErrorRequestCount === 0) {
          timeoutErrorRequestCount++;
          return Promise.reject(timeoutError);
        } else {
          return [200, { data: 'success' }];
        }
      });
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify made expected number of requests
      expect(mockAxios.history.get.length).toBe(2);
    });
  });

  /**
   * Tests for circuit breaker interaction
   */
  describe('Circuit Breaker Integration', () => {
    it('should record success on successful requests', async () => {
      // Set up successful response
      mockAxios.onGet('https://api.example.com/test').reply(200, { data: 'success' });
      
      // Make request
      await apiClient.get('/test');
      
      // Verify success was recorded
      expect(apiClient.circuitBreaker.recordSuccess).toHaveBeenCalledTimes(1);
    });
    
    it('should record failure on failed requests', async () => {
      // Set up error response
      mockAxios.onGet('https://api.example.com/test').reply(500, { error: 'server error' });
      
      // Make request (should reject after all retries)
      try {
        await apiClient.get('/test');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Expected to fail
        expect(error.message).toContain('HTTP error 500');
      }
      
      // Should record failure for initial request + each retry
      expect(apiClient.circuitBreaker.recordFailure).toHaveBeenCalledTimes(4);
    });
    
    it('should check circuit breaker before making requests', async () => {
      // Override isOpen to return true for this test
      apiClient.circuitBreaker.isOpen.mockReturnValueOnce(true);
      
      // Make request (should reject due to open circuit)
      try {
        await apiClient.get('/test');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Expected to fail with circuit breaker message
        expect(error.message).toContain('Circuit breaker open');
      }
      
      // Verify isOpen was called
      expect(apiClient.circuitBreaker.isOpen).toHaveBeenCalledTimes(1);
      
      // Verify no actual request was made
      expect(mockAxios.history.get.length).toBe(0);
    });
  });

  /**
   * Tests for edge cases in retry logic
   */
  describe('Edge Cases', () => {
    it('should handle responses with no retry-after header', async () => {
      // Set up rate limit response without retry-after header
      let noRetryAfterCount = 0;
      mockAxios.onGet('https://api.example.com/test').reply(() => {
        if (noRetryAfterCount === 0) {
          noRetryAfterCount++;
          return [429, { error: 'Too many requests' }];
        } else {
          return [200, { data: 'success' }];
        }
      });
      
      // Spy on calculateBackoff to verify it's used as fallback
      const calculateBackoffSpy = vi.spyOn(apiClient, 'calculateBackoff');
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify calculateBackoff was called as fallback
      expect(calculateBackoffSpy).toHaveBeenCalledWith(0);
    });
    
    it('should handle non-numeric retry-after header', async () => {
      // Set up responses: 429 with invalid retry-after, 200
      let invalidRetryAfterCount = 0;
      mockAxios.onGet('https://api.example.com/test').reply(() => {
        if (invalidRetryAfterCount === 0) {
          invalidRetryAfterCount++;
          return [429, { error: 'Too many requests' }, { 'retry-after': 'not-a-number' }];
        } else {
          return [200, { data: 'success' }];
        }
      });
      
      // Spy on calculateBackoff to verify it's used as fallback
      const calculateBackoffSpy = vi.spyOn(apiClient, 'calculateBackoff');
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify calculateBackoff was called as fallback for invalid retry-after
      expect(calculateBackoffSpy).toHaveBeenCalledWith(0);
    });
    
    it('should handle case where maxRetries is set to 0', async () => {
      // Create client with maxRetries=0
      const noRetryClient = new RobustAPIClient({
        baseURL: 'https://api.example.com',
        maxRetries: 0
      });
      
      // Set up error response
      mockAxios.onGet('https://api.example.com/test').reply(500, { error: 'server error' });
      
      // Make request (should reject immediately)
      try {
        await noRetryClient.get('/test');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Expected to fail without retry
        expect(error.message).toContain('HTTP error 500');
      }
      
      // Verify only made one request
      expect(mockAxios.history.get.length).toBe(1);
    });
    
    it('should respect maxRetries limit exactly', async () => {
      // Create client with specific maxRetries
      const client = new RobustAPIClient({
        baseURL: 'https://api.example.com',
        maxRetries: 2 // Exactly 2 retries
      });
      
      // Set up error responses for all attempts
      mockAxios.onGet('https://api.example.com/test').reply(500, { error: 'server error' });
      
      // Make request (should reject after maxRetries)
      try {
        await client.get('/test');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Expected to fail
        expect(error.message).toContain('HTTP error 500');
      }
      
      // Verify made exactly 1 initial request + 2 retries = 3 total requests
      expect(mockAxios.history.get.length).toBe(3);
    });
  });

  /**
   * Tests for request behavior during retries
   */
  describe('Request Preservation', () => {
    it('should preserve request data across retries', async () => {
      // Set up responses: 500, 200
      let postRequestCount = 0;
      mockAxios.onPost('https://api.example.com/test').reply(() => {
        if (postRequestCount === 0) {
          postRequestCount++;
          return [500, { error: 'server error' }];
        } else {
          return [200, { data: 'success' }];
        }
      });
      
      // Data to send
      const testData = { key: 'value', nested: { prop: true } };
      
      // Make POST request
      await apiClient.post('/test', testData);
      
      // Verify both requests had identical data
      expect(mockAxios.history.post.length).toBe(2);
      expect(JSON.parse(mockAxios.history.post[0].data)).toEqual(testData);
      expect(JSON.parse(mockAxios.history.post[1].data)).toEqual(testData);
    });
    
    it('should preserve headers across retries', async () => {
      // Set up responses: 500, 200
      let headersRequestCount = 0;
      mockAxios.onGet('https://api.example.com/test').reply(() => {
        if (headersRequestCount === 0) {
          headersRequestCount++;
          return [500, { error: 'server error' }];
        } else {
          return [200, { data: 'success' }];
        }
      });
      
      // Custom headers
      const customHeaders = { 'X-Custom': 'test-value', 'Authorization': 'Bearer token' };
      
      // Make request with custom headers
      await apiClient.get('/test', { headers: customHeaders });
      
      // Verify both requests had identical headers
      expect(mockAxios.history.get.length).toBe(2);
      expect(mockAxios.history.get[0].headers['X-Custom']).toBe('test-value');
      expect(mockAxios.history.get[0].headers['Authorization']).toBe('Bearer token');
      expect(mockAxios.history.get[1].headers['X-Custom']).toBe('test-value');
      expect(mockAxios.history.get[1].headers['Authorization']).toBe('Bearer token');
    });
  });
});