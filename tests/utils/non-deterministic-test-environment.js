/**
 * Non-Deterministic Test Environment
 * 
 * This module provides controlled test environments for testing
 * code that deals with non-deterministic errors and behavior.
 */

/**
 * Creates a controlled test environment for testing non-deterministic behavior
 * 
 * @param {Object} options - Configuration options
 * @returns {Object} - Test environment with controlled service and utilities
 */
export function createTestEnvironment(options = {}) {
  // Default configuration
  const config = {
    simulateLatency: true,
    baseLatency: 10,
    randomLatency: 20,
    ...options
  };
  
  // Reset state before each test
  let state = {
    networkEnabled: true,
    resourceAvailable: true,
    rateLimitReached: false,
    serverAvailable: true,
    errorProbability: 0,
    currentErrorType: null,
    latencyRange: [config.baseLatency, config.baseLatency + config.randomLatency],
    currentApiVersion: 'v1',
    remainingQuota: 1000,
    callCount: 0
  };
  
  /**
   * Simulates network latency based on current configuration
   * @returns {Promise<void>}
   */
  async function simulateLatency() {
    if (!config.simulateLatency) return;
    
    const [min, max] = state.latencyRange;
    const latency = min + Math.random() * (max - min);
    await new Promise(r => setTimeout(r, latency));
  }
  
  /**
   * Simulates a service call with controlled failures
   * @param {Function} operation 
   * @returns {Promise<any>}
   */
  async function simulateServiceCall(operation) {
    state.callCount++;
    
    // First check conditions that would prevent the call from succeeding
    await simulateLatency();
    
    if (!state.networkEnabled) {
      const error = new Error('Network unavailable');
      error.code = 'ENETDOWN';
      throw error;
    }
    
    if (!state.serverAvailable) {
      const error = new Error('Server unavailable');
      error.status = 503;
      throw error;
    }
    
    if (state.remainingQuota <= 0 || state.rateLimitReached) {
      const error = new Error('Rate limit exceeded');
      error.status = 429;
      error.retryAfter = 30;
      throw error;
    }
    
    if (!state.resourceAvailable) {
      const error = new Error('Resource not available');
      error.code = 'RESOURCE_EXHAUSTED';
      throw error;
    }
    
    // Random error simulation
    if (Math.random() < state.errorProbability) {
      const errorTypes = {
        timeout: () => {
          const error = new Error('Operation timed out');
          error.code = 'ETIMEDOUT';
          return error;
        },
        connection: () => {
          const error = new Error('Connection reset');
          error.code = 'ECONNRESET';
          return error;
        },
        server: () => {
          const error = new Error('Internal server error');
          error.status = 500;
          return error;
        },
        validation: () => {
          const error = new Error('Validation failed');
          error.status = 400;
          error.validationErrors = [{ field: 'test', message: 'Invalid value' }];
          return error;
        }
      };
      
      // Generate error based on current error type
      const errorGenerator = errorTypes[state.currentErrorType] || errorTypes.server;
      throw errorGenerator();
    }
    
    // If we made it here, decrement quota and execute operation
    state.remainingQuota--;
    return operation();
  }
  
  // Service that simulates non-deterministic behavior
  const flakyService = {
    /**
     * Simulates fetching data with potential failures
     * @param {string} id - Identifier to fetch
     * @returns {Promise<Object>} - Fetched data
     */
    async getData(id) {
      return simulateServiceCall(() => {
        return {
          id,
          timestamp: Date.now(),
          apiVersion: state.currentApiVersion,
          remainingQuota: state.remainingQuota,
          callCount: state.callCount
        };
      });
    },
    
    /**
     * Simulates updating data with potential failures
     * @param {string} id - Identifier to update
     * @param {Object} data - Data to update
     * @returns {Promise<Object>} - Updated data
     */
    async updateData(id, data) {
      return simulateServiceCall(() => {
        return {
          id,
          ...data,
          updated: true,
          timestamp: Date.now(),
          apiVersion: state.currentApiVersion
        };
      });
    },
    
    /**
     * Simulates a batch operation with potential partial failures
     * @param {Array} items - Items to process
     * @returns {Promise<Object>} - Processing results
     */
    async processBatch(items) {
      // Process each item individually
      const results = [];
      const errors = [];
      
      for (let i = 0; i < items.length; i++) {
        try {
          const result = await simulateServiceCall(() => {
            return {
              id: items[i].id || i,
              processed: true,
              timestamp: Date.now()
            };
          });
          results.push(result);
        } catch (error) {
          errors.push({
            item: items[i],
            error: error.message,
            code: error.code || error.status
          });
        }
      }
      
      return {
        success: errors.length === 0,
        results,
        errors,
        totalProcessed: results.length,
        totalFailed: errors.length
      };
    },
    
    // ===== Control methods to simulate specific conditions =====
    
    /**
     * Disables network connectivity
     */
    disableNetwork() {
      state.networkEnabled = false;
    },
    
    /**
     * Enables network connectivity
     */
    enableNetwork() {
      state.networkEnabled = true;
    },
    
    /**
     * Simulates resource exhaustion
     */
    exhaustResource() {
      state.resourceAvailable = false;
    },
    
    /**
     * Makes resource available again
     */
    makeResourceAvailable() {
      state.resourceAvailable = true;
    },
    
    /**
     * Triggers rate limiting
     */
    triggerRateLimit() {
      state.rateLimitReached = true;
    },
    
    /**
     * Resets rate limiting
     */
    resetRateLimit() {
      state.rateLimitReached = false;
    },
    
    /**
     * Simulates server downtime
     */
    takeServerDown() {
      state.serverAvailable = false;
    },
    
    /**
     * Brings server back online
     */
    bringServerUp() {
      state.serverAvailable = true;
    },
    
    /**
     * Sets random error probability
     * @param {number} probability - Probability of error (0-1)
     * @param {string} errorType - Type of error to simulate
     */
    setErrorProbability(probability, errorType = 'server') {
      state.errorProbability = probability;
      state.currentErrorType = errorType;
    },
    
    /**
     * Sets latency range for simulated calls
     * @param {number} min - Minimum latency in ms
     * @param {number} max - Maximum latency in ms
     */
    setLatencyRange(min, max) {
      state.latencyRange = [min, max];
    },
    
    /**
     * Sets API version
     * @param {string} version - API version to simulate
     */
    setApiVersion(version) {
      state.currentApiVersion = version;
    },
    
    /**
     * Sets remaining API quota
     * @param {number} quota - Remaining API calls
     */
    setRemainingQuota(quota) {
      state.remainingQuota = quota;
    },
    
    /**
     * Gets current state for assertions
     * @returns {Object} - Current state
     */
    getState() {
      return { ...state };
    },
    
    /**
     * Resets service to initial state
     */
    reset() {
      state = {
        networkEnabled: true,
        resourceAvailable: true,
        rateLimitReached: false,
        serverAvailable: true,
        errorProbability: 0,
        currentErrorType: null,
        latencyRange: [config.baseLatency, config.baseLatency + config.randomLatency],
        currentApiVersion: 'v1',
        remainingQuota: 1000,
        callCount: 0
      };
    }
  };
  
  return { flakyService };
}

export default createTestEnvironment;