class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.state = {};
  }

  async executeRequest(serviceKey, requestFn) {
    if (this.isOpen(serviceKey)) {
      throw new Error(`Circuit breaker open for ${serviceKey}`);
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

  isOpen(serviceKey) {
    if (!this.state[serviceKey]) {
      return false;
    }
    const { failures, lastFailure } = this.state[serviceKey];
    if (failures >= this.failureThreshold) {
      const timeSinceLastFailure = Date.now() - lastFailure;
      return timeSinceLastFailure < this.resetTimeout;
    }
    return false;
  }

  onSuccess(serviceKey) {
    if (this.state[serviceKey]) {
      this.state[serviceKey].failures = 0;
    }
  }

  onFailure(serviceKey) {
    if (!this.state[serviceKey]) {
      this.state[serviceKey] = { failures: 0 };
    }
    this.state[serviceKey].failures += 1;
    this.state[serviceKey].lastFailure = Date.now();
  }
}

module.exports = { logger, CircuitBreaker };