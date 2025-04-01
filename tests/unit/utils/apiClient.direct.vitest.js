/**
 * Direct API Client Tests
 * 
 * A simplified approach to testing the API client without circuit breaker integration
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Create direct mock for the CircuitBreaker
vi.mock('../../../utils/circuitBreaker.js', () => {
  return {
    CircuitBreaker: vi.fn().mockImplementation(() => ({
      isOpen: vi.fn().mockReturnValue(false),
      recordSuccess: vi.fn(),
      recordFailure: vi.fn()
    })),
    default: vi.fn().mockImplementation(() => ({
      isOpen: vi.fn().mockReturnValue(false),
      recordSuccess: vi.fn(),
      recordFailure: vi.fn()
    }))
  };
});

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Import after mocks are set up
import { RobustAPIClient } from '../../../utils/apiClient.js';
import logger from '../../../utils/logger.js';

describe('RobustAPIClient Direct Tests', () => {
  let client;
  let mockAxios;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a mock adapter for axios
    mockAxios = new MockAdapter(axios);
    
    // Create a fresh client for each test
    client = new RobustAPIClient({
      baseURL: 'https://api.example.com',
      timeout: 500,
      maxRetries: 1, // Minimal retries for faster tests
      retryDelay: 10, // Minimal delay for faster tests
      name: 'DirectTestAPI'
    });
    
    // Spy on methods
    vi.spyOn(client, 'shouldRetry');
    vi.spyOn(client, 'delay').mockImplementation(() => Promise.resolve());
    
    // Fix random for deterministic jitter
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  
  afterEach(() => {
    mockAxios.reset();
  });
  
  describe('Successful Requests', () => {
    it('should handle successful GET requests', async () => {
      // Setup mock response
      mockAxios.onGet('https://api.example.com/success').reply(200, { data: 'success' });
      
      // Execute request
      const result = await client.get('/success');
      
      // Verify response
      expect(result).toEqual({ data: 'success' });
    });
    
    it('should handle successful POST requests with data', async () => {
      // Setup mock response
      mockAxios.onPost('https://api.example.com/users', { name: 'Test User' }).reply(201, { 
        id: 123, 
        name: 'Test User' 
      });
      
      // Execute request
      const result = await client.post('/users', { name: 'Test User' });
      
      // Verify response
      expect(result).toEqual({ id: 123, name: 'Test User' });
    });
  });
  
  describe('Error Handling', () => {
    it('should retry after server errors', async () => {
      // First request fails, second succeeds
      let requestCount = 0;
      mockAxios.onGet('https://api.example.com/retry').reply(() => {
        requestCount++;
        if (requestCount === 1) {
          return [500, { error: 'Server error' }];
        } else {
          return [200, { data: 'success after retry' }];
        }
      });
      
      // Execute request
      const result = await client.get('/retry');
      
      // Verify response from second (successful) attempt
      expect(result).toEqual({ data: 'success after retry' });
      
      // Verify retry happened
      expect(client.shouldRetry).toHaveBeenCalled();
      expect(requestCount).toBe(2);
    });
    
    it('should handle non-retryable client errors', async () => {
      // Setup mock response for a 404 error (not retried)
      mockAxios.onGet('https://api.example.com/not-found').reply(404, { 
        error: 'Resource not found' 
      });
      
      // Execute request and expect it to fail
      try {
        await client.get('/not-found');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Verify error structure
        expect(error.message).toContain('HTTP error 404');
        expect(error.response.status).toBe(404);
        expect(error.response.data).toEqual({ error: 'Resource not found' });
        
        // Verify no retry was attempted for 404
        expect(client.shouldRetry(error)).toBe(false);
      }
    });
    
    it('should handle and retry network errors', async () => {
      // Setup a network error then success
      let requestCount = 0;
      mockAxios.onGet('https://api.example.com/network').reply(() => {
        requestCount++;
        if (requestCount === 1) {
          // First request: Network error
          return [0, null, { message: 'Network Error' }];
        } else {
          // Second request: Success
          return [200, { data: 'recovered' }];
        }
      });
      
      // Execute request
      const result = await client.get('/network');
      
      // Verify response from successful retry
      expect(result).toEqual({ data: 'recovered' });
      
      // Verify retry count
      expect(requestCount).toBe(2);
    });
  });
  
  describe('Logging', () => {
    it('should log errors appropriately', async () => {
      // Mock a request that will fail completely (even after retry)
      mockAxios.onGet('https://api.example.com/always-fail').reply(500, { 
        error: 'Persistent server error' 
      });
      
      // Execute request and expect it to fail
      try {
        await client.get('/always-fail');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Verify warning was logged for retry
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Request failed, retrying'),
          expect.objectContaining({
            component: 'apiClient',
            url: '/always-fail'
          })
        );
        
        // Verify error was logged for final failure
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('All retries failed'),
          expect.objectContaining({
            component: 'apiClient',
            url: '/always-fail'
          })
        );
      }
    });
  });
});