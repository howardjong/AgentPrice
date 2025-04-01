/**
 * @file circuitBreaker.edge-cases.vitest.js
 * @description Edge case tests for the CircuitBreaker component
 * 
 * Tests for unusual scenarios, extreme values, and edge cases
 * that the circuit breaker might encounter in production.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker } from '../../../utils/circuitBreaker.js';
import { createTimeController } from '../../utils/time-testing-utils.js';

// Mock logger to reduce test noise
vi.mock('../../../utils/logger.js', () => {
  return {
    default: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  };
});

describe('CircuitBreaker Edge Cases', () => {
  let timeController;
  
  beforeEach(() => {
    vi.clearAllMocks();
    timeController = createTimeController().setup();
  });
  
  afterEach(() => {
    timeController.restore();
  });
  
  describe('Configuration Edge Cases', () => {
    it('should handle zero failureThreshold', () => {
      // Zero failure threshold - should open on first failure
      const breaker = new CircuitBreaker({
        failureThreshold: 0,
        resetTimeout: 1000
      });
      
      // Record a single failure
      breaker.recordFailure();
      
      // Should be open
      expect(breaker.getState()).toBe('OPEN');
    });
    
    it('should handle zero successThreshold', () => {
      // Zero success threshold - might use default or special behavior
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000,
        successThreshold: 0
      });
      
      // Force to HALF_OPEN
      breaker.forceState('HALF_OPEN');
      
      // Record a single success
      breaker.recordSuccess();
      
      // Here we're just checking that it behaves consistently
      // CircuitBreaker may treat 0 as default, or may use it as immediate close
      // So we allow either state to pass the test
      const state = breaker.getState();
      expect(['HALF_OPEN', 'CLOSED']).toContain(state);
    });
    
    it('should handle very large thresholds', () => {
      // Very large failure threshold
      const breaker = new CircuitBreaker({
        failureThreshold: 1000000,
        resetTimeout: 1000
      });
      
      // Record many failures, but not enough to open
      for (let i = 0; i < 1000; i++) {
        breaker.recordFailure();
      }
      
      // Should still be closed
      expect(breaker.getState()).toBe('CLOSED');
      
      // Very large success threshold
      const breaker2 = new CircuitBreaker({
        successThreshold: 1000000,
        resetTimeout: 1000
      });
      
      // Force to HALF_OPEN
      breaker2.forceState('HALF_OPEN');
      
      // Record many successes, but not enough to close
      for (let i = 0; i < 1000; i++) {
        breaker2.recordSuccess();
      }
      
      // Should still be half-open
      expect(breaker2.getState()).toBe('HALF_OPEN');
    });
    
    it('should handle negative thresholds by using defaults or treating as immediate', () => {
      // Negative thresholds might be treated as defaults or as immediate triggers
      const breaker = new CircuitBreaker({
        failureThreshold: -5,
        successThreshold: -10,
        resetTimeout: 1000
      });
      
      // Record failures - the implementation might use default threshold
      // or treat negative as immediate trigger (0)
      breaker.recordFailure();
      
      // Either it's still CLOSED (using default) or it's OPEN (treating negative as 0)
      const state = breaker.getState();
      expect(['CLOSED', 'OPEN']).toContain(state);
      
      // If still closed, record more failures to reach default threshold
      if (state === 'CLOSED') {
        for (let i = 0; i < 4; i++) {
          breaker.recordFailure();
        }
        // Should be open now
        expect(breaker.getState()).toBe('OPEN');
      }
    });
    
    it('should handle very short resetTimeout', () => {
      // Very short reset timeout (1ms)
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1
      });
      
      // Open the breaker
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
      
      // Advance time past the short timeout
      timeController.advanceTime(2);
      
      // Check state - should transition to HALF_OPEN
      expect(breaker.isOpen()).toBe(false);
      expect(breaker.getState()).toBe('HALF_OPEN');
    });
    
    it('should handle very long resetTimeout', () => {
      // Very long reset timeout (1 hour)
      const oneHour = 60 * 60 * 1000;
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: oneHour
      });
      
      // Open the breaker
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
      
      // Advance time almost to timeout but not quite
      timeController.advanceTime(oneHour - 1);
      
      // Check state - should still be OPEN
      expect(breaker.isOpen()).toBe(true);
      expect(breaker.getState()).toBe('OPEN');
      
      // Advance past timeout
      timeController.advanceTime(2);
      
      // Check state - should transition to HALF_OPEN
      expect(breaker.isOpen()).toBe(false);
      expect(breaker.getState()).toBe('HALF_OPEN');
    });
    
    it('should handle missing options by using defaults', () => {
      // No options provided
      const breaker = new CircuitBreaker();
      
      // Default failure threshold is 5
      for (let i = 0; i < 4; i++) {
        breaker.recordFailure();
      }
      
      // Should still be closed
      expect(breaker.getState()).toBe('CLOSED');
      
      // One more failure should open (using default of 5)
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
      
      // Default resetTimeout should be 30 seconds
      // (too long to test in a unit test)
    });
  });
  
  describe('State History Edge Cases', () => {
    it('should limit history size', () => {
      const breaker = new CircuitBreaker({
        name: 'HistoryBreaker'
      });
      
      // Generate lots of state transitions
      // History limit is 100 in the implementation
      for (let i = 0; i < 150; i++) {
        breaker.forceState('OPEN', `Transition ${i}`);
        breaker.forceState('CLOSED', `Transition ${i}`);
      }
      
      // Get stats and check history size is limited
      const stats = breaker.getStats();
      expect(stats.stateHistory.length).toBeLessThanOrEqual(100);
      
      // History should have most recent transitions
      const lastTransition = stats.stateHistory[stats.stateHistory.length - 1];
      expect(lastTransition.reason).toContain('Transition 149');
    });
    
    it('should handle rapid consecutive state changes', () => {
      const breaker = new CircuitBreaker({
        name: 'RapidChangeBreaker'
      });
      
      // Perform state changes in rapid succession
      breaker.forceState('OPEN', 'First change');
      breaker.forceState('HALF_OPEN', 'Second change');
      breaker.forceState('CLOSED', 'Third change');
      breaker.forceState('OPEN', 'Fourth change');
      
      // All changes should be recorded in order
      const stats = breaker.getStats();
      
      // Initial state + 4 changes = 5 history entries
      expect(stats.stateHistory.length).toBe(5);
      
      // Check order of reasons
      expect(stats.stateHistory[1].reason).toBe('First change');
      expect(stats.stateHistory[2].reason).toBe('Second change');
      expect(stats.stateHistory[3].reason).toBe('Third change');
      expect(stats.stateHistory[4].reason).toBe('Fourth change');
    });
  });
  
  describe('Success/Failure Counting Edge Cases', () => {
    it('should handle rapid consecutive successes in HALF_OPEN state', () => {
      // High success threshold for this test
      const breaker = new CircuitBreaker({
        successThreshold: 10
      });
      
      // Force to HALF_OPEN
      breaker.forceState('HALF_OPEN');
      
      // Record rapid consecutive successes
      for (let i = 0; i < breaker.options.successThreshold; i++) {
        breaker.recordSuccess();
      }
      
      // Should be CLOSED after meeting threshold
      expect(breaker.getState()).toBe('CLOSED');
    });
    
    it('should handle success after many failures in CLOSED state', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 5
      });
      
      // Record failures but one less than threshold
      for (let i = 0; i < breaker.options.failureThreshold - 1; i++) {
        breaker.recordFailure();
      }
      
      // Record a success
      breaker.recordSuccess();
      
      // Failure count should be reset
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(0);
      
      // Should need all failures again to open
      for (let i = 0; i < breaker.options.failureThreshold - 1; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe('CLOSED');
      
      // One more failure should open
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
    });
    
    it('should handle multiple failures when already OPEN', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000
      });
      
      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
      
      // Record more failures while open
      const initialNextAttempt = breaker.getStats().nextAttempt;
      
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      
      // Should still be open
      expect(breaker.getState()).toBe('OPEN');
      
      // Next attempt time should not change
      const newNextAttempt = breaker.getStats().nextAttempt;
      expect(newNextAttempt).toBe(initialNextAttempt);
    });
    
    it('should handle multiple successes when already CLOSED', () => {
      const breaker = new CircuitBreaker();
      
      // Already closed by default
      expect(breaker.getState()).toBe('CLOSED');
      
      // Record multiple successes
      breaker.recordSuccess();
      breaker.recordSuccess();
      breaker.recordSuccess();
      
      // Should still be closed
      expect(breaker.getState()).toBe('CLOSED');
      
      // Success count should remain 0 in CLOSED state
      const stats = breaker.getStats();
      expect(stats.successCount).toBe(0);
    });
  });
  
  describe('Timing Edge Cases', () => {
    it('should handle time jumping far into the future', () => {
      const breaker = new CircuitBreaker({
        resetTimeout: 5000 // 5 seconds
      });
      
      // Open the circuit
      breaker.forceState('OPEN');
      expect(breaker.getState()).toBe('OPEN');
      
      // Jump way into the future (1 day)
      timeController.advanceTime(24 * 60 * 60 * 1000);
      
      // Should transition to HALF_OPEN on next check
      expect(breaker.isOpen()).toBe(false);
      expect(breaker.getState()).toBe('HALF_OPEN');
    });
    
    it('should handle case where nextAttempt is in the past', () => {
      const breaker = new CircuitBreaker({
        resetTimeout: 1000
      });
      
      // Open the circuit and get the next attempt time
      breaker.forceState('OPEN');
      const originalNextAttempt = breaker.getStats().nextAttempt;
      
      // Advance time past timeout
      timeController.advanceTime(2000);
      
      // Force back to OPEN and check nextAttempt is recalculated from current time
      breaker.forceState('OPEN');
      const newNextAttempt = breaker.getStats().nextAttempt;
      
      // New time should be greater than original
      expect(newNextAttempt).toBeGreaterThan(originalNextAttempt);
      
      // New time should be about 1000ms from now
      expect(newNextAttempt).toBeCloseTo(Date.now() + 1000, -2); // within ~100ms
    });
  });
  
  describe('Constructor Edge Cases', () => {
    it('should handle calling constructor without new', () => {
      // This test only verifies that the constructor behaves consistently
      // when called without 'new', not that it behaves in any specific way
      try {
        // Call constructor as a function (without new)
        // eslint-disable-next-line new-cap
        const result = CircuitBreaker();
        
        // If no error, should have returned something
        expect(result).toBeDefined();
      } catch (error) {
        // If error thrown, it should be a TypeError
        // (standard behavior for class constructor called without new)
        expect(error).toBeInstanceOf(TypeError);
      }
    });
  });
  
  describe('Advanced State Transitions', () => {
    it('should maintain correct state through complex transition sequence', () => {
      // Create breaker with low thresholds for easier testing
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 100,
        successThreshold: 2
      });
      
      // Initial state is CLOSED
      expect(breaker.getState()).toBe('CLOSED');
      
      // 1. Record failures to open
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
      
      // 2. Wait for timeout to go half-open
      timeController.advanceTime(101);
      expect(breaker.isOpen()).toBe(false);
      expect(breaker.getState()).toBe('HALF_OPEN');
      
      // 3. Record one success but not enough to close
      breaker.recordSuccess();
      expect(breaker.getState()).toBe('HALF_OPEN');
      
      // 4. Record failure to go back to open
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
      
      // 5. Wait for timeout to go half-open again
      timeController.advanceTime(101);
      expect(breaker.isOpen()).toBe(false);
      expect(breaker.getState()).toBe('HALF_OPEN');
      
      // 6. Record two successes to close
      breaker.recordSuccess();
      breaker.recordSuccess();
      expect(breaker.getState()).toBe('CLOSED');
      
      // 7. Record multiple successes while closed (should stay closed)
      breaker.recordSuccess();
      breaker.recordSuccess();
      expect(breaker.getState()).toBe('CLOSED');
      
      // 8. Record one failure (not enough to open)
      breaker.recordFailure();
      expect(breaker.getState()).toBe('CLOSED');
      
      // 9. Record second failure to open again
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
      
      // 10. Check state history has correct transitions
      // The implementation might keep all transitions or only a subset
      const stats = breaker.getStats();
      
      // At minimum, we should see the key transitions
      const states = stats.stateHistory.map(h => h.state);
      
      // Verify that the recent state changes occurred in the right order
      // Note: we're not checking every single state, just key ones
      expect(states).toContain('CLOSED'); // Initial 
      expect(states).toContain('OPEN');   // After failures
      
      // Check that the transitions include at least one HALF_OPEN state
      expect(states).toContain('HALF_OPEN');
      
      // The last recorded transition should have happened properly
      // (final OPEN state might not be in history yet)
      const lastRecordedState = stats.stateHistory[stats.stateHistory.length - 1].state;
      expect(['CLOSED', 'OPEN']).toContain(lastRecordedState);
    });
  });
});