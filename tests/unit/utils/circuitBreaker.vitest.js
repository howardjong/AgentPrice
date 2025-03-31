/**
 * @file circuitBreaker.vitest.js
 * @description Tests for the CircuitBreaker utility
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTimeController, mockPerformanceNowSequence, wait, withTimeout } from '../../utils/time-testing-utils.js';

// Mock dependencies
vi.mock('../../../utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Import the module after mocks are set up
import { CircuitBreaker } from '../../../utils/circuitBreaker.js';
import logger from '../../../utils/logger.js';

describe('CircuitBreaker', () => {
  let circuitBreaker;
  let timeController;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create default circuit breaker instance with shorter timeouts for testing
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000, // Short timeout for testing
      successThreshold: 2,
      name: 'TestCircuit'
    });
    
    // Set up time controller for deterministic time manipulation
    timeController = createTimeController().setup();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
    if (timeController) {
      timeController.restore();
    }
  });
  
  describe('constructor', () => {
    it('should use default options when none are provided', () => {
      const defaultCircuitBreaker = new CircuitBreaker();
      expect(defaultCircuitBreaker.options.failureThreshold).toBe(5);
      expect(defaultCircuitBreaker.options.resetTimeout).toBe(30000);
      expect(defaultCircuitBreaker.options.successThreshold).toBe(2);
      expect(defaultCircuitBreaker.name).toBe('CircuitBreaker');
      expect(defaultCircuitBreaker.state).toBe('CLOSED');
    });
    
    it('should use provided options', () => {
      expect(circuitBreaker.options.failureThreshold).toBe(3);
      expect(circuitBreaker.options.resetTimeout).toBe(1000);
      expect(circuitBreaker.options.successThreshold).toBe(2);
      expect(circuitBreaker.name).toBe('TestCircuit');
    });
    
    it('should initialize with a closed state', () => {
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0);
      expect(circuitBreaker.successCount).toBe(0);
    });
    
    it('should record initial state in history', () => {
      expect(circuitBreaker.stateHistory).toHaveLength(1);
      expect(circuitBreaker.stateHistory[0].state).toBe('CLOSED');
      expect(circuitBreaker.stateHistory[0].reason).toBe('Initialized');
    });
    
    it('should log initialization', () => {
      expect(logger.info).toHaveBeenCalledWith(
        'TestCircuit: Circuit breaker initialized in CLOSED state',
        expect.objectContaining({
          component: 'circuitBreaker'
        })
      );
    });
  });
  
  describe('recordSuccess', () => {
    it('should reset failure count', () => {
      circuitBreaker.failureCount = 2;
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.failureCount).toBe(0);
    });
    
    it('should increment success count in HALF-OPEN state', () => {
      // Force circuit to HALF-OPEN state
      circuitBreaker.state = 'HALF-OPEN';
      circuitBreaker.successCount = 0;
      
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.successCount).toBe(1);
    });
    
    it('should transition to CLOSED after reaching success threshold in HALF-OPEN state', () => {
      // Force circuit to HALF-OPEN state
      circuitBreaker.state = 'HALF-OPEN';
      circuitBreaker.successCount = 1; // One more success needed to reach threshold
      
      circuitBreaker.recordSuccess();
      
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.stateHistory[circuitBreaker.stateHistory.length - 1].reason).toBe('Success threshold reached');
      
      // Verify transition was logged
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Circuit state change from HALF-OPEN to CLOSED'),
        expect.any(Object)
      );
    });
  });
  
  describe('recordFailure', () => {
    it('should increment failure count', () => {
      circuitBreaker.failureCount = 0;
      circuitBreaker.recordFailure();
      expect(circuitBreaker.failureCount).toBe(1);
    });
    
    it('should reset success count', () => {
      circuitBreaker.successCount = 1;
      circuitBreaker.recordFailure();
      expect(circuitBreaker.successCount).toBe(0);
    });
    
    it('should transition to OPEN after reaching failure threshold in CLOSED state', () => {
      // Set state to one below threshold
      circuitBreaker.failureCount = 2; // One more to reach threshold of 3
      
      circuitBreaker.recordFailure();
      
      expect(circuitBreaker.state).toBe('OPEN');
      expect(circuitBreaker.stateHistory[circuitBreaker.stateHistory.length - 1].reason).toBe('Failure threshold reached');
      
      // Verify next attempt time was set
      expect(circuitBreaker.nextAttempt).toBe(Date.now() + 1000);
      
      // Verify transition was logged
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Circuit state change from CLOSED to OPEN'),
        expect.any(Object)
      );
    });
    
    it('should transition to OPEN after failure in HALF-OPEN state', () => {
      // Force circuit to HALF-OPEN state
      circuitBreaker.state = 'HALF-OPEN';
      
      circuitBreaker.recordFailure();
      
      expect(circuitBreaker.state).toBe('OPEN');
      expect(circuitBreaker.stateHistory[circuitBreaker.stateHistory.length - 1].reason).toBe('Failed in half-open state');
      
      // Verify next attempt time was set
      expect(circuitBreaker.nextAttempt).toBe(Date.now() + 1000);
    });
  });
  
  describe('isOpen', () => {
    it('should return false when circuit is CLOSED', () => {
      circuitBreaker.state = 'CLOSED';
      expect(circuitBreaker.isOpen()).toBe(false);
    });
    
    it('should return false when circuit is HALF-OPEN', () => {
      circuitBreaker.state = 'HALF-OPEN';
      expect(circuitBreaker.isOpen()).toBe(false);
    });
    
    it('should return true when circuit is OPEN and reset timeout has not elapsed', () => {
      circuitBreaker.state = 'OPEN';
      circuitBreaker.nextAttempt = Date.now() + 500; // 500ms into the future
      
      expect(circuitBreaker.isOpen()).toBe(true);
    });
    
    it('should transition to HALF-OPEN and return false when reset timeout has elapsed', () => {
      circuitBreaker.state = 'OPEN';
      circuitBreaker.nextAttempt = Date.now() - 100; // 100ms in the past
      
      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.state).toBe('HALF-OPEN');
      
      // Verify transition was logged
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Circuit state change from OPEN to HALF-OPEN'),
        expect.any(Object)
      );
    });
  });
  
  describe('forceState', () => {
    it('should force circuit to a specified state', () => {
      circuitBreaker.state = 'CLOSED';
      circuitBreaker.forceState('OPEN', 'Testing force state');
      
      expect(circuitBreaker.state).toBe('OPEN');
      expect(circuitBreaker.stateHistory[circuitBreaker.stateHistory.length - 1].reason).toBe('Testing force state');
    });
    
    it('should reset counters when forcing state', () => {
      circuitBreaker.failureCount = 2;
      circuitBreaker.successCount = 1;
      
      circuitBreaker.forceState('HALF-OPEN');
      
      expect(circuitBreaker.failureCount).toBe(0);
      expect(circuitBreaker.successCount).toBe(0);
    });
    
    it('should set next attempt time when forcing to OPEN state', () => {
      circuitBreaker.forceState('OPEN');
      expect(circuitBreaker.nextAttempt).toBe(Date.now() + 1000); // 1000ms is the reset timeout
    });
    
    it('should log an error for invalid state', () => {
      circuitBreaker.forceState('INVALID_STATE');
      
      expect(logger.error).toHaveBeenCalledWith(
        'TestCircuit: Invalid state: INVALID_STATE',
        expect.objectContaining({
          component: 'circuitBreaker'
        })
      );
      
      // State should not have changed
      expect(circuitBreaker.state).toBe('CLOSED');
    });
  });
  
  describe('getState', () => {
    it('should return the current state', () => {
      circuitBreaker.state = 'OPEN';
      expect(circuitBreaker.getState()).toBe('OPEN');
      
      circuitBreaker.state = 'CLOSED';
      expect(circuitBreaker.getState()).toBe('CLOSED');
      
      circuitBreaker.state = 'HALF-OPEN';
      expect(circuitBreaker.getState()).toBe('HALF-OPEN');
    });
  });
  
  describe('getStats', () => {
    it('should return circuit statistics', () => {
      // Set up some state
      circuitBreaker.state = 'OPEN';
      circuitBreaker.failureCount = 3;
      circuitBreaker.successCount = 0;
      circuitBreaker.nextAttempt = Date.now() + 1000;
      
      const stats = circuitBreaker.getStats();
      
      expect(stats.state).toBe('OPEN');
      expect(stats.failureCount).toBe(3);
      expect(stats.successCount).toBe(0);
      expect(stats.nextAttempt).toBe(Date.now() + 1000);
      expect(stats.stateHistory).toBeInstanceOf(Array);
    });
    
    it('should limit state history in the stats', () => {
      // Create a circuit with a lot of state changes
      const testCircuit = new CircuitBreaker({ name: 'LimitTest' });
      
      // Push more than 10 state changes
      for (let i = 0; i < 15; i++) {
        testCircuit.stateHistory.push({
          timestamp: Date.now(),
          state: 'CLOSED',
          reason: `Change ${i}`
        });
      }
      
      const stats = testCircuit.getStats();
      
      // Should only return last 10 state changes
      expect(stats.stateHistory.length).toBe(10);
    });
  });
  
  describe('transitionTo', () => {
    it('should update state and record in history', () => {
      circuitBreaker.transitionTo('OPEN', 'Test transition');
      
      expect(circuitBreaker.state).toBe('OPEN');
      
      const latestChange = circuitBreaker.stateHistory[circuitBreaker.stateHistory.length - 1];
      expect(latestChange.state).toBe('OPEN');
      expect(latestChange.reason).toBe('Test transition');
      expect(latestChange.timestamp).toBeDefined();
    });
    
    it('should log state change', () => {
      circuitBreaker.transitionTo('OPEN', 'Test transition');
      
      expect(logger.info).toHaveBeenCalledWith(
        'TestCircuit: Circuit state change from CLOSED to OPEN (Test transition)',
        expect.objectContaining({
          component: 'circuitBreaker'
        })
      );
    });
    
    it('should reset success count on transitions (except to HALF-OPEN)', () => {
      circuitBreaker.successCount = 1;
      
      // Transition to OPEN should reset success count
      circuitBreaker.transitionTo('OPEN', 'Test transition');
      expect(circuitBreaker.successCount).toBe(0);
      
      // Set success count again
      circuitBreaker.successCount = 1;
      
      // Transition to HALF-OPEN should maintain success count
      circuitBreaker.transitionTo('HALF-OPEN', 'Test transition');
      expect(circuitBreaker.successCount).toBe(1);
    });
    
    it('should limit history size', () => {
      // Create a circuit with a lot of state changes
      const testCircuit = new CircuitBreaker();
      
      // Add 150 state changes
      for (let i = 0; i < 150; i++) {
        testCircuit.transitionTo('CLOSED', `Change ${i}`);
      }
      
      // Should be limited to 100 entries
      expect(testCircuit.stateHistory.length).toBe(100);
    });
    
    it('should do nothing if new state is the same as current state', () => {
      // Start with CLOSED state
      circuitBreaker.state = 'CLOSED';
      const historyLengthBefore = circuitBreaker.stateHistory.length;
      
      // Try to transition to CLOSED again
      circuitBreaker.transitionTo('CLOSED', 'No change needed');
      
      // No new history entry should be added
      expect(circuitBreaker.stateHistory.length).toBe(historyLengthBefore);
      
      // No log should be made
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Circuit state change'),
        expect.any(Object)
      );
    });
  });
});