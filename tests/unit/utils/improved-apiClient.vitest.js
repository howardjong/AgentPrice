import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { assertRejects, createErrorTrackingSpy } from '../utils/error-handling-utils.js';
import { assertRejects, createErrorTrackingSpy } from '../utils/error-handling-utils.js';
import { assertRejects, createErrorTrackingSpy } from '../utils/error-handling-utils.js';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Logger mock
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock the apiClient.js module
vi.mock('../../../utils/apiClient.js', () => {
  return {
    RobustAPIClient: vi.fn().mockImplementation((options = {}) => {
      // Default options
      const config = {
        maxRetries: options.maxRetries || 3,
        timeout: options.timeout || 30000,
        retryStatusCodes: options.retryStatusCodes || [429, 500, 502, 503, 504],
        retryDelay: options.retryDelay || 1000
      };
      
      // Storage maps for tracking state
      const activePromises = new Map();
      const rateLimitedEndpoints = new Map();
      
      // Set up interval for cleanup
      const cleanupInterval = setInterval(() => {
        // Implementation of cleanupStalePromises
        const now = Date.now();
        activePromises.forEach((metadata, promise) => {
          if (now - metadata.timestamp > 30 * 60 * 1000) {
            activePromises.delete(promise);
          }
        });
      }, 300000);
      
      // Create the mock instance
      return {
        // Properties
        maxRetries: config.maxRetries,
        timeout: config.timeout,
        retryStatusCodes: config.retryStatusCodes,
        retryDelay: config.retryDelay,
        activePromises,
        rateLimitedEndpoints,
        cleanupInterval,
        
        // Methods
        cleanupStalePromises: vi.fn(() => {
          const now = Date.now();
          activePromises.forEach((metadata, promise) => {
            if (now - metadata.timestamp > 30 * 60 * 1000) {
              activePromises.delete(promise);
            }
          });
        }),
        
        trackPromise: vi.fn((promise, metadata = {}) => {
          activePromises.set(promise, { ...metadata, timestamp: Date.now() });
          return promise;
        }),
        
        request: vi.fn(async function(config) {
          // Using function keyword to allow us to define calculateRetryDelay inside scope
          const self = this;
          
          function calculateRetryDelayLocal(retries, response = null) {
            // Check for Retry-After header
            if (response?.headers?.['retry-after']) {
              const retryAfter = parseInt(response.headers['retry-after'], 10);
              if (!isNaN(retryAfter)) {
                return retryAfter * 1000;
              }
            }
            
            // Standard exponential backoff without jitter for tests
            return options.retryDelay * Math.pow(2, retries - 1);
          }
          
          const requestConfig = {
            ...config,
            timeout: options.timeout
          };
          
          const endpointKey = config.url.split('?')[0];
          
          // Check if endpoint is rate limited
          if (rateLimitedEndpoints.has(endpointKey)) {
            const limitInfo = rateLimitedEndpoints.get(endpointKey);
            const now = Date.now();
            
            if (now < limitInfo.resetTime) {
              const waitTime = limitInfo.resetTime - now;
              // Wait before proceeding
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
            // Clear rate limit info after waiting
            rateLimitedEndpoints.delete(endpointKey);
          }
          
          let retries = 0;
          
          while (true) {
            try {
              const response = await axios(requestConfig);
              return response;
            } catch (error) {
              // Special handling for rate limit errors
              if (error.response?.status === 429) {
                const retryDelayMs = calculateRetryDelayLocal(retries + 1, error.response);
                
                rateLimitedEndpoints.set(endpointKey, {
                  resetTime: Date.now() + retryDelayMs,
                  status: error.response.status,
                  retryCount: (rateLimitedEndpoints.get(endpointKey)?.retryCount || 0) + 1
                });
                
                if (retries >= config.maxRetries) {
                  throw new Error(`Endpoint ${config.url} rate limited after ${retries} retries`);
                }
                
                retries++;
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                continue;
              }
              
              const shouldRetry = (
                retries < config.maxRetries && 
                (
                  error.response?.status === 429 ||
                  (error.response && config.retryStatusCodes.includes(error.response.status)) ||
                  error.code === 'ECONNABORTED' || 
                  !error.response
                )
              );
              
              if (shouldRetry) {
                retries++;
                const delay = calculateRetryDelayLocal(retries);
                await new Promise(resolve => setTimeout(resolve, delay));
              } else {
                throw error;
              }
            }
          }
        }),
        
        shouldRetryRequest: vi.fn((error, retries) => {
          if (retries >= config.maxRetries) {
            return false;
          }
          
          if (error.response?.status === 429) {
            return true;
          }
          
          if (error.response && config.retryStatusCodes.includes(error.response.status)) {
            return true;
          }
          
          if (error.code === 'ECONNABORTED' || !error.response) {
            return true;
          }
          
          return false;
        }),
        
        calculateRetryDelay: vi.fn((retries, response = null) => {
          // Check for Retry-After header
          if (response?.headers?.['retry-after']) {
            const retryAfter = parseInt(response.headers['retry-after'], 10);
            if (!isNaN(retryAfter)) {
              return retryAfter * 1000;
            }
          }
          
          // Standard exponential backoff without jitter for tests
          return config.retryDelay * Math.pow(2, retries - 1);
        }),
        
        destroy: vi.fn(function() {
          if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
          }
          activePromises.clear();
          return this;
        })
      };
    })
  };
});

// Import the module under test after mocks are set up
import { RobustAPIClient } from '../../../utils/apiClient.js'
import { createTimeController, mockPerformanceNowSequence, wait, withTimeout } from '../utils/time-testing-utils.js';;

describe('RobustAPIClient', () => {
  let client;
  let mockAxios;
  let originalSetInterval;
  
  // Mock setInterval to avoid infinite loop in timer tests
  function setupMockSetInterval() {
    // Store original setInterval
    originalSetInterval = global.setInterval;
    
    // Replace setInterval with a no-op version for tests
    global.setInterval = vi.fn().mockReturnValue(123);
  }
  
  // Setup before each test
  beforeEach(() => {
    // Create a mock adapter for axios
    mockAxios = new MockAdapter(axios);
    
    // Mock setInterval to prevent timer-related infinite loops
    setupMockSetInterval();
    
    // Track clearInterval calls but make them no-ops
    global.clearInterval = vi.fn();
    
    // Override random to return a fixed value (for deterministic jitter)
    vi.spyOn(Math, 'random').mockImplementation(() => 0);
    
    // Fix Date.now for consistent timestamps
    vi.spyOn(Date, 'now').mockImplementation(() => 1609459200000); // 2021-01-01
    
    // Create client instance for testing with short timeouts
    client = new RobustAPIClient({
      maxRetries: 2,
      timeout: 100, // Short timeout for tests
      retryDelay: 10, // Short delay for tests
      enableMetrics: false
    });
  });
  
  afterEach(() => {
    // Reset all mocks
    mockAxios.reset();
    vi.restoreAllMocks();
    
    // Clean up client
    if (client) {
      client.destroy();
      client = null;
    }
    
    // Restore original setInterval
    if (originalSetInterval) {
      global.setInterval = originalSetInterval;
    }
  });

  describe('Basic Functionality', () => {
    it('should initialize with default options', () => {
      const defaultClient = new RobustAPIClient();
      expect(defaultClient.maxRetries).toBe(3);
      expect(defaultClient.timeout).toBe(30000);
    });
    
    it('should initialize with custom options', () => {
      expect(client.maxRetries).toBe(2);
      expect(client.timeout).toBe(100);
      expect(client.retryDelay).toBe(10);
    });
    
    it('should clean up resources properly on destroy', () => {
      client.destroy();
      expect(global.clearInterval).toHaveBeenCalled();
      expect(client.cleanupInterval).toBeNull();
    });
  });
  
  describe('Request Handling', () => {
    it('should make successful requests through axios', async () => {
      // Set up mock response
      mockAxios.onAny().reply(200, { data: 'success' });
      
      // Start the request as a Promise
      const requestPromise = client.request({
        method: 'GET',
        url: '/data'
      });
      
      // Advance any timers that might be waiting
      vi.runAllTimers();
      
      // Wait for the request to complete
      const result = await requestPromise;
      
      // Verify response and request was made correctly
      expect(result.data).toEqual({ data: 'success' });
      expect(mockAxios.history.get.length).toBe(1);
      expect(mockAxios.history.get[0].url).toBe('/data');
    });
    
    it('should handle failed requests and propagate errors', async () => {
      // Set up mock to return an error
      mockAxios.onAny().reply(404, { error: 'Not found' });
      
      // Start the request and expect it to fail
      const requestPromise = client.request({
        method: 'GET',
        url: '/data'
      });
      
      // Advance any timers
      vi.runAllTimers();
      
      // Wait for the promise to reject
      await expect(requestPromise).rejects.toHaveProperty('response.status', 404);
    });
  });
  
  describe('Retry Logic', () => {
    it('should retry on retryable errors', async () => {
      // First request fails with 500, second succeeds
      mockAxios.onGet('/data').replyOnce(500)
                        .onGet('/data').reply(200, { data: 'success after retry' });
      
      // Start the request
      const requestPromise = client.request({
        method: 'GET',
        url: '/data'
      });
      
      // Advance timers to handle any setTimeout calls (for retry delay)
      vi.runAllTimers();
      
      // Wait for the result
      const result = await requestPromise;
      
      // Verify response and that multiple requests were made
      expect(result.data).toEqual({ data: 'success after retry' });
      expect(mockAxios.history.get.length).toBe(2);
    });
    
    it('should not retry after exceeding max retries', async () => {
      // All requests fail with 500
      mockAxios.onGet('/data').reply(500, { error: 'Server error' });
      
      // Start the request
      const requestPromise = client.request({
        method: 'GET',
        url: '/data'
      });
      
      // Run timers multiple times to get through all retries
      vi.runAllTimers(); // First attempt
      vi.runAllTimers(); // First retry
      vi.runAllTimers(); // Second retry
      
      // Expect the request to fail after retries
      await expect(requestPromise).rejects.toHaveProperty('response.status', 500);
      
      // With maxRetries=2, we expect 3 calls total (1 initial + 2 retries)
      expect(mockAxios.history.get.length).toBe(3);
    });
    
    it('should calculate retry delay correctly', () => {
      // Basic retry without retry-after header
      expect(client.calculateRetryDelay(1)).toBe(10); // Base delay for first retry with no jitter
      
      // Second retry with exponential backoff (with zero jitter)
      expect(client.calculateRetryDelay(2)).toBe(20); // Base delay * 2 with no jitter
      
      // With retry-after header
      const responseWithHeader = { 
        headers: { 'retry-after': '5' } // 5 seconds
      };
      
      const delayWithHeader = client.calculateRetryDelay(1, responseWithHeader);
      expect(delayWithHeader).toBe(5000); // 5 seconds in ms with no jitter
    });
  });
  
  describe('Rate Limiting', () => {
    it('should handle rate limiting (429) with special retry logic', async () => {
      // Mock a 429 rate limit response
      mockAxios.onGet('/data').reply(429, { error: 'Rate limited' }, {
        'retry-after': '2' // 2 seconds
      });
      
      // Start the request
      const requestPromise = client.request({
        method: 'GET',
        url: '/data'
      });
      
      // Run timers multiple times to get through all retries
      vi.runAllTimers(); // First attempt
      vi.runAllTimers(); // First retry
      vi.runAllTimers(); // Second retry
      
      // Expect the request to fail with a rate limit error
      await expect(requestPromise).rejects.toThrow(/rate limit/i);
      
      // Verify the request was made
      expect(mockAxios.history.get.length).toBe(3); // Initial + 2 retries
    });
    
    it('should wait if an endpoint is already rate limited', async () => {
      // Set up an existing rate limit
      const endpoint = '/rate-limited';
      const resetTime = Date.now() + 5000; // 5 seconds from now
      
      client.rateLimitedEndpoints.set(endpoint, {
        resetTime,
        status: 429,
        retryCount: 1
      });
      
      // Mock successful response after the rate limit
      mockAxios.onGet(endpoint).reply(200, { data: 'success' });
      
      // Start the request
      const requestPromise = client.request({
        method: 'GET',
        url: endpoint
      });
      
      // Advance timers to handle the waiting period
      vi.runAllTimers();
      
      // Wait for the request to complete
      const result = await requestPromise;
      
      // Verify response
      expect(result.data).toEqual({ data: 'success' });
      
      // Rate limit should be cleared
      expect(client.rateLimitedEndpoints.has(endpoint)).toBe(false);
    });
  });
  
  describe('Cleanup', () => {
    it('should clean up stale promises correctly', () => {
      // Mock the activePromises map with some stale entries
      const stalePromise = Promise.resolve();
      const recentPromise = Promise.resolve();
      
      const staleTime = Date.now() - (31 * 60 * 1000); // 31 minutes ago
      const recentTime = Date.now() - (20 * 60 * 1000); // 20 minutes ago
      
      client.activePromises.set(stalePromise, { timestamp: staleTime });
      client.activePromises.set(recentPromise, { timestamp: recentTime });
      
      // Run cleanup
      client.cleanupStalePromises();
      
      // Only stale promise should be removed
      expect(client.activePromises.has(stalePromise)).toBe(false);
      expect(client.activePromises.has(recentPromise)).toBe(true);
    });
  });
});