/**
 * @file apiClient.timeout.vitest.js
 * @description Focused tests for the RobustAPIClient timeout handling
 * 
 * This file contains tests specifically focused on the timeout handling capabilities
 * of the RobustAPIClient, including various timeout scenarios, recovery, and configuration.
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

describe('RobustAPIClient Timeout Handling', () => {
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
      timeout: 1000, // 1 second timeout
      maxRetries: 2,
      retryDelay: 100, // Use small delay for faster tests
      name: 'TimeoutTestAPI'
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
   * Tests for timeout configuration
   */
  describe('Timeout Configuration', () => {
    it('should use the configured timeout value', () => {
      // Create clients with different timeout values
      const client1 = new RobustAPIClient({ timeout: 5000 });
      const client2 = new RobustAPIClient({ timeout: 10000 });
      const defaultClient = new RobustAPIClient({});
      
      // Verify timeout values are passed to axios correctly
      expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ 
        timeout: 5000 
      }));
      expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ 
        timeout: 10000 
      }));
      expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ 
        timeout: 30000 // Default value
      }));
    });
    
    it('should allow per-request timeout overrides', async () => {
      // Mock successful response
      mockAxios.onGet('https://api.example.com/test').reply(200, { data: 'success' });
      
      // Make request with custom timeout
      await apiClient.get('/test', { timeout: 5000 });
      
      // Verify request was made with overridden timeout
      expect(mockAxios.history.get[0].timeout).toBe(5000);
    });
  });

  /**
   * Tests for various timeout scenarios
   */
  describe('Timeout Handling', () => {
    it('should retry requests that time out', async () => {
      // Create timeout error
      const timeoutError = new Error('timeout of 1000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      
      // First request times out, second succeeds
      mockAxios.onGet('https://api.example.com/test')
        .replyOnce(() => Promise.reject(timeoutError))
        .replyOnce(200, { data: 'success' });
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify made expected number of requests
      expect(mockAxios.history.get.length).toBe(2);
    });
    
    it('should fail after maxRetries timeouts', async () => {
      // Create timeout error
      const timeoutError = new Error('timeout of 1000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      
      // All requests time out
      mockAxios.onGet('https://api.example.com/test')
        .reply(() => Promise.reject(timeoutError));
      
      // Make request
      try {
        await apiClient.get('/test');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Expected to fail after all retries
        expect(error.code).toBe('ECONNABORTED');
        expect(error.message).toContain('timeout');
      }
      
      // Verify made expected number of requests (initial + maxRetries)
      expect(mockAxios.history.get.length).toBe(3);
    });
    
    it('should handle 408 Request Timeout status', async () => {
      // First request returns 408, second succeeds
      mockAxios.onGet('https://api.example.com/test')
        .replyOnce(408, { error: 'Request Timeout' })
        .replyOnce(200, { data: 'success' });
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify made expected number of requests
      expect(mockAxios.history.get.length).toBe(2);
    });
  });

  /**
   * Tests for timeout at different request stages
   */
  describe('Timeout Stages', () => {
    it('should handle connect timeouts', async () => {
      // Create connect timeout error
      const connectTimeoutError = new Error('connect ETIMEDOUT');
      connectTimeoutError.code = 'ETIMEDOUT';
      connectTimeoutError.syscall = 'connect';
      
      // First connect times out, second succeeds
      mockAxios.onGet('https://api.example.com/test')
        .replyOnce(() => Promise.reject(connectTimeoutError))
        .replyOnce(200, { data: 'success' });
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify made expected number of requests
      expect(mockAxios.history.get.length).toBe(2);
    });
    
    it('should handle socket timeouts', async () => {
      // Create socket timeout error
      const socketTimeoutError = new Error('socket hang up');
      socketTimeoutError.code = 'ECONNRESET';
      
      // First socket times out, second succeeds
      mockAxios.onGet('https://api.example.com/test')
        .replyOnce(() => Promise.reject(socketTimeoutError))
        .replyOnce(200, { data: 'success' });
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify made expected number of requests
      expect(mockAxios.history.get.length).toBe(2);
    });
    
    it('should handle request timeouts', async () => {
      // Create request timeout error
      const requestTimeoutError = new Error('timeout of 1000ms exceeded');
      requestTimeoutError.code = 'ECONNABORTED';
      
      // First request times out, second succeeds
      mockAxios.onGet('https://api.example.com/test')
        .replyOnce(() => Promise.reject(requestTimeoutError))
        .replyOnce(200, { data: 'success' });
      
      // Make request
      const result = await apiClient.get('/test');
      
      // Should eventually succeed
      expect(result).toEqual({ data: 'success' });
      
      // Verify made expected number of requests
      expect(mockAxios.history.get.length).toBe(2);
    });
  });

  /**
   * Tests for timeout interaction with circuit breaker
   */
  describe('Timeout Circuit Breaker Integration', () => {
    it('should record failure on timeout', async () => {
      // Create timeout error
      const timeoutError = new Error('timeout of 1000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      
      // Request times out
      mockAxios.onGet('https://api.example.com/test')
        .replyOnce(() => Promise.reject(timeoutError))
        .replyOnce(200, { data: 'success' });
      
      // Make request
      await apiClient.get('/test');
      
      // Verify failure recorded for timeout
      expect(apiClient.circuitBreaker.recordFailure).toHaveBeenCalledTimes(1);
      
      // Verify success recorded for successful retry
      expect(apiClient.circuitBreaker.recordSuccess).toHaveBeenCalledTimes(1);
    });
    
    it('should trip circuit breaker after multiple timeouts', async () => {
      // Create timeout error
      const timeoutError = new Error('timeout of 1000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      
      // All requests time out
      mockAxios.onGet('https://api.example.com/test')
        .reply(() => Promise.reject(timeoutError));
      
      // Mock circuit breaker to open after threshold
      let failureCount = 0;
      apiClient.circuitBreaker.recordFailure.mockImplementation(() => {
        failureCount++;
        // Open circuit after 5 failures
        if (failureCount >= 5) {
          apiClient.circuitBreaker.isOpen.mockReturnValue(true);
        }
      });
      
      // First request should fail after max retries
      try {
        await apiClient.get('/test');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Expected to fail
        expect(error.code).toBe('ECONNABORTED');
      }
      
      // Verify failures recorded
      expect(apiClient.circuitBreaker.recordFailure).toHaveBeenCalledTimes(3);
      
      // Make another request - this should be blocked by circuit breaker
      try {
        await apiClient.get('/other-endpoint');
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Expected to fail with circuit breaker message
        expect(error.message).toContain('Circuit breaker open');
      }
      
      // Verify no additional request was made
      expect(mockAxios.history.get.length).toBe(3); // From first request only
    });
  });

  /**
   * Tests for timeout recovery patterns
   */
  describe('Timeout Recovery', () => {
    it('should retry with progressive backoff after timeouts', async () => {
      // Create timeout error
      const timeoutError = new Error('timeout of 1000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      
      // First request times out, second succeeds
      mockAxios.onGet('https://api.example.com/test')
        .replyOnce(() => Promise.reject(timeoutError))
        .replyOnce(200, { data: 'success' });
      
      // Spy on calculateBackoff and delay
      const calculateBackoffSpy = vi.spyOn(apiClient, 'calculateBackoff');
      const delaySpy = vi.spyOn(apiClient, 'delay');
      
      // Make request
      await apiClient.get('/test');
      
      // Verify calculateBackoff called
      expect(calculateBackoffSpy).toHaveBeenCalledWith(0);
      
      // Verify delay called with backoff value
      expect(delaySpy).toHaveBeenCalled();
    });
    
    it('should preserve request configuration across timeout retries', async () => {
      // Create timeout error
      const timeoutError = new Error('timeout of 1000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      
      // First request times out, second succeeds
      mockAxios.onPost('https://api.example.com/test')
        .replyOnce(() => Promise.reject(timeoutError))
        .replyOnce(200, { data: 'success' });
      
      // Request data and headers
      const data = { key: 'value' };
      const headers = { 'X-Custom': 'test-value' };
      
      // Make request
      await apiClient.post('/test', data, { headers });
      
      // Verify both requests had identical configuration
      expect(mockAxios.history.post.length).toBe(2);
      expect(JSON.parse(mockAxios.history.post[0].data)).toEqual(data);
      expect(mockAxios.history.post[0].headers['X-Custom']).toBe('test-value');
      expect(JSON.parse(mockAxios.history.post[1].data)).toEqual(data);
      expect(mockAxios.history.post[1].headers['X-Custom']).toBe('test-value');
    });
  });

  /**
   * Tests for edge cases in timeout handling
   */
  describe('Timeout Edge Cases', () => {
    it('should handle zero timeout value', async () => {
      // Create client with zero timeout (which means no timeout in axios)
      const zeroTimeoutClient = new RobustAPIClient({
        baseURL: 'https://api.example.com',
        timeout: 0
      });
      
      // Mock successful response
      mockAxios.onGet('https://api.example.com/test').reply(200, { data: 'success' });
      
      // Make request
      await zeroTimeoutClient.get('/test');
      
      // Verify request was made with zero timeout
      expect(mockAxios.history.get[0].timeout).toBe(0);
    });
    
    it('should handle very long timeout value', async () => {
      // Create client with very long timeout
      const longTimeoutClient = new RobustAPIClient({
        baseURL: 'https://api.example.com',
        timeout: 3600000 // 1 hour
      });
      
      // Mock successful response
      mockAxios.onGet('https://api.example.com/test').reply(200, { data: 'success' });
      
      // Make request
      await longTimeoutClient.get('/test');
      
      // Verify request was made with correct timeout
      expect(mockAxios.history.get[0].timeout).toBe(3600000);
    });
    
    it('should handle timeout value overriding at the request level', async () => {
      // Mock successful response
      mockAxios.onGet('https://api.example.com/test').reply(200, { data: 'success' });
      
      // Make request with custom timeout
      await apiClient.get('/test', { timeout: 5000 });
      
      // Verify request was made with overridden timeout
      expect(mockAxios.history.get[0].timeout).toBe(5000);
    });
    
    it('should handle different timeout errors with consistent retry logic', async () => {
      // Different types of timeout errors
      const timeoutErrors = [
        { message: 'timeout of 1000ms exceeded', code: 'ECONNABORTED' },
        { message: 'connect ETIMEDOUT', code: 'ETIMEDOUT', syscall: 'connect' },
        { message: 'socket hang up', code: 'ECONNRESET' }
      ];
      
      // Test each type of timeout error
      for (const timeoutError of timeoutErrors) {
        mockAxios.reset();
        vi.clearAllMocks();
        
        // Create Error object from template
        const error = new Error(timeoutError.message);
        error.code = timeoutError.code;
        if (timeoutError.syscall) {
          error.syscall = timeoutError.syscall;
        }
        
        // First request times out, second succeeds
        mockAxios.onGet(`https://api.example.com/test-${timeoutError.code}`)
          .replyOnce(() => Promise.reject(error))
          .replyOnce(200, { data: 'success' });
        
        // Make request
        const result = await apiClient.get(`/test-${timeoutError.code}`);
        
        // Should eventually succeed
        expect(result).toEqual({ data: 'success' });
        
        // Verify retry mechanism worked
        expect(mockAxios.history.get.length).toBe(2);
        expect(apiClient.circuitBreaker.recordFailure).toHaveBeenCalledTimes(1);
        expect(apiClient.circuitBreaker.recordSuccess).toHaveBeenCalledTimes(1);
      }
    });
  });
});