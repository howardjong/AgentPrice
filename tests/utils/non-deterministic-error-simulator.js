/**
 * Non-Deterministic Error Simulator
 * 
 * This utility library provides tools for simulating various types of non-deterministic
 * errors that are difficult to reproduce in a controlled test environment.
 */

/**
 * Utility class for simulating non-deterministic errors in a controlled way
 */
export class NonDeterministicErrorSimulator {
  /**
   * Simulates network flakiness with a configurable failure rate
   * 
   * @param {Function} operation - Async function to execute with simulated network issues
   * @param {Object} options - Configuration options
   * @param {number} [options.failureRate=0.3] - Probability of failure (0-1)
   * @param {number} [options.retries=3] - Maximum number of retries
   * @param {number} [options.retryDelay=100] - Base delay between retries in ms
   * @param {boolean} [options.exponentialBackoff=true] - Whether to use exponential backoff
   * @returns {Promise<any>} - Result of the operation after handling simulated failures
   */
  static async simulateNetworkFlakiness(operation, options = {}) {
    const { 
      failureRate = 0.3, 
      retries = 3, 
      retryDelay = 100,
      exponentialBackoff = true
    } = options;
    
    let attempts = 0;
    
    while (attempts <= retries) {
      try {
        // Randomly fail based on the failure rate
        if (Math.random() < failureRate && attempts < retries) {
          const error = new Error('Network error (simulated)');
          error.code = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'][Math.floor(Math.random() * 3)];
          error.isSimulated = true;
          throw error;
        }
        
        // Execute the actual operation
        return await operation();
      } catch (error) {
        attempts++;
        
        // Only retry if we haven't exceeded retry count
        if (attempts > retries || !error.isSimulated) {
          throw error;
        }
        
        // Determine delay before retry
        const delay = exponentialBackoff 
          ? retryDelay * Math.pow(2, attempts - 1) 
          : retryDelay;
        
        // Apply jitter to prevent thundering herd
        const jitteredDelay = delay * (0.8 + Math.random() * 0.4);
        
        // Wait before retry
        await new Promise(r => setTimeout(r, jitteredDelay));
      }
    }
  }
  
  /**
   * Simulates race conditions by introducing random delays to concurrent operations
   * 
   * @param {Function[]} operations - Array of async functions to execute concurrently
   * @param {Object} options - Configuration options
   * @param {number} [options.maxDelay=100] - Maximum random delay in ms
   * @param {number} [options.minDelay=0] - Minimum random delay in ms
   * @returns {Promise<any[]>} - Results of all operations
   */
  static async simulateRaceCondition(operations, options = {}) {
    const { 
      maxDelay = 100,
      minDelay = 0
    } = options;
    
    // Wrap each operation with a random delay
    const delayedOps = operations.map(op => async () => {
      const delay = minDelay + Math.random() * (maxDelay - minDelay);
      await new Promise(r => setTimeout(r, delay));
      return op();
    });
    
    // Execute all operations concurrently
    return Promise.all(delayedOps.map(op => op()));
  }
  
  /**
   * Simulates resource exhaustion errors
   * 
   * @param {Function} operation - Async function to execute
   * @param {string} resource - Name of the resource (for error message)
   * @param {Object} options - Configuration options
   * @param {number} [options.probability=0.3] - Probability of failure (0-1)
   * @param {string} [options.errorCode='RESOURCE_EXHAUSTED'] - Error code to use
   * @returns {Promise<any>} - Result of the operation or throws simulated error
   */
  static async simulateResourceExhaustion(operation, resource, options = {}) {
    const { 
      probability = 0.3,
      errorCode = 'RESOURCE_EXHAUSTED'
    } = options;
    
    if (Math.random() < probability) {
      const error = new Error(`${resource} resource exhausted (simulated)`);
      error.code = errorCode;
      error.resource = resource;
      error.isSimulated = true;
      throw error;
    }
    
    return operation();
  }
  
  /**
   * Simulates throttling/rate limiting errors
   * 
   * @param {Function} operation - Async function to execute
   * @param {Object} options - Configuration options
   * @param {number} [options.probability=0.3] - Probability of failure (0-1)
   * @param {number} [options.statusCode=429] - HTTP status code for rate limiting
   * @param {number} [options.retryAfter=30] - Suggested retry after time in seconds
   * @returns {Promise<any>} - Result of the operation or throws simulated error
   */
  static async simulateThrottling(operation, options = {}) {
    const { 
      probability = 0.3,
      statusCode = 429,
      retryAfter = 30
    } = options;
    
    if (Math.random() < probability) {
      const error = new Error('Rate limit exceeded (simulated)');
      error.status = statusCode;
      error.retryAfter = retryAfter;
      error.isSimulated = true;
      throw error;
    }
    
    return operation();
  }
  
  /**
   * Simulates intermittent timeout errors
   * 
   * @param {Function} operation - Async function to execute
   * @param {Object} options - Configuration options
   * @param {number} [options.probability=0.3] - Probability of timeout (0-1)
   * @param {number} [options.timeoutAfter=500] - Simulate timeout after this many ms
   * @returns {Promise<any>} - Result of the operation or throws simulated timeout
   */
  static async simulateTimeout(operation, options = {}) {
    const { 
      probability = 0.3,
      timeoutAfter = 500
    } = options;
    
    if (Math.random() < probability) {
      // Simulate a timeout
      await new Promise(r => setTimeout(r, timeoutAfter));
      const error = new Error('Operation timed out (simulated)');
      error.code = 'ETIMEDOUT';
      error.isSimulated = true;
      throw error;
    }
    
    return operation();
  }
  
  /**
   * Simulates partial failure where some operations succeed and others fail
   * 
   * @param {Function[]} operations - Array of async functions to execute
   * @param {Object} options - Configuration options
   * @param {number} [options.failureRate=0.3] - Probability of individual operation failure
   * @returns {Promise<{results: any[], errors: Error[]}>} - Results and errors from operations
   */
  static async simulatePartialFailure(operations, options = {}) {
    const { failureRate = 0.3 } = options;
    
    const results = [];
    const errors = [];
    
    // Execute operations with potential failures
    const promises = operations.map(async (op, index) => {
      try {
        if (Math.random() < failureRate) {
          const error = new Error(`Operation ${index} failed (simulated)`);
          error.index = index;
          error.isSimulated = true;
          throw error;
        }
        
        const result = await op();
        results.push({ index, result });
        return { success: true, index, result };
      } catch (error) {
        errors.push({ index, error });
        return { success: false, index, error };
      }
    });
    
    await Promise.all(promises);
    
    return { results, errors };
  }
}

export default NonDeterministicErrorSimulator;