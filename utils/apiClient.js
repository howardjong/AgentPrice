
// Using ES modules as specified in package.json "type": "module"
import axios from 'axios';
import logger from './logger.js';
import { CircuitBreaker } from './monitoring.js';

export class RobustAPIClient {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 30000;
    this.retryStatusCodes = options.retryStatusCodes || [429, 500, 502, 503, 504];
    this.retryDelay = options.retryDelay || 1000;
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
  }

  async request(config) {
    const requestConfig = {
      ...config,
      timeout: this.timeout,
      // Add timestamp to track request lifecycle
      timestamp: Date.now()
    };

    const serviceKey = `${config.method}:${config.url}`;
    
    // Track all active promises for debugging
    const activePromises = new Set();
    
    try {
      // Create the promise and track it
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
      
      // Track the promise and remove it when done
      activePromises.add(promise);
      promise.finally(() => activePromises.delete(promise));
      
      // Return the tracked promise
      return promise;
    } catch (error) {
      logger.error('Fatal error in API client', {
        url: config.url,
        method: config.method,
        error: error.message
      });
      throw error;
    }
  }

  shouldRetryRequest(error, retries) {
    if (retries >= this.maxRetries) {
      return false;
    }

    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      this.retryDelay = (retryAfter ? parseInt(retryAfter) * 1000 : 60000);
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

  calculateRetryDelay(retries) {
    const baseDelay = this.retryDelay * Math.pow(2, retries - 1);
    const jitter = Math.random() * 0.5 * baseDelay;
    return baseDelay + jitter;
  }
}
