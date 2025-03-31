/**
 * @file circuitBreaker.minimal.vitest.js
 * @description Focused minimal tests for the CircuitBreaker utility
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
import CircuitBreaker from '../../../utils/circuitBreaker.js';
import logger from '../../../utils/logger.js';

describe('CircuitBreaker', () => {
  let circuitBreaker;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create default circuit breaker instance with shorter timeouts for testing
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000, // Short timeout for testing
      successThreshold: 2,
      name: 'TestCircuit'
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('constructor', () => {
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
  });
  
  describe('recordSuccess', () => {
    it('should reset failure count', () => {
      circuitBreaker.failureCount = 2;
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.failureCount).toBe(0);
    });
    
    it('should increment success count in HALF_OPEN state', () => {
      // Force circuit to HALF_OPEN state
      circuitBreaker.state = 'HALF_OPEN';  // This matches the STATE.HALF_OPEN constant in the implementation
      circuitBreaker.successCount = 0;
      
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.successCount).toBe(1);
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
  });
  
  describe('getState', () => {
    it('should return the current state', () => {
      circuitBreaker.state = 'OPEN';
      expect(circuitBreaker.getState()).toBe('OPEN');
      
      circuitBreaker.state = 'CLOSED';
      expect(circuitBreaker.getState()).toBe('CLOSED');
      
      circuitBreaker.state = 'HALF_OPEN';
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
    });
  });
});