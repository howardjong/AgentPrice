# Circuit Breaker Testing Patterns

This document outlines the testing patterns and best practices for testing the Circuit Breaker pattern in the Multi-LLM Research System (MLRS). The tests focus on comprehensive state transitions, edge cases, and integration with API clients.

## Table of Contents
1. [State Transition Testing](#state-transition-testing)
2. [Edge Case Testing](#edge-case-testing)
3. [API Client Integration Testing](#api-client-integration-testing)
4. [Time-Dependent Testing](#time-dependent-testing)
5. [Mocking Strategies](#mocking-strategies)
6. [Test Organization](#test-organization)

## State Transition Testing

State transitions are the core of the Circuit Breaker pattern. Our testing approach ensures all possible transitions are thoroughly tested.

### Key State Transition Tests

- **Initial State**: Verify that a new Circuit Breaker starts in the CLOSED state with correct counters
- **CLOSED to OPEN**: Verify that reaching the failure threshold triggers the transition
- **OPEN to HALF_OPEN**: Verify that the timeout mechanism works correctly
- **HALF_OPEN to CLOSED**: Verify that successful operations in HALF_OPEN state close the circuit
- **HALF_OPEN to OPEN**: Verify that failures in HALF_OPEN immediately reopen the circuit
- **Complete Cycles**: Test full transition cycles (CLOSED→OPEN→HALF_OPEN→CLOSED)

### Test Patterns

```javascript
// Test pattern: Transition through failure threshold
for (let i = 0; i < failureThreshold; i++) {
  breaker.recordFailure();
}
expect(breaker.getState()).toBe('OPEN');

// Test pattern: Time-based transitions
timeController.advanceTime(resetTimeout + 1);
expect(breaker.isOpen()).toBe(false);
expect(breaker.getState()).toBe('HALF_OPEN');

// Test pattern: Testing counter resets
// Record failures but not enough to open
for (let i = 0; i < failureThreshold - 1; i++) {
  breaker.recordFailure();
}
// Record a success
breaker.recordSuccess();
// Failures should be reset
expect(breaker.getStats().failureCount).toBe(0);
```

## Edge Case Testing

Edge cases test the boundary conditions and unusual scenarios that might occur in production.

### Key Edge Case Tests

- **Configuration Edge Cases**: Test zero, negative, extremely large thresholds
- **History Management**: Test history size limits and order preservation
- **Success/Failure Counting**: Test rapid operations, counter resets
- **Timing Edge Cases**: Test very short/long timeouts, time jumps
- **Constructor Edge Cases**: Test initialization variations

### Test Patterns

```javascript
// Test pattern: Testing extreme values
const breaker = new CircuitBreaker({
  failureThreshold: 1000000,
  resetTimeout: 1
});

// Test pattern: Testing rapid operations
for (let i = 0; i < successThreshold; i++) {
  breaker.recordSuccess();
}

// Test pattern: Testing time jumps
timeController.advanceTime(24 * 60 * 60 * 1000); // Jump a full day
```

## API Client Integration Testing

These tests verify that the Circuit Breaker properly integrates with API clients.

### Key API Client Integration Tests

- **Successful Requests**: Test handling of successful API responses
- **Failed Requests**: Test handling of server errors, network failures, timeouts
- **Recovery Patterns**: Test recovery after service becomes available again
- **Client vs. Server Errors**: Test differentiated handling of 4xx vs 5xx errors

### Test Patterns

```javascript
// Test pattern: Protecting API calls
async function executeRequest(url) {
  if (breaker.isOpen()) {
    throw new Error('Circuit breaker is open');
  }
  
  try {
    const response = await axios.get(url);
    breaker.recordSuccess();
    return response;
  } catch (error) {
    breaker.recordFailure();
    throw error;
  }
}

// Test pattern: Recovery testing
// First open the circuit
mockFailures();
await expectFailures();
expect(breaker.getState()).toBe('OPEN');

// Then make service available
mockSuccesses();
timeController.advanceTime(resetTimeout + 1);
await successfulRequests();
expect(breaker.getState()).toBe('CLOSED');
```

## Time-Dependent Testing

Since the Circuit Breaker relies on time for state transitions, we use a time controller to make tests deterministic.

### Time Controller Usage

```javascript
// Initialize time controller
timeController = createTimeController().setup();

// Use in tests
breaker.forceState('OPEN');
timeController.advanceTime(resetTimeout + 1);
expect(breaker.isOpen()).toBe(false);

// Clean up
timeController.restore();
```

## Mocking Strategies

### Logger Mocking

```javascript
vi.mock('../../../utils/logger.js', () => {
  return {
    default: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  };
});
```

### HTTP Client Mocking

```javascript
// Setup
vi.mock('axios');
axios.get.mockResolvedValue({ data: { success: true }, status: 200 });

// Multiple responses
axios.get
  .mockResolvedValueOnce({ data: { first: true } })
  .mockRejectedValueOnce(new Error('Temporary Error'))
  .mockResolvedValueOnce({ data: { third: true } });
```

## Test Organization

Our Circuit Breaker tests are organized into three main files:

1. **circuitBreaker.state-transitions.vitest.js**: Focused on comprehensive state transition tests
2. **circuitBreaker.edge-cases.vitest.js**: Tests edge cases and boundary conditions
3. **circuitBreaker.api-client.vitest.js**: Tests integration with API clients

This separation helps keep tests focused and maintainable while ensuring comprehensive coverage.

## Key Testing Insights

- **Isolated Tests**: Each test is completely isolated with fresh breaker instances
- **Deterministic Time**: Time-based behavior is tested deterministically with timeController
- **Comprehensive States**: All states and transitions are verified
- **Real-world Scenarios**: Tests simulate real API scenarios including failures, recovery, rate limiting
- **Edge Protection**: Edge cases ensure production stability in unusual conditions

## Test Coverage Goals

| Component                  | Coverage Target | Test Focus                                                  |
|----------------------------|----------------:|-------------------------------------------------------------|
| State Transitions          |            100% | Complete state machine verification                          |
| Configuration Options      |             90% | All options tested with reasonable boundaries                |
| Time-Dependent Behavior    |             95% | All timeout scenarios verified                               |
| API Client Integration     |             85% | Common API response patterns covered                         |
| Event History              |             90% | State history recording, limiting, order verification        |
| Error Handling             |             95% | All error conditions tested and gracefully handled           |