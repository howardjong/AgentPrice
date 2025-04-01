/**
 * @file circuitBreaker.state.vitest.js
 * @description Tests for CircuitBreaker state transitions
 * 
 * This file focuses on testing the state transitions of the CircuitBreaker utility,
 * including normal operations, failure detection, recovery, and configuration options.
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

describe('CircuitBreaker State Transitions', () => {
  let breaker;
  let timeController;
  
  // Default test configuration
  const defaultOptions = {
    failureThreshold: 3,
    resetTimeout: 1000, // 1 second for faster tests
    successThreshold: 2,
    name: 'TestBreaker'
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up time controller to manage time in tests
    timeController = createTimeController().setup();
    
    // Create a new circuit breaker for each test
    breaker = new CircuitBreaker(defaultOptions);
  });
  
  afterEach(() => {
    timeController.restore();
  });
  
  /**
   * Tests for initial state
   */
  describe('Initial State', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe('CLOSED');
    });
    
    it('should initialize with the provided options', () => {
      const customBreaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 2000,
        successThreshold: 3,
        name: 'CustomBreaker'
      });
      
      // Get stats to verify internal state
      const stats = customBreaker.getStats();
      
      // Verify options were correctly set
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.state).toBe('CLOSED');
    });
    
    it('should use default options when none provided', () => {
      const defaultBreaker = new CircuitBreaker();
      
      // Verify default name is set
      expect(defaultBreaker.name).toBe('CircuitBreaker');
      
      // Verify state is closed
      expect(defaultBreaker.getState()).toBe('CLOSED');
    });
  });
  
  /**
   * Tests for CLOSED state behavior
   */
  describe('CLOSED State', () => {
    it('should remain CLOSED when failures are below threshold', () => {
      // Record some failures, but below threshold
      breaker.recordFailure();
      breaker.recordFailure();
      
      // Should still be closed
      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.isOpen()).toBe(false);
    });
    
    it('should transition to OPEN when failures reach threshold', () => {
      // Record failures up to threshold
      for (let i = 0; i < defaultOptions.failureThreshold; i++) {
        breaker.recordFailure();
      }
      
      // Should now be open
      expect(breaker.getState()).toBe('OPEN');
      expect(breaker.isOpen()).toBe(true);
    });
    
    it('should reset failure count on success', () => {
      // Record some failures
      breaker.recordFailure();
      breaker.recordFailure();
      
      // Record a success
      breaker.recordSuccess();
      
      // Get stats to check failure count
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(0);
    });
  });
  
  /**
   * Tests for OPEN state behavior
   */
  describe('OPEN State', () => {
    beforeEach(() => {
      // Set up breaker in OPEN state
      breaker.forceState('OPEN');
    });
    
    it('should block requests when OPEN', () => {
      expect(breaker.isOpen()).toBe(true);
    });
    
    it('should transition to HALF_OPEN after resetTimeout', () => {
      // Advance time past the reset timeout
      timeController.advanceTime(defaultOptions.resetTimeout + 100);
      
      // Check state by calling isOpen (which also transitions if needed)
      breaker.isOpen();
      
      // Should now be half-open
      expect(breaker.getState()).toBe('HALF_OPEN');
    });
    
    it('should remain OPEN if resetTimeout has not elapsed', () => {
      // Advance time, but not past the timeout
      timeController.advanceTime(defaultOptions.resetTimeout / 2);
      
      // Should still be open
      expect(breaker.isOpen()).toBe(true);
      expect(breaker.getState()).toBe('OPEN');
    });
  });
  
  /**
   * Tests for HALF_OPEN state behavior
   */
  describe('HALF_OPEN State', () => {
    beforeEach(() => {
      // Set up breaker in HALF_OPEN state
      breaker.forceState('HALF_OPEN');
    });
    
    it('should allow requests in HALF_OPEN state', () => {
      expect(breaker.isOpen()).toBe(false);
    });
    
    it('should transition to CLOSED after success threshold is reached', () => {
      // Record successes up to threshold
      for (let i = 0; i < defaultOptions.successThreshold; i++) {
        breaker.recordSuccess();
      }
      
      // Should now be closed
      expect(breaker.getState()).toBe('CLOSED');
    });
    
    it('should transition back to OPEN on failure in HALF_OPEN state', () => {
      // Record a failure in HALF_OPEN state
      breaker.recordFailure();
      
      // Should go back to OPEN
      expect(breaker.getState()).toBe('OPEN');
    });
    
    it('should require consecutive successes to close the circuit', () => {
      // Record a success
      breaker.recordSuccess();
      
      // Record a failure (resets success count)
      breaker.recordFailure();
      
      // Advance time to get back to HALF_OPEN
      timeController.advanceTime(defaultOptions.resetTimeout + 100);
      breaker.isOpen(); // Trigger the state check
      
      // Record one success (not enough to close)
      breaker.recordSuccess();
      
      // Should still be HALF_OPEN
      expect(breaker.getState()).toBe('HALF_OPEN');
      
      // Record another success to reach threshold
      breaker.recordSuccess();
      
      // Should now be CLOSED
      expect(breaker.getState()).toBe('CLOSED');
    });
  });
  
  /**
   * Tests for manual state control
   */
  describe('Manual State Control', () => {
    it('should allow forcing to OPEN state', () => {
      breaker.forceState('OPEN', 'Manual override');
      expect(breaker.getState()).toBe('OPEN');
      expect(breaker.isOpen()).toBe(true);
    });
    
    it('should allow forcing to CLOSED state', () => {
      // First open the circuit
      breaker.forceState('OPEN');
      
      // Then force it closed
      breaker.forceState('CLOSED', 'Manual override');
      
      // Should be closed
      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.isOpen()).toBe(false);
    });
    
    it('should allow forcing to HALF_OPEN state', () => {
      breaker.forceState('HALF_OPEN', 'Manual override');
      expect(breaker.getState()).toBe('HALF_OPEN');
      expect(breaker.isOpen()).toBe(false);
    });
    
    it('should reset failure and success counts when forcing state', () => {
      // Record some failures
      breaker.recordFailure();
      breaker.recordFailure();
      
      // Force to a new state
      breaker.forceState('OPEN', 'Testing reset');
      
      // Get stats to check counts
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });
    
    it('should ignore invalid state names', () => {
      const initialState = breaker.getState();
      
      // Try to force an invalid state
      breaker.forceState('INVALID_STATE', 'Testing invalid');
      
      // Should remain in the original state
      expect(breaker.getState()).toBe(initialState);
    });
  });
  
  /**
   * Tests for statistics and monitoring
   */
  describe('Statistics and Monitoring', () => {
    it('should track state history', () => {
      // Force some state changes
      breaker.forceState('OPEN', 'Test 1');
      breaker.forceState('HALF_OPEN', 'Test 2');
      breaker.forceState('CLOSED', 'Test 3');
      
      // Get stats
      const stats = breaker.getStats();
      
      // Should have at least 4 entries (init + 3 forced changes)
      expect(stats.stateHistory.length).toBeGreaterThanOrEqual(4);
      
      // Check the last three state changes
      const lastThree = stats.stateHistory.slice(-3);
      expect(lastThree[0].state).toBe('OPEN');
      expect(lastThree[0].reason).toBe('Test 1');
      
      expect(lastThree[1].state).toBe('HALF_OPEN');
      expect(lastThree[1].reason).toBe('Test 2');
      
      expect(lastThree[2].state).toBe('CLOSED');
      expect(lastThree[2].reason).toBe('Test 3');
    });
    
    it('should limit history size', () => {
      // Force a lot of state changes
      for (let i = 0; i < 120; i++) {
        breaker.forceState('OPEN', `Test ${i}`);
        breaker.forceState('CLOSED', `Test ${i}`);
      }
      
      // Get stats
      const stats = breaker.getStats();
      
      // Should be limited to 100 entries
      expect(stats.stateHistory.length).toBeLessThanOrEqual(100);
    });
    
    it('should provide accurate statistics', () => {
      // Record some activity
      breaker.recordFailure();
      breaker.recordSuccess();
      breaker.recordFailure();
      
      // Get stats
      const stats = breaker.getStats();
      
      // Check stats fields
      expect(stats.failureCount).toBe(1); // Reset to 1 after the success
      expect(stats.state).toBe('CLOSED');
      expect(stats.nextAttempt).toBeDefined();
    });
  });
});