/**
 * @file apiClient.minimal.vitest.js
 * @description Focused minimal tests for the RobustAPIClient utility
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
import axios from 'axios';

describe('RobustAPIClient', () => {
  let apiClient;
  let axiosCreateSpy;
  let axiosInstanceMock;

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
  });

  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('constructor', () => {
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
  });
  
  describe('shouldRetry', () => {
    it('should retry network errors', () => {
      const error = new Error('Network Error');
      expect(apiClient.shouldRetry(error)).toBe(true);
    });
    
    it('should retry on specific status codes', () => {
      expect(apiClient.shouldRetry({ response: { status: 429 } })).toBe(true);
      expect(apiClient.shouldRetry({ response: { status: 503 } })).toBe(true);
    });
    
    it('should not retry on other status codes', () => {
      expect(apiClient.shouldRetry({ response: { status: 400 } })).toBe(false);
      expect(apiClient.shouldRetry({ response: { status: 401 } })).toBe(false);
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
  });
});