
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker } from '../../../utils/circuitBreaker.js';

// Mock the logger
vi.mock('../../../utils/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }
}));

describe('CircuitBreaker', () => {
  let circuitBreaker;
  const originalDateNow = Date.now;

  beforeEach(() => {
    // Reset mocks between tests
    vi.clearAllMocks();
    
    // Mock Date.now
    let currentTime = 1000;
    global.Date.now = vi.fn(() => currentTime);
    
    // Create a new circuit breaker for each test
    circuitBreaker = new CircuitBreaker({
      name: 'test-circuit',
      failureThreshold: 3,
      resetTimeout: 500
    });
  });

  afterEach(() => {
    // Clean up
    circuitBreaker = null;
    global.Date.now = originalDateNow;
  });

  it('should start in closed state', () => {
    expect(circuitBreaker.getState()).toBe('CLOSED');
    expect(circuitBreaker.isOpen()).toBe(false);
  });

  it('should transition to open state after failures exceed threshold', () => {
    // Register enough failures to trip the circuit
    circuitBreaker.recordFailure();
    circuitBreaker.recordFailure();
    circuitBreaker.recordFailure();
    
    expect(circuitBreaker.getState()).toBe('OPEN');
    expect(circuitBreaker.isOpen()).toBe(true);
  });

  it('should handle reset timeout', () => {
    // Register failures to trip the circuit
    circuitBreaker.recordFailure();
    circuitBreaker.recordFailure();
    circuitBreaker.recordFailure();
    
    expect(circuitBreaker.isOpen()).toBe(true);
    
    // Manually force state to closed
    circuitBreaker.forceState('CLOSED', 'Test reset');
    
    // Should be closed now
    expect(circuitBreaker.isOpen()).toBe(false);
  });

  it('should track consecutive failures', () => {
    circuitBreaker.recordFailure();
    circuitBreaker.recordFailure();
    
    const stats = circuitBreaker.getStats();
    expect(stats.failureCount).toBe(2);
  });

  it('should reset failure count on success', () => {
    circuitBreaker.recordFailure();
    circuitBreaker.recordFailure();
    circuitBreaker.recordSuccess();
    
    const stats = circuitBreaker.getStats();
    expect(stats.failureCount).toBe(0);
  });
});
