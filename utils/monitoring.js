
// Using ES modules as specified in package.json "type": "module"
import logger from './logger.js';

export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.rateLimitResetTimeout = options.rateLimitResetTimeout || 60000; // 1 minute
    this.state = {};
    this.monitorInterval = setInterval(() => this.logCircuitStatus(), 60000);
    this.pendingPromises = new Map(); // Track in-flight requests
    
    // Register for cleanup in tests
    if (typeof global !== 'undefined' && global.registerCircuitBreakerForCleanup) {
      global.registerCircuitBreakerForCleanup(this);
    }
  }

  async executeRequest(serviceKey, requestFn) {
    if (!this.state[serviceKey]) {
      this.state[serviceKey] = { 
        failures: 0, 
        lastFailure: null, 
        status: 'CLOSED',
        successCount: 0,
        failureCount: 0,
        lastSuccess: null,
        rateLimited: false,
        rateLimitResetTime: null,
        consecutiveRateLimits: 0
      };
    }

    const serviceState = this.state[serviceKey];
    
    // Check if service is rate limited
    if (serviceState.rateLimited) {
      const now = Date.now();
      if (now < serviceState.rateLimitResetTime) {
        const waitTime = serviceState.rateLimitResetTime - now;
        logger.warn(`Service ${serviceKey} is rate limited, waiting ${waitTime}ms before retry`, {
          resetTime: new Date(serviceState.rateLimitResetTime).toISOString(),
          consecutiveRateLimits: serviceState.consecutiveRateLimits
        });
        
        // For aggressive rate limiting, throw immediately instead of waiting
        if (serviceState.consecutiveRateLimits > 3) {
          throw new Error(`Service ${serviceKey} is rate limited (429) - too many consecutive rate limits`);
        }
        
        // Wait before proceeding
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Clear rate limit info after waiting
        serviceState.rateLimited = false;
      }
    }
    
    // Check circuit breaker status
    if (serviceState.status === 'OPEN') {
      const now = Date.now();
      if (now - serviceState.lastFailure > this.resetTimeout) {
        serviceState.status = 'HALF-OPEN';
        logger.info(`Circuit breaker half-open for ${serviceKey}`);
      } else {
        logger.warn(`Circuit breaker open for ${serviceKey}, rejecting request`);
        throw new Error(`Service ${serviceKey} is unavailable (circuit breaker open)`);
      }
    }

    // Create a cancellable request with timeout
    const requestId = Date.now() + '-' + Math.random().toString(36).substring(2, 10);
    // Adjust timeout based on service - deep research needs more time
    const timeoutMs = serviceKey.includes('deep') ? 300000 : 180000; // 5 min for deep research, 3 min for others
    
    try {
      // Track this request
      const timeout = setTimeout(() => {
        // If the request is still pending after timeout, consider it failed
        if (this.pendingPromises.has(requestId)) {
          logger.error(`Request ${requestId} for ${serviceKey} timed out after ${timeoutMs}ms`, {
            serviceKey,
            requestId,
            startTime: new Date(this.pendingPromises.get(requestId).startTime).toISOString(),
            elapsedTime: Date.now() - this.pendingPromises.get(requestId).startTime
          });
          
          // Attempt to cancel the request if possible
          const pendingRequest = this.pendingPromises.get(requestId);
          if (pendingRequest.cancel && typeof pendingRequest.cancel === 'function') {
            try {
              pendingRequest.cancel('Request timed out');
              logger.info(`Cancelled request ${requestId} for ${serviceKey}`);
            } catch (cancelError) {
              logger.warn(`Failed to cancel request ${requestId}`, { error: cancelError.message });
            }
          }
          
          this.pendingPromises.delete(requestId);
        }
      }, timeoutMs);
      
      // Store the request in pending map
      this.pendingPromises.set(requestId, {
        serviceKey,
        startTime: Date.now(),
        timeout
      });
      
      // Execute the request function
      const result = await Promise.resolve(requestFn());
      
      // Clean up tracking
      if (this.pendingPromises.has(requestId)) {
        clearTimeout(this.pendingPromises.get(requestId).timeout);
        this.pendingPromises.delete(requestId);
      }
      
      // Record success
      this.onSuccess(serviceKey);
      return result;
    } catch (error) {
      // Clean up tracking
      if (this.pendingPromises.has(requestId)) {
        clearTimeout(this.pendingPromises.get(requestId).timeout);
        this.pendingPromises.delete(requestId);
      }
      
      // Special handling for rate limit errors
      if (error.response?.status === 429) {
        this.onRateLimit(serviceKey, error);
        throw new Error(`Service ${serviceKey} rate limited (HTTP 429). Please try again later.`);
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT' || error.message.includes('timeout')) {
        this.onFailure(serviceKey, error);
        throw new Error(`Service ${serviceKey} request timed out after ${timeoutMs/1000} seconds. This may indicate server overload or connectivity issues.`);
      } else {
        this.onFailure(serviceKey, error);
        throw error;
      }
    }
  }

  onSuccess(serviceKey) {
    const serviceState = this.state[serviceKey];
    serviceState.successCount++;
    serviceState.lastSuccess = Date.now();
    
    // Reset rate limit counter on success
    serviceState.consecutiveRateLimits = 0;
    
    if (serviceState.status === 'HALF-OPEN') {
      serviceState.status = 'CLOSED';
      serviceState.failures = 0;
      logger.info(`Circuit breaker closed for ${serviceKey}`);
    }
  }
  
  onRateLimit(serviceKey, error) {
    const serviceState = this.state[serviceKey];
    serviceState.rateLimited = true;
    serviceState.consecutiveRateLimits = (serviceState.consecutiveRateLimits || 0) + 1;
    
    // Extract retry-after header or use exponential backoff
    let retryAfterMs = 60000; // Default 1 minute
    
    if (error.response?.headers && error.response.headers['retry-after']) {
      const retryAfter = error.response.headers['retry-after'];
      retryAfterMs = parseInt(retryAfter) * 1000;
    } else {
      // Exponential backoff based on consecutive rate limits
      retryAfterMs = Math.min(
        this.rateLimitResetTimeout * Math.pow(2, serviceState.consecutiveRateLimits - 1),
        300000 // Cap at 5 minutes
      );
    }
    
    // Add jitter to prevent thundering herd
    retryAfterMs = retryAfterMs + (Math.random() * 5000);
    
    serviceState.rateLimitResetTime = Date.now() + retryAfterMs;
    
    logger.warn(`Service ${serviceKey} rate limited (429)`, {
      resetTime: new Date(serviceState.rateLimitResetTime).toISOString(),
      retryAfterMs,
      consecutiveRateLimits: serviceState.consecutiveRateLimits
    });
    
    // If we get too many consecutive rate limits, open the circuit breaker
    if (serviceState.consecutiveRateLimits >= 5) {
      serviceState.status = 'OPEN';
      serviceState.lastFailure = Date.now();
      
      // Use a longer reset timeout for rate limit-induced circuit breaking
      const extendedTimeout = this.resetTimeout * 2;
      logger.error(`Circuit breaker opened due to excessive rate limits for ${serviceKey}`, {
        consecutiveRateLimits: serviceState.consecutiveRateLimits,
        resetTimeout: extendedTimeout
      });
    }
  }

  onFailure(serviceKey, error) {
    const serviceState = this.state[serviceKey];
    serviceState.failures++;
    serviceState.failureCount++;
    serviceState.lastFailure = Date.now();
    
    logger.error(`Service ${serviceKey} call failed`, {
      service: serviceKey,
      error: error.message,
      failureCount: serviceState.failures
    });
    
    if (serviceState.status !== 'OPEN' && serviceState.failures >= this.failureThreshold) {
      serviceState.status = 'OPEN';
      logger.warn(`Circuit breaker opened for ${serviceKey}`, {
        failureThreshold: this.failureThreshold,
        resetTimeout: this.resetTimeout
      });
    }
  }
  
  logCircuitStatus() {
    const now = Date.now();
    let totalCircuitsOpen = 0;
    let totalRateLimitedServices = 0;
    
    for (const [serviceKey, state] of Object.entries(this.state)) {
      if (state.status === 'OPEN') totalCircuitsOpen++;
      if (state.rateLimited) totalRateLimitedServices++;
      
      // Calculate time since last activity
      const timeSinceSuccess = state.lastSuccess ? Math.round((now - state.lastSuccess) / 1000) : null;
      const timeSinceFailure = state.lastFailure ? Math.round((now - state.lastFailure) / 1000) : null;
      
      // Only log when there's activity or issues
      const shouldDetailLog = state.status !== 'CLOSED' || 
                            state.rateLimited || 
                            state.consecutiveRateLimits > 0 ||
                            state.failures > 0;
      
      const logMethod = shouldDetailLog ? 'info' : 'debug';
      
      logger[logMethod](`Circuit status for ${serviceKey}`, {
        status: state.status,
        failures: state.failures,
        successCount: state.successCount,
        failureCount: state.failureCount,
        successRate: state.successCount > 0 ? Math.round((state.successCount / (state.successCount + state.failureCount)) * 100) + '%' : '0%',
        rateLimited: state.rateLimited || false,
        consecutiveRateLimits: state.consecutiveRateLimits || 0,
        rateLimitResetTime: state.rateLimitResetTime ? new Date(state.rateLimitResetTime).toISOString() : null,
        rateLimitResetIn: state.rateLimitResetTime ? Math.round((state.rateLimitResetTime - now) / 1000) + 's' : null,
        lastSuccess: state.lastSuccess ? new Date(state.lastSuccess).toISOString() : null,
        timeSinceSuccess: timeSinceSuccess !== null ? timeSinceSuccess + 's' : 'never',
        lastFailure: state.lastFailure ? new Date(state.lastFailure).toISOString() : null,
        timeSinceFailure: timeSinceFailure !== null ? timeSinceFailure + 's' : 'never',
        pendingRequests: [...this.pendingPromises.values()].filter(req => req.serviceKey === serviceKey).length
      });
    }
    
    // Log summary of all circuits
    logger.info('Circuit breaker summary', {
      totalCircuits: Object.keys(this.state).length,
      openCircuits: totalCircuitsOpen,
      rateLimitedServices: totalRateLimitedServices,
      pendingRequests: this.pendingPromises.size
    });
  }
  
  reset(serviceKey) {
    if (this.state[serviceKey]) {
      this.state[serviceKey] = {
        failures: 0,
        lastFailure: null, 
        status: 'CLOSED',
        successCount: 0,
        failureCount: 0,
        lastSuccess: null,
        rateLimited: false,
        rateLimitResetTime: null,
        consecutiveRateLimits: 0
      };
      logger.info(`Circuit breaker reset for ${serviceKey}`);
    }
  }
  
  stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    // Clean up any pending promises
    this.pendingPromises.forEach(request => {
      clearTimeout(request.timeout);
    });
    this.pendingPromises.clear();
  }
}
