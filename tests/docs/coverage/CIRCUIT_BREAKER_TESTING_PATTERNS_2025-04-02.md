# Circuit Breaker Testing Patterns

## Overview

This document outlines the testing patterns established for effectively testing the CircuitBreaker utility, which is a critical component for maintaining service reliability during API failures.

## Testing Structure

We've organized the CircuitBreaker tests into three focused files:

1. **circuitBreaker.state.vitest.js**: Tests state transitions and core functionality
2. **circuitBreaker.integration.vitest.js**: Tests integration with API requests and error handling
3. **circuitBreaker.config.vitest.js**: Tests configuration options and edge cases

This modular approach allows for more focused tests and better clarity when debugging failures.

## Key Testing Patterns

### 1. Time Manipulation

Circuit breakers are inherently time-dependent, requiring controlled time advancement for testing timeouts and state transitions.

```javascript
// Create a time controller
const timeController = createTimeController().setup();

// Use in tests to advance time
it('should transition to HALF_OPEN after resetTimeout', () => {
  breaker.forceState('OPEN');
  
  // Advance time past the timeout
  timeController.advanceTime(resetTimeout + 100);
  breaker.isOpen(); // Trigger state check
  
  expect(breaker.getState()).toBe('HALF_OPEN');
});

// Important: always restore time in afterEach
afterEach(() => {
  timeController.restore();
});
```

### 2. State Transition Testing

Testing all possible state transitions ensures the circuit breaker operates correctly under all conditions.

```javascript
// Test all possible transitions:
// CLOSED -> OPEN (failure threshold reached)
// OPEN -> HALF_OPEN (timeout elapsed)
// HALF_OPEN -> CLOSED (success threshold reached)
// HALF_OPEN -> OPEN (failure during testing)
```

### 3. Mocking API Requests

When testing integration with API clients, create mock functions that can succeed or fail on demand.

```javascript
// Create mock API functions
const successfulRequest = vi.fn().mockResolvedValue({ data: 'success' });
const failingRequest = vi.fn().mockRejectedValue(new Error('API Error'));

// Create intermittent failure function
let counter = 0;
const intermittentRequest = vi.fn().mockImplementation(() => {
  if (counter++ % 2 === 0) {
    return Promise.reject(new Error('Intermittent Error'));
  } else {
    return Promise.resolve({ data: 'success' });
  }
});
```

### 4. Protected Request Pattern

Standardize how requests are protected by the circuit breaker.

```javascript
async function executeWithBreaker(fn) {
  if (breaker.isOpen()) {
    throw new Error('Circuit breaker is open');
  }
  
  try {
    const result = await fn();
    breaker.recordSuccess();
    return result;
  } catch (error) {
    breaker.recordFailure();
    throw error;
  }
}

// Use this pattern consistently
const result = await executeWithBreaker(apiFunction);
```

### 5. Configuration Testing

Test different configurations to ensure the circuit breaker behaves as expected with various settings.

```javascript
it('should respect custom thresholds', () => {
  const breaker = new CircuitBreaker({ 
    failureThreshold: 10,
    resetTimeout: 5000,
    successThreshold: 3
  });
  
  // Test with the specific configuration...
});
```

## Common Scenarios to Test

1. **Normal operation**: Circuit closed, requests succeed
2. **Failure detection**: Circuit opens after threshold failures
3. **Recovery attempt**: Circuit transitions to half-open after timeout
4. **Successful recovery**: Circuit closes after successful requests
5. **Failed recovery**: Circuit reopens after failure in half-open state
6. **Edge cases**: Different configurations, zero thresholds, extreme values
7. **Error handling**: Different types of errors and their effect on the circuit
8. **Multiple circuits**: Independence of different circuit breaker instances

## Best Practices

1. **Use short timeouts for tests**: Configure circuit breakers with short timeouts (100-1000ms) for faster tests
2. **Test state transitions explicitly**: Don't rely on implied transitions
3. **Verify both state and behavior**: Check both the internal state and the behavior from a client perspective
4. **Mock time instead of waiting**: Never use actual timeouts in tests
5. **Use descriptive test names**: Clearly indicate what state transition or behavior is being tested
6. **Test edge configurations**: Test with both minimal and maximal configuration values

## Example Test Cases

### Basic State Transition

```javascript
it('should transition from CLOSED to OPEN when failures exceed threshold', () => {
  const breaker = new CircuitBreaker({ failureThreshold: 3 });
  
  // Record failures up to threshold
  breaker.recordFailure();
  breaker.recordFailure();
  expect(breaker.getState()).toBe('CLOSED');
  
  // One more failure should open the circuit
  breaker.recordFailure();
  expect(breaker.getState()).toBe('OPEN');
});
```

### Testing Recovery

```javascript
it('should attempt recovery after timeout period', () => {
  const resetTimeout = 1000;
  const breaker = new CircuitBreaker({ resetTimeout });
  
  // Open the circuit
  breaker.forceState('OPEN');
  
  // Advance time past the timeout
  timeController.advanceTime(resetTimeout + 100);
  
  // Check if circuit is open - should trigger transition to HALF_OPEN
  const isOpen = breaker.isOpen();
  
  // Circuit should now be in HALF_OPEN state
  expect(isOpen).toBe(false);
  expect(breaker.getState()).toBe('HALF_OPEN');
});
```

### Testing Request Handling

```javascript
it('should reject requests when circuit is open', async () => {
  // Open the circuit
  breaker.forceState('OPEN');
  
  try {
    await executeWithBreaker(successfulRequest);
    // Should not reach here
    expect(true).toBe(false);
  } catch (error) {
    expect(error.message).toBe('Circuit breaker is open');
  }
  
  // API function should not have been called
  expect(successfulRequest).not.toHaveBeenCalled();
});
```

## Related Testing Tools

- **time-testing-utils.js**: Utilities for controlling time in tests
- **MockAdapter**: For testing API integrations that use axios
- **vi.mock()**: For mocking dependencies like logger