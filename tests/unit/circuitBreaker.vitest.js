import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { CircuitBreaker } from '../../utils/monitoring.js';

describe('CircuitBreaker', () => {
  let circuitBreaker;
  
  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({ 
      failureThreshold: 5,
      resetTimeout: 1000
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('trips after threshold failures', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Service error'));
    const serviceKey = 'test-service';

    // Attempt 5 failed calls
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.executeRequest(serviceKey, mockFn);
      } catch (error) {
        expect(error.message).toBe('Service error');
      }
    }

    // Verify circuit is open
    try {
      await circuitBreaker.executeRequest(serviceKey, mockFn);
      expect.fail('Should have thrown circuit open error');
    } catch (error) {
      expect(error.message).includes('circuit breaker open');
    }

    // Advance time past reset timeout
    vi.advanceTimersByTime(1100);

    // Should be half-open now
    const successFn = vi.fn().mockResolvedValue('success');
    const result = await circuitBreaker.executeRequest(serviceKey, successFn);
    expect(result).toBe('success');
  });
});