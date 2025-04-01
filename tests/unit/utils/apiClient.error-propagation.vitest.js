/**
 * @file apiClient.error-propagation.vitest.js
 * @description Advanced tests for error propagation and handling in the RobustAPIClient
 * 
 * This file contains tests specifically focused on error propagation, classification,
 * and recovery strategies in the RobustAPIClient.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { createTimeController } from '../../test-helpers/time-controller.js';

// Create a mock circuit breaker
const mockCircuitBreaker = {
  isOpen: vi.fn().mockReturnValue(false),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  getState: vi.fn().mockReturnValue('CLOSED'),
  forceState: vi.fn()
};

// Mock modules before import
vi.mock('../../../utils/circuitBreaker.js', () => {
  return {
    __esModule: true,
    CircuitBreaker: vi.fn().mockImplementation(() => mockCircuitBreaker),
    default: vi.fn().mockImplementation(() => mockCircuitBreaker)
  };
});

// Import the modules under test
import { RobustAPIClient } from '../../../utils/apiClient.js';

// Mock logger to avoid console noise but spy on error logging
vi.mock('../../../utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Import the mocked logger to verify calls
import logger from '../../../utils/logger.js';

describe('RobustAPIClient Error Propagation', () => {
  let apiClient;
  let mockAxios;
  let timeController;
  
  // Helper function for creating standardized error responses
  const mockErrorResponse = (status, data = {}, headers = {}) => {
    return {
      status,
      statusText: getStatusText(status),
      data,
      headers
    };
  };
  
  // Helper to get status text for common error codes
  const getStatusText = (status) => {
    const statusTexts = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      408: 'Request Timeout',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    };
    return statusTexts[status] || 'Unknown Error';
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a mock adapter for axios
    mockAxios = new MockAdapter(axios);
    
    // Set up time controller to manage time in tests
    timeController = createTimeController();
    timeController.setup();
    
    // Create client instance with minimal retry settings
    apiClient = new RobustAPIClient({
      baseURL: 'https://api.example.com',
      timeout: 500,
      maxRetries: 1, // Minimal retries for faster tests
      retryDelay: 100,
      name: 'ErrorTestAPI'
    });
    
    // Spy on apiClient methods
    vi.spyOn(apiClient, 'shouldRetry');
    
    // Fix random for deterministic jitter calculation
    vi.spyOn(Math, 'random').mockImplementation(() => 0.5);
  });
  
  afterEach(() => {
    mockAxios.reset();
    timeController.teardown();
  });
  
  /**
   * Tests for HTTP status code error handling
   */
  describe('HTTP Status Code Errors', () => {
    it('should propagate client errors (4xx) with proper error objects', async () => {
      // Client errors like 400, 401, 403, 404, 422 should be propagated
      const errorCodes = [400, 401, 403, 404, 422];
      
      for (const status of errorCodes) {
        // Reset history between tests
        vi.clearAllMocks();
        mockAxios.reset();
        
        // Mock the status code error
        mockAxios.onGet(`https://api.example.com/error-${status}`).reply(
          status,
          { message: `Error ${status}` }
        );
        
        try {
          await apiClient.get(`/error-${status}`);
          // Should never reach here
          expect(true).toBe(false);
        } catch (error) {
          // Verify error structure
          expect(error.message).toContain(`HTTP error ${status}`);
          expect(error.response.status).toBe(status);
          expect(error.response.data).toEqual({ message: `Error ${status}` });
          
          // 4xx client errors (except 408, 429) should not be retried
          if (status !== 408 && status !== 429) {
            expect(apiClient.shouldRetry(error)).toBe(false);
          }
        }
      }
    });
    
    it('should retry on selected 4xx errors (408, 429)', async () => {
      const retryableErrors = [408, 429];
      
      for (const status of retryableErrors) {
        // Reset history between tests
        vi.clearAllMocks();
        mockAxios.reset();
        
        // Mock sequential responses: first error, then success
        let requestCount = 0;
        mockAxios.onGet(`https://api.example.com/retry-${status}`).reply(() => {
          if (requestCount++ === 0) {
            return [status, { message: `Error ${status}` }];
          } else {
            return [200, { result: 'success' }];
          }
        });
        
        // Should succeed after retry
        const result = await apiClient.get(`/retry-${status}`);
        expect(result).toEqual({ result: 'success' });
        
        // Verify shouldRetry was called and returned true
        expect(apiClient.shouldRetry).toHaveBeenCalled();
        
        // Create a similar error and verify it would be retried
        const testError = new Error('Test');
        testError.response = mockErrorResponse(status);
        expect(apiClient.shouldRetry(testError)).toBe(true);
      }
    });
    
    it('should retry server errors (5xx)', async () => {
      const serverErrors = [500, 502, 503, 504];
      
      for (const status of serverErrors) {
        // Reset history between tests
        vi.clearAllMocks();
        mockAxios.reset();
        
        // Mock sequential responses: first error, then success
        let requestCount = 0;
        mockAxios.onGet(`https://api.example.com/server-${status}`).reply(() => {
          if (requestCount++ === 0) {
            return [status, { message: `Error ${status}` }];
          } else {
            return [200, { result: 'success' }];
          }
        });
        
        // Should succeed after retry
        const result = await apiClient.get(`/server-${status}`);
        expect(result).toEqual({ result: 'success' });
        
        // Verify shouldRetry was called and would return true
        expect(apiClient.shouldRetry).toHaveBeenCalled();
        
        // Create a similar error and verify it would be retried
        const testError = new Error('Test');
        testError.response = mockErrorResponse(status);
        expect(apiClient.shouldRetry(testError)).toBe(true);
      }
    });
    
    it('should handle response errors with missing or invalid data', async () => {
      // Mock various malformed responses
      const badResponses = [
        [500, null],                  // null data
        [500, undefined],             // undefined data
        [500, "Not a JSON object"],   // string data
        [500, new Error("Error obj")] // Error object as data
      ];
      
      for (let i = 0; i < badResponses.length; i++) {
        // Reset history between tests
        vi.clearAllMocks();
        mockAxios.reset();
        
        // Mock the malformed response
        mockAxios.onGet(`https://api.example.com/malformed-${i}`).reply(
          badResponses[i][0],
          badResponses[i][1]
        );
        
        try {
          await apiClient.get(`/malformed-${i}`);
          // Should never reach here
          expect(true).toBe(false);
        } catch (error) {
          // Verify error contains status code
          expect(error.message).toContain(`HTTP error ${badResponses[i][0]}`);
          
          // Specific check for response.data
          if (error.response) {
            // Response might contain unusual data, but it shouldn't crash
            expect(error.response).toBeDefined();
          }
        }
      }
    });
  });
  
  /**
   * Tests for network-level errors
   */
  describe('Network and Connection Errors', () => {
    it('should retry on network errors (no response)', async () => {
      // Mock a network error
      mockAxios.onGet('https://api.example.com/network-error').networkError();
      
      // Spy on delay to verify retry happens
      const delaySpy = vi.spyOn(apiClient, 'delay');
      
      try {
        await apiClient.get('/network-error');
        // Should never reach here
        expect(true).toBe(false);
      } catch (error) {
        // For network errors, there's no response property
        expect(error.response).toBeUndefined();
        
        // Verify shouldRetry was called and returns true for network errors
        expect(apiClient.shouldRetry(error)).toBe(true);
        
        // Verify retry delay was called (indicating retry occurred)
        expect(delaySpy).toHaveBeenCalled();
      }
    });
    
    it('should retry when server is unreachable', async () => {
      // Mock a timeout 
      mockAxios.onGet('https://api.example.com/timeout').timeout();
      
      // Spy on delay to verify retry happens
      const delaySpy = vi.spyOn(apiClient, 'delay');
      
      try {
        await apiClient.get('/timeout');
        // Should never reach here
        expect(true).toBe(false);
      } catch (error) {
        // Verify retry delay was called (indicating retry occurred)
        expect(delaySpy).toHaveBeenCalled();
      }
    });
    
    it('should handle ECONNABORTED errors', async () => {
      // Mock a connection abort error (typically timeout)
      mockAxios.onGet('https://api.example.com/connection-abort').reply(() => {
        // Create a custom error that simulates ECONNABORTED
        const error = new Error('Connection aborted');
        error.code = 'ECONNABORTED';
        throw error;
      });
      
      try {
        await apiClient.get('/connection-abort');
        // Should never reach here
        expect(true).toBe(false);
      } catch (error) {
        // Verify error is properly propagated
        expect(error.message).toContain('Connection aborted');
        
        // Verify this type of error would be retried
        expect(apiClient.shouldRetry(error)).toBe(true);
      }
    });
  });
  
  /**
   * Tests for error logging
   */
  describe('Error Logging', () => {
    it('should log all retry attempts with appropriate log levels', async () => {
      // Mock a series of 503 Service Unavailable responses
      mockAxios.onGet('https://api.example.com/log-test').reply(503);
      
      try {
        await apiClient.get('/log-test');
        // Should never reach here after all retries fail
        expect(true).toBe(false);
      } catch (error) {
        // Expect logger.warn to be called for retry attempt logs
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Request failed, retrying'),
          expect.objectContaining({
            component: 'apiClient',
            url: '/log-test',
            attempt: 1,
            error: expect.any(String)
          })
        );
        
        // Expect logger.error to be called for final failure
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('All retries failed'),
          expect.objectContaining({
            component: 'apiClient',
            url: '/log-test',
            error: expect.any(Error)
          })
        );
      }
    });
    
    it('should log rate limit errors specifically', async () => {
      // Mock a 429 Too Many Requests response with retry-after header
      mockAxios.onGet('https://api.example.com/rate-limit').reply(429, {}, {
        'retry-after': '2'
      });
      
      try {
        await apiClient.get('/rate-limit');
        // Should never reach here after all retries fail
        expect(true).toBe(false);
      } catch (error) {
        // Expect logger.warn to be called with rate limit message
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Rate limit exceeded'),
          expect.objectContaining({
            component: 'apiClient',
            url: '/rate-limit'
          })
        );
      }
    });
  });
  
  /**
   * Tests for error enrichment and transformation
   */
  describe('Error Enrichment', () => {
    it('should preserve original response data in the error object', async () => {
      const errorData = {
        error: 'invalid_request',
        error_description: 'The request was malformed',
        code: 'XYZ123',
        timestamp: '2023-04-01T12:00:00Z'
      };
      
      mockAxios.onGet('https://api.example.com/detailed-error').reply(400, errorData);
      
      try {
        await apiClient.get('/detailed-error');
        // Should never reach here
        expect(true).toBe(false);
      } catch (error) {
        // Verify error contains original data
        expect(error.response.data).toEqual(errorData);
        expect(error.message).toContain('HTTP error 400');
      }
    });
  });
});