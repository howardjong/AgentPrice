# Error Handling and Promise Rejection Best Practices for Vitest

This document outlines enhanced approaches for error handling in our Vitest test suite, focusing on proper handling of asynchronous operations and promise rejections.

## Common Error Handling Patterns

### 1. Using `expect().rejects` for Promise Rejections

**✅ Recommended Approach:**

```javascript
test('should handle API errors properly', async () => {
  // Setup - service throws an error
  service.method.mockRejectedValueOnce(new Error('API Error'));
  
  // Using await with expect().rejects pattern
  await expect(service.method('test')).rejects.toThrow('API Error');
  
  // Alternatively, be more specific with exact error
  await expect(service.method('test')).rejects.toEqual(new Error('API Error'));
});
```

**⛔ Avoid This Pattern:**

```javascript
test('should handle API errors', async () => {
  service.method.mockRejectedValueOnce(new Error('API Error'));
  
  try {
    await service.method('test');
    // If we reach here, the test should fail
    expect(true).toBe(false); // Bad approach - test might pass incorrectly
  } catch (error) {
    expect(error.message).toBe('API Error');
  }
});
```

**Why this matters:** The `expect().rejects` pattern is more declarative and provides better error messages when tests fail. It also ensures the test fails properly if the promise resolves instead of rejects.

### 2. Testing Error Objects Thoroughly

**✅ Recommended Approach:**

```javascript
test('should handle specific error types', async () => {
  // Mock a specific error type
  const customError = new ApiRateLimitError('Rate limit exceeded');
  customError.retryAfter = 30;
  service.method.mockRejectedValueOnce(customError);
  
  // Verify complete error object
  await expect(service.method('test')).rejects.toMatchObject({
    message: 'Rate limit exceeded',
    retryAfter: 30,
    name: 'ApiRateLimitError'
  });
});
```

**⛔ Avoid Just Checking Message:**

```javascript
test('should handle errors', async () => {
  service.method.mockRejectedValueOnce(new Error('Some error'));
  
  try {
    await service.method('test');
    fail('Should have thrown');
  } catch (error) {
    expect(error.message).toBe('Some error');
    // Missing checks for other important properties
  }
});
```

**Why this matters:** Checking just the error message might miss important context in the error object. Testing the full error object ensures the correct type and properties are used.

### 3. Handling Multiple Rejections in a Test Flow

**✅ Recommended Approach:**

```javascript
test('should handle a sequence of operations with potential failures', async () => {
  // First operation fails
  serviceA.methodA.mockRejectedValueOnce(new Error('First error'));
  
  // Second operation succeeds as fallback
  serviceB.methodB.mockResolvedValueOnce('fallback result');
  
  // Test the complete flow with proper assertions at each stage
  const result = await handler.processRequest('test input');
  
  // Verify the error was logged
  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('First error'),
    expect.any(Error)
  );
  
  // Verify fallback was used
  expect(serviceB.methodB).toHaveBeenCalled();
  
  // Verify final result
  expect(result).toBe('fallback result');
});
```

**⛔ Avoid Excessive try/catch Blocks:**

```javascript
test('should handle failures', async () => {
  serviceA.methodA.mockRejectedValueOnce(new Error('Error'));
  
  try {
    await handler.processRequest('test');
    // complex test logic here...
  } catch (e) {
    fail('Should have handled error internally: ' + e);
  }
});
```

**Why this matters:** Complex test flows with potential failures should verify both the error handling and the recovery mechanism. Clearly specify what should happen at each stage.

## Advanced Error Handling Techniques

### 1. Testing for Side Effects After Errors

Verify that even after an error, the correct cleanup or recovery actions happened:

```javascript
test('should clean up resources even when processing fails', async () => {
  // Setup - service throws during processing
  service.process.mockRejectedValueOnce(new Error('Processing failed'));
  
  // Execute - this should internally handle the error
  await expect(service.processWithErrorHandling()).resolves.toEqual({
    status: 'error',
    message: expect.stringContaining('Processing failed')
  });
  
  // Verify cleanup happened despite the error
  expect(service.cleanup).toHaveBeenCalled();
});
```

### 2. Testing Error Propagation Chains

Test how errors propagate through multiple layers:

```javascript
test('should propagate specific errors while handling others', async () => {
  // Setup a critical error that should propagate
  const criticalError = new CriticalSystemError('Database unavailable');
  dataService.query.mockRejectedValueOnce(criticalError);
  
  // Execute through multiple layers
  await expect(controller.handleRequest()).rejects.toThrow(criticalError);
  
  // Verify intermediate error handling attempts
  expect(logger.critical).toHaveBeenCalledWith(
    expect.stringContaining('Database unavailable'), 
    expect.any(CriticalSystemError)
  );
  expect(monitoringService.alertOperators).toHaveBeenCalled();
});
```

### 3. Testing Race Conditions and Timeouts

Test how the system behaves with timeouts and race conditions:

```javascript
test('should handle timeouts properly', async () => {
  vi.useFakeTimers();
  
  // Setup a promise that will never resolve
  service.longRunningOperation.mockImplementationOnce(() => {
    return new Promise(() => {/* never resolves */});
  });
  
  // Start the operation with a timeout
  const operationPromise = service.executeWithTimeout(100);
  
  // Advance time past the timeout
  await vi.advanceTimersByTimeAsync(150);
  
  // Verify timeout was handled properly
  await expect(operationPromise).rejects.toThrow('Operation timed out');
  
  // Verify cleanup happened after timeout
  expect(service.cancelOperation).toHaveBeenCalled();
  
  vi.useRealTimers();
});
```

## Practical Implementation Guide

### Updating Existing Tests

When updating existing tests, follow these steps:

1. Replace try/catch blocks with the `expect().rejects` pattern
2. Ensure all async tests are properly awaited
3. Add thorough checks for error properties, not just error messages
4. Test both the "happy path" and multiple failure scenarios

### Testing Error Recovery Mechanisms

For services with fallback mechanisms:

```javascript
test('should fall back to secondary service when primary fails', async () => {
  // Primary service fails
  primaryService.operation.mockRejectedValueOnce(new Error('Primary failure'));
  
  // Secondary service succeeds
  secondaryService.operation.mockResolvedValueOnce('backup result');
  
  // Execute the operation
  const result = await serviceManager.performOperation('test');
  
  // Verify the attempt to use primary service
  expect(primaryService.operation).toHaveBeenCalledWith('test');
  
  // Verify the fallback to secondary service
  expect(secondaryService.operation).toHaveBeenCalledWith('test');
  
  // Verify the final result came from the secondary service
  expect(result).toBe('backup result');
  
  // Verify the error was logged
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Primary failure'), 
    expect.any(Error)
  );
});
```

### Testing Non-Deterministic Error Scenarios

For testing scenarios with non-deterministic error occurrences:

```javascript
test('should handle intermittent failures with retries', async () => {
  // Service fails the first two times, succeeds on third attempt
  service.operation
    .mockRejectedValueOnce(new Error('Temporary failure 1'))
    .mockRejectedValueOnce(new Error('Temporary failure 2'))
    .mockResolvedValueOnce('success result');
  
  // Execute with retry logic
  const result = await serviceWithRetries.performOperation('test');
  
  // Verify multiple attempts were made
  expect(service.operation).toHaveBeenCalledTimes(3);
  
  // Verify we got the successful result
  expect(result).toBe('success result');
  
  // Verify retries were logged
  expect(logger.info).toHaveBeenCalledWith(
    expect.stringContaining('Retrying operation'), 
    expect.anything()
  );
});
```

## Conclusion

By implementing these error handling patterns consistently across our test suite, we'll create more reliable and maintainable tests that accurately verify our application's error handling behavior. This approach will:

1. Reduce false positives in our test results
2. Provide clear failure messages when tests fail
3. Ensure our application handles errors gracefully
4. Make tests more maintainable and easier to understand