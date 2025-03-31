/**
 * Time Controller for Testing
 * 
 * This utility helps control timer functions (setTimeout, setInterval) in tests.
 * It allows tests to advance timers without actually waiting, making timer-based tests faster and more reliable.
 */

import { vi } from 'vitest';

export class TimeController {
  constructor() {
    this.originalSetTimeout = global.setTimeout;
    this.originalSetInterval = global.setInterval;
    this.originalClearTimeout = global.clearTimeout;
    this.originalClearInterval = global.clearInterval;
    this.originalDateNow = Date.now;
    this.originalPerformanceNow = performance.now;
  }
  
  /**
   * Set up mock time functions
   */
  setup() {
    // Use vitest's fake timers
    vi.useFakeTimers();
  }
  
  /**
   * Restore original time functions
   */
  teardown() {
    vi.useRealTimers();
  }
  
  /**
   * Advance timers by a specific amount of time
   * @param {number} ms - Milliseconds to advance
   */
  advanceTimersByTime(ms) {
    vi.advanceTimersByTime(ms);
  }
  
  /**
   * Run all pending timers
   */
  runAllTimers() {
    vi.runAllTimers();
  }
  
  /**
   * Run only pending timers that are scheduled to run within the specified time
   * @param {number} ms - Milliseconds limit
   */
  runOnlyPendingTimers() {
    vi.runOnlyPendingTimers();
  }
  
  /**
   * Set the current virtual time
   * @param {number} timestamp - UNIX timestamp to set as current time
   */
  setSystemTime(timestamp) {
    vi.setSystemTime(timestamp);
  }
  
  /**
   * Get the current virtual time
   * @returns {number} Current virtual time
   */
  getCurrentTime() {
    return Date.now();
  }
}

/**
 * Helper to wait for a specified time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after the specified time
 */
export async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper to execute a function with a timeout
 * @param {Promise} promise - Promise to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} message - Error message if timeout occurs
 * @returns {Promise} Promise that resolves with the result or rejects with timeout error
 */
export async function withTimeout(promise, timeoutMs, message = 'Operation timed out') {
  let timeoutId;
  
  // Create a promise that rejects after the timeout
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });
  
  // Race the original promise against the timeout
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Mock performance.now() to return a predetermined sequence of values
 * @param {number[]} values - Array of values to return in sequence
 * @returns {Function} Restore function to revert the mock
 */
export function mockPerformanceNowSequence(values) {
  let callCount = 0;
  const originalNow = performance.now;
  
  performance.now = () => {
    return values[Math.min(callCount++, values.length - 1)];
  };
  
  return () => {
    performance.now = originalNow;
  };
}

/**
 * Create a completely separate test execution time controller
 * This is useful when you need to isolate timer management from other tests
 * @returns {Object} Time controller with methods to manage time
 */
export function createTimeController() {
  return new TimeController();
}