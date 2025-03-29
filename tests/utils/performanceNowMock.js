/**
 * Performance.now() Mock for Testing
 * 
 * This module provides a utility to mock the performance.now() function for testing
 * time-sensitive code without relying on actual timing or setTimeout.
 * 
 * It supports:
 * - Predefined sequence of timestamps
 * - Auto-incrementing timestamps
 * - Timestamp manipulation for simulating specific scenarios
 */

import { vi } from 'vitest';

/**
 * Mock performance.now() with predefined timestamps
 * @param {number[]|null} timestamps - Array of timestamps to return in sequence, or null to use auto-incrementing
 * @param {Object} options - Configuration options
 * @param {number} options.startTime - Starting timestamp value (default: 0)
 * @param {number} options.increment - Amount to increment by for auto-generated timestamps (default: 100)
 * @returns {Object} Control object with utilities for manipulating timestamps
 */
export function mockPerformanceNow(timestamps = null, options = {}) {
  const defaultOptions = {
    startTime: 0,
    increment: 100, // Default increment of 100ms
  };
  
  const config = { ...defaultOptions, ...options };
  let callCount = 0;
  let currentTime = config.startTime;
  let timestampSequence = timestamps ? [...timestamps] : null;
  
  // Create the mock function
  const performanceNowMock = vi.fn().mockImplementation(() => {
    // If using predefined sequence
    if (timestampSequence && timestampSequence.length > 0) {
      // If we have timestamps remaining in the sequence, use the next one
      if (callCount < timestampSequence.length) {
        const time = timestampSequence[callCount];
        callCount++;
        return time;
      }
      
      // If we've exhausted the sequence, use the last timestamp + increment
      const lastTime = timestampSequence[timestampSequence.length - 1];
      callCount++;
      return lastTime + ((callCount - timestampSequence.length) * config.increment);
    }
    
    // If using auto-increment mode
    const time = currentTime;
    currentTime += config.increment;
    callCount++;
    return time;
  });
  
  // Replace the global performance.now
  const originalPerformanceNow = performance.now;
  performance.now = performanceNowMock;
  
  // Return control object with utilities
  return {
    // Access the mock function directly
    mock: performanceNowMock,
    
    // Get current call count
    getCallCount: () => callCount,
    
    // Reset to initial state
    reset: () => {
      callCount = 0;
      currentTime = config.startTime;
      if (timestamps) {
        timestampSequence = [...timestamps];
      }
      performanceNowMock.mockClear();
    },
    
    // Advance the time by a specific amount (useful for simulating elapsed time)
    advanceTime: (amount) => {
      if (timestampSequence) {
        // Add a new timestamp to the sequence
        timestampSequence.push(
          (timestampSequence[timestampSequence.length - 1] || 0) + amount
        );
      } else {
        currentTime += amount;
      }
    },
    
    // Set the current time to a specific value
    setTime: (time) => {
      if (timestampSequence) {
        // Add a new specific timestamp to the sequence
        timestampSequence.push(time);
      } else {
        currentTime = time;
      }
    },
    
    // Add multiple timestamps at once
    addTimestamps: (newTimestamps) => {
      if (!timestampSequence) {
        timestampSequence = [];
      }
      timestampSequence.push(...newTimestamps);
    },
    
    // Restore the original performance.now function
    restore: () => {
      performance.now = originalPerformanceNow;
    }
  };
}

/**
 * Create a simulated timeline of timestamps for complex timing tests
 * @param {Object} scenario - Timing scenario to simulate
 * @param {number} scenario.initialDelay - Time before first operation
 * @param {number} scenario.networkLatency - Simulated network latency for requests
 * @param {number} scenario.processingTime - Simulated processing time for operations
 * @param {number} scenario.operationCount - Number of operations to simulate
 * @returns {number[]} Array of timestamps representing the scenario
 */
export function createTimingScenario(scenario = {}) {
  const defaults = {
    initialDelay: 50,
    networkLatency: 200,
    processingTime: 150,
    operationCount: 3
  };
  
  const config = { ...defaults, ...scenario };
  const timestamps = [0]; // Start at 0
  let currentTime = config.initialDelay;
  
  // Simulate a sequence of operations with network and processing components
  for (let i = 0; i < config.operationCount; i++) {
    // Request start
    timestamps.push(currentTime);
    
    // After network latency (request received)
    currentTime += config.networkLatency;
    timestamps.push(currentTime);
    
    // After processing (response ready)
    currentTime += config.processingTime;
    timestamps.push(currentTime);
    
    // Small gap between operations
    currentTime += 50;
  }
  
  return timestamps;
}

/**
 * Create a simulated error timing scenario
 * @param {Object} scenario - Error timing scenario to simulate
 * @param {number} scenario.initialDelay - Time before first operation
 * @param {number} scenario.timeToError - Time until error occurs
 * @param {number} scenario.recoveryTime - Time to recover from error
 * @returns {number[]} Array of timestamps representing the error scenario
 */
export function createErrorTimingScenario(scenario = {}) {
  const defaults = {
    initialDelay: 50,
    timeToError: 300,
    recoveryTime: 500
  };
  
  const config = { ...defaults, ...scenario };
  return [
    0, // Starting time
    config.initialDelay, // Initial delay
    config.initialDelay + config.timeToError, // Error occurs
    config.initialDelay + config.timeToError + config.recoveryTime // Recovery complete
  ];
}

/**
 * Mock for simulating a specific performance profile
 * @param {string} profile - Predefined performance profile ('fast', 'slow', 'inconsistent', etc.)
 * @returns {Object} Performance now mock controller
 */
export function mockPerformanceProfile(profile = 'normal') {
  // Predefined performance profiles
  const profiles = {
    fast: {
      initialDelay: 10,
      networkLatency: 50,
      processingTime: 30,
      operationCount: 5
    },
    slow: {
      initialDelay: 100,
      networkLatency: 350,
      processingTime: 500,
      operationCount: 3
    },
    inconsistent: [0, 10, 50, 500, 520, 530, 1200, 1300, 1310],
    timeout: [0, 100, 200, 30000, 31000],
    error: createErrorTimingScenario()
  };
  
  // Use the selected profile or fallback to normal
  const selectedProfile = profiles[profile] || profiles.normal;
  
  // If the profile is an array, use it directly
  if (Array.isArray(selectedProfile)) {
    return mockPerformanceNow(selectedProfile);
  }
  
  // Otherwise, create a timing scenario from the profile config
  const timestamps = createTimingScenario(selectedProfile);
  return mockPerformanceNow(timestamps);
}

// Export for use in tests
export default {
  mockPerformanceNow,
  createTimingScenario,
  createErrorTimingScenario,
  mockPerformanceProfile
};