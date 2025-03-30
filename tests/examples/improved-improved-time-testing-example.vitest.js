/**
 * Example of improved time testing patterns
 * 
 * This example demonstrates how to use the time-testing utilities
 * to create reliable tests for time-dependent functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  createTimeController,
  mockPerformanceNowSequence,
  wait,
  withTimeout
} from '../utils/time-testing-utils.js';

// We'll create a simple utility that demonstrates time-based functionality
class TimeDependentUtil {
  constructor() {
    this.timeouts = [];
    this.intervals = [];
    this.lastExecutionTime = null;
  }

  /**
   * Measures execution time of a function
   * @param {Function} fn - Function to execute
   * @returns {Object} - Result and execution time
   */
  measureExecutionTime(fn) {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();
    this.lastExecutionTime = endTime - startTime;
    
    return {
      result,
      executionTime: this.lastExecutionTime
    };
  }

  /**
   * Executes a function after a delay
   * @param {Function} fn - Function to execute
   * @param {number} delay - Delay in milliseconds
   * @returns {number} - Timeout ID
   */
  executeAfterDelay(fn, delay) {
    const timeoutId = setTimeout(() => {
      fn();
    }, delay);
    
    this.timeouts.push(timeoutId);
    return timeoutId;
  }

  /**
   * Executes a function at regular intervals
   * @param {Function} fn - Function to execute
   * @param {number} interval - Interval in milliseconds
   * @returns {number} - Interval ID
   */
  executeAtInterval(fn, interval) {
    const intervalId = setInterval(() => {
      fn();
    }, interval);
    
    this.intervals.push(intervalId);
    return intervalId;
  }

  /**
   * Checks if a deadline has passed
   * @param {number} deadline - Deadline timestamp
   * @returns {boolean} - True if deadline has passed
   */
  isDeadlinePassed(deadline) {
    return Date.now() > deadline;
  }

  /**
   * Cleans up all timeouts and intervals
   */
  cleanup() {
    this.timeouts.forEach(id => clearTimeout(id));
    this.intervals.forEach(id => clearInterval(id));
    this.timeouts = [];
    this.intervals = [];
  }
}

// Test suite using TimeController for comprehensive time control
describe('TimeDependentUtil with TimeController', () => {
  let util;
  let timeController;
  
  beforeEach(() => {
    // Create and setup the time controller
    timeController = createTimeController().setup();
    
    // Create a new utility instance for each test
    util = new TimeDependentUtil();
  });
  
  afterEach(() => {
    // Clean up timeouts and intervals
    util.cleanup();
    
    // Restore original time functions
    timeController.restore();
  });
  
  it('should measure execution time correctly', () => {
    // Set up performance.now to return specific values
    // First call will return 100, second call returns 150
    vi.stubGlobal('performance', {
      now: mockPerformanceNowSequence(100, 150)
    });
    
    // Test the function
    const { executionTime } = util.measureExecutionTime(() => 'test result');
    
    // Execution time should be 150 - 100 = 50
    expect(executionTime).toBe(50);
  });
  
  it('should execute function after delay', async () => {
    // Set initial time
    timeController.setTime(1000);
    
    // Create a mock function to execute after delay
    const mockFn = vi.fn();
    
    // Set up the delayed execution
    util.executeAfterDelay(mockFn, 2000);
    
    // Function should not have been called yet
    expect(mockFn).not.toHaveBeenCalled();
    
    // Advance time by 1000ms (to 2000ms) - still before timeout
    await timeController.advanceTime(1000);
    expect(mockFn).not.toHaveBeenCalled();
    
    // Advance time by another 1000ms (to 3000ms) - should trigger timeout
    await timeController.advanceTime(1000);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
  
  it('should execute function at intervals', async () => {
    // Set initial time
    timeController.setTime(0);
    
    // Create a mock function to execute at intervals
    const mockFn = vi.fn();
    
    // Set up the interval execution (every 1000ms)
    util.executeAtInterval(mockFn, 1000);
    
    // Function should not have been called yet
    expect(mockFn).not.toHaveBeenCalled();
    
    // Advance time by 3500ms - should trigger 3 calls
    await timeController.advanceTime(3500);
    expect(mockFn).toHaveBeenCalledTimes(3);
    
    // Advance time by another 2000ms - should trigger 2 more calls
    await timeController.advanceTime(2000);
    expect(mockFn).toHaveBeenCalledTimes(5);
  });
  
  it('should correctly determine if deadline has passed', () => {
    // Set current time to 1000
    timeController.setTime(1000);
    
    // Deadline in the future
    expect(util.isDeadlinePassed(2000)).toBe(false);
    
    // Deadline in the past
    expect(util.isDeadlinePassed(500)).toBe(true);
    
    // Advance time to 3000
    timeController.setTime(3000);
    
    // Now the first deadline has also passed
    expect(util.isDeadlinePassed(2000)).toBe(true);
  });
});

// Alternative test suite using Vitest's built-in timer mocks
describe('TimeDependentUtil with Vitest timer mocks', () => {
  let util;
  
  beforeEach(() => {
    vi.useFakeTimers();
    util = new TimeDependentUtil();
  });
  
  afterEach(() => {
    util.cleanup();
    vi.useRealTimers();
  });
  
  it('should execute function after delay with Vitest timers', () => {
    const mockFn = vi.fn();
    
    util.executeAfterDelay(mockFn, 2000);
    expect(mockFn).not.toHaveBeenCalled();
    
    // Advance by 1 second
    vi.advanceTimersByTime(1000);
    expect(mockFn).not.toHaveBeenCalled();
    
    // Advance by another second
    vi.advanceTimersByTime(1000);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
  
  it('should execute function at intervals with Vitest timers', () => {
    const mockFn = vi.fn();
    
    util.executeAtInterval(mockFn, 1000);
    expect(mockFn).not.toHaveBeenCalled();
    
    // Advance by 3.5 seconds
    vi.advanceTimersByTime(3500);
    expect(mockFn).toHaveBeenCalledTimes(3);
  });
});

// Example of testing with real time (for integration tests)
describe('TimeDependentUtil with real time (integration tests)', () => {
  let util;
  
  beforeEach(() => {
    util = new TimeDependentUtil();
  });
  
  afterEach(() => {
    util.cleanup();
  });
  
  it('should measure actual execution time', async () => {
    // This test uses real time
    const { executionTime } = util.measureExecutionTime(() => {
      // Simulate work by creating a simple loop
      let sum = 0;
      for (let i = 0; i < 1000000; i++) {
        sum += i;
      }
      return sum;
    });
    
    // The execution time should be positive
    expect(executionTime).toBeGreaterThan(0);
  });
  
  it('should execute function after delay (with timeout protection)', async () => {
    // Use withTimeout to protect against test hanging
    await withTimeout(async () => {
      let called = false;
      
      util.executeAfterDelay(() => {
        called = true;
      }, 50); // Short delay for test efficiency
      
      // Initially not called
      expect(called).toBe(false);
      
      // Wait a bit more than the delay
      await wait(60);
      
      // Should be called now
      expect(called).toBe(true);
    }, 500); // Overall timeout protection
  });
});