/**
 * Tests for the performanceNowMock utility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import performanceNowMock from '../../utils/performanceNowMock.js'
import { createTimeController, mockPerformanceNowSequence, wait, withTimeout } from '../utils/time-testing-utils.js';;

describe('performanceNowMock', () => {
  const originalPerformanceNow = performance.now;

  // Reset the mock state after each test
  afterEach(() => {
    try {
      performanceNowMock.uninstallPerformanceNowMock();
    } catch (e) {
      // Ignore errors during uninstall
    }
    performance.now = originalPerformanceNow;
  });

  describe('Installation and uninstallation', () => {
    it('should properly install and uninstall the mock', () => {
      // Original performance.now returns a different value each time
      const originalValue = performance.now();
      
      // Install the mock
      performanceNowMock.installPerformanceNowMock();
      
      // Mocked performance.now returns the same value when not advanced
      const mockedValue1 = performance.now();
      const mockedValue2 = performance.now();
      expect(mockedValue1).toBe(mockedValue2);
      
      // Uninstall the mock
      performanceNowMock.uninstallPerformanceNowMock();
      
      // Original behavior should be restored
      const restoredValue = performance.now();
      expect(typeof restoredValue).toBe('number');
      expect(restoredValue).not.toBe(mockedValue1);
    });

    it('should throw an error when installing twice', () => {
      performanceNowMock.installPerformanceNowMock();
      expect(() => performanceNowMock.installPerformanceNowMock()).toThrow();
    });

    it('should allow custom start time', () => {
      const customStartTime = 12345;
      performanceNowMock.installPerformanceNowMock({ startTime: customStartTime });
      expect(performance.now()).toBe(customStartTime);
    });
  });

  describe('Time control', () => {
    beforeEach(() => {
      performanceNowMock.installPerformanceNowMock({ startTime: 1000 });
    });

    it('should allow advancing time', () => {
      const initialTime = performance.now();
      performanceNowMock.advanceTime(500);
      expect(performance.now()).toBe(initialTime + 500);
    });

    it('should allow setting time to a specific value', () => {
      performanceNowMock.setTime(5000);
      expect(performance.now()).toBe(5000);
    });

    it('should allow resetting time to the initial value', () => {
      performanceNowMock.advanceTime(2000);
      performanceNowMock.resetTime();
      expect(performance.now()).not.toBe(3000); // 1000 (initial) + 2000 (advanced)
    });

    it('should allow getting the current time', () => {
      const currentTime = performanceNowMock.getCurrentTime();
      expect(performance.now()).toBe(currentTime);
    });

    it('should throw an error when advancing time without installing first', () => {
      performanceNowMock.uninstallPerformanceNowMock();
      expect(() => performanceNowMock.advanceTime(100)).toThrow();
    });

    it('should throw an error when setting time without installing first', () => {
      performanceNowMock.uninstallPerformanceNowMock();
      expect(() => performanceNowMock.setTime(100)).toThrow();
    });
  });

  describe('Integration with Vitest fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      performanceNowMock.installPerformanceNowMock({ startTime: 1000 });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should advance both performance.now and Vitest timers', () => {
      const initialTime = performance.now();
      const initialDate = Date.now();
      
      // Advance both
      performanceNowMock.advanceTimeAndFakeTimers(5000, vi);
      
      // Check performance.now
      expect(performance.now()).toBe(initialTime + 5000);
      
      // Check Date.now (controlled by Vitest fake timers)
      expect(Date.now()).toBeGreaterThan(initialDate);
    });

    it('should throw when vi is not provided', () => {
      expect(() => performanceNowMock.advanceTimeAndFakeTimers(1000)).toThrow();
    });

    it('should simulate long operations', () => {
      const initialTime = performance.now();
      const initialDate = Date.now();
      
      // Simulate a 30-minute operation
      performanceNowMock.simulateLongOperation(30 * 60 * 1000, vi);
      
      // Check that time advanced by 30 minutes
      expect(performance.now()).toBe(initialTime + 30 * 60 * 1000);
      expect(Date.now()).toBeGreaterThan(initialDate);
    });

    it('should simulate long operations without vi', () => {
      const initialTime = performance.now();
      
      // Simulate a 30-minute operation without vi
      performanceNowMock.simulateLongOperation(30 * 60 * 1000);
      
      // Check that performance.now advanced by 30 minutes
      expect(performance.now()).toBe(initialTime + 30 * 60 * 1000);
    });
  });
});