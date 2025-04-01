/**
 * Simple test for Circuit Breaker recovery
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker } from '../../../utils/circuitBreaker.js';
import { RobustAPIClient } from '../../../utils/apiClient.js';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Mock logger to avoid console noise during tests
vi.mock('../../../utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('Simple Circuit Breaker Test', () => {
  let circuitBreaker;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a new circuit breaker
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 1000,
      name: 'TestBreaker'
    });
    
    // Spy on methods
    vi.spyOn(circuitBreaker, 'recordSuccess');
    vi.spyOn(circuitBreaker, 'recordFailure');
    vi.spyOn(circuitBreaker, 'isOpen');
    vi.spyOn(circuitBreaker, 'getState');
  });
  
  it('should start in closed state', () => {
    expect(circuitBreaker.getState()).toBe('CLOSED');
  });
  
  it('should open after failure threshold is reached', () => {
    // Record failures
    circuitBreaker.recordFailure();
    expect(circuitBreaker.getState()).toBe('CLOSED');
    
    circuitBreaker.recordFailure();
    expect(circuitBreaker.getState()).toBe('OPEN');
  });
});