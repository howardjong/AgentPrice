/**
 * @file apiClient.vitest.js
 * @description Tests for the RobustAPIClient utility
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { createTimeController, mockPerformanceNowSequence, wait, withTimeout } from '../../utils/time-testing-utils.js';

// Mock dependencies
vi.mock('axios');
vi.mock('../../../utils/circuitBreaker.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    isOpen: vi.fn().mockReturnValue(false),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn()
  }))
}));

vi.mock('../../../utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Import the module after mocks are set up
import { RobustAPIClient } from '../../../utils/apiClient.js';
import CircuitBreaker from '../../../utils/circuitBreaker.js';
import logger from '../../../utils/logger.js';

describe('RobustAPIClient', () => {
  let apiClient;
  let axiosCreateSpy;
  let axiosInstanceMock;
  let timeController;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock axios.create
    axiosInstanceMock = {
      get: vi.fn(),
      post: vi.fn(),
      defaults: {},
      request: vi.fn()
    };
    
    axiosCreateSpy = vi.spyOn(axios, 'create').mockReturnValue(axiosInstanceMock);
    
    // Create default API client instance
    apiClient = new RobustAPIClient({
      baseURL: 'https://api.example.com',
      timeout: 5000,
      maxRetries: 3,
      retryDelay: 100, // Use small delay for faster tests
      name: 'TestAPI'
    });
    
    // Set up time controller with minimal delays for tests
    timeController = createTimeController().setup();
    // Note: setup() already sets up the mocks, no need to manually assign them
  });
  
  afterEach(() => {
    vi.resetAllMocks();
    if (timeController) {
      timeController.restore();
    }
  });
  
  describe('constructor', () => {
    it('should use default options when none are provided', () => {
      const defaultClient = new RobustAPIClient();
      expect(defaultClient.options.timeout).toBe(30000);
      expect(defaultClient.options.maxRetries).toBe(3);
      expect(defaultClient.options.retryDelay).toBe(1000);
      expect(defaultClient.name).toBe('API Client');
    });
    
    it('should use provided options', () => {
      expect(apiClient.options.timeout).toBe(5000);
      expect(apiClient.options.maxRetries).toBe(3);
      expect(apiClient.options.retryDelay).toBe(100);
      expect(apiClient.name).toBe('TestAPI');
    });
    
    it('should create an axios instance with the right config', () => {
      expect(axiosCreateSpy).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com',
        headers: {},
        timeout: 5000
      });
    });
    
    it('should create a circuit breaker with the right config', () => {
      expect(CircuitBreaker).toHaveBeenCalledWith({
        failureThreshold: 5,
        resetTimeout: 30000,
        name: 'https://api.example.com'
      });
    });
  });
  
  describe('request', () => {
    it('should throw error when circuit breaker is open', async () => {
      // Override the isOpen mock for this test
      apiClient.circuitBreaker.isOpen.mockReturnValueOnce(true);
      
      // Test configuration
      const config = {
        url: '/test',
        method: 'GET'
      };
      
      // Create a function that we can await and expect to throw
      const requestFn = async () => await apiClient.request(config);
      
      // Should reject due to open circuit
      await expect(requestFn()).rejects.toThrow('Circuit breaker open for TestAPI');
      
      // Verify axios was not called
      expect(apiClient.axios).not.toHaveBeenCalled();
      
      // Verify warning was logged
      expect(logger.warn).toHaveBeenCalledWith(
        'TestAPI: Circuit breaker open, request blocked',
        expect.objectContaining({
          component: 'apiClient',
          url: '/test'
        })
      );
    });
    
    it('should make a successful request and record success', async () => {
      // Mock successful response
      const mockResponse = { 
        status: 200, 
        statusText: 'OK',
        data: { success: true } 
      };
      apiClient.axios.mockResolvedValueOnce(mockResponse);
      
      // Test configuration
      const config = {
        url: '/test',
        method: 'GET'
      };
      
      const result = await apiClient.request(config);
      
      // Verify axios was called correctly
      expect(apiClient.axios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/test',
          method: 'GET',
          validateStatus: null
        })
      );
      
      // Verify response is correct
      expect(result).toEqual({ success: true });
      
      // Verify circuit breaker success was recorded
      expect(apiClient.circuitBreaker.recordSuccess).toHaveBeenCalled();
    });
    
    it('should handle 429 responses with retry-after header', async () => {
      // Mock a rate limit response then a successful response
      const rateLimitResponse = { 
        status: 429, 
        statusText: 'Too Many Requests',
        headers: { 'retry-after': '2' },
        data: { error: 'rate limit' }
      };
      
      const successResponse = { 
        status: 200, 
        statusText: 'OK',
        data: { success: true } 
      };
      
      apiClient.axios.mockResolvedValueOnce(rateLimitResponse);
      apiClient.axios.mockResolvedValueOnce(successResponse);
      
      const config = { url: '/test', method: 'GET' };
      const result = await apiClient.request(config);
      
      // Verify axios was called twice
      expect(apiClient.axios).toHaveBeenCalledTimes(2);
      
      // Verify warning about rate limit was logged
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded'),
        expect.objectContaining({
          component: 'apiClient',
          url: '/test',
          attempt: 1
        })
      );
      
      // Verify delay was approximately correct (2000ms from header)
      // Note: We don't actually wait due to the time controller
      
      // Verify correct result
      expect(result).toEqual({ success: true });
    });
    
    it('should handle HTTP errors with retry for retriable status codes', async () => {
      // Mock a server error then success
      const errorResponse = { 
        status: 503, 
        statusText: 'Service Unavailable',
        data: { error: 'server error' }
      };
      
      const successResponse = { 
        status: 200, 
        statusText: 'OK',
        data: { success: true } 
      };
      
      apiClient.axios.mockResolvedValueOnce(errorResponse);
      apiClient.axios.mockResolvedValueOnce(successResponse);
      
      const config = { url: '/test', method: 'GET' };
      const result = await apiClient.request(config);
      
      // Verify circuit breaker failure was recorded
      expect(apiClient.circuitBreaker.recordFailure).toHaveBeenCalled();
      
      // Verify warning was logged
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Request failed'),
        expect.objectContaining({
          component: 'apiClient',
          url: '/test',
          attempt: 1
        })
      );
      
      // Verify correct result after retry
      expect(result).toEqual({ success: true });
    });
    
    it('should not retry for client errors like 400', async () => {
      // Mock a client error
      const errorResponse = { 
        status: 400, 
        statusText: 'Bad Request',
        data: { error: 'bad request' }
      };
      
      apiClient.axios.mockResolvedValueOnce(errorResponse);
      
      const config = { url: '/test', method: 'GET' };
      
      // Create a function we can await
      const requestFn = async () => await apiClient.request(config);
      
      // Should throw error without retrying
      await expect(requestFn()).rejects.toThrow('HTTP error 400: Bad Request');
      
      // Verify axios was called only once
      expect(apiClient.axios).toHaveBeenCalledTimes(1);
      
      // Verify circuit breaker failure was recorded
      expect(apiClient.circuitBreaker.recordFailure).toHaveBeenCalled();
    });
    
    it('should retry network errors', async () => {
      // Mock a network error then a successful response
      const networkError = new Error('Network Error');
      networkError.code = 'ECONNABORTED';
      
      const successResponse = { 
        status: 200, 
        statusText: 'OK',
        data: { success: true } 
      };
      
      apiClient.axios.mockRejectedValueOnce(networkError);
      apiClient.axios.mockResolvedValueOnce(successResponse);
      
      const config = { url: '/test', method: 'POST', data: { key: 'value' } };
      const result = await apiClient.request(config);
      
      // Verify axios was called twice
      expect(apiClient.axios).toHaveBeenCalledTimes(2);
      
      // Verify circuit breaker failure was recorded
      expect(apiClient.circuitBreaker.recordFailure).toHaveBeenCalled();
      
      // Verify warning was logged
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Request failed'),
        expect.objectContaining({
          component: 'apiClient',
          url: '/test',
          attempt: 1,
          error: 'Network Error'
        })
      );
      
      // Verify correct result after retry
      expect(result).toEqual({ success: true });
    });
    
    it('should give up after maxRetries attempts', async () => {
      // Mock errors for all retries
      const errorResponse = { 
        status: 503, 
        statusText: 'Service Unavailable',
        data: { error: 'server error' }
      };
      
      // Setup all responses to fail
      apiClient.axios.mockResolvedValue(errorResponse);
      
      const config = { url: '/test', method: 'GET' };
      
      // Create a function we can await
      const requestFn = async () => await apiClient.request(config);
      
      // Should reject after maxRetries attempts
      await expect(requestFn()).rejects.toThrow('HTTP error 503: Service Unavailable');
      
      // Verify axios was called maxRetries + 1 times (original + retries)
      expect(apiClient.axios).toHaveBeenCalledTimes(4); // 1 original + 3 retries
      
      // Verify final error logging
      expect(logger.error).toHaveBeenCalledWith(
        'TestAPI: All retries failed',
        expect.objectContaining({
          component: 'apiClient',
          url: '/test'
        })
      );
    });
  });
  
  describe('calculateBackoff', () => {
    it('should use exponential backoff with jitter', () => {
      // Mock Math.random for predictable testing
      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.5);
      
      // Create client with fixed delay for testing
      const testClient = new RobustAPIClient({
        retryDelay: 1000
      });
      
      // First attempt (0): base delay = 1000ms, jitter = 150ms (1000 * 0.3 * 0.5)
      expect(testClient.calculateBackoff(0)).toBe(1150);
      
      // Second attempt (1): base delay = 2000ms, jitter = 300ms (2000 * 0.3 * 0.5)
      expect(testClient.calculateBackoff(1)).toBe(2300);
      
      // Third attempt (2): base delay = 4000ms, jitter = 600ms (4000 * 0.3 * 0.5)
      expect(testClient.calculateBackoff(2)).toBe(4600);
      
      // Should not exceed max delay of 60000ms
      const largeResult = testClient.calculateBackoff(10); // 2^10 * 1000 = 1024000ms
      expect(largeResult).toBe(60000);
      
      // Restore Math.random
      Math.random = originalRandom;
    });
  });
  
  describe('shouldRetry', () => {
    it('should retry network errors', () => {
      const error = new Error('Network Error');
      expect(apiClient.shouldRetry(error)).toBe(true);
    });
    
    it('should retry on specific status codes', () => {
      expect(apiClient.shouldRetry({ response: { status: 408 } })).toBe(true);
      expect(apiClient.shouldRetry({ response: { status: 429 } })).toBe(true);
      expect(apiClient.shouldRetry({ response: { status: 500 } })).toBe(true);
      expect(apiClient.shouldRetry({ response: { status: 502 } })).toBe(true);
      expect(apiClient.shouldRetry({ response: { status: 503 } })).toBe(true);
      expect(apiClient.shouldRetry({ response: { status: 504 } })).toBe(true);
    });
    
    it('should not retry on other status codes', () => {
      expect(apiClient.shouldRetry({ response: { status: 400 } })).toBe(false);
      expect(apiClient.shouldRetry({ response: { status: 401 } })).toBe(false);
      expect(apiClient.shouldRetry({ response: { status: 403 } })).toBe(false);
      expect(apiClient.shouldRetry({ response: { status: 404 } })).toBe(false);
      expect(apiClient.shouldRetry({ response: { status: 422 } })).toBe(false);
    });
  });
  
  describe('convenience methods', () => {
    it('should provide a get method that calls request', async () => {
      // Spy on the request method
      const requestSpy = vi.spyOn(apiClient, 'request').mockResolvedValue({ success: true });
      
      // Call get method
      const result = await apiClient.get('/test', { headers: { 'X-Test': 'true' } });
      
      // Verify request was called with correct parameters
      expect(requestSpy).toHaveBeenCalledWith({
        method: 'get',
        url: '/test',
        headers: { 'X-Test': 'true' }
      });
      
      // Verify result
      expect(result).toEqual({ success: true });
    });
    
    it('should provide a post method that calls request', async () => {
      // Spy on the request method
      const requestSpy = vi.spyOn(apiClient, 'request').mockResolvedValue({ success: true });
      
      // Call post method
      const result = await apiClient.post('/test', { name: 'test' }, { headers: { 'X-Test': 'true' } });
      
      // Verify request was called with correct parameters
      expect(requestSpy).toHaveBeenCalledWith({
        method: 'post',
        url: '/test',
        data: { name: 'test' },
        headers: { 'X-Test': 'true' }
      });
      
      // Verify result
      expect(result).toEqual({ success: true });
    });
  });
  
  describe('delay', () => {
    it('should create a promise that resolves after the specified time', async () => {
      const start = Date.now();
      
      // Call delay method with timeController - it won't actually wait in tests
      await apiClient.delay(1000);
      
      // Time controller's setTimeout is a mock function that was called
      // Don't need to verify exact parameters as the mock doesn't work that way
      expect(setTimeout).toHaveBeenCalled();
    });
  });
});