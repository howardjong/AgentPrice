/**
 * circuitBreaker.js
 * 
 * Implements the Circuit Breaker pattern for fault tolerance.
 * This pattern prevents an application from repeatedly trying to execute an operation
 * that's likely to fail, allowing it to recover and conserve resources.
 */

import logger from './logger.js';

// Circuit states
const STATE = {
  CLOSED: 'CLOSED',   // Normal operation, requests allowed
  OPEN: 'OPEN',       // Circuit is open, requests are blocked
  HALF_OPEN: 'HALF_OPEN' // Testing if the service is back, limited requests allowed
};

class CircuitBreaker {
  /**
   * Create a new circuit breaker instance
   * @param {Object} options - Configuration options
   * @param {number} options.failureThreshold - Number of failures before opening the circuit (default: 5)
   * @param {number} options.resetTimeout - Time in milliseconds before trying to reset the circuit (default: 30000)
   * @param {number} options.successThreshold - Number of consecutive successes before closing the circuit (default: 2)
   * @param {string} options.name - Name for this circuit breaker instance (for logging)
   */
  constructor(options = {}) {
    this.options = {
      failureThreshold: 5,
      resetTimeout: 30000, // 30 seconds
      successThreshold: 2,
      ...options
    };
    
    this.name = options.name || 'CircuitBreaker';
    
    // Initialize state
    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    
    // Track historical state changes
    this.stateHistory = [{
      timestamp: Date.now(),
      state: this.state,
      reason: 'Initialized'
    }];
    
    logger.info(`${this.name}: Circuit breaker initialized in ${this.state} state`, {
      component: 'circuitBreaker'
    });
  }
  
  /**
   * Records a successful operation, potentially closing the circuit
   */
  recordSuccess() {
    this.failureCount = 0;
    
    if (this.state === STATE.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.options.successThreshold) {
        this.transitionTo(STATE.CLOSED, 'Success threshold reached');
      }
    }
  }
  
  /**
   * Records a failed operation, potentially opening the circuit
   */
  recordFailure() {
    this.failureCount++;
    this.successCount = 0;
    
    if (this.state === STATE.CLOSED && 
        this.failureCount >= this.options.failureThreshold) {
      this.transitionTo(STATE.OPEN, 'Failure threshold reached');
      
      // Schedule the circuit to half-open after the reset timeout
      this.nextAttempt = Date.now() + this.options.resetTimeout;
    } else if (this.state === STATE.HALF_OPEN) {
      this.transitionTo(STATE.OPEN, 'Failed in half-open state');
      this.nextAttempt = Date.now() + this.options.resetTimeout;
    }
  }
  
  /**
   * Checks if the circuit is open and requests should be blocked
   * @returns {boolean} - True if circuit is open and requests should be blocked
   */
  isOpen() {
    if (this.state === STATE.OPEN) {
      // Check if we can transition to half-open
      if (this.nextAttempt <= Date.now()) {
        this.transitionTo(STATE.HALF_OPEN, 'Reset timeout elapsed');
      }
    }
    
    return this.state === STATE.OPEN;
  }
  
  /**
   * Forces the circuit to a specific state
   * @param {string} state - The state to transition to (use STATE constants)
   * @param {string} reason - The reason for the forced transition
   */
  forceState(state, reason = 'Manually forced') {
    if (Object.values(STATE).includes(state)) {
      this.transitionTo(state, reason);
      
      // Reset counters
      this.failureCount = 0;
      this.successCount = 0;
      
      if (state === STATE.OPEN) {
        this.nextAttempt = Date.now() + this.options.resetTimeout;
      }
    } else {
      logger.error(`${this.name}: Invalid state: ${state}`, {
        component: 'circuitBreaker'
      });
    }
  }
  
  /**
   * Gets the current state of the circuit
   * @returns {string} - The current state (OPEN, CLOSED, or HALF_OPEN)
   */
  getState() {
    return this.state;
  }
  
  /**
   * Gets statistics about this circuit breaker
   * @returns {Object} - Circuit breaker statistics
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      stateHistory: this.stateHistory.slice(-10) // Last 10 state changes
    };
  }
  
  /**
   * Helper to transition between states
   * @param {string} newState - The new state
   * @param {string} reason - The reason for the state change
   * @private
   */
  transitionTo(newState, reason) {
    if (this.state !== newState) {
      logger.info(`${this.name}: Circuit state change from ${this.state} to ${newState} (${reason})`, {
        component: 'circuitBreaker'
      });
      
      // Update state
      this.state = newState;
      
      // Record state change in history
      this.stateHistory.push({
        timestamp: Date.now(),
        state: newState,
        reason
      });
      
      // Keep history at a reasonable size
      if (this.stateHistory.length > 100) {
        this.stateHistory = this.stateHistory.slice(-100);
      }
      
      // Reset success count on any transition except to HALF_OPEN
      if (newState !== STATE.HALF_OPEN) {
        this.successCount = 0;
      }
    }
  }
}

export { CircuitBreaker };
export default CircuitBreaker;