# Consolidated Testing Best Practices - April 6, 2025

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

### API Client & Circuit Breaker Testing

✅ **DO**:
- Test state transitions in isolation (closed → open → half-open → closed)
- Use TimeController to manipulate time-dependent operations
- Test integration between circuit breaker and API client
- Mock axios at request level rather than client level

❌ **DON'T**:
- Couple circuit breaker tests with actual API requests
- Test multiple state transitions in a single test
- Use chained axios-mock-adapter responses for timeout tests

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

## Conclusion

These consolidated best practices represent our learning throughout the testing initiative. By following these patterns, we can continue to improve our test coverage while ensuring that tests remain stable, maintainable, and effective at catching regressions.

Remember that good tests are:
1. **Focused**: Testing one thing well
2. **Fast**: Running quickly without unnecessary delays
3. **Reliable**: Producing consistent results
4. **Clear**: Making their purpose obvious
5. **Diagnostic**: Providing useful information when they fail

Applying these principles consistently will help maintain our quality standards as the system continues to evolve.