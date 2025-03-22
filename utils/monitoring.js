import logger from './logger.js';

export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.state = {};
  }

  async executeRequest(serviceKey, requestFn) {
    if (!this.state[serviceKey]) {
      this.state[serviceKey] = {
        failures: 0,
        status: 'CLOSED',
        lastFailure: null,
        successCount: 0,
        lastSuccess: null
      };
    }

    const serviceState = this.state[serviceKey];

    if (serviceState.status === 'OPEN') {
      if (Date.now() - serviceState.lastFailure >= this.resetTimeout) {
        serviceState.status = 'HALF-OPEN';
      } else {
        throw new Error('Circuit breaker open');
      }
    }

    try {
      const result = await requestFn();
      this.onSuccess(serviceKey);
      return result;
    } catch (error) {
      this.onFailure(serviceKey);
      throw error;
    }
  }

  onFailure(serviceKey) {
    const serviceState = this.state[serviceKey];
    serviceState.failures++;
    serviceState.lastFailure = Date.now();

    if (serviceState.failures >= this.failureThreshold) {
      serviceState.status = 'OPEN';
      logger.warn(`Circuit breaker opened for ${serviceKey}`);
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
}