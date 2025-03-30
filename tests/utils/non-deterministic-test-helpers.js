/**
 * Non-Deterministic Test Helpers
 * 
 * This module provides helper functions for testing scenarios involving
 * non-deterministic errors and behavior.
 */

/**
 * Attempts an operation multiple times until it succeeds or reaches max attempts
 * 
 * @param {Function} operation - Async function to execute
 * @param {Object} options - Configuration options
 * @param {number} [options.maxAttempts=5] - Maximum number of attempts
 * @param {number} [options.delayBetweenAttempts=100] - Delay between attempts in ms
 * @param {Function} [options.shouldRetry] - Function that determines if error should trigger retry
 * @returns {Promise<any>} - Result of the operation if it eventually succeeds
 * @throws {Error} - The last error encountered if all attempts fail
 */
export async function expectEventualSuccess(operation, options = {}) {
  const { 
    maxAttempts = 5, 
    delayBetweenAttempts = 100,
    shouldRetry = () => true
  } = options;
  
  let attempts = 0;
  let lastError = null;
  
  while (attempts < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempts++;
      
      // Check if we should retry based on the error
      if (!shouldRetry(error) || attempts >= maxAttempts) {
        throw error;
      }
      
      await new Promise(r => setTimeout(r, delayBetweenAttempts));
    }
  }
  
  throw new Error(`Operation failed after ${maxAttempts} attempts. Last error: ${lastError.message}`);
}

/**
 * Verifies that an operation consistently fails with the expected error pattern
 * 
 * @param {Function} operation - Async function expected to fail
 * @param {string|RegExp|Object} errorMatcher - Pattern to match against the error
 * @param {Object} options - Configuration options
 * @param {number} [options.attempts=3] - Number of attempts to verify consistent failure
 * @param {number} [options.delayBetweenAttempts=50] - Delay between attempts in ms
 * @returns {Promise<boolean>} - True if operation consistently fails as expected
 * @throws {Error} - If the operation succeeds or fails with an unexpected error
 */
export async function expectConsistentFailure(operation, errorMatcher, options = {}) {
  const { attempts = 3, delayBetweenAttempts = 50 } = options;
  
  for (let i = 0; i < attempts; i++) {
    try {
      await operation();
      throw new Error('Expected operation to fail, but it succeeded');
    } catch (error) {
      // If this isn't the expected error type, rethrow
      if (!errorMatchesPattern(error, errorMatcher)) {
        throw new Error(`Expected error to match ${JSON.stringify(errorMatcher)}, but got: ${error.message}`);
      }
    }
    
    if (i < attempts - 1) {
      await new Promise(r => setTimeout(r, delayBetweenAttempts));
    }
  }
  
  return true; // All attempts failed as expected
}

/**
 * Checks if an error matches the expected pattern
 * 
 * @param {Error} error - The error to check
 * @param {string|RegExp|Object} matcher - The pattern to match against
 * @returns {boolean} - Whether the error matches the pattern
 */
function errorMatchesPattern(error, matcher) {
  if (typeof matcher === 'string') {
    return error.message.includes(matcher);
  }
  
  if (matcher instanceof RegExp) {
    return matcher.test(error.message);
  }
  
  if (typeof matcher === 'object') {
    return Object.entries(matcher).every(([key, value]) => {
      return error[key] === value || 
        (value instanceof RegExp && value.test(error[key]));
    });
  }
  
  return false;
}

/**
 * Creates a controlled failure environment for testing recovery logic
 * 
 * @param {Function} operation - Async function to execute
 * @param {Object} failureSchedule - Schedule of when to fail and succeed
 * @param {number[]} [failureSchedule.failOn=[1,2]] - Which attempt numbers should fail (1-based)
 * @param {Function} [failureSchedule.errorGenerator] - Function to generate appropriate errors
 * @returns {Function} - A function that fails according to the schedule when called
 */
export function createScheduledFailure(operation, failureSchedule = {}) {
  const { 
    failOn = [1, 2], 
    errorGenerator = (attempt) => {
      const error = new Error(`Scheduled failure on attempt ${attempt}`);
      error.attempt = attempt;
      return error;
    }
  } = failureSchedule;
  
  let attempt = 0;
  
  return async (...args) => {
    attempt++;
    
    if (failOn.includes(attempt)) {
      throw errorGenerator(attempt);
    }
    
    return operation(...args);
  };
}

/**
 * Tracks execution attempts for assertions in tests
 * 
 * @param {Function} operation - Async function to track
 * @returns {Object} - Tracked operation with attempt history
 */
export function trackAttempts(operation) {
  const attempts = [];
  
  const trackedOperation = async (...args) => {
    try {
      const attemptInfo = { 
        number: attempts.length + 1,
        args,
        timestamp: Date.now() 
      };
      
      const result = await operation(...args);
      
      attemptInfo.success = true;
      attemptInfo.result = result;
      attempts.push(attemptInfo);
      
      return result;
    } catch (error) {
      const attemptInfo = { 
        number: attempts.length + 1,
        args,
        timestamp: Date.now(),
        success: false,
        error
      };
      
      attempts.push(attemptInfo);
      throw error;
    }
  };
  
  // Attach the attempts history to the function
  trackedOperation.attempts = attempts;
  trackedOperation.getAttemptCount = () => attempts.length;
  trackedOperation.getSuccessful = () => attempts.filter(a => a.success);
  trackedOperation.getFailed = () => attempts.filter(a => !a.success);
  
  return trackedOperation;
}

/**
 * Handles multiple strategies for retrying a failed operation
 * 
 * @param {Function} operation - Async function to execute with retry
 * @param {Object} options - Configuration options
 * @param {string} [options.strategy='exponential'] - Retry strategy: 'exponential', 'linear', 'fixed'
 * @param {number} [options.maxAttempts=3] - Maximum number of attempts
 * @param {number} [options.baseDelay=100] - Base delay between retries in ms
 * @param {Function} [options.shouldRetry] - Function that determines if error should trigger retry
 * @returns {Promise<any>} - Result of the operation if it eventually succeeds
 */
export async function withRetry(operation, options = {}) {
  const { 
    strategy = 'exponential',
    maxAttempts = 3,
    baseDelay = 100,
    shouldRetry = () => true
  } = options;
  
  let attempts = 0;
  let lastError = null;
  
  while (attempts < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempts++;
      
      // Check if we should retry based on the error
      if (!shouldRetry(error) || attempts >= maxAttempts) {
        throw error;
      }
      
      // Calculate delay based on strategy
      let delay;
      
      switch (strategy) {
        case 'exponential':
          delay = baseDelay * Math.pow(2, attempts - 1);
          break;
        case 'linear':
          delay = baseDelay * attempts;
          break;
        case 'fixed':
        default:
          delay = baseDelay;
      }
      
      // Add jitter (±20%)
      const jitteredDelay = delay * (0.8 + Math.random() * 0.4);
      
      await new Promise(r => setTimeout(r, jitteredDelay));
    }
  }
  
  throw new Error(`Operation failed after ${maxAttempts} attempts. Last error: ${lastError.message}`);
}

export default {
  expectEventualSuccess,
  expectConsistentFailure,
  errorMatchesPattern,
  createScheduledFailure,
  trackAttempts,
  withRetry
};