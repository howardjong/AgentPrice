/**
 * Error handling utilities for testing
 */

import { expect } from 'vitest';

/**
 * Utility to check that a promise rejects with expected error
 * 
 * @param {Promise} promise - The promise that should reject
 * @param {string|RegExp} [expectedError] - Expected error message or pattern
 * @param {Function} [errorType] - Expected error constructor
 * @returns {Promise<Error>} - The caught error for further assertions
 */
export async function assertRejects(promise, expectedError, errorType) {
  let error;
  
  try {
    await promise;
    throw new Error('Expected promise to reject but it resolved');
  } catch (e) {
    error = e;
  }
  
  if (errorType) {
    expect(error).toBeInstanceOf(errorType);
  }
  
  if (expectedError) {
    if (expectedError instanceof RegExp) {
      expect(error.message).toMatch(expectedError);
    } else {
      expect(error.message).toContain(expectedError);
    }
  }
  
  return error;
}

/**
 * Creates a spy that tracks errors for testing error handling
 * 
 * @returns {Object} - Object with methods to track and assert errors
 */
export function createErrorTrackingSpy() {
  const errors = [];
  
  const trackError = (error) => {
    errors.push(error);
    return error; // Chain for promise catch handlers
  };
  
  return {
    // Methods to track errors
    trackError,
    reset: () => { errors.length = 0; },
    
    // Test assertion helpers
    assertNoErrors: () => {
      expect(errors).toHaveLength(0);
    },
    assertHasErrors: (count = null) => {
      if (count !== null) {
        expect(errors).toHaveLength(count);
      } else {
        expect(errors.length).toBeGreaterThan(0);
      }
    },
    assertErrorMatches: (pattern) => {
      expect(errors.some(e => pattern.test(e.message))).toBe(true);
    },
    assertErrorContains: (substring) => {
      expect(errors.some(e => e.message.includes(substring))).toBe(true);
    },
    assertErrorType: (errorType) => {
      expect(errors.some(e => e instanceof errorType)).toBe(true);
    },
    
    // Access the tracked errors
    getErrors: () => [...errors]
  };
}