
import logger from './logger.js';

export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.state = {};
    this.monitorInterval = setInterval(() => this.logCircuitStatus(), 60000);
  }

  async executeRequest(serviceKey, requestFn) {
    if (!this.state[serviceKey]) {
      this.state[serviceKey] = { 
        failures: 0, 
        lastFailure: null, 
        status: 'CLOSED',
        successCount: 0,
        failureCount: 0,
        lastSuccess: null
      };
    }

    const serviceState = this.state[serviceKey];
    
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

    try {
      const result = await requestFn();
      this.onSuccess(serviceKey);
      return result;
    } catch (error) {
      this.onFailure(serviceKey, error);
      throw error;
    }
  }

  onSuccess(serviceKey) {
    const serviceState = this.state[serviceKey];
    serviceState.successCount++;
    serviceState.lastSuccess = Date.now();
    
    if (serviceState.status === 'HALF-OPEN') {
      serviceState.status = 'CLOSED';
      serviceState.failures = 0;
      logger.info(`Circuit breaker closed for ${serviceKey}`);
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
    for (const [serviceKey, state] of Object.entries(this.state)) {
      logger.debug(`Circuit status for ${serviceKey}`, {
        status: state.status,
        failures: state.failures,
        successCount: state.successCount,
        failureCount: state.failureCount,
        lastSuccess: state.lastSuccess ? new Date(state.lastSuccess).toISOString() : null,
        lastFailure: state.lastFailure ? new Date(state.lastFailure).toISOString() : null
      });
    }
  }
  
  reset(serviceKey) {
    if (this.state[serviceKey]) {
      this.state[serviceKey] = {
        failures: 0,
        lastFailure: null,
        status: 'CLOSED',
        successCount: 0,
        failureCount: 0,
        lastSuccess: null
      };
      logger.info(`Circuit breaker reset for ${serviceKey}`);
    }
  }
  
  stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }
}
