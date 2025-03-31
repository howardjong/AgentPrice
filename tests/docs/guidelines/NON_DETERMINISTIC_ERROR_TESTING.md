# Non-Deterministic Error Testing Library

This document describes the Non-Deterministic Error Testing Library implemented for the Multi-LLM Research System (MLRS). The library provides utilities for testing code that deals with non-deterministic behavior, such as network flakiness, race conditions, and timing-dependent errors.

## Components

The library consists of three main components:

1. **Error Simulator**: Simulates various types of non-deterministic errors
2. **Test Helpers**: Utilities for writing tests that handle non-deterministic behavior
3. **Test Environment**: Creates a controlled test environment for testing code that deals with non-deterministic errors

## 1. Error Simulator

The `NonDeterministicErrorSimulator` class provides methods for simulating various types of non-deterministic errors.

### Methods:

- **simulateNetworkFlakiness**: Simulates network flakiness with a configurable failure rate
- **simulateRaceCondition**: Simulates race conditions by introducing random delays
- **simulateResourceExhaustion**: Simulates resource exhaustion errors
- **simulateThrottling**: Simulates throttling/rate limiting errors
- **simulateTimeout**: Simulates intermittent timeout errors
- **simulatePartialFailure**: Simulates partial failures where some operations succeed and others fail

### Example Usage:

```javascript
import { NonDeterministicErrorSimulator } from './tests/utils/non-deterministic-error-simulator';

// Simulate network flakiness
async function testWithFlakiness() {
  try {
    const result = await NonDeterministicErrorSimulator.simulateNetworkFlakiness(
      async () => {
        // Your actual operation here
        return await fetchSomeData();
      },
      { failureRate: 0.5, retries: 5 }
    );
    
    // Process result
    return result;
  } catch (error) {
    // Handle error
    console.error('Failed after retries:', error);
  }
}
```

## 2. Test Helpers

The test helpers provide utility functions for testing scenarios involving non-deterministic behavior.

### Key Functions:

- **expectEventualSuccess**: Attempts an operation multiple times until it succeeds
- **expectConsistentFailure**: Verifies that an operation consistently fails with the expected error
- **createScheduledFailure**: Creates a controlled failure environment for testing recovery logic
- **trackAttempts**: Tracks execution attempts for assertions in tests
- **withRetry**: Handles multiple strategies for retrying a failed operation

### Example Usage:

```javascript
import { expectEventualSuccess, withRetry } from './tests/utils/non-deterministic-test-helpers';

// Test that eventually succeeds
test('operation eventually succeeds', async () => {
  const result = await expectEventualSuccess(
    async () => {
      // Test operation that might fail sometimes
      return await someUnreliableOperation();
    },
    { maxAttempts: 5, delayBetweenAttempts: 200 }
  );
  
  expect(result).toBeDefined();
});

// Test with retry strategies
test('operation with exponential backoff', async () => {
  const result = await withRetry(
    async () => {
      return await someOperation();
    },
    {
      strategy: 'exponential',
      maxAttempts: 5,
      baseDelay: 100,
      shouldRetry: (error) => error.code === 'ECONNRESET'
    }
  );
  
  expect(result).toBeDefined();
});
```

## 3. Test Environment

The `createTestEnvironment` function creates a controlled test environment with a flaky service that can be configured to simulate various error conditions.

### Key Features:

- Configurable latency
- Network connectivity simulation
- Resource exhaustion simulation
- Rate limiting simulation
- Server availability simulation
- API versioning and quota management

### Example Usage:

```javascript
import { createTestEnvironment } from './tests/utils/non-deterministic-test-environment';

describe('Service with non-deterministic behavior', () => {
  const { flakyService } = createTestEnvironment();
  
  beforeEach(() => {
    // Reset service state before each test
    flakyService.reset();
  });
  
  test('handles network failures gracefully', async () => {
    // Set up the test environment
    flakyService.setErrorProbability(0.5, 'connection');
    
    // Test the code that uses the flaky service
    const result = await yourErrorHandlingCode(flakyService);
    
    // Assert the expected behavior
    expect(result.status).toBe('recovered');
  });
  
  test('handles rate limiting correctly', async () => {
    // Trigger rate limiting
    flakyService.triggerRateLimit();
    
    // Test the code that should handle rate limiting
    const result = await yourRateLimitHandlingCode(flakyService);
    
    // Assert the expected behavior
    expect(result.retryAfter).toBeDefined();
  });
});
```

## Integration with Existing Codebase

To integrate the non-deterministic error testing library with the existing codebase, follow these steps:

1. **Identify Components to Test**: Identify components that interact with external services, handle network requests, or are susceptible to timing-dependent errors.

2. **Create Test Cases**: Write test cases that use the non-deterministic error testing library to simulate various error conditions.

3. **Implement Error Handling**: Ensure your code handles the simulated errors gracefully and recovers when possible.

4. **Automate Tests**: Include the non-deterministic error tests in your automated test suite.

## Best Practices

1. **Test Realistic Scenarios**: Focus on testing error scenarios that are likely to occur in production.

2. **Isolate Tests**: Ensure each test case focuses on a specific aspect of error handling.

3. **Avoid False Positives**: Be careful not to make tests too flaky, which could lead to false positives.

4. **Test Recovery Logic**: Test that your code not only handles errors but also recovers from them when appropriate.

5. **Document Edge Cases**: Document any edge cases or limitations discovered during testing.

## Conclusion

The Non-Deterministic Error Testing Library provides a powerful set of tools for testing code that deals with non-deterministic behavior. By simulating various error conditions, you can ensure your code handles errors gracefully and recovers when possible.