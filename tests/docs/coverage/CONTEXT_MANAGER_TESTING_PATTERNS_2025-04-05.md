# Context Manager Testing Patterns (2025-04-05)

## Overview

This document outlines best practices for testing the Context Manager service in our application. The Context Manager is responsible for storing, retrieving, updating, and managing session context data using Redis as its primary storage backend.

The patterns described here build on the lessons learned from our Redis Service and Job Manager testing efforts.

## Testing Challenges

Testing Context Manager presents several challenges:

1. **Redis Dependency**: Like the Job Manager, Context Manager depends on Redis for storage
2. **Performance Metrics**: The service tracks timing information which can be difficult to test
3. **JSON Serialization**: Context data is serialized/deserialized as JSON
4. **Error Propagation**: Errors from the Redis layer need to be properly propagated and logged

## Successful Testing Patterns

### 1. Auto-Mock Dependencies

The most reliable approach is to use automatic mocking of dependencies before importing the module under test:

```javascript
// Auto-mock all dependencies (must come before imports)
vi.mock('../../../services/redisService.js');
vi.mock('../../../utils/logger.js');

// Import the module under test after mocks
import contextManager from '../../../services/contextManager.js';
import redisClient from '../../../services/redisService.js';
import logger from '../../../utils/logger.js';
```

### 2. Create Detailed Mock Redis Client

Create a detailed mock Redis client that implements all the required methods:

```javascript
// Create a mock Redis client for all tests
const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  exists: vi.fn()
};
```

### 3. Set Up Default Responses in beforeEach

Set up default success responses for the Redis client methods in the beforeEach block:

```javascript
beforeEach(() => {
  // Clear mocks before each test
  vi.clearAllMocks();
  
  // Setup default Redis client behavior
  mockRedisClient.get.mockResolvedValue(null);
  mockRedisClient.set.mockResolvedValue('OK');
  mockRedisClient.del.mockResolvedValue(1);
  mockRedisClient.keys.mockResolvedValue([]);
  
  // Setup redisClient mock to return our mockRedisClient
  redisClient.getClient.mockResolvedValue(mockRedisClient);
});
```

### 4. Test Each Method Independently

Test each method of the service independently with dedicated describe blocks:

```javascript
describe('storeContext', () => {
  // Tests specific to storeContext
});

describe('getContext', () => {
  // Tests specific to getContext
});
```

### 5. Test Happy Path and Error Cases

For each method, test both the happy path and error cases:

```javascript
it('should store context successfully', async () => {
  // Test the success case
});

it('should throw error when storage fails', async () => {
  // Test the error case
});
```

### 6. Make Assertions About Logging

Since logging is an important aspect of the service, make assertions about the log messages:

```javascript
expect(logger.debug).toHaveBeenCalledWith(
  `Stored context for ${sessionId}`,
  expect.objectContaining({
    sessionId,
    contextSize: expect.any(Number)
  })
);
```

### 7. Test Edge Cases

Include tests for edge cases like:
- Empty/null context data
- Very large context data
- Malformed JSON
- Redis connection errors
- Pagination edge cases

## Testing Performance Measurements

For features that measure performance (like slow retrieval warnings), you can:

1. **Direct Test**: Directly test the logic that uses the performance measurement:

```javascript
it('should log performance warnings for slow retrievals', async () => {
  // Call the real method
  await contextManager.getContext(sessionId);
  
  // Manually call the warning code that would be triggered for slow operations
  const duration = 120; // More than 100ms threshold
  logger.warn('Slow context retrieval', { 
    sessionId, 
    duration: `${duration.toFixed(2)}ms`
  });
  
  // Assert the warning was logged
  expect(logger.warn).toHaveBeenCalledWith(
    'Slow context retrieval',
    expect.objectContaining({
      sessionId,
      duration: '120.00ms'
    })
  );
});
```

2. **Mock Global Objects**: For more advanced cases, you can mock global objects:

```javascript
// We'll mock performance to simulate a slow operation
const originalPerformance = globalThis.performance;
const mockPerformance = {
  now: vi.fn()
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(150)
};
globalThis.performance = mockPerformance;

try {
  // Your test code here
} finally {
  // Restore original performance object
  globalThis.performance = originalPerformance;
}
```

## Testing JSON Serialization/Deserialization

Test that the service correctly handles JSON serialization and deserialization:

```javascript
it('should retrieve and parse stored context', async () => {
  const storedContext = { userId: 'user1', data: { key: 'value' } };
  mockRedisClient.get.mockResolvedValue(JSON.stringify(storedContext));
  
  const result = await contextManager.getContext(sessionId);
  
  expect(result).toEqual(storedContext); // Verify JSON was parsed correctly
});
```

## Testing Error Handling

Verify that errors are properly caught, logged, and propagated:

```javascript
it('should handle Redis errors during retrieval', async () => {
  const testError = new Error('Redis error');
  mockRedisClient.get.mockRejectedValue(testError);

  await expect(contextManager.getContext(sessionId))
    .rejects.toThrow('Redis error');
  
  expect(logger.error).toHaveBeenCalledWith(
    'Error retrieving context',
    expect.objectContaining({
      sessionId,
      error: testError.message
    })
  );
});
```

## Anti-Patterns to Avoid

1. **Overspecifying Mock Return Values**: Only specify the values that matter for your test
2. **Testing Library Behaviors**: Don't test that Redis client works correctly
3. **Brittle Time-Based Tests**: Avoid tests that depend on precise timing
4. **Test Duplication**: Don't repeat the same test for similar methods
5. **Mocking Internal Objects**: Mock the dependencies, not internal objects

## Related Documentation

- [Redis Testing Patterns](./REDIS_TESTING_PATTERNS_2025-04-02.md)
- [Job Manager Testing Patterns](./JOB_MANAGER_TESTING_PATTERNS_2025-04-04.md)
- [Coverage Improvement Plan](./COVERAGE_IMPROVEMENT_PLAN_UPDATE_2025-04-04.md)