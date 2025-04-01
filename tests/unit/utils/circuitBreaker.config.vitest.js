/**
 * @file circuitBreaker.config.vitest.js
 * @description Tests for CircuitBreaker configuration options and edge cases
 * 
 * This file focuses on testing various configuration options of the CircuitBreaker utility,
 * as well as edge cases and advanced usage patterns.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker } from '../../../utils/circuitBreaker.js';
import { createTimeController } from '../../utils/time-testing-utils.js';

// Mock logger to reduce test noise
vi.mock('../../../utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('CircuitBreaker Configuration and Edge Cases', () => {
  let timeController;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up time controller to manage time in tests
    timeController = createTimeController().setup();
  });
  
  afterEach(() => {
    timeController.restore();
  });
  
  /**
   * Tests for configuration options
   */
  describe('Configuration Options', () => {
    it('should use provided failureThreshold', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 10 });
      
      // Record failures but less than threshold
      for (let i = 0; i < 9; i++) {
        breaker.recordFailure();
      }
      
      // Should still be closed
      expect(breaker.getState()).toBe('CLOSED');
      
      // One more failure should open the circuit
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
    });
    
    it('should use provided resetTimeout', () => {
      const resetTimeout = 5000;
      const breaker = new CircuitBreaker({ resetTimeout });
      
      // Force to OPEN state
      breaker.forceState('OPEN');
      
      // Advance time, but not enough to transition
      timeController.advanceTime(resetTimeout - 100);
      breaker.isOpen();
      
      // Should still be OPEN
      expect(breaker.getState()).toBe('OPEN');
      
      // Advance time past the timeout
      timeController.advanceTime(200);
      breaker.isOpen();
      
      // Should now be HALF_OPEN
      expect(breaker.getState()).toBe('HALF_OPEN');
    });
    
    it('should use provided successThreshold', () => {
      const successThreshold = 5;
      const breaker = new CircuitBreaker({ successThreshold });
      
      // Force to HALF_OPEN state
      breaker.forceState('HALF_OPEN');
      
      // Record successes but less than threshold
      for (let i = 0; i < 4; i++) {
        breaker.recordSuccess();
      }
      
      // Should still be HALF_OPEN
      expect(breaker.getState()).toBe('HALF_OPEN');
      
      // One more success should close the circuit
      breaker.recordSuccess();
      expect(breaker.getState()).toBe('CLOSED');
    });
    
    it('should use provided name', () => {
      const customName = 'CustomCircuitBreaker';
      const breaker = new CircuitBreaker({ name: customName });
      
      expect(breaker.name).toBe(customName);
    });
  });
  
  /**
   * Tests for edge cases
   */
  describe('Edge Cases', () => {
    it('should handle zero failure threshold', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 0 });
      
      // Even a single failure should open the circuit
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
    });
    
    it('should handle zero success threshold', () => {
      const breaker = new CircuitBreaker({ successThreshold: 0 });
      
      // Force to HALF_OPEN state
      breaker.forceState('HALF_OPEN');
      
      // Should immediately transition to CLOSED even without recordSuccess
      expect(breaker.getState()).toBe('CLOSED');
    });
    
    it('should handle extremely large failure threshold', () => {
      const breaker = new CircuitBreaker({ failureThreshold: Number.MAX_SAFE_INTEGER });
      
      // Record many failures
      for (let i = 0; i < 1000; i++) {
        breaker.recordFailure();
      }
      
      // Should still be CLOSED due to high threshold
      expect(breaker.getState()).toBe('CLOSED');
    });
    
    it('should handle extremely short reset timeout', () => {
      const breaker = new CircuitBreaker({ resetTimeout: 1 });
      
      // Force to OPEN state
      breaker.forceState('OPEN');
      
      // Advance time past the short timeout
      timeController.advanceTime(2);
      breaker.isOpen();
      
      // Should be HALF_OPEN now
      expect(breaker.getState()).toBe('HALF_OPEN');
    });
    
    it('should handle extremely long reset timeout', () => {
      const longTimeout = 24 * 60 * 60 * 1000; // 1 day
      const breaker = new CircuitBreaker({ resetTimeout: longTimeout });
      
      // Force to OPEN state
      breaker.forceState('OPEN');
      
      // Advance time, but not past the long timeout
      timeController.advanceTime(longTimeout / 2);
      breaker.isOpen();
      
      // Should still be OPEN
      expect(breaker.getState()).toBe('OPEN');
    });
  });
  
  /**
   * Tests for the failure rate measurement
   */
  describe('Failure Rate', () => {
    it('should maintain failure count in CLOSED state', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 5 });
      
      // Record some failures
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure();
      }
      
      // Check the failureCount
      expect(breaker.getStats().failureCount).toBe(3);
    });
    
    it('should reset failure count on success', () => {
      const breaker = new CircuitBreaker();
      
      // Record some failures
      breaker.recordFailure();
      breaker.recordFailure();
      
      // Verify failures are recorded
      expect(breaker.getStats().failureCount).toBe(2);
      
      // Record a success
      breaker.recordSuccess();
      
      // Failure count should be reset
      expect(breaker.getStats().failureCount).toBe(0);
    });
    
    it('should reset success count on state transitions except to HALF_OPEN', () => {
      const breaker = new CircuitBreaker({ successThreshold: 3 });
      
      // Force to HALF_OPEN
      breaker.forceState('HALF_OPEN');
      
      // Record some successes
      breaker.recordSuccess();
      breaker.recordSuccess();
      
      // Verify success count
      expect(breaker.getStats().successCount).toBe(2);
      
      // Force to OPEN (should reset success count)
      breaker.forceState('OPEN');
      
      // Success count should be reset
      expect(breaker.getStats().successCount).toBe(0);
    });
  });
  
  /**
   * Tests for using multiple circuit breakers
   */
  describe('Multiple Circuit Breakers', () => {
    it('should maintain separate state for different circuit breakers', () => {
      const breaker1 = new CircuitBreaker({ name: 'Breaker1' });
      const breaker2 = new CircuitBreaker({ name: 'Breaker2' });
      
      // Open the first breaker
      breaker1.forceState('OPEN');
      
      // The second breaker should still be closed
      expect(breaker1.getState()).toBe('OPEN');
      expect(breaker2.getState()).toBe('CLOSED');
    });
    
    it('should allow different configurations for different services', () => {
      // Critical service with low threshold and quick recovery
      const criticalBreaker = new CircuitBreaker({
        name: 'CriticalService',
        failureThreshold: 1,
        resetTimeout: 5000,
        successThreshold: 1
      });
      
      // Non-critical service with higher tolerance
      const nonCriticalBreaker = new CircuitBreaker({
        name: 'NonCriticalService',
        failureThreshold: 10,
        resetTimeout: 30000,
        successThreshold: 3
      });
      
      // One failure opens the critical breaker
      criticalBreaker.recordFailure();
      expect(criticalBreaker.getState()).toBe('OPEN');
      
      // Same failure count doesn't affect non-critical breaker
      nonCriticalBreaker.recordFailure();
      expect(nonCriticalBreaker.getState()).toBe('CLOSED');
    });
  });
  
  /**
   * Tests for monitoring and history
   */
  describe('Monitoring and History', () => {
    it('should track state history with correct timestamps', () => {
      const breaker = new CircuitBreaker();
      const initialTime = Date.now();
      
      // Force some state changes with time advancement
      breaker.forceState('OPEN');
      timeController.advanceTime(1000);
      
      breaker.forceState('HALF_OPEN');
      timeController.advanceTime(1000);
      
      breaker.forceState('CLOSED');
      
      // Get the history
      const history = breaker.getStats().stateHistory;
      
      // Verify history entries
      expect(history.length).toBeGreaterThanOrEqual(4); // Initial + 3 changes
      
      // Check timestamps are advancing
      for (let i = 1; i < history.length; i++) {
        expect(history[i].timestamp).toBeGreaterThan(history[i-1].timestamp);
      }
      
      // Check the time differences are reasonable
      expect(history[2].timestamp - history[1].timestamp).toBeGreaterThanOrEqual(1000);
      expect(history[3].timestamp - history[2].timestamp).toBeGreaterThanOrEqual(1000);
    });
    
    it('should include reason in state history', () => {
      const breaker = new CircuitBreaker();
      
      // Force state with custom reason
      const customReason = 'Custom test reason';
      breaker.forceState('OPEN', customReason);
      
      // Get the history
      const history = breaker.getStats().stateHistory;
      const lastEntry = history[history.length - 1];
      
      // Check the reason
      expect(lastEntry.reason).toBe(customReason);
    });
    
    it('should limit history size', () => {
      const breaker = new CircuitBreaker();
      
      // Generate lots of state changes
      for (let i = 0; i < 200; i++) {
        if (i % 2 === 0) {
          breaker.forceState('OPEN', `Test ${i}`);
        } else {
          breaker.forceState('CLOSED', `Test ${i}`);
        }
      }
      
      // Get the history
      const history = breaker.getStats().stateHistory;
      
      // Should be limited to 100 entries
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });
});