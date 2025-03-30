/**
 * Time Controller Helper
 * 
 * A utility class for managing time in tests:
 * - Provides a consistent way to mock time-related functions (Date, setTimeout, etc.)
 * - Manages setup/teardown of time mocks to prevent test interference
 * - Offers high-level methods for time manipulation in tests
 * 
 * This approach improves test reliability by ensuring consistent time handling.
 */

import { vi } from 'vitest';

export class TimeController {
  constructor() {
    this.originalPerformanceNow = global.performance ? global.performance.now : null;
    this.originalDateNow = Date.now;
    this.originalSetTimeout = setTimeout;
    this.originalSetInterval = setInterval;
    this.originalClearTimeout = clearTimeout;
    this.originalClearInterval = clearInterval;
    this.currentTime = 0;
  }

  /**
   * Set up time mocking
   */
  setup() {
    // Use vitest's fake timers
    vi.useFakeTimers();
    
    // Set initial fake time if needed
    if (this.currentTime > 0) {
      vi.setSystemTime(this.currentTime);
    }
    
    // Mock performance.now if it exists
    if (global.performance) {
      global.performance.now = vi.fn(() => {
        return this.currentTime;
      });
    }
  }

  /**
   * Clean up time mocking
   */
  teardown() {
    // Restore vitest's timers
    vi.useRealTimers();
    
    // Restore performance.now if it was mocked
    if (global.performance && this.originalPerformanceNow) {
      global.performance.now = this.originalPerformanceNow;
    }
  }

  /**
   * Advance time by a specific amount of milliseconds
   * @param {number} ms - Milliseconds to advance
   */
  advanceTimersByTime(ms) {
    vi.advanceTimersByTime(ms);
    this.currentTime += ms;
  }

  /**
   * Advance time to trigger the next timer
   */
  advanceTimersToNextTimer() {
    const delay = vi.getNextTimerDelay();
    if (delay !== undefined) {
      this.advanceTimersByTime(delay);
    }
  }

  /**
   * Run all pending timers
   */
  runAllTimers() {
    vi.runAllTimers();
    
    // Update our current time to match vitest's time
    this.currentTime = new Date().getTime();
  }

  /**
   * Set the current time to a specific value
   * @param {number|Date} time - The time to set
   */
  setCurrentTime(time) {
    if (time instanceof Date) {
      this.currentTime = time.getTime();
    } else {
      this.currentTime = time;
    }
    
    vi.setSystemTime(this.currentTime);
  }

  /**
   * Get the current mocked time
   * @returns {number} The current time in milliseconds
   */
  getCurrentTime() {
    return this.currentTime;
  }
}