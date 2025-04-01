# Resilient API Testing Patterns

**Date:** April 1, 2025  
**Author:** Test Engineering Team

This reference document collects proven testing patterns for resilient API components, derived from our work on the CircuitBreaker and RobustAPIClient modules. These patterns can be applied to other similar components throughout the codebase.

## Table of Contents

1. [Time-Based Testing Patterns](#time-based-testing-patterns)
2. [State Machine Testing Patterns](#state-machine-testing-patterns)
3. [HTTP Response Testing Patterns](#http-response-testing-patterns)
4. [Retry Logic Testing Patterns](#retry-logic-testing-patterns)
5. [Configuration Testing Patterns](#configuration-testing-patterns)
6. [Error Handling Testing Patterns](#error-handling-testing-patterns)
7. [Integration Testing Patterns](#integration-testing-patterns)

## Time-Based Testing Patterns

### Mock Time Control

For components with time-dependent behavior, create deterministic tests by mocking time functions:

```javascript
// Setup time mocking
const originalDateNow = Date.now;
Date.now = vi.fn().mockReturnValue(1000);

// Force specific time for test
circuitBreaker.forceState('OPEN', 'Test timeout transition');

// Advance time to specific point
Date.now.mockReturnValue(1100); // Current time + 100ms

// Verify behavior at exact time point
expect(circuitBreaker.isOpen()).toBe(false);
expect(circuitBreaker.getState()).toBe('HALF_OPEN');

// Restore original function in afterEach
Date.now = originalDateNow;
```

### Immediate Callback Pattern

For functions that use timeouts, replace setTimeout with immediate execution for faster tests:

```javascript
// Replace setTimeout with immediate execution
const originalSetTimeout = global.setTimeout;
global.setTimeout = vi.fn((callback, delay) => {
  // Capture the delay for verification if needed
  actualDelay = delay; 
  
  // Execute immediately instead of waiting
  callback();
  
  // Return fake timer ID
  return 123;
});

// Execute test with timeout-dependent code
const result = await functionWithTimeout();

// Verify the delay would have been correct
expect(actualDelay).toBe(expectedDelay);

// Restore original in afterEach
global.setTimeout = originalSetTimeout;
```

## State Machine Testing Patterns

### Complete Lifecycle Testing

Test the entire lifecycle of a state machine:

```javascript
// Test state machine lifecycle
describe('State Machine Lifecycle', () => {
  it('should transition through complete lifecycle', () => {
    // Step 1: Verify initial state
    expect(stateMachine.getState()).toBe('INITIAL');
    
    // Step 2: Trigger first transition
    stateMachine.triggerEvent('START');
    expect(stateMachine.getState()).toBe('RUNNING');
    
    // Step 3: Trigger next transition
    stateMachine.triggerEvent('COMPLETE');
    expect(stateMachine.getState()).toBe('FINISHED');
    
    // Step 4: Verify final state behavior
    expect(stateMachine.isRunning()).toBe(false);
    expect(stateMachine.isComplete()).toBe(true);
  });
});
```

### State Transition History

Test that state transitions are properly recorded:

```javascript
// Test state history tracking
it('should maintain accurate state transition history', () => {
  // Perform multiple transitions
  stateMachine.triggerEvent('START');
  stateMachine.triggerEvent('PAUSE');
  stateMachine.triggerEvent('RESUME');
  stateMachine.triggerEvent('COMPLETE');
  
  // Get history
  const history = stateMachine.getHistory();
  
  // Verify history length
  expect(history.length).toBe(5); // Initial + 4 transitions
  
  // Verify specific transitions in order
  expect(history[0].state).toBe('INITIAL');
  expect(history[1].state).toBe('RUNNING');
  expect(history[2].state).toBe('PAUSED');
  expect(history[3].state).toBe('RUNNING');
  expect(history[4].state).toBe('FINISHED');
  
  // Verify timestamps
  for (let i = 0; i < history.length; i++) {
    expect(history[i].timestamp).toBeDefined();
    expect(typeof history[i].timestamp).toBe('number');
  }
  
  // Verify transition reasons if applicable
  expect(history[1].reason).toBe('User started process');
  expect(history[4].reason).toBe('Process completed successfully');
});
```

## HTTP Response Testing Patterns

### Status Code Range Testing

Test handling of the full range of HTTP status codes:

```javascript
// Group status codes by category
const successCodes = [200, 201, 202, 204, 206, 299];
const redirectCodes = [301, 302, 303, 307, 308];
const clientErrorCodes = [400, 401, 403, 404, 422, 429];
const serverErrorCodes = [500, 502, 503, 504, 507];

// Test each category with appropriate expectations
describe('HTTP Status Code Handling', () => {
  it('should handle success status codes correctly', () => {
    for (const status of successCodes) {
      // Reset mocks for each test
      vi.clearAllMocks();
      
      // Mock successful response with this status
      mockAxios.mockResolvedValueOnce({ status, data: { result: 'ok' } });
      
      // Execute request
      const result = await apiClient.request('/test');
      
      // Verify success handling
      expect(result).toEqual({ result: 'ok' });
      expect(onSuccess).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    }
  });
  
  it('should handle client error status codes correctly', () => {
    for (const status of clientErrorCodes) {
      // Reset mocks for each test
      vi.clearAllMocks();
      
      // Mock error response
      mockAxios.mockResolvedValueOnce({ 
        status, 
        statusText: 'Error', 
        data: { error: 'Client error' } 
      });
      
      // Execute request and verify handling
      await expect(apiClient.request('/test')).rejects.toThrow();
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ status })
      );
    }
  });
  
  // Similar tests for redirects and server errors
});
```

### Response Error Testing

Test handling of malformed responses:

```javascript
describe('Malformed Response Handling', () => {
  it('should handle null response', async () => {
    mockAxios.mockResolvedValueOnce(null);
    await expect(apiClient.request('/test')).rejects.toThrow('Invalid response');
  });
  
  it('should handle missing status', async () => {
    mockAxios.mockResolvedValueOnce({ data: {} }); // No status
    await expect(apiClient.request('/test')).rejects.toThrow('Missing status');
  });
  
  it('should handle empty data', async () => {
    mockAxios.mockResolvedValueOnce({ status: 200 }); // No data
    const result = await apiClient.request('/test');
    expect(result).toBeUndefined(); // Or whatever your expected behavior is
  });
});
```

## Retry Logic Testing Patterns

### Progressive Failure Testing

Test retry with progressive failure patterns:

```javascript
describe('Retry Logic', () => {
  it('should retry until success', async () => {
    // Mock first two calls to fail, third succeeds
    mockAxios.mockRejectedValueOnce(new Error('First failure'))
             .mockRejectedValueOnce(new Error('Second failure'))
             .mockResolvedValueOnce({ status: 200, data: { success: true } });
             
    // Replace setTimeout with immediate execution
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = vi.fn(cb => { cb(); return 123; });
    
    // Execute request
    const result = await apiClient.request('/test');
    
    // Verify success
    expect(result).toEqual({ success: true });
    
    // Verify three attempts were made
    expect(mockAxios).toHaveBeenCalledTimes(3);
    
    // Restore setTimeout
    global.setTimeout = originalSetTimeout;
  });
  
  it('should stop after max retries', async () => {
    // Mock all calls to fail
    mockAxios.mockRejectedValue(new Error('Persistent failure'));
    
    // Replace setTimeout with immediate execution
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = vi.fn(cb => { cb(); return 123; });
    
    // Execute request - should fail after maxRetries
    await expect(apiClient.request('/test')).rejects.toThrow('Persistent failure');
    
    // Verify exact number of attempts (initial + retries)
    expect(mockAxios).toHaveBeenCalledTimes(1 + apiClient.options.maxRetries);
    
    // Restore setTimeout
    global.setTimeout = originalSetTimeout;
  });
});
```

### Backoff Calculation Testing

Test exponential backoff algorithms:

```javascript
describe('Backoff Algorithm', () => {
  it('should increase backoff exponentially', () => {
    const baseDelay = 100;
    const attempts = [0, 1, 2, 3];
    
    // Calculate backoff for each attempt
    const backoffs = attempts.map(attempt => apiClient.calculateBackoff(attempt));
    
    // Each backoff should be ~2x the previous one
    for (let i = 1; i < backoffs.length; i++) {
      // Allow some margin for jitter
      const ratio = backoffs[i] / backoffs[i-1];
      expect(ratio).toBeGreaterThanOrEqual(1.5);
      expect(ratio).toBeLessThanOrEqual(2.5);
    }
  });
  
  it('should respect maximum backoff limit', () => {
    // Try a very high attempt number
    const backoff = apiClient.calculateBackoff(20);
    
    // Should be capped at the maximum
    expect(backoff).toBeLessThanOrEqual(maxBackoffDelay);
  });
  
  it('should add jitter to prevent thundering herd', () => {
    // Generate multiple backoffs for the same attempt
    const backoffs = Array(10).fill(0).map(() => apiClient.calculateBackoff(1));
    
    // Should have variation (not all the same value)
    const uniqueValues = new Set(backoffs).size;
    expect(uniqueValues).toBeGreaterThan(1);
  });
});
```

## Configuration Testing Patterns

### Default and Custom Configuration

Test both default and custom configurations:

```javascript
describe('Configuration Options', () => {
  it('should use default values when not provided', () => {
    // Create with minimal configuration
    const client = new ApiClient({ baseURL: 'https://api.example.com' });
    
    // Check default values
    expect(client.options.timeout).toBe(30000);
    expect(client.options.maxRetries).toBe(3);
    expect(client.options.retryDelay).toBe(1000);
  });
  
  it('should use provided values when specified', () => {
    // Create with custom configuration
    const client = new ApiClient({
      baseURL: 'https://api.example.com',
      timeout: 5000,
      maxRetries: 5,
      retryDelay: 2000
    });
    
    // Check custom values
    expect(client.options.timeout).toBe(5000);
    expect(client.options.maxRetries).toBe(5);
    expect(client.options.retryDelay).toBe(2000);
  });
  
  it('should handle partial custom configuration', () => {
    // Create with partial custom configuration
    const client = new ApiClient({
      baseURL: 'https://api.example.com',
      timeout: 5000
      // Other options not specified
    });
    
    // Check mix of custom and default values
    expect(client.options.timeout).toBe(5000); // Custom
    expect(client.options.maxRetries).toBe(3); // Default
    expect(client.options.retryDelay).toBe(1000); // Default
  });
});
```

### Edge Case Configuration

Test behavior with extreme configuration values:

```javascript
describe('Configuration Edge Cases', () => {
  it('should handle zero values', () => {
    // Create with zero values for numeric options
    const client = new ApiClient({
      baseURL: 'https://api.example.com',
      timeout: 0,
      maxRetries: 0,
      retryDelay: 0
    });
    
    // Test behavior with these values
    // (Specifics depend on how your component should handle them)
  });
  
  it('should handle very large values', () => {
    // Create with very large values
    const client = new ApiClient({
      baseURL: 'https://api.example.com',
      timeout: Number.MAX_SAFE_INTEGER,
      maxRetries: 1000,
      retryDelay: 3600000 // 1 hour
    });
    
    // Test behavior with these values
  });
  
  it('should handle invalid values', () => {
    // Create with invalid values
    const client = new ApiClient({
      baseURL: 'https://api.example.com',
      timeout: -1,
      maxRetries: -5,
      retryDelay: 'invalid'
    });
    
    // Test behavior with these values
    // (Should use defaults or handle gracefully)
  });
});
```

## Error Handling Testing Patterns

### Error Type Testing

Test handling of different error types:

```javascript
describe('Error Handling', () => {
  it('should handle standard Error objects', async () => {
    // Mock throwing standard Error
    mockFunction.mockImplementation(() => {
      throw new Error('Standard error');
    });
    
    // Execute and verify handling
    await expect(apiClient.request('/test')).rejects.toThrow('Standard error');
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Standard error' })
    );
  });
  
  it('should handle string errors', async () => {
    // Mock throwing string
    mockFunction.mockImplementation(() => {
      throw 'String error';
    });
    
    // Execute and verify handling
    await expect(apiClient.request('/test')).rejects.toThrow('String error');
    expect(errorHandler).toHaveBeenCalled();
  });
  
  it('should handle null/undefined errors', async () => {
    // Mock throwing null
    mockFunction.mockImplementation(() => {
      throw null;
    });
    
    // Execute and verify default error handling
    await expect(apiClient.request('/test')).rejects.toThrow();
    expect(errorHandler).toHaveBeenCalled();
  });
  
  it('should handle custom error classes', async () => {
    // Define custom error class
    class ApiError extends Error {
      constructor(message, code) {
        super(message);
        this.code = code;
      }
    }
    
    // Mock throwing custom error
    mockFunction.mockImplementation(() => {
      throw new ApiError('Custom error', 'AUTH_FAILED');
    });
    
    // Execute and verify handling
    await expect(apiClient.request('/test')).rejects.toThrow('Custom error');
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ 
        message: 'Custom error',
        code: 'AUTH_FAILED'
      })
    );
  });
});
```

### Error Recovery Testing

Test system recovery after errors:

```javascript
describe('Error Recovery', () => {
  it('should recover from transient errors', async () => {
    // Setup initial failure
    mockFunction.mockRejectedValueOnce(new Error('Transient error'));
    
    // Execute request - should fail
    await expect(component.performAction()).rejects.toThrow('Transient error');
    
    // Setup success for subsequent attempt
    mockFunction.mockResolvedValueOnce({ success: true });
    
    // Execute again - should succeed
    const result = await component.performAction();
    expect(result).toEqual({ success: true });
    
    // Verify system is in correct state after recovery
    expect(component.isReady()).toBe(true);
  });
  
  it('should reset error count after successful operation', async () => {
    // Mock implementation to track error count
    let errorCount = component.getErrorCount();
    
    // Trigger errors
    mockFunction.mockRejectedValue(new Error('Error'));
    await expect(component.performAction()).rejects.toThrow();
    await expect(component.performAction()).rejects.toThrow();
    
    // Verify error count increased
    expect(component.getErrorCount()).toBeGreaterThan(errorCount);
    
    // Now succeed
    mockFunction.mockResolvedValueOnce({ success: true });
    await component.performAction();
    
    // Error count should be reset
    expect(component.getErrorCount()).toBe(0);
  });
});
```

## Integration Testing Patterns

### Component Interaction Testing

Test interaction between components:

```javascript
describe('Component Interaction', () => {
  it('should integrate with circuit breaker', async () => {
    // Create real (not mocked) instances
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 100
    });
    
    const apiClient = new ApiClient({
      baseURL: 'https://api.example.com',
      circuitBreaker // Use actual circuit breaker
    });
    
    // Mock axios for controlled responses
    axios.mockRejectedValue(new Error('Server error'));
    
    // Step 1: Trigger failures to open circuit
    await expect(apiClient.request('/test')).rejects.toThrow();
    await expect(apiClient.request('/test')).rejects.toThrow();
    
    // Step 2: Verify circuit is open
    expect(circuitBreaker.getState()).toBe('OPEN');
    
    // Step 3: Verify request is blocked by circuit
    await expect(apiClient.request('/test')).rejects.toThrow('Circuit breaker open');
    
    // Step 4: Advance time to allow circuit reset
    vi.advanceTimersByTime(150); // > resetTimeout
    
    // Step 5: Mock success response
    axios.mockResolvedValueOnce({ status: 200, data: { success: true } });
    
    // Step 6: Verify request succeeds and circuit closes
    const result = await apiClient.request('/test');
    expect(result).toEqual({ success: true });
    expect(circuitBreaker.getState()).toBe('CLOSED');
  });
});
```

### End-to-End Request Flow Testing

Test the full request flow from beginning to end:

```javascript
describe('End-to-End Request Flow', () => {
  it('should handle the complete request lifecycle', async () => {
    // Setup spies/mocks for all components in the flow
    const requestSpy = vi.spyOn(http, 'request');
    const onBeforeRequestSpy = vi.spyOn(hooks, 'onBeforeRequest');
    const authSpy = vi.spyOn(auth, 'addCredentials');
    const onSuccessSpy = vi.spyOn(hooks, 'onSuccess');
    
    // Mock successful response
    mockAxios.mockResolvedValueOnce({ 
      status: 200, 
      data: { result: 'success' } 
    });
    
    // Execute request
    const result = await apiClient.request({
      url: '/test',
      method: 'get',
      params: { id: 123 }
    });
    
    // Verify result
    expect(result).toEqual({ result: 'success' });
    
    // Verify correct flow sequence
    expect(onBeforeRequestSpy).toHaveBeenCalledBefore(authSpy);
    expect(authSpy).toHaveBeenCalledBefore(requestSpy);
    expect(requestSpy).toHaveBeenCalledBefore(onSuccessSpy);
    
    // Verify request was properly formatted
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/test'),
        method: 'get',
        params: { id: 123 },
        headers: expect.objectContaining({
          'Authorization': expect.stringContaining('Bearer ')
        })
      })
    );
  });
});
```

## Best Practices Summary

1. **Mock Time Functions**: For time-dependent components, mock `Date.now()` and other time functions to create deterministic tests.

2. **Immediate Callback Execution**: Replace timeouts with immediate execution for faster tests.

3. **Test Complete Lifecycles**: For state machines, test the entire lifecycle from beginning to end.

4. **Test State Transition History**: Verify that state machines maintain accurate history.

5. **Test Full Status Code Range**: Test the component's response to the full range of HTTP status codes.

6. **Test Malformed Responses**: Test handling of invalid or unexpected response formats.

7. **Progressive Failure Testing**: Test retry logic with a sequence of failures followed by success.

8. **Test Default and Custom Configurations**: Verify behavior with both default and custom configuration values.

9. **Test Edge Case Configurations**: Test with extreme (very large, zero, or negative) configuration values.

10. **Test Various Error Types**: Test handling of different error types (standard Error, strings, custom errors).

11. **Test Error Recovery**: Verify the system can recover after errors.

12. **Test Component Integration**: Test interaction between components as a system.

---

These patterns are extracted from our work on the CircuitBreaker and RobustAPIClient components. For component-specific documentation, refer to:
- [CircuitBreaker Coverage Improvements](../coverage/CIRCUIT_BREAKER_COVERAGE_IMPROVEMENTS_2025-04-01.md)
- [API Client Coverage Improvements](../coverage/API_CLIENT_COVERAGE_IMPROVEMENTS_2025-04-01.md)
- [Combined Testing Suite Improvements](../coverage/TESTING_SUITE_IMPROVEMENTS_2025-04-01.md)