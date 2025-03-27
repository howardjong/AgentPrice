
// Using ES modules as specified in package.json "type": "module"
import axios from 'axios';
import logger from './logger.js';
import { CircuitBreaker } from './monitoring.js';

// Global set to track and manage all active API promises
const globalActivePromises = new Set();

// Global unhandled rejection handler
if (typeof process !== 'undefined') {
  process.on('unhandledRejection', (reason, promise) => {
    // Check if this is one of our tracked promises
    if (globalActivePromises.has(promise)) {
      logger.error('Caught unhandled promise rejection in API client', { 
        reason: reason?.message || String(reason),
        stack: reason?.stack
      });
      // Remove from tracked set to prevent memory leaks
      globalActivePromises.delete(promise);
    }
  });
}

export class RobustAPIClient {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 30000;
    this.retryStatusCodes = options.retryStatusCodes || [429, 500, 502, 503, 504];
    this.retryDelay = options.retryDelay || 1000;
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
    this.activePromises = new Map(); // Track promises with metadata
    this.rateLimitedEndpoints = new Map(); // Track rate-limited endpoints
    
    // Enable resource usage tracking
    this.enableMetrics = options.enableMetrics !== false;
    
    // Import the performance monitor lazily to avoid circular dependencies
    if (this.enableMetrics) {
      import('../utils/performanceMonitor.js').then(module => {
        this.performanceMonitor = module.default;
      }).catch(err => {
        logger.warn('Failed to import performance monitor', { error: err.message });
        this.performanceMonitor = null;
      });
    }
    
    // Reduce cleanup frequency - only clean stale promises every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupStalePromises(), 300000);
  }

  cleanupStalePromises() {
    const now = Date.now();
    let cleanedCount = 0;
    
    this.activePromises.forEach((metadata, promise) => {
      // If promise is older than 30 minutes, consider it stale
      if (now - metadata.timestamp > 30 * 60 * 1000) {
        this.activePromises.delete(promise);
        globalActivePromises.delete(promise);
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} stale API promises`, {
        remaining: this.activePromises.size
      });
    }
  }
  
  // Safely track a promise with proper cleanup
  trackPromise(promise, metadata = {}) {
    const enhancedMetadata = {
      ...metadata,
      timestamp: Date.now()
    };
    
    this.activePromises.set(promise, enhancedMetadata);
    globalActivePromises.add(promise);
    
    // Ensure promise is removed from tracking when settled
    promise.finally(() => {
      this.activePromises.delete(promise);
      globalActivePromises.delete(promise);
    });
    
    return promise;
  }

  async request(config) {
    // Track performance if monitor is available
    let tracker = null;
    
    if (this.enableMetrics && this.performanceMonitor) {
      const endpointKey = config.url.split('?')[0].split('/').pop();
      tracker = this.performanceMonitor.startTracking('api', `${config.method}:${endpointKey}`);
    }
    
    const requestConfig = {
      ...config,
      timeout: this.timeout,
      timestamp: Date.now()
    };

    const serviceKey = `${config.method}:${config.url}`;
    const endpointKey = config.url.split('?')[0]; // Base URL without query params
    
    // Check if endpoint is rate limited
    if (this.rateLimitedEndpoints.has(endpointKey)) {
      const limitInfo = this.rateLimitedEndpoints.get(endpointKey);
      const now = Date.now();
      
      if (now < limitInfo.resetTime) {
        const waitTime = limitInfo.resetTime - now;
        logger.info(`Endpoint ${endpointKey} is rate limited, waiting ${waitTime}ms before retry`, {
          resetTime: new Date(limitInfo.resetTime).toISOString()
        });
        
        // Wait before proceeding
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      // Clear rate limit info after waiting
      this.rateLimitedEndpoints.delete(endpointKey);
    }
    
    try {
      // Create the promise with circuit breaker
      const promise = this.circuitBreaker.executeRequest(serviceKey, async () => {
        let retries = 0;
        const startTime = Date.now();
        
        while (true) {
          try {
            const response = await axios(requestConfig);
            
            const duration = Date.now() - startTime;
            logger.debug(`API request succeeded in ${duration}ms`, {
              url: config.url,
              method: config.method,
              duration,
              retries
            });
            
            return response;
          } catch (error) {
            // Special handling for rate limit errors
            if (error.response?.status === 429) {
              // Use improved retry delay calculation that checks headers
              const retryDelayMs = this.calculateRetryDelay(retries + 1, error.response);
              
              // Track this rate-limited endpoint to avoid immediate retries
              this.rateLimitedEndpoints.set(endpointKey, {
                resetTime: Date.now() + retryDelayMs,
                status: error.response.status,
                retryCount: (this.rateLimitedEndpoints.get(endpointKey)?.retryCount || 0) + 1
              });
              
              if (retries >= this.maxRetries) {
                logger.warn(`Rate limit (429) reached maximum retries for ${config.url}`, { 
                  retries, 
                  retryDelayMs,
                  totalEndpointRetries: this.rateLimitedEndpoints.get(endpointKey)?.retryCount || 1
                });
                throw error;
              }
              
              retries++;
              logger.info(`Rate limited (429), waiting ${retryDelayMs}ms before retry ${retries}`, {
                url: config.url,
                retryDelayMs,
                retryAfterHeader: error.response.headers['retry-after'] || 'not provided'
              });
              
              await new Promise(resolve => setTimeout(resolve, retryDelayMs));
              continue;
            }
            
            const shouldRetry = this.shouldRetryRequest(error, retries);
            
            if (!shouldRetry) {
              const duration = Date.now() - startTime;
              logger.error('API request failed', {
                url: config.url,
                method: config.method,
                error: error.message,
                status: error.response?.status,
                duration,
                retries
              });
              throw error;
            }

            retries++;
            const delay = this.calculateRetryDelay(retries);
            logger.info(`Retrying request (attempt ${retries})`, {
              url: config.url,
              delay,
              error: error.message,
              status: error.response?.status
            });
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      });
      
      // Track the promise with proper cleanup
      return this.trackPromise(promise, {
        url: config.url,
        method: config.method,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Fatal error in API client', {
        url: config.url,
        method: config.method,
        error: error.message
      });
      
      // Stop tracking with error status if performance monitor is being used
      if (tracker) {
        tracker.stop({
          status: 'error',
          errorMessage: error.message
        });
      }
      
      throw error;
    } finally {
      // If tracking was started but not stopped (edge case)
      if (tracker) {
        tracker.stop({
          status: 'completed'
        });
      }
    }
  }

  shouldRetryRequest(error, retries) {
    if (retries >= this.maxRetries) {
      return false;
    }

    // 429 is handled separately with special logic
    if (error.response?.status === 429) {
      return true;
    }

    if (error.response && this.retryStatusCodes.includes(error.response.status)) {
      return true;
    }

    if (error.code === 'ECONNABORTED' || !error.response) {
      return true;
    }

    return false;
  }

  calculateRetryDelay(retries, response = null) {
    // Check for Retry-After header for more accurate retry timing
    if (response?.headers?.['retry-after']) {
      const retryAfter = parseInt(response.headers['retry-after'], 10);
      if (!isNaN(retryAfter)) {
        // Convert to milliseconds and add small jitter
        const retryMs = retryAfter * 1000;
        const jitter = Math.random() * 0.1 * retryMs;
        logger.info(`Using retry-after header: ${retryAfter}s (${retryMs + jitter}ms with jitter)`);
        return retryMs + jitter;
      }
    }
    
    // Standard exponential backoff if no header
    const baseDelay = this.retryDelay * Math.pow(2, retries - 1);
    // Add randomization to prevent thundering herd problem
    const jitter = Math.random() * 0.5 * baseDelay;
    
    // More aggressive backoff for higher retry counts
    let delay = baseDelay + jitter;
    if (retries > 2) {
      delay *= 1.5; // Add 50% more time for 3+ retries
    }
    
    return Math.min(delay, 300000); // Cap at 5 minutes
  }
  
  // Clean up resources when client is no longer needed
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Clear all tracked promises
    this.activePromises.clear();
  }
}
