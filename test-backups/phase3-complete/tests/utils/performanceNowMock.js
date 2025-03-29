/**
 * Performance.now() Mock Utility
 * 
 * This module provides utilities for mocking the performance.now() function
 * in Node.js environments. It allows precise control over time advancement
 * for testing time-dependent functionality without actual delays.
 * 
 * Features:
 * - Mock implementation of performance.now()
 * - Control over time advancement
 * - Integration with Vitest's fake timers
 * - Support for testing long-running operations
 */

// Default starting time in milliseconds
const DEFAULT_START_TIME = 1614556800000;

// Mock state
let currentTime = DEFAULT_START_TIME;
let installed = false;
let originalPerformanceNow = null;

/**
 * Install the performance.now() mock
 * @param {Object} options - Configuration options
 * @param {Number} options.startTime - Initial time value (ms since epoch)
 * @returns {Function} - Uninstall function to restore original performance.now
 */
export function installPerformanceNowMock(options = {}) {
  if (installed) {
    throw new Error('Performance.now() mock is already installed');
  }

  const { startTime = DEFAULT_START_TIME } = options;
  currentTime = startTime;

  // Store original implementation
  originalPerformanceNow = performance.now;

  // Install mock
  performance.now = () => currentTime;
  installed = true;

  // Return function to uninstall the mock
  return uninstallPerformanceNowMock;
}

/**
 * Uninstall the performance.now() mock
 */
export function uninstallPerformanceNowMock() {
  if (!installed) {
    return;
  }

  // Restore original implementation
  performance.now = originalPerformanceNow;
  originalPerformanceNow = null;
  installed = false;
}

/**
 * Advance the mocked time by a specified amount
 * @param {Number} milliseconds - Time to advance (in milliseconds)
 */
export function advanceTime(milliseconds) {
  if (!installed) {
    throw new Error('Performance.now() mock is not installed');
  }

  currentTime += milliseconds;
}

/**
 * Set the mocked time to a specific value
 * @param {Number} milliseconds - Time to set (in milliseconds)
 */
export function setTime(milliseconds) {
  if (!installed) {
    throw new Error('Performance.now() mock is not installed');
  }

  currentTime = milliseconds;
}

/**
 * Get the current mocked time
 * @returns {Number} Current mocked time
 */
export function getCurrentTime() {
  return currentTime;
}

/**
 * Reset the mocked time to the initial value
 * @param {Number} startTime - Optional new start time
 */
export function resetTime(startTime = DEFAULT_START_TIME) {
  currentTime = startTime;
}

/**
 * Integration with Vitest's fake timers
 * Advances both the performance.now() time and Vitest's fake timers
 * @param {Number} milliseconds - Time to advance (in milliseconds)
 * @param {Object} vi - Vitest instance
 */
export function advanceTimeAndFakeTimers(milliseconds, vi) {
  if (!vi) {
    throw new Error('Vitest instance must be provided');
  }

  // Advance performance.now time
  advanceTime(milliseconds);
  
  // Advance Vitest's fake timers
  vi.advanceTimersByTime(milliseconds);
}

/**
 * Simulate a long-running operation without actual delays
 * @param {Number} durationMs - Duration to simulate (in milliseconds)
 * @param {Object} vi - Vitest instance (optional)
 */
export function simulateLongOperation(durationMs, vi = null) {
  if (vi) {
    advanceTimeAndFakeTimers(durationMs, vi);
  } else {
    advanceTime(durationMs);
  }
}

export default {
  installPerformanceNowMock,
  uninstallPerformanceNowMock,
  advanceTime,
  setTime,
  getCurrentTime,
  resetTime,
  advanceTimeAndFakeTimers,
  simulateLongOperation
};