/**
 * RobustAPIClient Error Handling Tests
 * 
 * These tests focus on the error handling capabilities of the RobustAPIClient,
 * which is used by Perplexity service for making resilient API calls.
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import axios from 'axios';
import CircuitBreaker from '../../../utils/circuitBreaker.js';
import { RobustAPIClient } from '../../../utils/apiClient.js';
import logger from '../../../utils/logger.js';

// Mock dependencies
vi.mock('axios');
vi.mock('../../../utils/circuitBreaker.js');
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('RobustAPIClient Error Handling', () => {
  let apiClient;
  let mockCircuitBreaker;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a mock circuit breaker
    mockCircuitBreaker = {
      isOpen: vi.fn().mockReturnValue(false),
      recordSuccess: vi.fn(),
      recordFailure: vi.fn()
    };
    
    // Mock the CircuitBreaker constructor
    CircuitBreaker.mockImplementation(() => mockCircuitBreaker);
    
    // Mock axios.create to return a mock axios instance
    axios.create = vi.fn().mockReturnValue(axios);
    
    // Create a new api client for each test
    apiClient = new RobustAPIClient({
      name: 'TestClient',
      baseURL: 'https://api.test.com',
      timeout: 1000,
      maxRetries: 3,
      retryDelay: 100, // Small for testing
      circuitBreakerThreshold: 2,
      circuitBreakerResetTimeout: 500
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('Circuit Breaker Integration', () => {
    it('should reject requests when circuit breaker is open', async () => {
      // Mock circuit breaker to be open
      mockCircuitBreaker.isOpen.mockReturnValue(true);
      
      // Attempt to make a request
      await expect(
        apiClient.request({ url: '/test', method: 'get' })
      ).rejects.toThrow('Circuit breaker open');
      
      // Axios should not have been called
      expect(axios).not.toHaveBeenCalled();
      
      // Logger should have been called with a warning
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker open'),
        expect.objectContaining({ component: 'apiClient' })
      );
    });
    
    it('should record success when request succeeds', async () => {
      // Mock a successful response
      axios.mockResolvedValue({
        status: 200,
        data: { success: true }
      });
      
      // Make a successful request
      const result = await apiClient.request({ url: '/test', method: 'get' });
      
      // Should return the data
      expect(result).toEqual({ success: true });
      
      // Should have recorded success
      expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalled();
      expect(mockCircuitBreaker.recordFailure).not.toHaveBeenCalled();
    });
    
    it('should record failure when request fails', async () => {
      // Mock a failed response
      axios.mockRejectedValue(new Error('Request failed'));
      
      // Attempt to make a request
      await expect(
        apiClient.request({ url: '/test', method: 'get' })
      ).rejects.toThrow('Request failed');
      
      // Should have recorded failure
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled();
      expect(mockCircuitBreaker.recordSuccess).not.toHaveBeenCalled();
    });
    
    it('should record failure for non-2xx status codes', async () => {
      // Mock a 400 error response
      axios.mockResolvedValue({
        status: 400,
        statusText: 'Bad Request',
        data: { error: 'Invalid parameter' }
      });
      
      // Attempt to make a request
      await expect(
        apiClient.request({ url: '/test', method: 'get' })
      ).rejects.toThrow('HTTP error 400');
      
      // Should have recorded failure
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled();
      expect(mockCircuitBreaker.recordSuccess).not.toHaveBeenCalled();
    });
  });
  
  describe('Retry Logic', () => {
    it('should retry transient errors', async () => {
      // First two calls fail, third succeeds
      axios.mockRejectedValueOnce(new Error('Network error 1'))
           .mockRejectedValueOnce(new Error('Network error 2'))
           .mockResolvedValueOnce({
             status: 200,
             data: { success: true }
           });
      
      // Replace setTimeout with a mock that executes immediately
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((callback) => {
        callback(); // Execute immediately
        return 123; // Fake timer ID
      });
      
      // Make a request
      const result = await apiClient.request({ url: '/test', method: 'get' });
      
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
      
      // Should return the successful result
      expect(result).toEqual({ success: true });
      
      // Should have called axios three times
      expect(axios).toHaveBeenCalledTimes(3);
      
      // Should have logged retries
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Request failed, retrying'),
        expect.objectContaining({ 
          component: 'apiClient',
          attempt: expect.any(Number)
        })
      );
    });
    
    it('should stop retrying after maxRetries', async () => {
      // All calls fail
      axios.mockRejectedValue(new Error('Persistent error'));
      
      // Mock setTimeout to execute immediately
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((callback) => {
        callback(); // Execute immediately
        return 123; // Fake timer ID
      });
      
      // Attempt to make a request
      await expect(
        apiClient.request({ url: '/test', method: 'get' })
      ).rejects.toThrow('Persistent error');
      
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
      
      // Should have called axios exactly maxRetries + 1 times (initial + retries)
      expect(axios).toHaveBeenCalledTimes(4); // Initial + 3 retries
      
      // Should have logged the final failure
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('All retries failed'),
        expect.objectContaining({ component: 'apiClient' })
      );
    });
    
    it('should use exponential backoff for retry delays', async () => {
      // All calls fail
      axios.mockRejectedValue(new Error('Retry error'));
      
      // Track actual delays
      const delays = [];
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((callback, delay) => {
        delays.push(delay);
        callback(); // Execute immediately
        return 123; // Fake timer ID
      });
      
      // Attempt to make a request
      await expect(
        apiClient.request({ url: '/test', method: 'get' })
      ).rejects.toThrow('Retry error');
      
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
      
      // Should have 3 delays (for 3 retries)
      expect(delays.length).toBe(3);
      
      // Each delay should be roughly double the previous one (with jitter)
      for (let i = 1; i < delays.length; i++) {
        // With jitter, it might not be exactly double, but should be significantly larger
        expect(delays[i]).toBeGreaterThan(delays[i-1] * 1.5);
      }
    });
  });
  
  describe('Rate Limiting Handling', () => {
    it('should handle 429 rate limiting specially', async () => {
      // Mock a 429 response, then success
      axios.mockResolvedValueOnce({
        status: 429,
        headers: { 'retry-after': '2' }, // 2 seconds
        statusText: 'Too Many Requests',
        data: { error: 'Rate limit exceeded' }
      }).mockResolvedValueOnce({
        status: 200,
        data: { success: true }
      });
      
      // Track retry delay
      let actualDelay = 0;
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((callback, delay) => {
        actualDelay = delay;
        callback(); // Execute immediately
        return 123; // Fake timer ID
      });
      
      // Make a request
      const result = await apiClient.request({ url: '/test', method: 'get' });
      
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
      
      // Should return the successful result
      expect(result).toEqual({ success: true });
      
      // Should have used the retry-after header value for the delay
      expect(actualDelay).toBe(2000); // 2 seconds in ms
      
      // Should have logged rate limit warning
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded'),
        expect.objectContaining({ 
          component: 'apiClient',
          attempt: expect.any(Number)
        })
      );
    });
    
    it('should use default backoff when retry-after header is missing', async () => {
      // Mock a 429 response without retry-after, then success
      axios.mockResolvedValueOnce({
        status: 429,
        headers: {}, // No retry-after header
        statusText: 'Too Many Requests',
        data: { error: 'Rate limit exceeded' }
      }).mockResolvedValueOnce({
        status: 200,
        data: { success: true }
      });
      
      // Track retry delay
      let actualDelay = 0;
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((callback, delay) => {
        actualDelay = delay;
        callback(); // Execute immediately
        return 123; // Fake timer ID
      });
      
      // Make a request
      const result = await apiClient.request({ url: '/test', method: 'get' });
      
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
      
      // Should return the successful result
      expect(result).toEqual({ success: true });
      
      // Should have used calculated backoff with jitter
      // Base delay is 100ms, first attempt would be 100 * 2^0 = 100ms plus jitter
      expect(actualDelay).toBeGreaterThanOrEqual(100);
      expect(actualDelay).toBeLessThanOrEqual(130); // 100 + 30% jitter
    });
  });
  
  describe('shouldRetry Logic', () => {
    it('should retry on network errors', async () => {
      const shouldRetry = apiClient.shouldRetry(new Error('Network error'));
      expect(shouldRetry).toBe(true);
    });
    
    it('should retry on specific HTTP status codes', async () => {
      // Create error objects with various status codes
      const errors = [
        { response: { status: 408 } }, // Request Timeout
        { response: { status: 429 } }, // Too Many Requests
        { response: { status: 500 } }, // Internal Server Error
        { response: { status: 502 } }, // Bad Gateway
        { response: { status: 503 } }, // Service Unavailable
        { response: { status: 504 } }  // Gateway Timeout
      ];
      
      // All should return true from shouldRetry
      for (const error of errors) {
        expect(apiClient.shouldRetry(error)).toBe(true);
      }
    });
    
    it('should not retry on client errors (4xx) except specific ones', async () => {
      // These 4xx errors shouldn't be retried
      const errors = [
        { response: { status: 400 } }, // Bad Request
        { response: { status: 401 } }, // Unauthorized
        { response: { status: 403 } }, // Forbidden
        { response: { status: 404 } }, // Not Found
        { response: { status: 422 } }  // Unprocessable Entity
      ];
      
      // All should return false from shouldRetry
      for (const error of errors) {
        expect(apiClient.shouldRetry(error)).toBe(false);
      }
    });
  });
  
  describe('Convenience Methods', () => {
    it('should handle GET requests with error handling', async () => {
      // Mock implementation for request method
      apiClient.request = vi.fn().mockResolvedValue({ data: 'success' });
      
      // Call get method
      await apiClient.get('/test', { params: { q: 'query' } });
      
      // Should have called request with correct parameters
      expect(apiClient.request).toHaveBeenCalledWith({
        method: 'get',
        url: '/test',
        params: { q: 'query' }
      });
    });
    
    it('should handle POST requests with error handling', async () => {
      // Mock implementation for request method
      apiClient.request = vi.fn().mockResolvedValue({ data: 'success' });
      
      // Call post method
      await apiClient.post('/test', { key: 'value' }, { headers: { 'X-Test': 'test' } });
      
      // Should have called request with correct parameters
      expect(apiClient.request).toHaveBeenCalledWith({
        method: 'post',
        url: '/test',
        data: { key: 'value' },
        headers: { 'X-Test': 'test' }
      });
    });
    
    it('should propagate errors from the request method', async () => {
      // Mock implementation for request method to throw
      apiClient.request = vi.fn().mockRejectedValue(new Error('Request failed'));
      
      // Call get method and expect it to throw
      await expect(
        apiClient.get('/test')
      ).rejects.toThrow('Request failed');
    });
  });
  
  describe('calculateBackoff', () => {
    it('should increase backoff exponentially with attempts', () => {
      // Base delay is 100ms
      const baseDelay = 100;
      
      // Calculate backoffs for multiple attempts
      const backoffs = [0, 1, 2, 3, 4].map(attempt => 
        apiClient.calculateBackoff(attempt)
      );
      
      // Remove jitter for comparison (find minimum value which would be closest to the base calculation)
      const baseBackoffs = backoffs.map(backoff => 
        Math.min(backoff * 100 / 130, backoff) // Assuming max 30% jitter
      );
      
      // Each backoff should be approximately double the previous
      for (let i = 1; i < baseBackoffs.length; i++) {
        const ratio = baseBackoffs[i] / baseBackoffs[i-1];
        expect(ratio).toBeGreaterThanOrEqual(1.5); // Allow more wiggle room for jitter effects
        expect(ratio).toBeLessThanOrEqual(2.6); // Increase upper limit to accommodate edge cases
      }
    });
    
    it('should cap backoff at maxDelay', () => {
      // Use a very high attempt number that would normally result in a huge delay
      const backoff = apiClient.calculateBackoff(20);
      
      // Should be capped at 60000ms (1 minute)
      expect(backoff).toBeLessThanOrEqual(60000);
    });
    
    it('should add jitter to avoid thundering herd', () => {
      // Run multiple calculations for the same attempt
      const backoffs = Array(10).fill(0).map(() => 
        apiClient.calculateBackoff(1)
      );
      
      // Should have some variation
      const uniqueValues = new Set(backoffs).size;
      expect(uniqueValues).toBeGreaterThan(1);
    });
  });
  
  describe('Error Recovery Flow', () => {
    it('should handle a full error and recovery cycle', async () => {
      // Reset any previous mock implementations
      axios.mockReset();
      
      // Mock a sequence: 
      // 1. Initial request fails with 500
      // 2. Retry 1 fails with 429
      // 3. Retry 2 succeeds
      axios.mockRejectedValueOnce({
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: 'Server error' }
        }
      }).mockRejectedValueOnce({
        response: {
          status: 429,
          headers: { 'retry-after': '1' },
          statusText: 'Too Many Requests',
          data: { error: 'Rate limit exceeded' }
        }
      }).mockResolvedValueOnce({
        status: 200,
        data: { success: true }
      });
      
      // Skip actual waiting
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((callback) => {
        callback(); // Execute immediately
        return 123; // Fake timer ID
      });
      
      // Make a request
      const result = await apiClient.request({ url: '/test', method: 'get' });
      
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
      
      // Should return the successful result
      expect(result).toEqual({ success: true });
      
      // Should have called axios exactly 3 times
      expect(axios).toHaveBeenCalledTimes(3);
      
      // Should have recorded failures and the final success
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalledTimes(2);
      expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalledTimes(1);
    });
  });
});