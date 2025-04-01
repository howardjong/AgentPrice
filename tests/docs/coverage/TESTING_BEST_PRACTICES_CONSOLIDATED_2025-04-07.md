# Consolidated Testing Best Practices - April 7, 2025

## Introduction

This document consolidates the best testing practices identified across various components of our system during the coverage improvement initiative. These patterns have been proven to enhance test stability, maintainability, and effectiveness.

## Cross-Component Testing Principles

### 1. Isolation & Independence

- **Single Responsibility**: Each test should verify one capability or behavior
- **Proper Cleanup**: All tests must clean up their resources, regardless of success or failure
- **Avoid Shared State**: Tests should not depend on or alter shared state

### 2. Mocking Strategy

- **Specific Context**: Mock only what's necessary for the current test
- **Realistic Behavior**: Mocks should mimic real component behavior, including errors
- **Boundary Mocking**: Mock at system boundaries (database, external APIs, filesystem)

### 3. Asynchronous Testing

- **Explicit Waiting**: Always use explicit waiting for async operations, never arbitrary timeouts
- **Timeout Control**: Set appropriate timeouts based on operation type (shorter for quick operations, longer for reconnection)
- **Timeout Diagnostics**: Capture state when timeouts occur to aid debugging

### 4. Error Handling

- **Expected Errors**: Always test error paths, not just happy paths
- **Error Specificity**: Verify specific error types and messages
- **Graceful Degradation**: Test that components fail gracefully under error conditions

## Component-Specific Best Practices

### Circuit Breaker Testing

✅ **DO**:
- Test complete state transition cycles (CLOSED → OPEN → HALF_OPEN → CLOSED)
- Mock time progression using TimeController to simulate timeout-based state transitions
- Test state history tracking with timestamps and transition reasons
- Verify proper counter resets during state transitions
- Test edge cases like multiple failures in HALF_OPEN state
- Mock logger calls to avoid direct dependency on the logger implementation
- Validate manual state control functionality and proper error handling

❌ **DON'T**:
- Use real timeouts in tests - always use time controllers
- Mix state transition testing with API client testing
- Skip testing edge cases with extreme configuration values
- Assume state transitions happen automatically - explicit calls may be needed
- Rely on state being persisted between tests (reset in beforeEach)

### Socket.IO Testing

✅ **DO**:
- Use minimal test implementations for critical functionality
- Verify room membership before broadcasting
- Implement detailed logging for socket operations
- Track message and event history for diagnosing timeouts
- Clean up resources in reverse order (clients → IO server → HTTP server)

❌ **DON'T**:
- Rely on complex abstractions for basic functionality tests
- Use arbitrary timeouts instead of event-based waiting
- Assume disconnects will complete immediately (use safety timeouts)
- Neglect to verify room membership before broadcasts

### API Client & Circuit Breaker Integration Testing

✅ **DO**:
- Test state transitions in isolation (closed → open → half-open → closed)
- Use TimeController to manipulate time-dependent operations
- Test integration between circuit breaker and API client
- Mock axios at request level rather than client level
- Use counter-based mocked responses instead of chained responses

❌ **DON'T**:
- Couple circuit breaker tests with actual API requests
- Test multiple state transitions in a single test
- Use chained axios-mock-adapter responses for timeout tests
- Forget to test circuit breaker reset behavior after API recovery

### Redis Testing

✅ **DO**:
- Create mock implementations that match exact Redis command names
- Test key expiration and time-to-live functionality
- Simulate connection failures and recovery
- String-convert values for comparison where appropriate

❌ **DON'T**:
- Mix camelCase and lowercase method names in mock implementations
- Assume commands are atomic (test with delays and concurrency)
- Skip testing publish/subscribe functionality

### Job Manager Testing

✅ **DO**:
- Place mock implementations inside vi.mock factory functions
- Test both queue creation and job processing
- Verify proper error handling during job processing
- Test delayed jobs with time controllers

❌ **DON'T**:
- Create real Redis connections in tests
- Modify global Bull implementation directly
- Skip testing error and retry scenarios

### Context Manager Testing

✅ **DO**:
- Mock Redis client and performance metrics
- Test edge cases like malformed JSON and large contexts
- Verify storage limits and expiration behavior
- Test performance degradation scenarios

❌ **DON'T**:
- Use real Redis in context manager tests
- Skip testing for error conditions
- Assume JSON parsing will always succeed

### Prompt Manager Testing

✅ **DO**:
- Mock filesystem operations for template loading
- Test template interpolation with various inputs
- Create simplifications when comprehensive mocking is problematic
- Test null/undefined variable handling in templates

❌ **DON'T**:
- Access actual filesystem in tests
- Skip testing template error conditions
- Assume directories will always exist

## Testing Patterns Library

### Circuit Breaker State Transition Pattern

```javascript
// Setup in beforeEach
const timeController = createTimeController().setup();
const breaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 1000,
  successThreshold: 2
});

// Test complete state cycle
it('should handle the complete CLOSED->OPEN->HALF_OPEN->CLOSED cycle', () => {
  // 1. Start in CLOSED state
  expect(breaker.getState()).toBe(STATE.CLOSED);
  
  // 2. Trigger enough failures to open the circuit
  for (let i = 0; i < 3; i++) {
    breaker.recordFailure();
  }
  
  // 3. Circuit should be OPEN
  expect(breaker.getState()).toBe(STATE.OPEN);
  
  // 4. Advance time past the reset timeout
  timeController.advanceTime(1001);
  
  // 5. Next isOpen() call should transition to HALF_OPEN
  expect(breaker.isOpen()).toBe(false);
  expect(breaker.getState()).toBe(STATE.HALF_OPEN);
  
  // 6. Record enough successes to close the circuit
  for (let i = 0; i < 2; i++) {
    breaker.recordSuccess();
  }
  
  // 7. Circuit should be CLOSED again
  expect(breaker.getState()).toBe(STATE.CLOSED);
});

// Clean up in afterEach
afterEach(() => {
  timeController.restore();
});
```

### Circuit Breaker Edge Case Testing Pattern

```javascript
describe('Configuration Edge Cases', () => {
  it('should handle zero failureThreshold', () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 0
    });
    
    // Circuit should open on first failure
    breaker.recordFailure();
    expect(breaker.getState()).toBe(STATE.OPEN);
  });
  
  it('should handle very large thresholds', () => {
    const breaker = new CircuitBreaker({
      failureThreshold: Number.MAX_SAFE_INTEGER
    });
    
    // Circuit should never open with normal failure counts
    for (let i = 0; i < 1000; i++) {
      breaker.recordFailure();
    }
    expect(breaker.getState()).toBe(STATE.CLOSED);
  });
});
```

### Circuit Breaker API Integration Pattern

```javascript
// Set up protected request pattern
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

// Test with counter-based mock
it('should handle intermittent failures correctly', async () => {
  let requestCount = 0;
  const intermittentRequest = vi.fn().mockImplementation(() => {
    requestCount++;
    if (requestCount % 2 === 1) {
      return Promise.reject(new Error('Intermittent Error'));
    }
    return Promise.resolve({ data: 'success' });
  });

  // First request fails
  await expect(executeWithBreaker(intermittentRequest)).rejects.toThrow('Intermittent Error');
  expect(breaker.getState()).toBe(STATE.CLOSED);

  // Second request succeeds
  const result = await executeWithBreaker(intermittentRequest);
  expect(result).toEqual({ data: 'success' });
  expect(breaker.getState()).toBe(STATE.CLOSED);
  
  // Verify failure counter was reset
  expect(breaker.getStats().failureCount).toBe(0);
});
```

### Socket.IO Test Pattern

```javascript
// Create minimal server and clients
const app = express();
const server = createServer(app);
const PORT = 3333;
const io = new Server(server);
server.listen(PORT);

// Track messages separately
const receivedMessages = { client1: [], client2: [] };

// Set up message handlers before connecting
client1.on('test-event', (msg) => {
  receivedMessages.client1.push(msg);
});

// Use event-based waiting
await Promise.all([
  new Promise(resolve => client1.once('joined', resolve)),
  new Promise(resolve => client2.once('joined', resolve))
]);

// Send targeted room messages
io.to('room1').emit('test-event', { room: 'room1', msg: 'Hello room1' });
```

### API Client Circuit Breaker Pattern

```javascript
// Setup mocked responses with counter-based approach
let requestCount = 0;
axiosMock.onGet('https://api.example.com/data').reply(() => {
  requestCount++;
  // First 5 requests fail
  if (requestCount <= 5) {
    return [500, { error: 'Server Error' }];
  }
  // Later requests succeed
  return [200, { data: 'Success' }];
});

// Test state transitions
expect(circuitBreaker.getState()).toBe('closed');

// Trigger circuit to open
await expect(apiClient.get('/data')).rejects.toThrow();
await expect(apiClient.get('/data')).rejects.toThrow();
expect(circuitBreaker.getState()).toBe('open');

// Advance time to half-open
timeController.advanceTimeBy(5000);
expect(circuitBreaker.getState()).toBe('half-open');

// Test recovery
const response = await apiClient.get('/data');
expect(response.data).toEqual({ data: 'Success' });
expect(circuitBreaker.getState()).toBe('closed');
```

### Redis Mock Pattern

```javascript
// Create the mock implementation
const redisMock = {
  connect: vi.fn().mockResolvedValue(undefined),
  hset: vi.fn().mockResolvedValue(1),
  hget: vi.fn().mockImplementation((key, field) => {
    if (mockData[key] && mockData[key][field]) {
      return Promise.resolve(mockData[key][field]);
    }
    return Promise.resolve(null);
  }),
  on: vi.fn(),
  emit: vi.fn()
};

// String conversion for redis responses
expect(await redisService.get('key')).toBe('42');  // not 42
```

### Job Queue Test Pattern

```javascript
// Mock Bull inside factory function
vi.mock('bull', () => {
  return {
    default: vi.fn().mockImplementation((name, options) => {
      const queue = {
        name,
        options,
        process: vi.fn(),
        add: vi.fn().mockResolvedValue({ id: 'job-123' }),
        on: vi.fn()
      };
      mockQueues[name] = queue;
      return queue;
    })
  };
});

// Test job processing
const processHandler = getJobProcessHandler();
await processHandler({ data: { type: 'test' }}, jobDone);
expect(jobDone).toHaveBeenCalledWith(null, { success: true });
```

## Best Practices for ES Module Testing

1. **Use Dynamic Imports for ES Modules**:
```javascript
// Import ES modules in test files with dynamic imports
const CircuitBreaker = (await import('../../../utils/circuitBreaker.js')).default;
```

2. **Mock ES Module Exports**:
```javascript
// Mock ES module in Vitest
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

3. **Mock Singleton Instances**:
```javascript
// Mock the exported instance rather than the class
vi.mock('../../../services/redisClient.js', () => {
  return {
    default: {
      get: vi.fn(),
      set: vi.fn()
    }
  };
});
```

## Shared Time Testing Utilities

The time-testing-utils.js module provides essential utilities for testing time-dependent components:

```javascript
// Create and setup a time controller
const timeController = createTimeController().setup();

// Advance time by a specific amount
timeController.advanceTime(1000);

// Set the current time to a specific value
timeController.setCurrentTime(new Date('2025-04-07').getTime());

// Restore the original Date implementation
timeController.restore();
```

## Conclusion

These consolidated best practices represent our learning throughout the testing initiative. By following these patterns, we can continue to improve our test coverage while ensuring that tests remain stable, maintainable, and effective at catching regressions.

Our Circuit Breaker testing implementation has now achieved >80% coverage, providing a model for testing other complex components with time-dependent behavior and state transitions.

Remember that good tests are:
1. **Focused**: Testing one thing well
2. **Fast**: Running quickly without unnecessary delays
3. **Reliable**: Producing consistent results
4. **Clear**: Making their purpose obvious
5. **Diagnostic**: Providing useful information when they fail

Applying these principles consistently will help maintain our quality standards as the system continues to evolve.