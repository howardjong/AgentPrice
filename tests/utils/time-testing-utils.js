/**
 * Time Testing Utilities
 * 
 * This module provides utilities for working with time in tests, including:
 * - Consistent performance.now mocking
 * - Time passage simulation
 * - Timeout and interval mocking
 * - Date manipulation
 */

import { vi } from 'vitest';

/**
 * A class for managing time-related test functionality
 */
class TimeController {
  constructor() {
    this.currentTime = 0;
    this.timeCallbacks = [];
    this.originalPerformanceNow = performance.now;
    this.originalDateNow = Date.now;
    this.originalSetTimeout = global.setTimeout;
    this.originalSetInterval = global.setInterval;
    this.originalClearTimeout = global.clearTimeout;
    this.originalClearInterval = global.clearInterval;
    this.timeouts = new Map();
    this.intervals = new Map();
    this.nextTimerId = 1;
  }

  /**
   * Sets up mocks for time-related functions
   */
  setup() {
    // Mock performance.now
    vi.stubGlobal('performance', {
      ...performance,
      now: vi.fn(() => this.currentTime)
    });

    // Mock Date.now
    Date.now = vi.fn(() => this.currentTime);

    // Mock setTimeout
    global.setTimeout = vi.fn((callback, delay, ...args) => {
      const id = this.nextTimerId++;
      this.timeouts.set(id, {
        callback,
        triggerTime: this.currentTime + (delay || 0),
        args
      });
      return id;
    });

    // Mock setInterval
    global.setInterval = vi.fn((callback, delay, ...args) => {
      const id = this.nextTimerId++;
      this.intervals.set(id, {
        callback,
        delay: delay || 0,
        args,
        lastExecuted: this.currentTime
      });
      return id;
    });

    // Mock clearTimeout
    global.clearTimeout = vi.fn((id) => {
      this.timeouts.delete(id);
    });

    // Mock clearInterval
    global.clearInterval = vi.fn((id) => {
      this.intervals.delete(id);
    });

    return this;
  }

  /**
   * Restores original time-related functions
   */
  restore() {
    vi.restoreAllMocks();
    performance.now = this.originalPerformanceNow;
    Date.now = this.originalDateNow;
    global.setTimeout = this.originalSetTimeout;
    global.setInterval = this.originalSetInterval;
    global.clearTimeout = this.originalClearTimeout;
    global.clearInterval = this.originalClearInterval;
    this.timeouts.clear();
    this.intervals.clear();
    this.nextTimerId = 1;
    return this;
  }

  /**
   * Sets the current mock time
   * @param {number} time - Time in milliseconds
   */
  setTime(time) {
    this.currentTime = time;
    return this;
  }

  /**
   * Advances time by the specified amount and processes any due callbacks
   * @param {number} duration - Time to advance in milliseconds
   * @returns {Promise<void>} - Promise that resolves when all callbacks are processed
   */
  async advanceTime(duration) {
    const startTime = this.currentTime;
    const endTime = startTime + duration;
    this.currentTime = endTime;

    // Process any timeouts that should have triggered
    const triggeredTimeouts = [];
    this.timeouts.forEach((timeout, id) => {
      if (timeout.triggerTime <= endTime) {
        triggeredTimeouts.push({ id, ...timeout });
      }
    });

    // Execute and remove triggered timeouts
    for (const { id, callback, args } of triggeredTimeouts) {
      this.timeouts.delete(id);
      try {
        await callback(...args);
      } catch (error) {
        console.error('Error in timeout callback:', error);
      }
    }

    // Process intervals
    const intervalsToExecute = [];
    this.intervals.forEach((interval, id) => {
      const { lastExecuted, delay, callback, args } = interval;
      let executionTime = lastExecuted + delay;
      
      while (executionTime <= endTime) {
        intervalsToExecute.push({ 
          id, 
          callback, 
          args, 
          executionTime 
        });
        executionTime += delay;
      }
      
      if (intervalsToExecute.length > 0) {
        interval.lastExecuted = executionTime - delay;
      }
    });

    // Execute intervals in order of execution time
    intervalsToExecute.sort((a, b) => a.executionTime - b.executionTime);
    for (const { callback, args } of intervalsToExecute) {
      try {
        await callback(...args);
      } catch (error) {
        console.error('Error in interval callback:', error);
      }
    }

    return this;
  }
  
  /**
   * Creates a sequence of performance.now mock return values
   * @param {number[]} times - Array of times to return in sequence
   * @returns {function} - Mock function that returns values in sequence
   */
  createTimeSequence(times) {
    let callCount = 0;
    return vi.fn(() => {
      const time = times[callCount % times.length];
      callCount++;
      return time;
    });
  }

  /**
   * Creates a function that returns increasing times
   * @param {number} startTime - Starting time
   * @param {number} increment - Increment for each call
   * @returns {function} - Mock function that returns increasing values
   */
  createIncreasingTimeMock(startTime = 0, increment = 1000) {
    let current = startTime;
    return vi.fn(() => {
      const time = current;
      current += increment;
      return time;
    });
  }
}

/**
 * Helper function to mock performance.now with a sequence of values
 * @param {...number} times - Times to return in sequence
 * @returns {function} - Mock implementation
 */
export function mockPerformanceNowSequence(...times) {
  let callCount = 0;
  return vi.fn(() => {
    if (callCount >= times.length) {
      callCount = 0; // Reset to beginning to allow repeated patterns
    }
    return times[callCount++];
  });
}

/**
 * Creates a time controller for comprehensive time management in tests
 * @returns {TimeController} - A time controller instance
 */
export function createTimeController() {
  return new TimeController();
}

/**
 * Wait for actual time to pass (useful in integration tests where we can't mock time)
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} - Promise that resolves after the specified time
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper for testing functions that involve timeouts
 * @param {Function} asyncFn - The async function to be tested
 * @param {number} timeout - Max waiting time in ms
 * @returns {Promise} - Promise resolved with the result or rejected on timeout
 */
export function withTimeout(asyncFn, timeout = 5000) {
  return Promise.race([
    asyncFn(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Test timed out after ${timeout}ms`)), timeout)
    )
  ]);
}

export default {
  createTimeController,
  mockPerformanceNowSequence,
  wait,
  withTimeout
};