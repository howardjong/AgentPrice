/**
 * @file apiClient.error.vitest.js
 * @description Focused tests for the RobustAPIClient error handling
 * 
 * This file contains tests specifically focused on error handling capabilities
 * of the RobustAPIClient, including various error scenarios, error propagation,
 * error classification, and recovery patterns.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { createTimeController } from '../../utils/time-testing-utils.js';

// Import the modules under test
import { RobustAPIClient } from '../../../utils/apiClient.js';
import CircuitBreaker from '../../../utils/circuitBreaker.js';
import logger from '../../../utils/logger.js';

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

// Mock logger to track error logging and avoid console noise during tests
vi.mock('../../../utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('RobustAPIClient Error Handling', () => {
  let apiClient;
  let mockAxios;
  let timeController;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a mock adapter for axios
    mockAxios = new MockAdapter(axios);
    
    // Set up time controller
    timeController = createTimeController().setup();
    
    // Create client instance with consistent settings for testing
    apiClient = new RobustAPIClient({
      baseURL: 'https://api.example.com',
      timeout: 1000,
      maxRetries: 2,
      retryDelay: 100, // Use small delay for faster tests
      name: 'ErrorTestAPI'
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
    mockAxios.reset();
    if (timeController) {
      timeController.restore();
    }
  });

  /**
   * Tests for HTTP error handling
   */
  describe('HTTP Error Handling', () => {
    it('should throw error with status code and text for HTTP errors', async () => {
      // Set up error response
      mockAxios.onGet('https://api.example.com/test').reply(404, { 
        message: 'Resource not found' 
      });
      
      // Make request (should reject)
      try {
        await apiClient.get('/test');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Verify error format
        expect(error.message).toBe('HTTP error 404: Not Found');
        expect(error.response.status).toBe(404);
        expect(error.response.data).toEqual({ message: 'Resource not found' });
      }
    });
    
    it('should include original response in error object', async () => {
      // Set up error response with headers
      mockAxios.onGet('https://api.example.com/test').reply(
        400, 
        { error: 'Bad request', details: ['Invalid parameter'] },
        { 'X-Error-Code': 'INVALID_PARAMS' }
      );
      
      // Make request (should reject)
      try {
        await apiClient.get('/test');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Verify error includes response with all details
        expect(error.response.status).toBe(400);
        expect(error.response.data).toEqual({ 
          error: 'Bad request', 
          details: ['Invalid parameter'] 
        });
        expect(error.response.headers).toEqual(
          expect.objectContaining({ 'x-error-code': 'INVALID_PARAMS' })
        );
      }
    });
    
    it('should log errors with appropriate level and details', async () => {
      // Set up error response
      mockAxios.onGet('https://api.example.com/test').reply(500, { 
        error: 'Internal server error' 
      });
      
      // Make request (should reject after all retries)
      try {
        await apiClient.get('/test');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Expected to fail
        expect(error.message).toContain('HTTP error 500');
      }
      
      // Verify warning logs for retries
      expect(logger.warn).toHaveBeenCalledTimes(2); // One for each retry
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Request failed'),
        expect.objectContaining({
          component: 'apiClient',
          url: '/test',
          attempt: expect.any(Number)
        })
      );
      
      // Verify final error log
      expect(logger.error).toHaveBeenCalledWith(
        'ErrorTestAPI: All retries failed',
        expect.objectContaining({
          component: 'apiClient',
          url: '/test',
          error: expect.any(Object)
        })
      );
    });
    
    it('should handle different status code ranges appropriately', async () => {
      // Test different status code ranges
      const statusTests = [
        { status: 400, retriable: false, name: 'Bad Request' },
        { status: 401, retriable: false, name: 'Unauthorized' },
        { status: 403, retriable: false, name: 'Forbidden' },
        { status: 404, retriable: false, name: 'Not Found' },
        { status: 408, retriable: true, name: 'Request Timeout' },
        { status: 429, retriable: true, name: 'Too Many Requests' },
        { status: 500, retriable: true, name: 'Internal Server Error' },
        { status: 502, retriable: true, name: 'Bad Gateway' },
        { status: 503, retriable: true, name: 'Service Unavailable' },
        { status: 504, retriable: true, name: 'Gateway Timeout' }
      ];
      
      for (const test of statusTests) {
        mockAxios.reset();
        vi.clearAllMocks();
        
        // Set up response with the test status code
        if (test.retriable) {
          // For retriable status, first request fails, second succeeds
          mockAxios.onGet(`https://api.example.com/status-${test.status}`)
            .replyOnce(test.status, { error: test.name })
            .replyOnce(200, { data: 'success' });
        } else {
          // For non-retriable status, request fails
          mockAxios.onGet(`https://api.example.com/status-${test.status}`)
            .reply(test.status, { error: test.name });
        }
        
        // Make request
        if (test.retriable) {
          // Should eventually succeed
          const result = await apiClient.get(`/status-${test.status}`);
          expect(result).toEqual({ data: 'success' });
          
          // Verify retry occurred
          expect(mockAxios.history.get.length).toBe(2);
        } else {
          // Should fail immediately
          try {
            await apiClient.get(`/status-${test.status}`);
            // Should not reach here
            expect(false).toBe(true);
          } catch (error) {
            // Verify error is as expected
            expect(error.message).toBe(`HTTP error ${test.status}: ${test.name}`);
            expect(error.response.status).toBe(test.status);
          }
          
          // Verify no retry was attempted
          expect(mockAxios.history.get.length).toBe(1);
        }
      }
    });
  });

  /**
   * Tests for network error handling
   */
  describe('Network Error Handling', () => {
    it('should handle network errors', async () => {
      // Create network error
      const networkError = new Error('Network Error');
      
      // First request fails with network error, second succeeds
      mockAxios.onGet('https://api.example.com/test')
        .replyOnce(() => Promise.reject(networkError))
        .replyOnce(200, { data: 'success' });
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify made expected number of requests
      expect(mockAxios.history.get.length).toBe(2);
    });
    
    it('should handle various network error types', async () => {
      // Different types of network errors
      const networkErrors = [
        { message: 'Network Error', code: undefined },
        { message: 'Error: getaddrinfo ENOTFOUND api.example.com', code: 'ENOTFOUND' },
        { message: 'Error: connect ECONNREFUSED', code: 'ECONNREFUSED' },
        { message: 'Error: read ECONNRESET', code: 'ECONNRESET' },
        { message: 'Error: socket hang up', code: 'ECONNRESET' }
      ];
      
      for (const errorInfo of networkErrors) {
        mockAxios.reset();
        vi.clearAllMocks();
        
        // Create error with specific message and code
        const error = new Error(errorInfo.message);
        if (errorInfo.code) {
          error.code = errorInfo.code;
        }
        
        // First request fails with network error, second succeeds
        mockAxios.onGet(`https://api.example.com/net-error-${errorInfo.code || 'generic'}`)
          .replyOnce(() => Promise.reject(error))
          .replyOnce(200, { data: 'success' });
        
        // Make request
        const result = await apiClient.get(`/net-error-${errorInfo.code || 'generic'}`);
        
        // Should eventually succeed
        expect(result).toEqual({ data: 'success' });
        
        // Verify retry occurred
        expect(mockAxios.history.get.length).toBe(2);
        
        // Verify failure was recorded
        expect(apiClient.circuitBreaker.recordFailure).toHaveBeenCalledTimes(1);
      }
    });
    
    it('should give up after maxRetries for persistent network errors', async () => {
      // Create network error
      const networkError = new Error('Network Error');
      
      // All requests fail with network error
      mockAxios.onGet('https://api.example.com/test')
        .reply(() => Promise.reject(networkError));
      
      // Make request (should reject after maxRetries)
      try {
        await apiClient.get('/test');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Verify error is the network error
        expect(error.message).toBe('Network Error');
      }
      
      // Verify made expected number of requests (initial + maxRetries)
      expect(mockAxios.history.get.length).toBe(3);
      
      // Verify all failures were recorded
      expect(apiClient.circuitBreaker.recordFailure).toHaveBeenCalledTimes(3);
    });
  });

  /**
   * Tests for error classification
   */
  describe('Error Classification', () => {
    it('should correctly identify retriable errors', () => {
      // Test shouldRetry for different error types
      
      // Network errors (no response)
      expect(apiClient.shouldRetry(new Error('Network Error'))).toBe(true);
      
      // Errors with response - retriable status codes
      expect(apiClient.shouldRetry({ response: { status: 408 } })).toBe(true);
      expect(apiClient.shouldRetry({ response: { status: 429 } })).toBe(true);
      expect(apiClient.shouldRetry({ response: { status: 500 } })).toBe(true);
      expect(apiClient.shouldRetry({ response: { status: 502 } })).toBe(true);
      expect(apiClient.shouldRetry({ response: { status: 503 } })).toBe(true);
      expect(apiClient.shouldRetry({ response: { status: 504 } })).toBe(true);
      
      // Errors with response - non-retriable status codes
      expect(apiClient.shouldRetry({ response: { status: 400 } })).toBe(false);
      expect(apiClient.shouldRetry({ response: { status: 401 } })).toBe(false);
      expect(apiClient.shouldRetry({ response: { status: 403 } })).toBe(false);
      expect(apiClient.shouldRetry({ response: { status: 404 } })).toBe(false);
      expect(apiClient.shouldRetry({ response: { status: 422 } })).toBe(false);
    });
    
    it('should handle errors with missing or malformed response', () => {
      // Should handle errors with undefined response
      expect(apiClient.shouldRetry({ response: undefined })).toBe(true);
      
      // Should handle errors with response but no status
      expect(apiClient.shouldRetry({ response: {} })).toBe(true);
      
      // Should handle errors with non-numeric status
      expect(apiClient.shouldRetry({ response: { status: 'error' } })).toBe(true);
      
      // Should handle errors with null response
      expect(apiClient.shouldRetry({ response: null })).toBe(true);
    });
  });

  /**
   * Tests for error propagation through circuit breaker
   */
  describe('Error Propagation to Circuit Breaker', () => {
    it('should record failure for all error types', async () => {
      // Different types of errors to test
      const errors = [
        // HTTP error
        { 
          setup: (mockAxios) => mockAxios.onGet('https://api.example.com/http-error').reply(500), 
          url: '/http-error' 
        },
        // Network error
        { 
          setup: (mockAxios) => mockAxios.onGet('https://api.example.com/network-error')
            .reply(() => Promise.reject(new Error('Network Error'))), 
          url: '/network-error' 
        },
        // Timeout error
        { 
          setup: (mockAxios) => {
            const timeoutError = new Error('timeout of 1000ms exceeded');
            timeoutError.code = 'ECONNABORTED';
            mockAxios.onGet('https://api.example.com/timeout-error')
              .reply(() => Promise.reject(timeoutError));
          }, 
          url: '/timeout-error' 
        }
      ];
      
      for (const errorCase of errors) {
        mockAxios.reset();
        vi.clearAllMocks();
        
        // Set up the specific error case
        errorCase.setup(mockAxios);
        
        // Attempt request (should fail after retries)
        try {
          await apiClient.get(errorCase.url);
          // Should not reach here
          expect(false).toBe(true);
        } catch (error) {
          // Error expected
        }
        
        // Verify failures recorded for each attempt
        expect(apiClient.circuitBreaker.recordFailure).toHaveBeenCalledTimes(3);
      }
    });
    
    it('should not make request when circuit breaker is open', async () => {
      // Override isOpen to return true
      apiClient.circuitBreaker.isOpen.mockReturnValueOnce(true);
      
      // Make request (should reject immediately)
      try {
        await apiClient.get('/test');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Verify correct error thrown
        expect(error.message).toBe('Circuit breaker open for ErrorTestAPI');
      }
      
      // Verify no actual request was made
      expect(mockAxios.history.get.length).toBe(0);
    });
  });

  /**
   * Tests for error handling edge cases
   */
  describe('Error Handling Edge Cases', () => {
    it('should handle malformed response objects', async () => {
      // Create error with malformed response
      const malformedError = new Error('Malformed response');
      malformedError.response = 'not an object';
      
      // Mock request that fails with malformed error
      mockAxios.onGet('https://api.example.com/test')
        .replyOnce(() => Promise.reject(malformedError))
        .replyOnce(200, { data: 'success' });
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify retry occurred
      expect(mockAxios.history.get.length).toBe(2);
    });
    
    it('should handle errors with circular references', async () => {
      // Create error with circular reference
      const circularError = new Error('Circular reference');
      const circularObj = { name: 'circular' };
      circularObj.self = circularObj;
      circularError.data = circularObj;
      
      // Mock request that fails with circular error
      mockAxios.onGet('https://api.example.com/test')
        .replyOnce(() => Promise.reject(circularError))
        .replyOnce(200, { data: 'success' });
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify retry occurred
      expect(mockAxios.history.get.length).toBe(2);
    });
    
    it('should handle errors with no message property', async () => {
      // Create error without message
      const noMessageError = {};
      
      // Mock request that fails with no-message error
      mockAxios.onGet('https://api.example.com/test')
        .replyOnce(() => Promise.reject(noMessageError))
        .replyOnce(200, { data: 'success' });
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify retry occurred
      expect(mockAxios.history.get.length).toBe(2);
      
      // Verify error logged
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Request failed'),
        expect.objectContaining({
          component: 'apiClient',
          url: '/test'
        })
      );
    });
    
    it('should handle axios errors with unusual formats', async () => {
      // Different types of unusual axios errors
      const unusualErrors = [
        { message: 'Error without code' },
        { message: 'Error without response', isAxiosError: true },
        { message: 'Error with empty response', response: {} },
        { message: 'Error with null data', response: { status: 500, data: null } }
      ];
      
      for (let i = 0; i < unusualErrors.length; i++) {
        mockAxios.reset();
        vi.clearAllMocks();
        
        const errorObj = unusualErrors[i];
        
        // Mock request that fails with unusual error
        mockAxios.onGet(`https://api.example.com/unusual-${i}`)
          .replyOnce(() => Promise.reject(errorObj))
          .replyOnce(200, { data: 'success' });
        
        // Make request
        const result = await apiClient.get(`/unusual-${i}`);
        
        // Should eventually succeed
        expect(result).toEqual({ data: 'success' });
        
        // Verify retry occurred
        expect(mockAxios.history.get.length).toBe(2);
      }
    });
  });

  /**
   * Tests for error recovery patterns
   */
  describe('Error Recovery Patterns', () => {
    it('should recover from temporary errors', async () => {
      // Set up sequence: fail, fail, succeed
      mockAxios.onGet('https://api.example.com/test')
        .replyOnce(500, { error: 'Temporary error 1' })
        .replyOnce(500, { error: 'Temporary error 2' })
        .replyOnce(200, { data: 'success' });
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify all requests were made
      expect(mockAxios.history.get.length).toBe(3);
      
      // Verify failures and success were recorded
      expect(apiClient.circuitBreaker.recordFailure).toHaveBeenCalledTimes(2);
      expect(apiClient.circuitBreaker.recordSuccess).toHaveBeenCalledTimes(1);
    });
    
    it('should handle mixed success/failure patterns', async () => {
      // Test multiple request sequences
      
      // First test: success, no retry needed
      mockAxios.onGet('https://api.example.com/success')
        .reply(200, { data: 'immediate success' });
      
      const successResult = await apiClient.get('/success');
      expect(successResult).toEqual({ data: 'immediate success' });
      
      // Second test: permanent failure, retries exhausted
      mockAxios.onGet('https://api.example.com/permanent-failure')
        .reply(500, { error: 'Permanent error' });
      
      try {
        await apiClient.get('/permanent-failure');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Expected
        expect(error.message).toContain('HTTP error 500');
      }
      
      // Third test: temporary failure, eventual success
      mockAxios.onGet('https://api.example.com/temporary-failure')
        .replyOnce(500, { error: 'Temporary error' })
        .replyOnce(200, { data: 'eventual success' });
      
      const eventualResult = await apiClient.get('/temporary-failure');
      expect(eventualResult).toEqual({ data: 'eventual success' });
      
      // Verify correct number of total requests
      expect(mockAxios.history.get.length).toBe(6); // 1 + 3 + 2
    });
  });
});