/**
 * apiClient.js
 * 
 * A robust API client utility for making HTTP requests to external services.
 * Includes built-in retry logic, circuit breaking, and error handling.
 */

import axios from 'axios';
import logger from './logger.js';
import CircuitBreaker from './circuitBreaker.js';

class RobustAPIClient {
  /**
   * Create a new API client instance
   * @param {Object} options - Configuration options
   * @param {string} options.baseURL - The base URL for all requests
   * @param {Object} options.headers - Default headers to include with all requests
   * @param {number} options.timeout - Request timeout in milliseconds (default: 30000)
   * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
   * @param {number} options.retryDelay - Base delay between retries in milliseconds (default: 1000)
   * @param {number} options.circuitBreakerThreshold - Number of failures before circuit breaker trips (default: 5)
   * @param {number} options.circuitBreakerResetTimeout - Time in milliseconds before circuit breaker resets (default: 30000)
   */
  constructor(options = {}) {
    this.options = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      circuitBreakerResetTimeout: 30000,
      ...options
    };
    
    // Create axios instance with default configuration
    this.axios = axios.create({
      baseURL: options.baseURL,
      headers: options.headers || {},
      timeout: this.options.timeout
    });
    
    // Setup circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: this.options.circuitBreakerThreshold,
      resetTimeout: this.options.circuitBreakerResetTimeout,
      name: options.baseURL || 'apiClient'
    });
    
    // Internal state
    this.name = options.name || 'API Client';
  }
  
  /**
   * Make a request with retry logic and circuit breaking
   * @param {Object} config - Axios request configuration
   * @returns {Promise<Object>} - The response data
   */
  async request(config) {
    // Check if circuit breaker is open
    if (this.circuitBreaker.isOpen()) {
      logger.warn(`${this.name}: Circuit breaker open, request blocked`, {
        component: 'apiClient',
        url: config.url
      });
      throw new Error(`Circuit breaker open for ${this.name}`);
    }
    
    let lastError = null;
    let attempt = 0;
    
    while (attempt <= this.options.maxRetries) {
      try {
        // Make the request
        const response = await this.axios({
          ...config,
          validateStatus: null  // Don't throw on non-2xx responses
        });
        
        // Check if the response is successful
        if (response.status >= 200 && response.status < 300) {
          // Success - record the success and return the data
          this.circuitBreaker.recordSuccess();
          return response.data;
        }
        
        // Handle specific error statuses
        if (response.status === 429) {
          // Rate limit error - calculate backoff
          const retryAfter = response.headers['retry-after'] ? 
            parseInt(response.headers['retry-after'], 10) * 1000 : 
            this.calculateBackoff(attempt);
            
          logger.warn(`${this.name}: Rate limit exceeded, retrying in ${retryAfter}ms`, {
            component: 'apiClient',
            url: config.url,
            attempt: attempt + 1
          });
          
          // Wait before retrying
          await this.delay(retryAfter);
          attempt++;
          continue;
        }
        
        // For other error statuses, handle as failures
        const error = new Error(`HTTP error ${response.status}: ${response.statusText}`);
        error.response = response;
        throw error;
      } catch (error) {
        lastError = error;
        
        // Record the failure in the circuit breaker
        this.circuitBreaker.recordFailure();
        
        // Check if we should retry
        if (this.shouldRetry(error) && attempt < this.options.maxRetries) {
          const backoff = this.calculateBackoff(attempt);
          
          logger.warn(`${this.name}: Request failed, retrying in ${backoff}ms`, {
            component: 'apiClient',
            url: config.url,
            attempt: attempt + 1,
            error: error.message
          });
          
          // Wait before retrying
          await this.delay(backoff);
          attempt++;
        } else {
          // No more retries, rethrow the error
          break;
        }
      }
    }
    
    // All retries failed, throw the last error
    logger.error(`${this.name}: All retries failed`, {
      component: 'apiClient',
      url: config.url,
      error: lastError
    });
    
    throw lastError;
  }
  
  /**
   * Helper to calculate exponential backoff
   * @param {number} attempt - The current attempt number (starting from 0)
   * @returns {number} - The backoff time in milliseconds
   */
  calculateBackoff(attempt) {
    // Exponential backoff with jitter
    const baseDelay = this.options.retryDelay;
    const maxDelay = 60000; // Cap at 1 minute
    
    // Calculate exponential delay: base * 2^attempt
    let delay = baseDelay * Math.pow(2, attempt);
    
    // Add jitter (up to 30% random variance)
    const jitter = delay * 0.3 * Math.random();
    delay += jitter;
    
    // Cap the delay
    return Math.min(delay, maxDelay);
  }
  
  /**
   * Helper to decide if a request should be retried
   * @param {Error} error - The error that occurred
   * @returns {boolean} - Whether the request should be retried
   */
  shouldRetry(error) {
    // Network errors are always retriable
    if (!error.response) {
      return true;
    }
    
    const status = error.response.status;
    
    // Retry for certain status codes
    return (
      status === 408 || // Request Timeout
      status === 429 || // Too Many Requests
      status === 500 || // Internal Server Error
      status === 502 || // Bad Gateway
      status === 503 || // Service Unavailable
      status === 504    // Gateway Timeout
    );
  }
  
  /**
   * Helper to create a delay promise
   * @param {number} ms - Time to delay in milliseconds
   * @returns {Promise} - A promise that resolves after the delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Convenience method for GET requests
   * @param {string} url - The URL to request
   * @param {Object} [config] - Additional Axios request config
   * @returns {Promise<Object>} - The response data
   */
  async get(url, config = {}) {
    return this.request({
      ...config,
      method: 'get',
      url
    });
  }
  
  /**
   * Convenience method for POST requests
   * @param {string} url - The URL to request
   * @param {Object} data - The data to send
   * @param {Object} [config] - Additional Axios request config
   * @returns {Promise<Object>} - The response data
   */
  async post(url, data, config = {}) {
    return this.request({
      ...config,
      method: 'post',
      url,
      data
    });
  }
}

export default RobustAPIClient;