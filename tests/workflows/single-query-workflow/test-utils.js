/**
 * Test Utilities for Single Query Workflow Tests
 * 
 * This module provides helper functions for setting up and running tests.
 */

import { vi } from 'vitest';

/**
 * Setup time-related mocks to speed up tests
 * @returns {Function} Function to restore original behavior
 */
export function setupTimeMocks() {
  // Store original implementations
  const originalSetTimeout = global.setTimeout;
  const originalSetInterval = global.setInterval;
  const originalClearTimeout = global.clearTimeout;
  const originalClearInterval = global.clearInterval;
  const originalDate = global.Date;
  
  // Mock setTimeout to execute immediately
  global.setTimeout = vi.fn((callback, delay, ...args) => {
    if (typeof callback === 'function') {
      callback(...args);
    }
    return Math.floor(Math.random() * 1000000);
  });
  
  // Mock setInterval to execute once immediately
  global.setInterval = vi.fn((callback, delay, ...args) => {
    if (typeof callback === 'function') {
      callback(...args);
    }
    return Math.floor(Math.random() * 1000000);
  });
  
  // Mock clearTimeout and clearInterval as no-ops
  global.clearTimeout = vi.fn();
  global.clearInterval = vi.fn();
  
  // Function to restore original implementations
  return () => {
    global.setTimeout = originalSetTimeout;
    global.setInterval = originalSetInterval;
    global.clearTimeout = originalClearTimeout;
    global.clearInterval = originalClearInterval;
    global.Date = originalDate;
  };
}

/**
 * Create promise that can be resolved/rejected externally
 * @returns {Object} Object with promise, resolve, and reject functions
 */
export function createResolvablePromise() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  return { promise, resolve, reject };
}

/**
 * Wait for a specific number of milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>} Promise that resolves after the delay
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock function that returns a promise that resolves after a delay
 * @param {any} returnValue - The value to return
 * @param {number} delayMs - Delay before resolving in milliseconds
 * @returns {Function} Mock function
 */
export function createDelayedMock(returnValue, delayMs = 100) {
  return vi.fn().mockImplementation(() => {
    return new Promise(resolve => {
      setTimeout(() => resolve(returnValue), delayMs);
    });
  });
}

/**
 * Create a mock function that fails a specified number of times before succeeding
 * @param {any} successValue - The value to return on success
 * @param {number} failureTimes - Number of times to fail
 * @param {Error} error - Error to throw on failure
 * @returns {Function} Mock function
 */
export function createRetryableMock(successValue, failureTimes = 2, error = new Error('Mock failure')) {
  let attempts = 0;
  
  return vi.fn().mockImplementation(() => {
    return new Promise((resolve, reject) => {
      attempts++;
      
      if (attempts <= failureTimes) {
        reject(error);
      } else {
        resolve(successValue);
      }
    });
  });
}

/**
 * Create a mock that alternates between success and failure
 * @param {any} successValue - The value to return on success
 * @param {Error} error - Error to throw on failure
 * @returns {Function} Mock function
 */
export function createAlternatingMock(successValue, error = new Error('Mock failure')) {
  let callCount = 0;
  
  return vi.fn().mockImplementation(() => {
    return new Promise((resolve, reject) => {
      callCount++;
      
      if (callCount % 2 === 0) {
        resolve(successValue);
      } else {
        reject(error);
      }
    });
  });
}

/**
 * Create a mock function that times out after a specified delay
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Function} Mock function
 */
export function createTimeoutMock(timeoutMs = 1000) {
  return vi.fn().mockImplementation(() => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  });
}

/**
 * Wait for a condition to be true
 * @param {Function} conditionFn - Function that returns a boolean
 * @param {object} options - Options
 * @param {number} options.timeout - Maximum time to wait in milliseconds
 * @param {number} options.interval - Interval between checks in milliseconds
 * @returns {Promise<void>} Promise that resolves when condition is true
 */
export async function waitForCondition(conditionFn, options = {}) {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await conditionFn()) {
      return;
    }
    await wait(interval);
  }
  
  throw new Error(`Condition not met within ${timeout}ms timeout`);
}