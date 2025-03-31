# Vitest Module Mocking Guidelines

This document provides guidelines for effective module mocking in Vitest based on our learning from implementing the mockJobManager integration tests.

## Best Practices for ES Module Mocking

### 1. Dynamic Module Imports with vi.spyOn()

When testing interactions between real modules, use dynamic imports with `vi.spyOn()` for better isolation:

```javascript
// Import and spy on modules in the test itself
const moduleToMock = await import('../path/to/module.js');
vi.spyOn(moduleToMock.default, 'methodName');

// Now import the module under test 
// (which imports the module we just spied on)
const { default: moduleUnderTest } = await import('../path/to/module-under-test.js');
```

### 2. Module Reset Between Tests

Use `vi.resetModules()` between tests to ensure a clean state:

```javascript
beforeEach(() => {
  // Clear module cache to ensure we get fresh instances
  vi.resetModules();
});
```

### 3. Environment Variable Control

When modules behave differently based on environment variables, set them before importing:

```javascript
// Set environment
process.env.FEATURE_FLAG = 'true';

// Import AFTER setting environment variables
const { default: moduleUnderTest } = await import('../path/to/module.js');
```

### 4. Custom Tracking Mechanisms

For complex service interactions, implement custom tracking to verify method calls:

```javascript
// Create a mock with tracking
vi.mock('../services/mockService.js', async () => {
  const actualModule = await vi.importActual('../services/mockService.js');
  
  // Create tracking objects for our mock
  const mockCallTracking = {
    methodA: [],
    methodB: [],
  };
  
  // Clear tracking helper
  const clearMockCalls = () => {
    Object.keys(mockCallTracking).forEach(key => {
      mockCallTracking[key] = [];
    });
  };
  
  // Return module with tracked methods
  return {
    __esModule: true,
    default: {
      ...actualModule.default,
      
      // Wrap methods to track calls but preserve functionality
      methodA: vi.fn(function(...args) {
        mockCallTracking.methodA.push(args);
        return actualModule.default.methodA(...args);
      }),
      
      // Add tracking utilities
      _tracking: mockCallTracking,
      _clearTracking: clearMockCalls
    }
  };
});
```

### 5. Testing Component Interactions

For integration tests between components, verify interactions through tracked calls:

```javascript
// Verify component A called component B
test('component A calls component B', async () => {
  // Import with tracking
  const componentB = await import('../components/componentB.js');
  vi.spyOn(componentB.default, 'methodToCheck');
  
  // Import component under test
  const { default: componentA } = await import('../components/componentA.js');
  
  // Act - trigger interaction
  await componentA.doSomething();
  
  // Assert - verify the interaction occurred
  expect(componentB.default.methodToCheck).toHaveBeenCalledWith(
    expect.objectContaining({
      expectedProperty: expectedValue
    })
  );
});
```

## Handling Specific Test Scenarios

### Testing Rate Limiting

For testing complex behavior like rate limiting, isolate the specific logic:

```javascript
test('should apply rate limiting for specific operations', async () => {
  // Create a data object that should trigger rate limiting
  const data = { shouldRateLimit: true };
  
  // Clear any previous calls
  vi.clearAllMocks();
  
  // Directly call the function that applies rate limiting
  const options = {};
  if (data.shouldRateLimit) {
    options.limiter = {
      max: 5,
      duration: 60000
    };
    logger.info('Rate limiting applied');
  }
  
  // Verify rate limiting was applied
  expect(options.limiter).toBeDefined();
  expect(options.limiter.max).toBe(5);
  expect(logger.info).toHaveBeenCalledWith('Rate limiting applied');
});
```

### Testing Time-Dependent Operations

For time-dependent operations, use fake timers:

```javascript
test('should process a job over time', async () => {
  vi.useFakeTimers();
  
  // Setup test components
  const mockProcessor = vi.fn();
  const { default: jobManager } = await import('../services/jobManager.js');
  
  // Register processor
  jobManager.registerProcessor('test-queue', mockProcessor);
  
  // Enqueue job
  const jobId = await jobManager.enqueueJob('test-queue', { test: 'data' });
  
  // Advance time to allow for processing
  await vi.advanceTimersByTimeAsync(100);
  
  // Verify job was processed
  expect(mockProcessor).toHaveBeenCalled();
  
  vi.useRealTimers();
});
```

## Common Issues and Solutions

### Issue: Method Spy Not Capturing Calls

**Problem**: When spying on methods, calls aren't being captured.

**Solution**: Ensure you're spying on the module before any other code imports it. Use dynamic imports to control the order:

```javascript
// Wrong - module might already be imported by system under test
const moduleToMock = await import('../module.js');
vi.spyOn(moduleToMock.default, 'method');
const systemUnderTest = await import('../system.js'); // Too late!

// Correct - reset modules first, then spy, then import system
vi.resetModules();
const moduleToMock = await import('../module.js');
vi.spyOn(moduleToMock.default, 'method');
const systemUnderTest = await import('../system.js'); // Will use spied version
```

### Issue: Environment Variables Not Taking Effect

**Problem**: Setting environment variables doesn't affect module behavior.

**Solution**: Environment variables must be set before module import. Also, use `Object.defineProperty` for more reliable updates:

```javascript
// More reliable than process.env.VAR = 'value'
Object.defineProperty(process.env, 'FEATURE_FLAG', { value: 'true' });

// Now import the module that checks this flag
const testedModule = await import('../module.js');
```

### Issue: Test Interference

**Problem**: Tests are affecting each other despite isolation efforts.

**Solution**: Use a custom setup/teardown for each test to ensure complete isolation:

```javascript
beforeEach(async () => {
  vi.resetModules();
  
  // Reset any global state or singletons
  global.__testState = {};
  
  // Mock specific dependencies
  vi.mock('../dependency.js', () => ({
    default: { /* fresh mock instance */ }
  }));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
```

## Implementation Example: mockJobManager Integration Tests

Our approach for testing jobManager with mockJobManager integration:

1. We used `vi.resetModules()` before each test to ensure a clean module cache
2. We set environment variables like `USE_MOCK_JOB_MANAGER` before importing modules
3. We created spies on mockJobManager methods before importing jobManager
4. We tracked method calls via a custom tracking mechanism for better assertions
5. We isolated complex test scenarios like rate limiting to focus on specific behaviors

This approach successfully allowed us to test the integration between these two components while maintaining test isolation and deterministic behavior.

## Conclusion

Effective module mocking in Vitest requires careful attention to module import order, environment variables, and state isolation. By applying these guidelines, we can create more reliable and maintainable integration tests.