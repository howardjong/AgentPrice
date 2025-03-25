
/**
 * A dedicated rate limiter specifically for the Perplexity API
 * that respects the 5 requests per minute SLA for sonar-deep-research
 */
import logger from './logger.js';

class PerplexityRateLimiter {
  constructor(requestsPerMinute = 4, cooldownPeriod = 15000) {
    this.requestsPerMinute = requestsPerMinute; // Slightly less than the 5 limit for safety
    this.cooldownPeriod = cooldownPeriod; // Minimum time between requests in ms
    this.requestTimestamps = [];
    this.pendingRequests = [];
    this.processing = false;
  }

  /**
   * Schedules a task to be executed when a rate limit slot is available
   * @param {Function} task - The async function to execute
   * @returns {Promise} Promise that resolves with the task result
   */
  async schedule(task) {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push({ task, resolve, reject });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the queue of pending requests
   */
  async processQueue() {
    if (this.pendingRequests.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const waitTime = this.getWaitTime();
    
    if (waitTime > 0) {
      logger.info(`Rate limiting: waiting ${waitTime}ms before next Perplexity request`, {
        service: 'perplexity-rate-limiter',
        waitTime,
        queueLength: this.pendingRequests.length
      });
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const { task, resolve, reject } = this.pendingRequests.shift();
    
    try {
      // Record the request timestamp before executing
      this.recordRequest();
      
      // Execute the task
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      // Process the next request in the queue
      setTimeout(() => this.processQueue(), this.cooldownPeriod);
    }
  }

  /**
   * Record a request timestamp
   */
  recordRequest() {
    const now = Date.now();
    this.requestTimestamps.push(now);
    
    // Clean up old timestamps (older than 1 minute)
    const oneMinuteAgo = now - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp >= oneMinuteAgo);
  }

  /**
   * Calculate wait time before next request is allowed
   * @returns {number} Milliseconds to wait
   */
  getWaitTime() {
    const now = Date.now();
    
    // Clean up old timestamps
    const oneMinuteAgo = now - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp >= oneMinuteAgo);
    
    // If we haven't hit the limit, no need to wait
    if (this.requestTimestamps.length < this.requestsPerMinute) {
      return 0;
    }
    
    // Calculate when the oldest request will expire from our minute window
    const oldestTimestamp = this.requestTimestamps[0];
    const timeUntilSlotAvailable = (oldestTimestamp + 60000) - now;
    
    // Add cooldown period to ensure proper spacing
    return Math.max(timeUntilSlotAvailable, this.cooldownPeriod);
  }

  /**
   * Get current status of the rate limiter
   */
  getStatus() {
    return {
      activeRequests: this.requestTimestamps.length,
      queuedRequests: this.pendingRequests.length,
      isRateLimited: this.requestTimestamps.length >= this.requestsPerMinute,
      nextAvailableSlot: this.getWaitTime()
    };
  }
}

export default new PerplexityRateLimiter();
