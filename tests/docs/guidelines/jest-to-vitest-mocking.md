# Jest to Vitest Migration Guide: Mocking Promises

This guide documents key differences between Jest and Vitest when it comes to mocking, particularly for asynchronous functions and Promise rejections.

## Promise Rejection Patterns

### Jest

In Jest, the following patterns are commonly used to mock promise rejections:

```javascript
// Pattern 1: Direct use of mockRejectedValueOnce
myService.myMethod.mockRejectedValueOnce(new Error('Service error'));

// Pattern 2: Using mockImplementationOnce with Promise.reject
myService.myMethod.mockImplementationOnce(() => Promise.reject(new Error('Service error')));
```

Both patterns typically work reliably in Jest.

### Vitest

In Vitest, the direct use of `mockRejectedValueOnce` can sometimes lead to issues, particularly when:
- The mock is applied to a nested property
- The mock is used within complex test suites
- Multiple rejection mocks are used in sequence

For more reliable behavior in Vitest, use one of these approaches:

```javascript
// Approach 1: Use vi.spyOn with mockImplementation
const spy = vi.spyOn(myService, 'myMethod');
spy.mockImplementation(() => {
  throw new Error('Service error');
});

// Approach 2: Use mockImplementationOnce with explicit Promise.reject
vi.mocked(myService.myMethod).mockImplementationOnce(() => {
  return Promise.reject(new Error('Service error'));
});

// Approach 3: Reset before mocking for clean state
const spy = vi.spyOn(myService, 'myMethod');
spy.mockReset();
spy.mockImplementation(() => {
  throw new Error('Service error');
});
```

## Handling Mock Failures in Tests

When testing error handlers, wrap the code that should handle errors in try/catch to verify correct behavior:

```javascript
it('should handle service errors', async () => {
  // Setup the mock to fail
  vi.spyOn(myService, 'myMethod').mockImplementation(() => {
    throw new Error('Service error');
  });
  
  try {
    // Call the function that should handle the error
    const result = await myFunction();
    
    // If we get here, the error was handled, so verify the results
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Service error');
  } catch (error) {
    // If we catch an error here, the error wasn't properly handled
    fail('Error should have been handled but was thrown: ' + error.message);
  }
});
```

## Other Important Vitest Differences

### Mock Resetting

In Vitest, ensure mocks are properly reset between tests:

```javascript
beforeEach(() => {
  vi.resetAllMocks();
  // or for specific mocks:
  vi.mocked(myService.myMethod).mockReset();
});
```

### Using vi.mocked

The `vi.mocked()` helper improves TypeScript integration, but can sometimes behave differently than direct mocking:

```javascript
// Instead of:
myService.myMethod.mockImplementation(() => {});

// Use:
vi.mocked(myService.myMethod).mockImplementation(() => {});
```

## Troubleshooting Vitest Mock Issues

If Vitest tests still fail despite following these patterns, try:

1. Use `vi.resetAllMocks()` before each test
2. Set up mocks in a more isolated way to avoid cross-test contamination
3. Consider using direct throw statements in mocked implementations rather than Promise rejections
4. Check if the issue is related to proper ES module mocking syntax
5. Verify mock functions are properly awaited where necessary

By following these guidelines, you can ensure smoother migration from Jest to Vitest, particularly for tests involving asynchronous operations and error handling.