
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

  beforeEach(() => {
    // Reset mocks between tests
    vi.clearAllMocks();
    
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
  });

  it('should start in closed state', () => {
    expect(circuitBreaker.isOpen()).toBe(false);
  });

  it('should transition to open state after failures exceed threshold', () => {
    // Register enough failures to trip the circuit
    circuitBreaker.registerFailure();
    circuitBreaker.registerFailure();
    circuitBreaker.registerFailure();
    
    expect(circuitBreaker.isOpen()).toBe(true);
  });

  it('should reset after timeout period', async () => {
    // Register failures to trip the circuit
    circuitBreaker.registerFailure();
    circuitBreaker.registerFailure();
    circuitBreaker.registerFailure();
    
    expect(circuitBreaker.isOpen()).toBe(true);
    
    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Should be closed now
    expect(circuitBreaker.isOpen()).toBe(false);
  });

  it('should track consecutive failures', () => {
    circuitBreaker.registerFailure();
    circuitBreaker.registerFailure();
    
    expect(circuitBreaker.getFailureCount()).toBe(2);
  });

  it('should reset failure count on success', () => {
    circuitBreaker.registerFailure();
    circuitBreaker.registerFailure();
    circuitBreaker.registerSuccess();
    
    expect(circuitBreaker.getFailureCount()).toBe(0);
  });
});
