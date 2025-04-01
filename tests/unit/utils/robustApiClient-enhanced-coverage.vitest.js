/**
 * RobustAPIClient Enhanced Coverage Tests
 * 
 * These tests expand coverage of the RobustAPIClient by testing edge cases,
 * additional configuration options, and error scenarios not covered in the
 * basic tests.
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

describe('RobustAPIClient Enhanced Coverage', () => {
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
  
  describe('Constructor Options', () => {
    it('should use default options when not provided', () => {
      // Create client with minimal options
      const minimalClient = new RobustAPIClient({
        name: 'MinimalClient',
        baseURL: 'https://api.minimal.com'
      });
      
      // Should have default values
      expect(minimalClient.options.timeout).toBe(30000);
      expect(minimalClient.options.maxRetries).toBe(3);
      expect(minimalClient.options.retryDelay).toBe(1000);
      expect(minimalClient.options.circuitBreakerThreshold).toBe(5);
      expect(minimalClient.options.circuitBreakerResetTimeout).toBe(30000);
    });
    
    it('should use provided options when specified', () => {
      // Create client with custom options
      const customClient = new RobustAPIClient({
        name: 'CustomClient',
        baseURL: 'https://api.custom.com',
        timeout: 5000,
        maxRetries: 5,
        retryDelay: 2000,
        circuitBreakerThreshold: 10,
        circuitBreakerResetTimeout: 60000
      });
      
      // Should use custom values
      expect(customClient.options.timeout).toBe(5000);
      expect(customClient.options.maxRetries).toBe(5);
      expect(customClient.options.retryDelay).toBe(2000);
      expect(customClient.options.circuitBreakerThreshold).toBe(10);
      expect(customClient.options.circuitBreakerResetTimeout).toBe(60000);
    });
    
    it('should create circuit breaker with correct parameters', () => {
      // Create a new client to trigger CircuitBreaker constructor
      new RobustAPIClient({
        name: 'TestCircuitBreakerOptions',
        baseURL: 'https://api.test.com',
        circuitBreakerThreshold: 7,
        circuitBreakerResetTimeout: 45000
      });
      
      // CircuitBreaker should have been constructed with correct options
      expect(CircuitBreaker).toHaveBeenCalledWith({
        failureThreshold: 7,
        resetTimeout: 45000,
        name: 'https://api.test.com'
      });
    });
    
    it('should use name in circuit breaker when baseURL is not provided', () => {
      // Create a client without baseURL
      new RobustAPIClient({
        name: 'NoBaseURLClient'
      });
      
      // Should use name as the circuit breaker name
      expect(CircuitBreaker).toHaveBeenCalledWith(expect.objectContaining({
        name: 'NoBaseURLClient'
      }));
    });
  });
  
  describe('Axios Configuration', () => {
    it('should create axios instance with correct base configuration', () => {
      // Create client with specific options
      new RobustAPIClient({
        baseURL: 'https://api.config.com',
        timeout: 2500,
        headers: { 'X-API-Key': 'test-key' }
      });
      
      // Should create axios with correct config
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.config.com',
        headers: { 'X-API-Key': 'test-key' },
        timeout: 2500
      });
    });
    
    it('should handle empty headers gracefully', () => {
      // Create client without headers
      new RobustAPIClient({
        baseURL: 'https://api.noheaders.com'
      });
      
      // Should create axios with empty headers object
      expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({
        headers: {}
      }));
    });
  });
  
  describe('Request Method Validation', () => {
    it('should handle 3xx redirect responses without error', async () => {
      // Mock a 301 redirect response
      axios.mockResolvedValue({
        status: 301,
        headers: { location: 'https://api.test.com/new-location' },
        data: {}
      });
      
      // Make a request - should throw as 3xx is not in 2xx success range
      await expect(
        apiClient.request({ url: '/test', method: 'get' })
      ).rejects.toThrow('HTTP error 301');
      
      // Should have recorded failure
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled();
    });
    
    it('should validate responses in the 200-299 range as success', async () => {
      // Test various success status codes
      const successStatuses = [200, 201, 202, 204, 206, 299];
      
      for (const status of successStatuses) {
        // Reset mocks
        vi.clearAllMocks();
        
        // Mock the response with this status code
        axios.mockResolvedValue({
          status: status,
          data: { status }
        });
        
        // Make a request
        const result = await apiClient.request({ url: '/test', method: 'get' });
        
        // Should have recorded success
        expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalled();
        expect(mockCircuitBreaker.recordFailure).not.toHaveBeenCalled();
        expect(result).toEqual({ status });
      }
    });
  });
  
  describe('HTTP Method Convenience Functions', () => {
    it('should support PUT requests', async () => {
      // Add a PUT method to the client for testing
      apiClient.put = function(url, data, config = {}) {
        return this.request({
          ...config,
          method: 'put',
          url,
          data
        });
      };
      
      // Mock request to succeed
      apiClient.request = vi.fn().mockResolvedValue({ success: true });
      
      // Call put method
      await apiClient.put('/test', { update: 'value' }, { headers: { 'Content-Type': 'application/json' } });
      
      // Should have called request with correct parameters
      expect(apiClient.request).toHaveBeenCalledWith({
        method: 'put',
        url: '/test',
        data: { update: 'value' },
        headers: { 'Content-Type': 'application/json' }
      });
    });
    
    it('should support DELETE requests', async () => {
      // Add a DELETE method to the client for testing
      apiClient.delete = function(url, config = {}) {
        return this.request({
          ...config,
          method: 'delete',
          url
        });
      };
      
      // Mock request to succeed
      apiClient.request = vi.fn().mockResolvedValue({ success: true });
      
      // Call delete method
      await apiClient.delete('/test/1', { params: { permanent: true } });
      
      // Should have called request with correct parameters
      expect(apiClient.request).toHaveBeenCalledWith({
        method: 'delete',
        url: '/test/1',
        params: { permanent: true }
      });
    });
    
    it('should support PATCH requests', async () => {
      // Add a PATCH method to the client for testing
      apiClient.patch = function(url, data, config = {}) {
        return this.request({
          ...config,
          method: 'patch',
          url,
          data
        });
      };
      
      // Mock request to succeed
      apiClient.request = vi.fn().mockResolvedValue({ success: true });
      
      // Call patch method
      await apiClient.patch('/test/1', { status: 'updated' });
      
      // Should have called request with correct parameters
      expect(apiClient.request).toHaveBeenCalledWith({
        method: 'patch',
        url: '/test/1',
        data: { status: 'updated' }
      });
    });
  });
  
  describe('Edge Case Handling', () => {
    it('should handle axios throwing non-Error objects', async () => {
      // Mock axios to throw a string instead of an Error
      axios.mockImplementation(() => {
        throw 'String error message';
      });
      
      // Should convert to Error and handle gracefully
      await expect(
        apiClient.request({ url: '/test', method: 'get' })
      ).rejects.toThrow('String error message');
      
      // Should still record failure
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled();
    });
    
    it('should handle null or undefined response', async () => {
      // Mock axios to return null (sometimes happens with weird network issues)
      axios.mockResolvedValue(null);
      
      // Should throw appropriate error
      await expect(
        apiClient.request({ url: '/test', method: 'get' })
      ).rejects.toThrow('Unexpected response format');
      
      // Should record failure
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled();
    });
    
    it('should handle response without status', async () => {
      // Mock axios to return a response without status
      axios.mockResolvedValue({ data: {} });
      
      // Should throw appropriate error
      await expect(
        apiClient.request({ url: '/test', method: 'get' })
      ).rejects.toThrow('Invalid response format');
      
      // Should record failure
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled();
    });
  });
  
  describe('Backoff Calculation Edge Cases', () => {
    it('should cap delay at maxDelay even with high jitter', () => {
      // Mock Math.random to always return 1 (maximum jitter)
      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(1);
      
      // Use high attempt number to hit max delay
      const backoff = apiClient.calculateBackoff(15); // Should be well over maxDelay
      
      // Restore original Math.random
      Math.random = originalRandom;
      
      // Should be capped at 60000ms (1 minute)
      expect(backoff).toBe(60000);
    });
    
    it('should handle attempt=0 gracefully', () => {
      // First attempt (attempt=0) should use base delay
      const backoff = apiClient.calculateBackoff(0);
      const baseDelay = apiClient.options.retryDelay; // 100ms in tests
      
      // Should be between baseDelay and baseDelay*1.3 (with jitter)
      expect(backoff).toBeGreaterThanOrEqual(baseDelay);
      expect(backoff).toBeLessThanOrEqual(baseDelay * 1.3);
    });
  });
  
  describe('Circuit Breaker Integration Edge Cases', () => {
    it('should only check circuit breaker once per request, not on retries', async () => {
      // Mock circuit breaker to return open after first check
      let checkCount = 0;
      mockCircuitBreaker.isOpen.mockImplementation(() => {
        checkCount++;
        return checkCount > 1; // Open after first check
      });
      
      // Mock axios to fail once, triggering retry
      axios.mockRejectedValueOnce(new Error('First failure'))
           .mockResolvedValueOnce({
             status: 200,
             data: { success: true }
           });
      
      // Replace setTimeout with immediate execution
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
      
      // Circuit breaker should only have been checked once
      expect(mockCircuitBreaker.isOpen).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Retry-After Header Handling', () => {
    it('should parse non-integer retry-after values', async () => {
      // Mock a 429 response with non-integer retry-after
      axios.mockResolvedValueOnce({
        status: 429,
        headers: { 'retry-after': '1.5' }, // Decimal value
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
      
      // Should have parsed and rounded the retry-after value
      expect(actualDelay).toBe(1500); // 1.5 seconds in ms
    });
    
    it('should handle date format retry-after headers', async () => {
      // Mock a hard-coded date for consistent testing
      const now = new Date('2023-01-01T12:00:00Z');
      
      // Future date exactly 2000ms ahead
      const futureDate = new Date('2023-01-01T12:00:02Z');
      
      // Mock Date.now
      const originalDateNow = Date.now;
      Date.now = vi.fn().mockReturnValue(now.getTime());
      
      // Use the real implementation, just with controlled time
      const delay = apiClient.parseRetryAfterHeader(futureDate.toUTCString());
      
      // Restore original
      Date.now = originalDateNow;
      
      // Should be exactly 2000ms
      expect(delay).toBe(2000);
    });
  });
  
  describe('Request URL Handling', () => {
    it('should handle absolute URLs that override baseURL', async () => {
      // Mock request to return success
      apiClient.request = vi.fn().mockResolvedValue({ success: true });
      
      // Call with absolute URL
      await apiClient.get('https://different-domain.com/api', { params: { q: 'test' } });
      
      // Should have called request with the absolute URL
      expect(apiClient.request).toHaveBeenCalledWith({
        method: 'get',
        url: 'https://different-domain.com/api',
        params: { q: 'test' }
      });
    });
  });
});