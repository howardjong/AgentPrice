/**
 * Circuit Breaker Error Handling Tests
 * 
 * These tests focus on the Circuit Breaker pattern implementation,
 * which is used to prevent cascade failures when external services are unstable.
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import CircuitBreaker from '../../../utils/circuitBreaker.js';
import logger from '../../../utils/logger.js';

// Mock dependencies
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Circuit Breaker Error Handling', () => {
  let circuitBreaker;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a new circuit breaker for each test with small timeouts for testing
    circuitBreaker = new CircuitBreaker({
      name: 'TestCircuit',
      failureThreshold: 3,
      resetTimeout: 100, // 100ms for faster testing
      successThreshold: 2
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('State Transitions', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
    
    it('should transition to OPEN after failures reach threshold', () => {
      // Record failures up to threshold
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      
      // Should now be OPEN
      expect(circuitBreaker.getState()).toBe('OPEN');
      expect(circuitBreaker.isOpen()).toBe(true);
      
      // Should have logged the state change
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Circuit state change from CLOSED to OPEN'),
        expect.objectContaining({ component: 'circuitBreaker' })
      );
    });
    
    it('should transition to HALF_OPEN after resetTimeout', async () => {
      // Move to OPEN state
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      
      // Wait for reset timeout to elapse
      await new Promise(resolve => setTimeout(resolve, 150)); // > 100ms reset timeout
      
      // Checking isOpen should transition to HALF_OPEN
      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Should have logged the state change
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Circuit state change from OPEN to HALF_OPEN'),
        expect.objectContaining({ component: 'circuitBreaker' })
      );
    });
    
    it('should transition back to CLOSED after successes in HALF_OPEN', async () => {
      // Move to OPEN state
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      
      // Wait for reset timeout to elapse
      await new Promise(resolve => setTimeout(resolve, 150)); // > 100ms reset timeout
      
      // Should now be in HALF_OPEN (after checking isOpen)
      circuitBreaker.isOpen();
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Record successes to meet threshold
      for (let i = 0; i < 2; i++) {
        circuitBreaker.recordSuccess();
      }
      
      // Should now be CLOSED
      expect(circuitBreaker.getState()).toBe('CLOSED');
      
      // Should have logged the state change
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Circuit state change from HALF_OPEN to CLOSED'),
        expect.objectContaining({ component: 'circuitBreaker' })
      );
    });
    
    it('should transition back to OPEN after failure in HALF_OPEN', async () => {
      // Move to OPEN state
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      
      // Wait for reset timeout to elapse
      await new Promise(resolve => setTimeout(resolve, 150)); // > 100ms reset timeout
      
      // Should now be in HALF_OPEN (after checking isOpen)
      circuitBreaker.isOpen();
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Record a failure in HALF_OPEN
      circuitBreaker.recordFailure();
      
      // Should be back to OPEN
      expect(circuitBreaker.getState()).toBe('OPEN');
      
      // Should have logged the state change
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Circuit state change from HALF_OPEN to OPEN'),
        expect.objectContaining({ component: 'circuitBreaker' })
      );
    });
  });
  
  describe('Failure and Success Counting', () => {
    it('should increment failure counter and reset success counter', () => {
      // Record some successes first
      circuitBreaker.recordSuccess();
      circuitBreaker.recordSuccess();
      
      // Now record a failure
      circuitBreaker.recordFailure();
      
      // Check internal state
      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(1);
      expect(stats.successCount).toBe(0); // Reset by the failure
    });
    
    it('should reset failure counter on successful transition to CLOSED', async () => {
      // Move to OPEN state
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      
      // Wait for reset timeout to elapse
      await new Promise(resolve => setTimeout(resolve, 150)); // > 100ms reset timeout
      
      // Force transition to HALF_OPEN
      circuitBreaker.isOpen();
      
      // Record successes to transition to CLOSED
      circuitBreaker.recordSuccess();
      circuitBreaker.recordSuccess();
      
      // Check internal state
      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(0); // Reset when transitioning to CLOSED
      expect(stats.successCount).toBe(0); // Reset when transitioning to CLOSED
    });
    
    it('should not increment success counter in CLOSED state', () => {
      // Record multiple successes in CLOSED state
      for (let i = 0; i < 10; i++) {
        circuitBreaker.recordSuccess();
      }
      
      // Success count should remain 0 in CLOSED state
      // (only meaningful in HALF_OPEN state)
      const stats = circuitBreaker.getStats();
      expect(stats.successCount).toBe(0);
    });
  });
  
  describe('State Tracking and History', () => {
    it('should maintain a history of state transitions', () => {
      // Make some transitions
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure(); // Should trigger OPEN state
      
      // Get the state history
      const stats = circuitBreaker.getStats();
      
      // Should have at least 2 entries (initial CLOSED + transition to OPEN)
      expect(stats.stateHistory.length).toBeGreaterThanOrEqual(2);
      
      // First entry should be initialization
      expect(stats.stateHistory[0].state).toBe('CLOSED');
      expect(stats.stateHistory[0].reason).toBe('Initialized');
      
      // Last entry should be the transition to OPEN
      const lastEntry = stats.stateHistory[stats.stateHistory.length - 1];
      expect(lastEntry.state).toBe('OPEN');
      expect(lastEntry.reason).toBe('Failure threshold reached');
      
      // All entries should have timestamps
      for (const entry of stats.stateHistory) {
        expect(entry.timestamp).toBeDefined();
        expect(typeof entry.timestamp).toBe('number');
      }
    });
    
    it('should limit history size to prevent memory issues', () => {
      // Force a large number of transitions
      for (let i = 0; i < 200; i++) {
        circuitBreaker.forceState('CLOSED', `Test transition ${i}`);
        circuitBreaker.forceState('OPEN', `Test transition ${i}`);
      }
      
      // Get the state history
      const stats = circuitBreaker.getStats();
      
      // Should be limited to 100 entries (or whatever the implementation limit is)
      expect(stats.stateHistory.length).toBeLessThanOrEqual(100);
    });
  });
  
  describe('Manual State Control', () => {
    it('should allow forcing to a specific state', () => {
      // Force to OPEN state
      circuitBreaker.forceState('OPEN', 'Manual override');
      
      // Should be in OPEN state
      expect(circuitBreaker.getState()).toBe('OPEN');
      expect(circuitBreaker.isOpen()).toBe(true);
      
      // Force back to CLOSED
      circuitBreaker.forceState('CLOSED', 'Test recovery');
      
      // Should be in CLOSED state
      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.isOpen()).toBe(false);
      
      // State history should reflect these manual changes
      const stats = circuitBreaker.getStats();
      const manualOpenEntry = stats.stateHistory.find(
        entry => entry.reason === 'Manual override'
      );
      const manualClosedEntry = stats.stateHistory.find(
        entry => entry.reason === 'Test recovery'
      );
      
      expect(manualOpenEntry).toBeDefined();
      expect(manualOpenEntry.state).toBe('OPEN');
      
      expect(manualClosedEntry).toBeDefined();
      expect(manualClosedEntry.state).toBe('CLOSED');
    });
    
    it('should ignore invalid state names', () => {
      // Try to force to an invalid state
      circuitBreaker.forceState('INVALID_STATE', 'Should be ignored');
      
      // Should still be in the original CLOSED state
      expect(circuitBreaker.getState()).toBe('CLOSED');
      
      // Should have logged an error
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid state'),
        expect.objectContaining({ component: 'circuitBreaker' })
      );
    });
    
    it('should reset counters when forcing state', () => {
      // Record some failures
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      
      // Get current counts
      const beforeStats = circuitBreaker.getStats();
      expect(beforeStats.failureCount).toBe(2);
      
      // Force state to OPEN
      circuitBreaker.forceState('OPEN', 'Testing counter reset');
      
      // Counts should be reset
      const afterStats = circuitBreaker.getStats();
      expect(afterStats.failureCount).toBe(0);
      expect(afterStats.successCount).toBe(0);
    });
  });
  
  describe('isOpen Behavior', () => {
    it('should check and potentially transition state', async () => {
      // Put in OPEN state
      circuitBreaker.forceState('OPEN', 'Test isOpen behavior');
      
      // Should be OPEN initially
      expect(circuitBreaker.isOpen()).toBe(true);
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150)); // > 100ms
      
      // Now isOpen should transition to HALF_OPEN and return false
      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
    });
    
    it('should not transition if not enough time has passed', () => {
      // Put in OPEN state with future nextAttempt time
      circuitBreaker.forceState('OPEN', 'Test isOpen timeout behavior');
      
      // Should be OPEN
      expect(circuitBreaker.isOpen()).toBe(true);
      
      // Force the nextAttempt to be far in the future
      circuitBreaker.nextAttempt = Date.now() + 10000; // 10 seconds
      
      // isOpen should still return true and not transition
      expect(circuitBreaker.isOpen()).toBe(true);
      expect(circuitBreaker.getState()).toBe('OPEN');
    });
  });
  
  describe('Error Handling Flow', () => {
    it('should demonstrate a complete failure recovery cycle', async () => {
      // Step 1: System is healthy (CLOSED)
      expect(circuitBreaker.getState()).toBe('CLOSED');
      
      // Step 2: Failures start occurring
      circuitBreaker.recordFailure(); // Failure 1
      expect(circuitBreaker.getState()).toBe('CLOSED'); // Still closed
      
      circuitBreaker.recordFailure(); // Failure 2
      expect(circuitBreaker.getState()).toBe('CLOSED'); // Still closed
      
      circuitBreaker.recordFailure(); // Failure 3 - threshold reached
      expect(circuitBreaker.getState()).toBe('OPEN'); // Now open
      
      // Step 3: While circuit is OPEN, all requests should be rejected
      expect(circuitBreaker.isOpen()).toBe(true);
      
      // Step 4: After timeout, system allows a test request
      await new Promise(resolve => setTimeout(resolve, 150)); // > 100ms reset timeout
      
      // Should transition to HALF_OPEN on next check
      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Step 5: First test is successful
      circuitBreaker.recordSuccess(); // Success 1
      expect(circuitBreaker.getState()).toBe('HALF_OPEN'); // Still half-open
      
      // Step 6: Second test is successful, reaching success threshold
      circuitBreaker.recordSuccess(); // Success 2
      expect(circuitBreaker.getState()).toBe('CLOSED'); // Back to closed!
      
      // Step 7: System has recovered
      expect(circuitBreaker.isOpen()).toBe(false);
      
      // Get the full state history
      const stats = circuitBreaker.getStats();
      
      // Should have these transitions in order:
      // 1. Initial CLOSED
      // 2. CLOSED -> OPEN (after 3 failures)
      // 3. OPEN -> HALF_OPEN (after timeout)
      // 4. HALF_OPEN -> CLOSED (after 2 successes)
      
      const transitionSequence = stats.stateHistory.map(entry => entry.state);
      
      // Verify the sequence of states (ignoring any duplicates or intermediate states)
      expect(transitionSequence).toContainEqual('CLOSED');
      expect(transitionSequence).toContainEqual('OPEN');
      expect(transitionSequence).toContainEqual('HALF_OPEN');
      expect(transitionSequence).toContainEqual('CLOSED');
      
      // Verify that the last transition is back to CLOSED
      expect(transitionSequence[transitionSequence.length - 1]).toBe('CLOSED');
    });
    
    it('should handle failure in HALF_OPEN state properly', async () => {
      // Move to OPEN state
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      
      // Wait for reset timeout to elapse
      await new Promise(resolve => setTimeout(resolve, 150)); // > 100ms reset timeout
      
      // Should now be in HALF_OPEN (after checking isOpen)
      circuitBreaker.isOpen();
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Record a success, but not enough to close
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Then a failure
      circuitBreaker.recordFailure();
      
      // Should be back to OPEN, with a new timeout
      expect(circuitBreaker.getState()).toBe('OPEN');
      
      // Next attempt should be in the future
      const stats = circuitBreaker.getStats();
      expect(stats.nextAttempt).toBeGreaterThan(Date.now());
    });
  });
  
  describe('Configuration Options', () => {
    it('should honor custom failure threshold', () => {
      // Create circuit breaker with higher threshold
      const customBreaker = new CircuitBreaker({
        name: 'HighThreshold',
        failureThreshold: 5 // Higher than default
      });
      
      // Record 4 failures
      for (let i = 0; i < 4; i++) {
        customBreaker.recordFailure();
      }
      
      // Should still be CLOSED (threshold is 5)
      expect(customBreaker.getState()).toBe('CLOSED');
      
      // One more failure
      customBreaker.recordFailure();
      
      // Now it should be OPEN
      expect(customBreaker.getState()).toBe('OPEN');
    });
    
    it('should honor custom success threshold', async () => {
      // Create circuit breaker with higher success threshold
      const customBreaker = new CircuitBreaker({
        name: 'HighSuccessThreshold',
        failureThreshold: 2,
        resetTimeout: 100,
        successThreshold: 3 // Higher than default
      });
      
      // Move to OPEN state
      customBreaker.recordFailure();
      customBreaker.recordFailure();
      expect(customBreaker.getState()).toBe('OPEN');
      
      // Wait for reset timeout to elapse
      await new Promise(resolve => setTimeout(resolve, 150)); // > 100ms
      
      // Force check to transition to HALF_OPEN
      customBreaker.isOpen();
      expect(customBreaker.getState()).toBe('HALF_OPEN');
      
      // Record 2 successes
      customBreaker.recordSuccess();
      customBreaker.recordSuccess();
      
      // Should still be HALF_OPEN (threshold is 3)
      expect(customBreaker.getState()).toBe('HALF_OPEN');
      
      // One more success
      customBreaker.recordSuccess();
      
      // Now it should be CLOSED
      expect(customBreaker.getState()).toBe('CLOSED');
    });
    
    it('should honor custom reset timeout', async () => {
      // Create circuit breaker with longer timeout
      const longTimeoutBreaker = new CircuitBreaker({
        name: 'LongTimeout',
        failureThreshold: 2,
        resetTimeout: 300, // 300ms
        successThreshold: 1
      });
      
      // Move to OPEN state
      longTimeoutBreaker.recordFailure();
      longTimeoutBreaker.recordFailure();
      expect(longTimeoutBreaker.getState()).toBe('OPEN');
      
      // Wait 150ms (longer than default 100ms but shorter than 300ms)
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should still be OPEN
      longTimeoutBreaker.isOpen(); // Check and potentially transition
      expect(longTimeoutBreaker.getState()).toBe('OPEN');
      
      // Wait the rest of the time
      await new Promise(resolve => setTimeout(resolve, 200)); // Total > 300ms
      
      // Now should transition to HALF_OPEN
      expect(longTimeoutBreaker.isOpen()).toBe(false);
      expect(longTimeoutBreaker.getState()).toBe('HALF_OPEN');
    });
  });
});