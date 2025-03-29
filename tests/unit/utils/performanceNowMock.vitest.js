/**
 * @file performanceNowMock.vitest.js
 * @description Tests for the performanceNowMock utility
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockPerformanceNow, createTimingScenario, mockPerformanceProfile } from '../../utils/performanceNowMock.js';

describe('performanceNowMock', () => {
  let perfMock;
  
  afterEach(() => {
    // Clean up the mock after each test
    if (perfMock && perfMock.restore) {
      perfMock.restore();
    }
  });
  
  test('should return predefined timestamps in sequence', () => {
    // Arrange
    const timestamps = [0, 100, 250, 400];
    perfMock = mockPerformanceNow(timestamps);
    
    // Act & Assert
    expect(performance.now()).toBe(0);
    expect(performance.now()).toBe(100);
    expect(performance.now()).toBe(250);
    expect(performance.now()).toBe(400);
  });
  
  test('should auto-increment timestamps when no sequence is provided', () => {
    // Arrange
    perfMock = mockPerformanceNow(null, { startTime: 50, increment: 200 });
    
    // Act & Assert
    expect(performance.now()).toBe(50);
    expect(performance.now()).toBe(250);
    expect(performance.now()).toBe(450);
  });
  
  test('should continue incrementing after predefined sequence is exhausted', () => {
    // Arrange
    const timestamps = [10, 20, 30];
    perfMock = mockPerformanceNow(timestamps, { increment: 50 });
    
    // Act - Use up the predefined sequence
    performance.now(); // 10
    performance.now(); // 20
    performance.now(); // 30
    
    // Assert - Should continue with increments
    expect(performance.now()).toBe(80); // 30 + 50
    expect(performance.now()).toBe(130); // 80 + 50
  });
  
  test('should allow modifying timing during a test', () => {
    // Arrange
    perfMock = mockPerformanceNow(null, { startTime: 0, increment: 100 });
    
    // Act & Assert - Initial behavior
    expect(performance.now()).toBe(0);
    expect(performance.now()).toBe(100);
    
    // Act - Modify timing
    perfMock.advanceTime(500);
    
    // Assert - Modified behavior 
    // Current time is now 600 (100 + 500)
    expect(performance.now()).toBe(700); // Each call increments by 100, so 600 + 100
  });
  
  test('should reset to initial state', () => {
    // Arrange
    const timestamps = [50, 150, 300];
    perfMock = mockPerformanceNow(timestamps);
    
    // Act - Use some timestamps
    performance.now(); // 50
    performance.now(); // 150
    
    // Act - Reset the mock
    perfMock.reset();
    
    // Assert - Should start from the beginning again
    expect(performance.now()).toBe(50);
  });
  
  test('should track call count', () => {
    // Arrange
    perfMock = mockPerformanceNow();
    
    // Act
    performance.now();
    performance.now();
    performance.now();
    
    // Assert
    expect(perfMock.getCallCount()).toBe(3);
  });
  
  test('should restore original performance.now', () => {
    // Arrange
    const originalPerformanceNow = performance.now;
    perfMock = mockPerformanceNow();
    
    // Act
    perfMock.restore();
    
    // Assert
    expect(performance.now).toBe(originalPerformanceNow);
  });
});

describe('createTimingScenario', () => {
  test('should create a realistic timing scenario', () => {
    // Arrange & Act
    const scenario = createTimingScenario({
      initialDelay: 20,
      networkLatency: 100,
      processingTime: 80,
      operationCount: 2
    });
    
    // Assert
    expect(scenario).toHaveLength(7); // 1 (start) + 2 operations * 3 timestamps
    expect(scenario[0]).toBe(0); // Starting timestamp
    expect(scenario[1]).toBe(20); // Initial delay
    expect(scenario[2]).toBe(120); // After first network latency
    expect(scenario[3]).toBe(200); // After first processing
  });
});

describe('mockPerformanceProfile', () => {
  let perfMock;
  
  afterEach(() => {
    if (perfMock && perfMock.restore) {
      perfMock.restore();
    }
  });
  
  test('should use fast profile correctly', () => {
    // Arrange
    perfMock = mockPerformanceProfile('fast');
    
    // Act & Assert - Sample a few timestamps from the fast profile
    expect(performance.now()).toBe(0); // Starting point
    expect(performance.now()).toBe(10); // Initial delay
    
    // Fast profile should have quick succession of timestamps
    const timestamps = [];
    for (let i = 0; i < 5; i++) {
      timestamps.push(performance.now());
    }
    
    // Verify we have small increments (characteristic of 'fast' profile)
    for (let i = 1; i < timestamps.length; i++) {
      const diff = timestamps[i] - timestamps[i-1];
      expect(diff).toBeLessThan(100); // Fast profile has small increments
    }
  });
  
  test('should use slow profile correctly', () => {
    // Arrange
    perfMock = mockPerformanceProfile('slow');
    
    // Act & Assert - Sample a few timestamps from the slow profile
    expect(performance.now()).toBe(0); // Starting point
    expect(performance.now()).toBe(100); // Initial delay in slow profile
    
    // Get next few timestamps
    const timestamp1 = performance.now();
    const timestamp2 = performance.now();
    
    // Verify we have larger increments (characteristic of 'slow' profile)
    const diff = timestamp2 - timestamp1;
    expect(diff).toBeGreaterThan(300); // Slow profile has larger increments
  });
  
  test('should use inconsistent profile correctly', () => {
    // Arrange
    perfMock = mockPerformanceProfile('inconsistent');
    
    // Act - Get all timestamps
    const timestamps = [];
    for (let i = 0; i < 9; i++) { // 'inconsistent' profile has 9 predefined timestamps
      timestamps.push(performance.now());
    }
    
    // Assert - Should match the pattern with inconsistent gaps
    expect(timestamps[2] - timestamps[1]).not.toEqual(timestamps[3] - timestamps[2]);
    expect(timestamps[5] - timestamps[4]).not.toEqual(timestamps[6] - timestamps[5]);
    
    // Verify big jump which is characteristic of the inconsistent profile
    const bigJump = timestamps.some((val, i) => {
      return i > 0 && (val - timestamps[i-1]) > 400;
    });
    expect(bigJump).toBe(true);
  });
});

// Example usage in a real-world test
describe('Performance timing demonstration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  test('should measure execution time of a function', () => {
    // Arrange
    const perfMock = mockPerformanceNow([0, 150]); // Simulate 150ms execution time
    
    const timedFunction = () => {
      const start = performance.now();
      
      // Function logic would go here
      
      const end = performance.now();
      return end - start; // Return execution time
    };
    
    // Act
    const executionTime = timedFunction();
    
    // Assert
    expect(executionTime).toBe(150);
    perfMock.restore();
  });
  
  test('should measure time across multiple operations', () => {
    // Arrange
    const perfMock = mockPerformanceNow([0, 100, 250, 300]);
    
    // Simulated operation with timing measurements
    const performOperations = () => {
      const timings = [];
      const startTime = performance.now(); // 0
      
      // First operation
      timings.push(performance.now() - startTime); // 100 - 0 = 100
      
      // Second operation
      timings.push(performance.now() - startTime); // 250 - 0 = 250
      
      // Final timing
      const totalTime = performance.now() - startTime; // 300 - 0 = 300
      
      return { timings, totalTime };
    };
    
    // Act
    const result = performOperations();
    
    // Assert
    expect(result.timings).toEqual([100, 250]);
    expect(result.totalTime).toBe(300);
    perfMock.restore();
  });
});