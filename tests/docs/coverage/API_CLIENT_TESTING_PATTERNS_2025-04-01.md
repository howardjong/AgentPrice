# API Client Testing Patterns

## Overview

This document describes the patterns and strategies used for testing the RobustAPIClient, a resilient HTTP client implementation with retry logic, circuit breaking, and error handling capabilities. These patterns were developed as part of our coverage improvement initiative to increase test coverage from ~75% to ~80% or higher.

## Components Tested

The following API client capabilities were tested in dedicated test files:

1. **Retry Logic** (`apiClient.retry.vitest.js`)
   - Progressive backoff with exponential increase and jitter
   - Retry decisions based on error types and status codes
   - Retry attempts counting and limits
   - Rate limit handling with retry-after headers
   - Circuit breaker integration for retry tracking

2. **Timeout Handling** (`apiClient.timeout.vitest.js`)
   - Timeout configuration and customization
   - Handling of various timeout scenarios
   - Timeout at different request stages (connect, socket, request)
   - Timeout recovery patterns
   - Timeout interaction with circuit breaker

3. **Error Handling** (`apiClient.error.vitest.js`)
   - HTTP error handling with status codes
   - Network error handling
   - Error classification for retry decisions
   - Error propagation to circuit breaker
   - Error recovery patterns
   - Edge cases in error handling

## Testing Patterns

### Mock Strategies

1. **Axios Mock Adapter**
   - Used `MockAdapter` from `axios-mock-adapter` for realistic response mocking
   - Configured response sequences using `replyOnce` to test retry behavior
   - Simulated network errors, timeouts, and HTTP errors
   - Used response status codes and headers to trigger specific behaviors

2. **Circuit Breaker Mocking**
   - Mocked the `CircuitBreaker` class to isolate API client testing
   - Implemented mock methods for `isOpen`, `recordSuccess`, and `recordFailure`
   - Controlled circuit breaker state for testing blocked requests

3. **Time Control**
   - Used `TimeController` to manage time-related functions
   - Mocked `setTimeout` and `clearTimeout` for delay testing
   - Fixed `Math.random()` for deterministic jitter calculation
   - Controlled date and time functions for consistent testing

### Test Organization

1. **Focused Test Files**
   - Created dedicated test files for specific client capabilities
   - Organized tests in logical groups using nested `describe` blocks
   - Used descriptive test names that explain the behavior being tested

2. **Comprehensive Coverage**
   - Tested successful and failure scenarios
   - Covered error cases and recovery patterns
   - Tested configuration options and customizations
   - Verified interactions with external dependencies (circuit breaker, logger)

3. **Edge Case Testing**
   - Tested unusual inputs and failure conditions
   - Verified behavior with malformed responses
   - Tested boundary conditions like zero timeouts or maximum retries

### Verification Strategies

1. **Response Verification**
   - Verified successful responses match expected data
   - Checked error objects for correct properties and messages
   - Validated HTTP status codes and headers

2. **Function Call Verification**
   - Used spies to track method calls
   - Verified correct parameters were passed to methods
   - Checked call counts for functions like `recordSuccess` and `recordFailure`

3. **Request Tracking**
   - Monitored request history through `mockAxios.history`
   - Verified correct number of retry attempts
   - Checked that request configuration was preserved across retries

4. **Logging Verification**
   - Verified error logging at appropriate levels
   - Checked log messages contain relevant information
   - Validated contextual data in log calls

## Key Testing Patterns

### Progressive Backoff Testing

```javascript
it('should use exponential backoff with each retry attempt', async () => {
  // Mock a 503 error for each request
  mockAxios.onGet('https://api.example.com/test').reply(503, { error: 'Service unavailable' });
  
  // Spy on calculateBackoff
  const calculateBackoffSpy = vi.spyOn(apiClient, 'calculateBackoff');
  
  // Make request that will fail
  try {
    await apiClient.get('/test');
  } catch (error) {
    // Expected to fail after all retries
    expect(error.message).toContain('HTTP error 503');
  }
  
  // Should have called calculateBackoff for each retry
  expect(calculateBackoffSpy).toHaveBeenCalledTimes(3);
  expect(calculateBackoffSpy).toHaveBeenNthCalledWith(1, 0);
  expect(calculateBackoffSpy).toHaveBeenNthCalledWith(2, 1);
  expect(calculateBackoffSpy).toHaveBeenNthCalledWith(3, 2);
  
  // Verify delay was called with progressively increasing values
  expect(apiClient.delay).toHaveBeenCalledTimes(3);
  
  // Verify delays increase
  const firstDelay = apiClient.delay.mock.calls[0][0];
  const secondDelay = apiClient.delay.mock.calls[1][0];
  const thirdDelay = apiClient.delay.mock.calls[2][0];
  
  expect(secondDelay).toBeGreaterThan(firstDelay);
  expect(thirdDelay).toBeGreaterThan(secondDelay);
});
```

### Retry Strategy Testing

```javascript
it('should retry server errors (5xx)', async () => {
  // Set up responses: 500, 502, 200
  mockAxios.onGet('https://api.example.com/test')
    .replyOnce(500, { error: 'Internal server error' })
    .replyOnce(502, { error: 'Bad gateway' })
    .replyOnce(200, { data: 'success' });
  
  // Make request
  const result = await apiClient.get('/test');
  
  // Should eventually succeed
  expect(result).toEqual({ data: 'success' });
  
  // Verify made expected number of requests
  expect(mockAxios.history.get.length).toBe(3);
});
```

### Timeout Handling Testing

```javascript
it('should retry requests that time out', async () => {
  // Create timeout error
  const timeoutError = new Error('timeout of 1000ms exceeded');
  timeoutError.code = 'ECONNABORTED';
  
  // First request times out, second succeeds
  mockAxios.onGet('https://api.example.com/test')
    .replyOnce(() => Promise.reject(timeoutError))
    .replyOnce(200, { data: 'success' });
  
  // Make request
  const result = await apiClient.get('/test');
  
  // Should eventually succeed
  expect(result).toEqual({ data: 'success' });
  
  // Verify made expected number of requests
  expect(mockAxios.history.get.length).toBe(2);
});
```

### Error Classification Testing

```javascript
it('should correctly identify retriable errors', () => {
  // Network errors (no response)
  expect(apiClient.shouldRetry(new Error('Network Error'))).toBe(true);
  
  // Errors with response - retriable status codes
  expect(apiClient.shouldRetry({ response: { status: 408 } })).toBe(true);
  expect(apiClient.shouldRetry({ response: { status: 429 } })).toBe(true);
  expect(apiClient.shouldRetry({ response: { status: 500 } })).toBe(true);
  
  // Errors with response - non-retriable status codes
  expect(apiClient.shouldRetry({ response: { status: 400 } })).toBe(false);
  expect(apiClient.shouldRetry({ response: { status: 404 } })).toBe(false);
});
```

## Lessons Learned

1. **Use MockAdapter for HTTP Mocking**
   - MockAdapter provides more realistic HTTP mocking than manual mocks
   - Allows sequential responses to test retry behavior
   - Tracks request history for verification

2. **Control Randomness in Tests**
   - Fix `Math.random()` to make jitter calculation deterministic
   - Allows verifying exact backoff values instead of approximate ranges

3. **Use Timeouts Wisely**
   - Use time control utilities instead of actual timeouts
   - Short timeouts in tests prevent test hanging
   - Test various timeout scenarios explicitly

4. **Test Error Propagation**
   - Verify errors are propagated with correct properties
   - Check interactions with circuit breaker and logging
   - Test different types of errors (HTTP, network, timeout)

5. **Group Tests Logically**
   - Divide tests into logical categories
   - Use nested `describe` blocks for organization
   - Create focused test files for specific capabilities

## Recommendations for Future Testing

1. **Create Shared HTTP Mocking Utilities**
   - Standardize HTTP mocking pattern for consistent tests
   - Create helpers for common patterns like sequential responses
   - Implement utilities for response generation

2. **Implement More Edge Case Testing**
   - Test malformed responses and unusual error formats
   - Verify behavior with missing or incorrect headers
   - Test extreme conditions like very long sequences of failures

3. **Improve Time Control Utilities**
   - Enhance time control to support more granular testing
   - Create helpers for common time-related testing scenarios
   - Standardize time control pattern across tests

4. **Standardize Verification Patterns**
   - Create consistent patterns for verifying retry behavior
   - Develop utilities for checking log messages
   - Standardize circuit breaker interaction verification

## Next Steps

The patterns established in these API client tests can be applied to other components that need similar testing:

1. **Apply to Perplexity Service Testing**
   - Reuse HTTP mocking patterns for API interactions
   - Apply retry logic testing to rate limit handling
   - Utilize error propagation testing for service errors

2. **Apply to Circuit Breaker Testing**
   - Use state transition testing patterns
   - Apply timeout handling for reset timeouts
   - Implement error handling testing for failure tracking

3. **Apply to Other API Clients**
   - Reuse mock strategies for other client implementations
   - Apply progressive backoff testing to retry mechanisms
   - Use error classification testing for retry decisions