/**
 * Circuit Breaker Enhanced Coverage Tests
 * 
 * These tests provide additional coverage for the Circuit Breaker implementation,
 * focusing on edge cases, state tracking, and real-world scenarios.
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

describe('Circuit Breaker Enhanced Coverage', () => {
  let circuitBreaker;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Date.now for consistent testing
    vi.spyOn(Date, 'now').mockImplementation(() => 1000);
    
    // Create a new circuit breaker for each test
    circuitBreaker = new CircuitBreaker({
      name: 'TestCircuit',
      failureThreshold: 3,
      resetTimeout: 100,
      successThreshold: 2
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks(); // Restore Date.now
  });
  
  describe('Default Values and Initialization', () => {
    it('should use default values when options are not provided', () => {
      // Create circuit breaker with no options
      const defaultBreaker = new CircuitBreaker();
      
      // Check internal settings
      expect(defaultBreaker.options.failureThreshold).toBe(5);
      expect(defaultBreaker.options.resetTimeout).toBe(30000);
      expect(defaultBreaker.options.successThreshold).toBe(2);
      expect(defaultBreaker.name).toBe('CircuitBreaker');
    });
    
    it('should initialize state history with creation entry', () => {
      // Get stats immediately after creation
      const stats = circuitBreaker.getStats();
      
      // Should have exactly one entry for initialization
      expect(stats.stateHistory.length).toBe(1);
      expect(stats.stateHistory[0].state).toBe('CLOSED');
      expect(stats.stateHistory[0].reason).toBe('Initialized');
      expect(stats.stateHistory[0].timestamp).toBe(1000); // From mocked Date.now
    });
    
    it('should start with all counters at zero', () => {
      // Get stats immediately after creation
      const stats = circuitBreaker.getStats();
      
      // All counters should be zero
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });
  });
  
  describe('State History Tracking', () => {
    it('should record reason with each state transition', () => {
      // Trigger state transitions with different reasons
      circuitBreaker.forceState('OPEN', 'First test transition');
      circuitBreaker.forceState('HALF_OPEN', 'Second test transition');
      circuitBreaker.forceState('CLOSED', 'Final test transition');
      
      // Check the state history
      const stats = circuitBreaker.getStats();
      
      // Find each transition
      const firstTransition = stats.stateHistory.find(entry => 
        entry.reason === 'First test transition'
      );
      const secondTransition = stats.stateHistory.find(entry => 
        entry.reason === 'Second test transition'
      );
      const finalTransition = stats.stateHistory.find(entry => 
        entry.reason === 'Final test transition'
      );
      
      // Verify each transition
      expect(firstTransition).toBeDefined();
      expect(firstTransition.state).toBe('OPEN');
      
      expect(secondTransition).toBeDefined();
      expect(secondTransition.state).toBe('HALF_OPEN');
      
      expect(finalTransition).toBeDefined();
      expect(finalTransition.state).toBe('CLOSED');
    });
    
    it('should cap history length and keep the most recent entries', () => {
      // Override stateHistory with a full array
      circuitBreaker.stateHistory = Array(100).fill(0).map((_, i) => ({
        timestamp: Date.now(),
        state: 'CLOSED',
        reason: `Test entry ${i}`
      }));
      
      // Add one more entry to exceed the limit
      circuitBreaker.forceState('OPEN', 'This should be kept');
      
      // Check the state history from the actual object, not through getStats
      // (getStats only returns last 10 entries for display purposes)
      const fullHistory = circuitBreaker.stateHistory;
      
      // Should still have 100 entries (not 101)
      expect(fullHistory.length).toBe(100);
      
      // The last entry should be our new one
      const lastEntry = fullHistory[fullHistory.length - 1];
      expect(lastEntry.reason).toBe('This should be kept');
      expect(lastEntry.state).toBe('OPEN');
      
      // The first entry should be entry #1, not #0 (as #0 should have been removed)
      const firstEntry = fullHistory[0];
      expect(firstEntry.reason).toBe('Test entry 1');
    });
    
    it('should return only the last 10 state changes in getStats', () => {
      // Create a larger history
      circuitBreaker.stateHistory = Array(20).fill(0).map((_, i) => ({
        timestamp: Date.now(),
        state: i % 2 === 0 ? 'CLOSED' : 'OPEN',
        reason: `Test entry ${i}`
      }));
      
      // Get stats
      const stats = circuitBreaker.getStats();
      
      // Should only return the last 10 entries
      expect(stats.stateHistory.length).toBe(10);
      
      // The first entry should be entry #10
      expect(stats.stateHistory[0].reason).toBe('Test entry 10');
      
      // The last entry should be entry #19
      expect(stats.stateHistory[9].reason).toBe('Test entry 19');
    });
  });
  
  describe('Edge Case Handling', () => {
    it('should handle multiple successful transitions in half-open state', () => {
      // Put in HALF_OPEN state
      circuitBreaker.forceState('HALF_OPEN', 'Testing multiple successes');
      
      // Record many more successes than the threshold
      for (let i = 0; i < 10; i++) {
        circuitBreaker.recordSuccess();
      }
      
      // Should be in CLOSED state after reaching the threshold
      expect(circuitBreaker.getState()).toBe('CLOSED');
      
      // Success count should be reset after transition
      const stats = circuitBreaker.getStats();
      expect(stats.successCount).toBe(0);
    });
    
    it('should handle multiple failures without triggering duplicate transitions', () => {
      // Move to OPEN state
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getState()).toBe('OPEN');
      
      // Record additional failures in OPEN state
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }
      
      // State should still be OPEN
      expect(circuitBreaker.getState()).toBe('OPEN');
      
      // Should have only ONE transition to OPEN in the history
      const stats = circuitBreaker.getStats();
      const openTransitions = stats.stateHistory.filter(
        entry => entry.reason === 'Failure threshold reached'
      );
      expect(openTransitions.length).toBe(1);
    });
    
    it('should correctly handle nextAttempt time when forcing OPEN state', () => {
      // Mock Date.now to return a specific time
      Date.now.mockReturnValue(5000);
      
      // Force to OPEN state
      circuitBreaker.forceState('OPEN', 'Test nextAttempt calculation');
      
      // Get stats
      const stats = circuitBreaker.getStats();
      
      // nextAttempt should be current time + resetTimeout
      expect(stats.nextAttempt).toBe(5000 + 100); // 5100
    });
  });
  
  describe('Time-Dependent State Transitions', () => {
    it('should not transition if timeout has not elapsed', () => {
      // Force to OPEN state at time 5000
      Date.now.mockReturnValue(5000);
      circuitBreaker.forceState('OPEN', 'Test timeout behavior');
      
      // Reset any logs from the forceState call
      logger.info.mockClear();
      
      // Mock Date.now to return a time before timeout
      Date.now.mockReturnValue(5050); // 50ms after, timeout is 100ms
      
      // Directly set nextAttempt to ensure it's in the future
      circuitBreaker.nextAttempt = 5100;
      
      // Check isOpen
      const result = circuitBreaker.isOpen();
      expect(result).toBe(true); // Should stay open
      expect(circuitBreaker.getState()).toBe('OPEN');
      
      // Should not have logged any state transition
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Circuit state change from OPEN to HALF_OPEN'),
        expect.any(Object)
      );
    });
    
    it('should transition exactly when timeout elapses', () => {
      // Force to OPEN state at time 5000
      Date.now.mockReturnValue(5000);
      circuitBreaker.forceState('OPEN', 'Test exact timeout transition');
      
      // Set time to exactly when timeout elapses (5000 + 100ms)
      Date.now.mockReturnValue(5100);
      
      // Check isOpen - should transition now
      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Should have logged the state transition
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Circuit state change from OPEN to HALF_OPEN'),
        expect.objectContaining({ component: 'circuitBreaker' })
      );
    });
  });
  
  describe('Circuit Breaker in High-Volume Scenarios', () => {
    it('should keep failure count at zero after successful transition to CLOSED', async () => {
      // Move to HALF_OPEN state
      circuitBreaker.forceState('HALF_OPEN', 'Testing high volume scenario');
      
      // Record enough successes to move to CLOSED
      circuitBreaker.recordSuccess();
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState()).toBe('CLOSED');
      
      // Now record many failures, but not enough to trip
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      
      // Should still be CLOSED
      expect(circuitBreaker.getState()).toBe('CLOSED');
      
      // Get stats
      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(2);
      
      // Record success
      circuitBreaker.recordSuccess();
      
      // Failure count should be reset to zero
      const newStats = circuitBreaker.getStats();
      expect(newStats.failureCount).toBe(0);
    });
    
    it('should handle successive state transitions without delay', () => {
      // Put in HALF_OPEN state
      circuitBreaker.forceState('HALF_OPEN', 'Test rapid transitions');
      
      // Record a failure to move to OPEN
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe('OPEN');
      
      // Force time forward past resetTimeout
      Date.now.mockReturnValue(5200);
      
      // Check isOpen to move to HALF_OPEN
      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Record successes to move to CLOSED
      circuitBreaker.recordSuccess();
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState()).toBe('CLOSED');
      
      // All state changes should be recorded in history in correct order
      const stats = circuitBreaker.getStats();
      const transitions = stats.stateHistory.filter(entry => 
        entry.reason !== 'Initialized'
      );
      
      expect(transitions.length).toBe(4); // HALF_OPEN -> OPEN -> HALF_OPEN -> CLOSED
      expect(transitions[0].state).toBe('HALF_OPEN');
      expect(transitions[1].state).toBe('OPEN');
      expect(transitions[2].state).toBe('HALF_OPEN');
      expect(transitions[3].state).toBe('CLOSED');
    });
  });
  
  describe('Integration with Logging', () => {
    it('should log all state transitions with the circuit name', () => {
      // Create a circuit with a custom name
      const namedCircuit = new CircuitBreaker({
        name: 'CustomNamedCircuit',
        failureThreshold: 2
      });
      
      // Trigger a state transition
      namedCircuit.recordFailure();
      namedCircuit.recordFailure(); // This should trigger transition to OPEN
      
      // Verify log contains the custom name
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('CustomNamedCircuit: Circuit state change'),
        expect.objectContaining({ component: 'circuitBreaker' })
      );
    });
    
    it('should log initialization with circuit name', () => {
      // Create a circuit breaker with a custom name
      new CircuitBreaker({ name: 'InitLoggingCircuit' });
      
      // Verify initialization was logged with the custom name
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('InitLoggingCircuit: Circuit breaker initialized'),
        expect.objectContaining({ component: 'circuitBreaker' })
      );
    });
    
    it('should log error when invalid state is forced', () => {
      // Attempt to force an invalid state
      circuitBreaker.forceState('BROKEN', 'This should fail');
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('TestCircuit: Invalid state: BROKEN'),
        expect.objectContaining({ component: 'circuitBreaker' })
      );
    });
  });
  
  describe('Automatic Timeout Recovery', () => {
    it('should transition to HALF_OPEN automatically when checking isOpen after timeout', () => {
      // Force to OPEN state
      circuitBreaker.forceState('OPEN', 'Testing automatic recovery');
      
      // Set time to after resetTimeout
      Date.now.mockReturnValue(5200); // Well past the 100ms timeout
      
      // Just check if open - should trigger the transition
      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
      
      // Transition should be logged
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Circuit state change from OPEN to HALF_OPEN'),
        expect.objectContaining({ component: 'circuitBreaker' })
      );
    });
    
    it('should track time properly even with multiple timeout checks', () => {
      // Force to OPEN state
      Date.now.mockReturnValue(5000);
      circuitBreaker.forceState('OPEN', 'Testing multiple timeout checks');
      
      // Check isOpen before timeout
      Date.now.mockReturnValue(5050); // 50ms after
      expect(circuitBreaker.isOpen()).toBe(true);
      
      // Check isOpen before timeout again
      Date.now.mockReturnValue(5099); // 99ms after
      expect(circuitBreaker.isOpen()).toBe(true);
      
      // Check isOpen exactly at timeout
      Date.now.mockReturnValue(5100); // 100ms after
      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
    });
  });
});