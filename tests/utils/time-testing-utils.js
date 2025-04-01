/**
 * Time Testing Utilities
 * 
 * Utilities for testing time-dependent code in a deterministic way.
 * Particularly useful for testing components with timeouts, intervals,
 * or date-based behaviors.
 */

/**
 * Creates a time controller for testing time-dependent code
 * @returns {Object} Time controller with methods to manipulate and control time in tests
 */
function createTimeController() {
  // Store original time functions
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const originalDateNow = Date.now;
  
  // Track active timers
  const timeouts = new Map();
  const intervals = new Map();
  
  // Current virtual time
  let currentTime = 0;
  
  // Custom fake implementations
  const fakeSetTimeout = (callback, delay, ...args) => {
    const id = Symbol('timeout');
    const executeTime = currentTime + delay;
    timeouts.set(id, { callback, executeTime, args });
    return id;
  };
  
  const fakeClearTimeout = (id) => {
    timeouts.delete(id);
  };
  
  const fakeSetInterval = (callback, delay, ...args) => {
    const id = Symbol('interval');
    intervals.set(id, { callback, delay, nextExecuteTime: currentTime + delay, args });
    return id;
  };
  
  const fakeClearInterval = (id) => {
    intervals.delete(id);
  };
  
  const fakeDateNow = () => {
    return currentTime;
  };
  
  /**
   * Installs fake timers
   */
  const install = () => {
    global.setTimeout = fakeSetTimeout;
    global.clearTimeout = fakeClearTimeout;
    global.setInterval = fakeSetInterval;
    global.clearInterval = fakeClearInterval;
    Date.now = fakeDateNow;
  };
  
  /**
   * Restores original timer functions
   */
  const uninstall = () => {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    Date.now = originalDateNow;
  };
  
  /**
   * Advances the virtual time by the specified amount
   * and executes any timers that have been triggered
   * @param {number} ms Milliseconds to advance time by
   */
  const advanceTime = (ms) => {
    const targetTime = currentTime + ms;
    
    // Process timeouts and intervals until we reach target time
    while (currentTime < targetTime) {
      // Find the next timer to execute
      let nextExecuteTime = targetTime;
      
      // Check timeouts
      for (const { executeTime } of timeouts.values()) {
        if (executeTime > currentTime && executeTime <= targetTime) {
          nextExecuteTime = Math.min(nextExecuteTime, executeTime);
        }
      }
      
      // Check intervals
      for (const { nextExecuteTime: executeTime } of intervals.values()) {
        if (executeTime > currentTime && executeTime <= targetTime) {
          nextExecuteTime = Math.min(nextExecuteTime, executeTime);
        }
      }
      
      // Advance to the next execution time
      currentTime = nextExecuteTime;
      
      // Execute timeouts
      for (const [id, { callback, executeTime, args }] of timeouts.entries()) {
        if (executeTime <= currentTime) {
          timeouts.delete(id);
          try {
            callback(...args);
          } catch (error) {
            console.error('Error in setTimeout callback:', error);
          }
        }
      }
      
      // Execute intervals
      for (const [id, interval] of intervals.entries()) {
        if (interval.nextExecuteTime <= currentTime) {
          // Schedule next execution
          interval.nextExecuteTime = currentTime + interval.delay;
          try {
            interval.callback(...interval.args);
          } catch (error) {
            console.error('Error in setInterval callback:', error);
          }
        }
      }
    }
  };
  
  /**
   * Advances time by running the next pending timer (if any)
   * @returns {boolean} true if a timer was executed, false otherwise
   */
  const runNextTimer = () => {
    let nextTimer = null;
    let nextTime = Infinity;
    
    // Find the next timeout
    for (const [id, { executeTime }] of timeouts.entries()) {
      if (executeTime < nextTime) {
        nextTime = executeTime;
        nextTimer = { type: 'timeout', id };
      }
    }
    
    // Find the next interval
    for (const [id, { nextExecuteTime }] of intervals.entries()) {
      if (nextExecuteTime < nextTime) {
        nextTime = nextExecuteTime;
        nextTimer = { type: 'interval', id };
      }
    }
    
    if (nextTimer) {
      advanceTime(nextTime - currentTime);
      return true;
    }
    
    return false;
  };
  
  /**
   * Runs all pending timers
   */
  const runAllTimers = () => {
    while (runNextTimer()) {
      // Keep running timers until none remain
    }
  };
  
  /**
   * Sets the current time to a specific value
   * @param {number} time The new current time
   */
  const setCurrentTime = (time) => {
    if (time < currentTime) {
      throw new Error('Cannot set time to a value in the past');
    }
    advanceTime(time - currentTime);
  };
  
  /**
   * Gets the current virtual time
   * @returns {number} The current virtual time
   */
  const getCurrentTime = () => {
    return currentTime;
  };
  
  /**
   * Resets the time controller to its initial state
   */
  const reset = () => {
    timeouts.clear();
    intervals.clear();
    currentTime = 0;
  };
  
  /**
   * Gets the number of pending timeouts
   * @returns {number} The number of pending timeouts
   */
  const getPendingTimeoutsCount = () => {
    return timeouts.size;
  };
  
  /**
   * Gets the number of active intervals
   * @returns {number} The number of active intervals
   */
  const getIntervalsCount = () => {
    return intervals.size;
  };
  
  return {
    install,
    uninstall,
    advanceTime,
    runNextTimer,
    runAllTimers,
    setCurrentTime,
    getCurrentTime,
    reset,
    getPendingTimeoutsCount,
    getIntervalsCount,
    
    /**
     * Setup method for easier initialization in tests
     * @returns {Object} The time controller
     */
    setup() {
      install();
      reset();
      return this;
    },
    
    /**
     * Restores original timer functions and resets state
     */
    restore() {
      uninstall();
      reset();
    }
  };
}

/**
 * Creates a sleeper utility that uses fake or real setTimeout based on context
 * @returns {Function} sleep function that returns a promise resolving after the specified delay
 */
function createSleeper() {
  return (ms) => new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  createTimeController,
  createSleeper
};