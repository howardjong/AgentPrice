/**
 * Error Handling Utilities for Tests
 * 
 * This module provides helper functions to simplify and standardize
 * error handling in tests, especially for promise rejections.
 */

import { expect } from 'vitest';

/**
 * Assert that a promise rejects with a specific error pattern
 * 
 * @param {Promise} promise - The promise that should reject
 * @param {Object} expectedError - The expected error properties to match
 * @param {string} [message] - Optional custom error message
 * @returns {Promise} A promise that resolves if the assertion passes
 * 
 * @example
 * // Basic usage
 * await assertRejects(
 *   service.method('bad input'),
 *   { message: 'Invalid input' }
 * );
 * 
 * // With specific error type and properties
 * await assertRejects(
 *   service.method('rate limited'),
 *   { 
 *     name: 'RateLimitError',
 *     message: 'Rate limit exceeded',
 *     retryAfter: 30
 *   }
 * );
 */
export async function assertRejects(promise, expectedError, message) {
  try {
    await promise;
    throw new Error(message || 'Expected promise to reject but it resolved');
  } catch (error) {
    // For each property in expectedError, check if it matches in actual error
    Object.entries(expectedError).forEach(([key, value]) => {
      expect(error[key], `Error property '${key}' should match`).toEqual(value);
    });
    return error; // Return the error for further assertions if needed
  }
}

/**
 * Assert that a callback throws a specific error
 * 
 * @param {Function} callback - The function that should throw
 * @param {Object} expectedError - The expected error properties to match
 * @param {string} [message] - Optional custom error message
 * @returns {Error} The caught error if the assertion passes
 * 
 * @example
 * // With synchronous code
 * const error = assertThrows(
 *   () => validator.validate('bad input'),
 *   { message: 'Invalid input' }
 * );
 * 
 * // With additional assertions on the error
 * const error = assertThrows(
 *   () => parser.parse('{"incomplete":'),
 *   { name: 'SyntaxError' }
 * );
 * expect(error.position).toBe(14);
 */
export function assertThrows(callback, expectedError, message) {
  try {
    callback();
    throw new Error(message || 'Expected function to throw but it did not');
  } catch (error) {
    // For each property in expectedError, check if it matches in actual error
    Object.entries(expectedError).forEach(([key, value]) => {
      expect(error[key], `Error property '${key}' should match`).toEqual(value);
    });
    return error; // Return the error for further assertions if needed
  }
}

/**
 * Creates a controlled failure function for testing error handling
 * 
 * @param {string} failureMessage - The error message for the failure
 * @param {string} [errorType] - The name of the error class to use
 * @param {Object} [additionalProperties] - Additional properties to add to the error
 * @returns {Function} A function that will predictably fail with the specified error
 * 
 * @example
 * // Mocking a function that fails with a specific error
 * service.method = createFailingFunction(
 *   'Database connection failed',
 *   'ConnectionError',
 *   { code: 'ECONNREFUSED', retryable: true }
 * );
 * 
 * // Using in async tests
 * await expect(service.method()).rejects.toMatchObject({
 *   message: 'Database connection failed',
 *   code: 'ECONNREFUSED'
 * });
 */
export function createFailingFunction(failureMessage, errorType = 'Error', additionalProperties = {}) {
  return function() {
    const error = new Error(failureMessage);
    error.name = errorType;
    
    // Add all additional properties to the error
    Object.entries(additionalProperties).forEach(([key, value]) => {
      error[key] = value;
    });
    
    throw error;
  };
}

/**
 * Creates a function that fails a specific number of times before succeeding
 * 
 * @param {Function} successFn - The function to eventually succeed
 * @param {number} failCount - Number of times to fail before succeeding
 * @param {Error|Function} failureMode - The error to throw or a function returning errors
 * @returns {Function} A function that fails `failCount` times then succeeds
 * 
 * @example
 * // Mock a function that fails twice then succeeds
 * const mockFetch = createEventuallySuccessfulFunction(
 *   () => ({ data: 'success' }),
 *   2,
 *   new Error('Network error')
 * );
 * 
 * // The mock will fail twice then succeed on the third call
 * await expect(mockFetch()).rejects.toThrow('Network error');
 * await expect(mockFetch()).rejects.toThrow('Network error');
 * await expect(mockFetch()).resolves.toEqual({ data: 'success' });
 */
export function createEventuallySuccessfulFunction(successFn, failCount, failureMode) {
  let attemptsRemaining = failCount;
  
  return function(...args) {
    if (attemptsRemaining > 0) {
      attemptsRemaining--;
      
      // Handle different failure modes
      if (typeof failureMode === 'function') {
        throw failureMode();
      } else {
        throw failureMode;
      }
    }
    
    return successFn(...args);
  };
}

/**
 * Create a spy function that records how often it was called with errors
 * 
 * @param {Function} [implementation] - Optional implementation for the spy
 * @returns {Function} A function that tracks error and success calls
 * 
 * @example
 * // Create a spy for error tracking
 * const errorTrackingSpy = createErrorTrackingSpy((err) => console.error(err));
 * 
 * // Use in error handlers
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   errorTrackingSpy(error);
 * }
 * 
 * // Check the spy's stats
 * expect(errorTrackingSpy.errorCount).toBe(1);
 * expect(errorTrackingSpy.errors[0].message).toContain('Expected error');
 */
export function createErrorTrackingSpy(implementation) {
  const spy = function(error) {
    if (error instanceof Error) {
      spy.errors.push(error);
      spy.errorCount++;
    } else {
      spy.successCount++;
    }
    
    if (implementation) {
      return implementation(error);
    }
  };
  
  // Initialize tracking properties
  spy.errors = [];
  spy.errorCount = 0;
  spy.successCount = 0;
  
  // Add reset method
  spy.reset = function() {
    spy.errors = [];
    spy.errorCount = 0;
    spy.successCount = 0;
  };
  
  return spy;
}

/**
 * Combines multiple error handlers into a single chain 
 * for testing complex error handling flows
 * 
 * @param {...Function} handlers - Error handling functions to chain
 * @returns {Function} A combined error handler
 * 
 * @example
 * // Create a chain of error handlers for testing
 * const handleError = chainErrorHandlers(
 *   (err) => logger.error(err),
 *   (err) => metrics.recordError(err),
 *   (err) => err.retryable ? retry() : Promise.reject(err)
 * );
 * 
 * // Use in tests
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   await handleError(error);
 * }
 */
export function chainErrorHandlers(...handlers) {
  return async function(error) {
    let currentError = error;
    
    for (const handler of handlers) {
      try {
        const result = await handler(currentError);
        if (result !== undefined) {
          return result; // Handler resolved the error
        }
      } catch (newError) {
        currentError = newError; // Continue with the new error
      }
    }
    
    throw currentError; // Re-throw if not handled
  };
}

/**
 * Creates a mock response factory with controlled failure modes
 * 
 * @param {Object} baseResponse - The base successful response
 * @returns {Object} An object with methods to create controlled responses
 * 
 * @example
 * const mockApiResponses = createMockResponseFactory({
 *   status: 'success',
 *   data: { id: 123, name: 'Test' }
 * });
 * 
 * // Create a rate limit error response
 * const rateLimitedResponse = mockApiResponses.withError(
 *   'RateLimitExceeded',
 *   'Too many requests', 
 *   { retryAfter: 30, statusCode: 429 }
 * );
 * 
 * // Use in tests
 * service.callApi.mockResolvedValueOnce(rateLimitedResponse);
 */
export function createMockResponseFactory(baseResponse) {
  return {
    success: (overrides = {}) => ({ ...baseResponse, ...overrides }),
    
    withError: (errorCode, errorMessage, additionalProps = {}) => ({
      status: 'error',
      error: {
        code: errorCode,
        message: errorMessage,
        ...additionalProps
      }
    }),
    
    networkError: (message = 'Network error') => {
      const error = new Error(message);
      error.name = 'NetworkError';
      return error;
    },
    
    timeout: (timeoutMs = 5000) => {
      const error = new Error(`Request timed out after ${timeoutMs}ms`);
      error.name = 'TimeoutError';
      error.timeoutMs = timeoutMs;
      return error;
    }
  };
}

export default {
  assertRejects,
  assertThrows,
  createFailingFunction,
  createEventuallySuccessfulFunction,
  createErrorTrackingSpy,
  chainErrorHandlers,
  createMockResponseFactory
};