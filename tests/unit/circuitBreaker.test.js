
// Using CommonJS for Jest compatibility
const { jest } = require('@jest/globals');
const { CircuitBreaker } = require('../../utils/monitoring.js');

describe('CircuitBreaker', () => {
  let circuitBreaker;
  
  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({ 
      failureThreshold: 5,
      resetTimeout: 1000
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('trips after threshold failures', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Service error'));
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
      fail('Should have thrown circuit open error');
    } catch (error) {
      expect(error.message).toContain('circuit breaker open');
    }

    // Advance time past reset timeout
    jest.advanceTimersByTime(1100);

    // Should be half-open now
    const successFn = jest.fn().mockResolvedValue('success');
    const result = await circuitBreaker.executeRequest(serviceKey, successFn);
    expect(result).toBe('success');
  });
});
