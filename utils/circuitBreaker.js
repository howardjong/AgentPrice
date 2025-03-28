/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by stopping execution when a service is failing,
 * and allowing progressive recovery.
 */

import logger from './logger.js';

class CircuitBreaker {
  constructor(options = {}) {
    this.options = {
      // Number of failures before opening the circuit
      failureThreshold: options.failureThreshold || 3,
      // Time to wait before trying to close the circuit (ms)
      resetTimeout: options.resetTimeout || 30000,
      // Minimum number of requests to trigger circuit opening
      minRequestThreshold: options.minRequestThreshold || 5,
      // Whether to attempt progressive reset (half-open before fully closed)
      progressiveReset: options.progressiveReset !== false,
      // Interval to check circuit health (ms)
      healthCheckInterval: options.healthCheckInterval || 60000,
      // Timeout for requests (ms)
      requestTimeout: options.requestTimeout || 10000,
      // Number of successful requests in half-open state to close circuit
      successThresholdToClose: options.successThresholdToClose || 2
    };
    
    // Circuit state for each service
    this.circuits = new Map();
    
    // For tests - keep track of failure count
    this.failureCount = 0;
    this.name = options.name || 'default';
    this.state = {
      status: 'CLOSED'
    };
    
    // Set up health check interval if requested
    if (this.options.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(() => this.checkCircuits(), 
                                          this.options.healthCheckInterval);
      // Prevent timer from keeping Node.js process alive
      this.healthCheckTimer.unref();
    }
  }
  
  // Methods added for test compatibility
  isOpen() {
    return this.state.status === 'OPEN';
  }
  
  registerFailure() {
    this.failureCount++;
    logger.debug(`Circuit ${this.name} registered failure, count: ${this.failureCount}`);
    
    if (this.failureCount >= this.options.failureThreshold) {
      this.state.status = 'OPEN';
      this.lastFailureTime = Date.now();
      logger.info(`Circuit ${this.name} is now OPEN after ${this.failureCount} failures`);
    }
  }
  
  registerSuccess() {
    this.failureCount = 0;
    if (this.state.status === 'HALF-OPEN') {
      this.state.status = 'CLOSED';
      logger.info(`Circuit ${this.name} is now CLOSED after success in HALF-OPEN state`);
    }
  }
  
  getFailureCount() {
    return this.failureCount;
  }
  
  /**
   * Get or create a circuit for a service
   * @param {string} service - Service identifier
   * @returns {Object} Circuit state object
   */
  getCircuit(service) {
    if (!this.circuits.has(service)) {
      this.circuits.set(service, {
        state: 'CLOSED',
        failures: 0,
        successes: 0,
        lastFailure: null,
        lastReset: Date.now(),
        totalRequests: 0,
        lastTestedAt: null,
        cooldownEndTime: null,
        halfOpenResult: null
      });
    }
    
    return this.circuits.get(service);
  }
  
  /**
   * Check if a circuit is closed (requests can go through)
   * @param {string} service - Service identifier
   * @returns {boolean} Whether circuit is closed
   */
  isClosed(service) {
    const circuit = this.getCircuit(service);
    return circuit.state === 'CLOSED';
  }
  
  /**
   * Execute a request with circuit breaker protection
   * @param {string} service - Service identifier
   * @param {Function} requestFn - Function to execute
   * @returns {Promise<any>} Result of the request
   */
  async executeRequest(service, requestFn) {
    const circuit = this.getCircuit(service);
    circuit.totalRequests++;
    
    // Check if circuit is open
    if (circuit.state === 'OPEN') {
      // Check if cooldown period has elapsed
      if (circuit.cooldownEndTime && Date.now() >= circuit.cooldownEndTime) {
        // Move to half-open state
        circuit.state = 'HALF_OPEN';
        circuit.lastTestedAt = Date.now();
        logger.info(`Circuit for service ${service} is HALF_OPEN, testing request`);
      } else {
        // Still in cooldown, reject with circuit open error
        const cooldownRemaining = circuit.cooldownEndTime ? 
          Math.ceil((circuit.cooldownEndTime - Date.now()) / 1000) : 
          'unknown';
          
        logger.warn(`Circuit for ${service} is OPEN, request rejected (cooldown: ${cooldownRemaining}s)`);
        throw new Error(`Service ${service} is unavailable (circuit open). Please try again later.`);
      }
    }
    
    // Execute the request with timeout
    try {
      // Create a promise that resolves with the request or rejects after timeout
      const requestWithTimeout = Promise.race([
        requestFn(),
        new Promise((_, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Request to ${service} timed out after ${this.options.requestTimeout}ms`));
          }, this.options.requestTimeout);
          
          // Prevent timer from keeping Node.js process alive
          timeoutId.unref();
        })
      ]);
      
      // Execute the request
      const result = await requestWithTimeout;
      
      // Handle success based on circuit state
      if (circuit.state === 'HALF_OPEN') {
        // Increment success counter for half-open circuit
        circuit.successes++;
        
        // Check if we have enough successes to close the circuit
        if (circuit.successes >= this.options.successThresholdToClose) {
          circuit.state = 'CLOSED';
          circuit.failures = 0;
          circuit.successes = 0;
          circuit.lastReset = Date.now();
          logger.info(`Circuit for service ${service} is now CLOSED after successful tests`);
        } else {
          logger.debug(`Circuit for ${service} remains HALF_OPEN (successes: ${circuit.successes}/${this.options.successThresholdToClose})`);
        }
      } else if (circuit.state === 'CLOSED') {
        // Reset failure count on success if there were previous failures
        if (circuit.failures > 0) {
          circuit.failures = Math.max(0, circuit.failures - 1);
        }
      }
      
      return result;
    } catch (error) {
      // Handle failure
      circuit.failures++;
      circuit.lastFailure = Date.now();
      circuit.successes = 0;
      
      logger.error(`Request to ${service} failed: ${error.message}`);
      
      // Check if we need to open the circuit
      if (circuit.state === 'CLOSED' && 
          circuit.failures >= this.options.failureThreshold &&
          circuit.totalRequests >= this.options.minRequestThreshold) {
        
        circuit.state = 'OPEN';
        circuit.cooldownEndTime = Date.now() + this.options.resetTimeout;
        
        logger.warn(`Circuit for service ${service} is now OPEN due to ${circuit.failures} failures`);
      } else if (circuit.state === 'HALF_OPEN') {
        // Failed during test, go back to open state with a new cooldown
        circuit.state = 'OPEN';
        circuit.cooldownEndTime = Date.now() + this.options.resetTimeout;
        
        logger.warn(`Circuit for service ${service} returned to OPEN after failed test`);
      }
      
      // Rethrow the error
      throw error;
    }
  }
  
  /**
   * Manually open a circuit
   * @param {string} service - Service identifier
   * @param {number} resetTimeoutMs - Optional override for reset timeout
   */
  openCircuit(service, resetTimeoutMs) {
    const circuit = this.getCircuit(service);
    
    circuit.state = 'OPEN';
    circuit.cooldownEndTime = Date.now() + (resetTimeoutMs || this.options.resetTimeout);
    
    logger.warn(`Circuit for service ${service} manually opened`);
  }
  
  /**
   * Manually close a circuit
   * @param {string} service - Service identifier
   */
  closeCircuit(service) {
    const circuit = this.getCircuit(service);
    
    circuit.state = 'CLOSED';
    circuit.failures = 0;
    circuit.successes = 0;
    circuit.lastReset = Date.now();
    
    logger.info(`Circuit for service ${service} manually closed`);
  }
  
  /**
   * Reset all circuits
   */
  resetAll() {
    for (const [service, circuit] of this.circuits.entries()) {
      circuit.state = 'CLOSED';
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.lastReset = Date.now();
    }
    
    logger.info(`All circuits reset to CLOSED state`);
  }
  
  /**
   * Check all circuits for maintenance
   */
  checkCircuits() {
    const now = Date.now();
    
    for (const [service, circuit] of this.circuits.entries()) {
      // Auto-reset open circuits that have been in cooldown long enough
      if (circuit.state === 'OPEN' && circuit.cooldownEndTime && now >= circuit.cooldownEndTime) {
        if (this.options.progressiveReset) {
          circuit.state = 'HALF_OPEN';
          circuit.lastTestedAt = now;
          logger.info(`Circuit for service ${service} moved to HALF_OPEN during health check`);
        } else {
          circuit.state = 'CLOSED';
          circuit.failures = 0;
          circuit.lastReset = now;
          logger.info(`Circuit for service ${service} auto-reset to CLOSED during health check`);
        }
      }
      
      // Decrease failure count over time for closed circuits with past failures
      if (circuit.state === 'CLOSED' && circuit.failures > 0) {
        // Decrease failure count every 30 seconds
        const failureAgeSeconds = (now - circuit.lastFailure) / 1000;
        if (failureAgeSeconds > 30) {
          circuit.failures = Math.max(0, circuit.failures - 1);
          circuit.lastFailure = now; // Reset timer
          logger.debug(`Circuit for ${service} failures decreased to ${circuit.failures} due to time decay`);
        }
      }
    }
  }
  
  /**
   * Get status of all circuits
   * @returns {Object} Status of all circuits
   */
  getStatus() {
    const result = {};
    
    for (const [service, circuit] of this.circuits.entries()) {
      result[service] = {
        state: circuit.state,
        failures: circuit.failures,
        successes: circuit.state === 'HALF_OPEN' ? circuit.successes : 0,
        totalRequests: circuit.totalRequests,
        lastFailure: circuit.lastFailure,
        lastReset: circuit.lastReset,
        cooldownRemaining: circuit.cooldownEndTime && circuit.state === 'OPEN' ? 
          Math.max(0, Math.ceil((circuit.cooldownEndTime - Date.now()) / 1000)) : 
          0
      };
    }
    
    return result;
  }
  
  /**
   * Clean up resources
   */
  shutdown() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}

export default CircuitBreaker;