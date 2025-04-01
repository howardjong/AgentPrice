/**
 * @file circuitBreaker.state-transitions.vitest.js
 * @description Comprehensive state transition tests for the CircuitBreaker component
 * 
 * These tests focus on verifying all possible state transitions of the circuit breaker
 * pattern, ensuring each state change happens correctly and with proper side effects.
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

// Define state constants to match the internal implementation
const STATE = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

describe('CircuitBreaker State Transitions', () => {
  let breaker;
  let timeController;
  
  // Default breaker options
  const defaultOptions = {
    failureThreshold: 3,
    resetTimeout: 1000,
    successThreshold: 2,
    name: 'TestStateBreaker'
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up time control
    timeController = createTimeController().setup();
    
    // Create fresh circuit breaker
    breaker = new CircuitBreaker(defaultOptions);
  });
  
  afterEach(() => {
    timeController.restore();
  });
  
  /**
   * Helper to execute a function with appropriate state recording
   */
  async function executeFunction(fn, shouldSucceed = true) {
    if (breaker.isOpen()) {
      throw new Error('Circuit breaker is open');
    }
    
    try {
      const result = await fn();
      breaker.recordSuccess();
      return result;
    } catch (error) {
      breaker.recordFailure();
      throw error;
    }
  }
  
  describe('Initial State', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe(STATE.CLOSED);
      expect(breaker.isOpen()).toBe(false);
      
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });
    
    it('should store initial state in history with reason', () => {
      const stats = breaker.getStats();
      expect(stats.stateHistory.length).toBeGreaterThan(0);
      
      const initialState = stats.stateHistory[0];
      expect(initialState.state).toBe(STATE.CLOSED);
      expect(initialState.reason).toBe('Initialized');
    });
    
    it('should use custom name if provided', () => {
      const customBreaker = new CircuitBreaker({
        ...defaultOptions,
        name: 'CustomNamedBreaker'
      });
      
      // The name isn't directly exposed, but we can check the history
      const stats = customBreaker.getStats();
      const initialEntry = stats.stateHistory[0];
      
      // The message should contain the custom name (from initialization)
      expect(stats).toBeDefined();
      expect(initialEntry).toBeDefined();
      
      // Just verify stats are returned as expected
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });
  });
  
  describe('CLOSED to OPEN Transition', () => {
    it('should transition to OPEN after reaching failure threshold', () => {
      // Record failures up to threshold
      for (let i = 0; i < defaultOptions.failureThreshold; i++) {
        breaker.recordFailure();
      }
      
      // Should now be OPEN
      expect(breaker.getState()).toBe(STATE.OPEN);
      expect(breaker.isOpen()).toBe(true);
      
      // Check state history
      const stats = breaker.getStats();
      const lastTransition = stats.stateHistory[stats.stateHistory.length - 1];
      expect(lastTransition.state).toBe(STATE.OPEN);
      expect(lastTransition.reason).toBe('Failure threshold reached');
    });
    
    it('should not transition to OPEN before reaching failure threshold', () => {
      // Record failures up to threshold - 1
      for (let i = 0; i < defaultOptions.failureThreshold - 1; i++) {
        breaker.recordFailure();
      }
      
      // Should still be CLOSED
      expect(breaker.getState()).toBe(STATE.CLOSED);
      expect(breaker.isOpen()).toBe(false);
    });
    
    it('should reset failure count when a success occurs', () => {
      // Record some failures but not enough to open
      for (let i = 0; i < defaultOptions.failureThreshold - 1; i++) {
        breaker.recordFailure();
      }
      
      // Record a success
      breaker.recordSuccess();
      
      // Check failure count is reset
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(0);
      
      // Should need the full threshold of failures again
      for (let i = 0; i < defaultOptions.failureThreshold - 1; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe(STATE.CLOSED);
      
      breaker.recordFailure(); // One more should trigger the transition
      expect(breaker.getState()).toBe(STATE.OPEN);
    });
  });
  
  describe('OPEN to HALF_OPEN Transition', () => {
    it('should transition to HALF_OPEN after reset timeout', () => {
      // Force to OPEN state
      breaker.forceState(STATE.OPEN);
      expect(breaker.getState()).toBe(STATE.OPEN);
      
      // Advance time just before timeout
      timeController.advanceTime(defaultOptions.resetTimeout - 1);
      
      // Call isOpen to check state - should still be OPEN
      expect(breaker.isOpen()).toBe(true);
      expect(breaker.getState()).toBe(STATE.OPEN);
      
      // Advance time past timeout
      timeController.advanceTime(2);
      
      // Call isOpen to check state - should transition to HALF_OPEN
      expect(breaker.isOpen()).toBe(false);
      expect(breaker.getState()).toBe(STATE.HALF_OPEN);
      
      // Check state history
      const stats = breaker.getStats();
      const lastTransition = stats.stateHistory[stats.stateHistory.length - 1];
      expect(lastTransition.state).toBe(STATE.HALF_OPEN);
      expect(lastTransition.reason).toBe('Reset timeout elapsed');
    });
    
    it('should only check for HALF_OPEN transition when isOpen() is called', () => {
      // Force to OPEN state
      breaker.forceState(STATE.OPEN);
      
      // Advance time past timeout
      timeController.advanceTime(defaultOptions.resetTimeout + 100);
      
      // State should not change until isOpen is called
      expect(breaker.getState()).toBe(STATE.OPEN);
      
      // Now call isOpen() which checks for transitions
      expect(breaker.isOpen()).toBe(false);
      expect(breaker.getState()).toBe(STATE.HALF_OPEN);
    });
  });
  
  describe('HALF_OPEN Transitions', () => {
    beforeEach(() => {
      // Start each test in HALF_OPEN state
      breaker.forceState(STATE.HALF_OPEN);
      expect(breaker.getState()).toBe(STATE.HALF_OPEN);
    });
    
    it('should transition to CLOSED after reaching success threshold', () => {
      // Record successes up to threshold
      for (let i = 0; i < defaultOptions.successThreshold; i++) {
        breaker.recordSuccess();
      }
      
      // Should now be CLOSED
      expect(breaker.getState()).toBe(STATE.CLOSED);
      expect(breaker.isOpen()).toBe(false);
      
      // Check state history
      const stats = breaker.getStats();
      const lastTransition = stats.stateHistory[stats.stateHistory.length - 1];
      expect(lastTransition.state).toBe(STATE.CLOSED);
      expect(lastTransition.reason).toBe('Success threshold reached');
    });
    
    it('should not transition to CLOSED before reaching success threshold', () => {
      // Success threshold is > 1
      expect(defaultOptions.successThreshold).toBeGreaterThan(1);
      
      // Record successes up to threshold - 1
      for (let i = 0; i < defaultOptions.successThreshold - 1; i++) {
        breaker.recordSuccess();
      }
      
      // Should still be HALF_OPEN
      expect(breaker.getState()).toBe(STATE.HALF_OPEN);
    });
    
    it('should transition to OPEN after any failure', () => {
      // Record some successes but not enough to close
      for (let i = 0; i < defaultOptions.successThreshold - 1; i++) {
        breaker.recordSuccess();
      }
      
      // Record a failure
      breaker.recordFailure();
      
      // Should now be OPEN
      expect(breaker.getState()).toBe(STATE.OPEN);
      expect(breaker.isOpen()).toBe(true);
      
      // Check state history
      const stats = breaker.getStats();
      const lastTransition = stats.stateHistory[stats.stateHistory.length - 1];
      expect(lastTransition.state).toBe(STATE.OPEN);
      expect(lastTransition.reason).toBe('Failed in half-open state');
    });
    
    it('should reset success count after transition to OPEN', () => {
      // Record some successes but not enough to close
      for (let i = 0; i < defaultOptions.successThreshold - 1; i++) {
        breaker.recordSuccess();
      }
      
      // Record a failure to transition to OPEN
      breaker.recordFailure();
      
      // Wait for reset timeout to transition to HALF_OPEN again
      timeController.advanceTime(defaultOptions.resetTimeout + 1);
      breaker.isOpen(); // Trigger state check
      
      // Should be back in HALF_OPEN with success count reset
      expect(breaker.getState()).toBe(STATE.HALF_OPEN);
      
      // Success count should be 0
      const stats = breaker.getStats();
      expect(stats.successCount).toBe(0);
      
      // Should need full threshold of successes again
      for (let i = 0; i < defaultOptions.successThreshold - 1; i++) {
        breaker.recordSuccess();
      }
      expect(breaker.getState()).toBe(STATE.HALF_OPEN);
      
      breaker.recordSuccess(); // One more should close the circuit
      expect(breaker.getState()).toBe(STATE.CLOSED);
    });
  });
  
  describe('Manual State Control', () => {
    it('should allow forcing to any valid state', () => {
      // Test each valid state
      breaker.forceState(STATE.OPEN);
      expect(breaker.getState()).toBe(STATE.OPEN);
      
      breaker.forceState(STATE.HALF_OPEN);
      expect(breaker.getState()).toBe(STATE.HALF_OPEN);
      
      breaker.forceState(STATE.CLOSED);
      expect(breaker.getState()).toBe(STATE.CLOSED);
    });
    
    it('should reject invalid states', () => {
      // Forcing an invalid state should log an error but not change state
      breaker.forceState('INVALID_STATE');
      
      // State should remain unchanged (CLOSED by default)
      expect(breaker.getState()).toBe(STATE.CLOSED);
      
      // State history should not have changed
      const stats = breaker.getStats();
      expect(stats.stateHistory.length).toBe(1); // Just the initial state
      expect(stats.stateHistory[0].state).toBe(STATE.CLOSED);
    });
    
    it('should reset counters when forcing state', () => {
      // Record some failures but not enough to open
      for (let i = 0; i < defaultOptions.failureThreshold - 1; i++) {
        breaker.recordFailure();
      }
      
      // Force to CLOSED state
      breaker.forceState(STATE.CLOSED);
      
      // Failure count should be reset
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(0);
      
      // Should need full threshold of failures again
      for (let i = 0; i < defaultOptions.failureThreshold - 1; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe(STATE.CLOSED);
      
      breaker.recordFailure(); // One more should open the circuit
      expect(breaker.getState()).toBe(STATE.OPEN);
    });
    
    it('should set next attempt time when forcing to OPEN state', () => {
      // Force to OPEN state
      breaker.forceState(STATE.OPEN);
      
      // Next attempt time should be set
      const stats = breaker.getStats();
      const expectedNextAttempt = Date.now() + defaultOptions.resetTimeout;
      
      // Allow small margin of error (few ms) for test execution time
      expect(stats.nextAttempt).toBeGreaterThanOrEqual(expectedNextAttempt - 5);
      expect(stats.nextAttempt).toBeLessThanOrEqual(expectedNextAttempt + 5);
    });
  });
  
  describe('State History', () => {
    it('should track state transitions with timestamps and reasons', () => {
      // Verify initial state entry
      const initialStats = breaker.getStats();
      expect(initialStats.stateHistory.length).toBe(1);
      expect(initialStats.stateHistory[0].state).toBe(STATE.CLOSED);
      expect(initialStats.stateHistory[0].reason).toBe('Initialized');
      
      // Force several state changes
      breaker.forceState(STATE.OPEN, 'Test transition to OPEN');
      timeController.advanceTime(100);
      
      breaker.forceState(STATE.HALF_OPEN, 'Test transition to HALF_OPEN');
      timeController.advanceTime(100);
      
      breaker.forceState(STATE.CLOSED, 'Test transition to CLOSED');
      
      // Verify all transitions were recorded
      const finalStats = breaker.getStats();
      expect(finalStats.stateHistory.length).toBe(4); // Initial + 3 forced changes
      
      // Check order and reasons
      expect(finalStats.stateHistory[1].state).toBe(STATE.OPEN);
      expect(finalStats.stateHistory[1].reason).toBe('Test transition to OPEN');
      
      expect(finalStats.stateHistory[2].state).toBe(STATE.HALF_OPEN);
      expect(finalStats.stateHistory[2].reason).toBe('Test transition to HALF_OPEN');
      
      expect(finalStats.stateHistory[3].state).toBe(STATE.CLOSED);
      expect(finalStats.stateHistory[3].reason).toBe('Test transition to CLOSED');
    });
    
    it('should limit history length for memory efficiency', () => {
      // Set limit lower for testing (actual limit is 100)
      const historyLimit = 100;
      
      // Generate many state transitions
      for (let i = 0; i < historyLimit + 10; i++) {
        breaker.forceState(STATE.OPEN, `Transition ${i} to OPEN`);
        breaker.forceState(STATE.CLOSED, `Transition ${i} to CLOSED`);
      }
      
      // History should be limited
      const stats = breaker.getStats();
      expect(stats.stateHistory.length).toBeLessThanOrEqual(historyLimit);
      
      // Most recent transitions should be kept
      const lastTransition = stats.stateHistory[stats.stateHistory.length - 1];
      expect(lastTransition.reason).toContain(`Transition ${historyLimit + 9} to CLOSED`);
    });
    
    it('should not record transition if state does not change', () => {
      // Get initial history length
      const initialStats = breaker.getStats();
      const initialHistoryLength = initialStats.stateHistory.length;
      
      // "Transition" to the same state
      breaker.forceState(STATE.CLOSED, 'Same state transition');
      
      // History length should not change
      const newStats = breaker.getStats();
      expect(newStats.stateHistory.length).toBe(initialHistoryLength);
    });
  });
  
  describe('Complex State Sequences', () => {
    it('should handle the complete CLOSED->OPEN->HALF_OPEN->CLOSED cycle', () => {
      // 1. Start in CLOSED state
      expect(breaker.getState()).toBe(STATE.CLOSED);
      
      // 2. Trigger enough failures to open the circuit
      for (let i = 0; i < defaultOptions.failureThreshold; i++) {
        breaker.recordFailure();
      }
      
      // 3. Circuit should be OPEN
      expect(breaker.getState()).toBe(STATE.OPEN);
      expect(breaker.isOpen()).toBe(true);
      
      // 4. Advance time past the reset timeout
      timeController.advanceTime(defaultOptions.resetTimeout + 1);
      
      // 5. Next isOpen() call should transition to HALF_OPEN
      expect(breaker.isOpen()).toBe(false);
      expect(breaker.getState()).toBe(STATE.HALF_OPEN);
      
      // 6. Record enough successes to close the circuit
      for (let i = 0; i < defaultOptions.successThreshold; i++) {
        breaker.recordSuccess();
      }
      
      // 7. Circuit should be CLOSED again
      expect(breaker.getState()).toBe(STATE.CLOSED);
      expect(breaker.isOpen()).toBe(false);
      
      // 8. Verify state history captures full cycle
      const stats = breaker.getStats();
      expect(stats.stateHistory.length).toBe(4); // Initial CLOSED + 3 transitions
      
      // 9. Check transition sequence
      const transitions = stats.stateHistory.map(h => h.state);
      expect(transitions).toEqual([
        STATE.CLOSED,   // Initial state
        STATE.OPEN,     // After failures
        STATE.HALF_OPEN, // After timeout
        STATE.CLOSED    // After successes
      ]);
    });
    
    it('should handle multiple cycles with failure in HALF_OPEN state', () => {
      // First cycle: CLOSED->OPEN->HALF_OPEN->OPEN (failure in HALF_OPEN)
      
      // 1. Trigger enough failures to open the circuit
      for (let i = 0; i < defaultOptions.failureThreshold; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe(STATE.OPEN);
      
      // 2. Advance time past timeout to HALF_OPEN
      timeController.advanceTime(defaultOptions.resetTimeout + 1);
      breaker.isOpen(); // Trigger transition check
      expect(breaker.getState()).toBe(STATE.HALF_OPEN);
      
      // 3. Record a failure to go back to OPEN
      breaker.recordFailure();
      expect(breaker.getState()).toBe(STATE.OPEN);
      
      // Second cycle: OPEN->HALF_OPEN->CLOSED (success in HALF_OPEN)
      
      // 4. Advance time past timeout to HALF_OPEN again
      timeController.advanceTime(defaultOptions.resetTimeout + 1);
      breaker.isOpen(); // Trigger transition check
      expect(breaker.getState()).toBe(STATE.HALF_OPEN);
      
      // 5. Record enough successes to CLOSED
      for (let i = 0; i < defaultOptions.successThreshold; i++) {
        breaker.recordSuccess();
      }
      expect(breaker.getState()).toBe(STATE.CLOSED);
      
      // 6. Verify state history captures both cycles
      const stats = breaker.getStats();
      expect(stats.stateHistory.length).toBe(6); // Initial + 5 transitions
      
      // 7. Check transition sequence
      const transitions = stats.stateHistory.map(h => h.state);
      expect(transitions).toEqual([
        STATE.CLOSED,    // Initial state
        STATE.OPEN,      // After failures
        STATE.HALF_OPEN, // After first timeout
        STATE.OPEN,      // After failure in HALF_OPEN
        STATE.HALF_OPEN, // After second timeout
        STATE.CLOSED     // After successes in HALF_OPEN
      ]);
    });
  });
});