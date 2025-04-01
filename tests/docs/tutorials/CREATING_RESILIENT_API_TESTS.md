# Tutorial: Creating Resilient API Tests

**Date:** April 1, 2025  
**Author:** Test Engineering Team

This tutorial provides a step-by-step guide for applying the resilient API testing patterns we've developed to new or existing components. By following these steps, you can create comprehensive test suites that ensure your API-related components are robust, reliable, and maintainable.

## Who Should Use This Tutorial

This tutorial is designed for:

- Developers adding tests to new API-related components
- QA engineers improving test coverage for existing components
- Anyone looking to implement best practices for testing resilient systems

## Prerequisites

- Basic knowledge of Vitest testing framework
- Familiarity with JavaScript/TypeScript
- Understanding of API client concepts and HTTP

## Step 1: Analyze the Component

Before writing tests, analyze the component to understand its:

1. **Core Functionality**: What is the component's main purpose?
2. **Configuration Options**: What can be customized?
3. **Time-Dependent Behavior**: Does it use timeouts, delays, or scheduling?
4. **State Transitions**: Does it have different operational states?
5. **Error Handling**: How does it handle various types of errors?
6. **Dependencies**: What external components does it interact with?

**Example:**

For a component like `RobustAPIClient`, you might identify:

- Core Functionality: Making HTTP requests with retry and circuit breaking
- Configuration: Timeout, retry count, backoff settings, circuit breaker settings
- Time-Dependent Behavior: Retry delays, circuit breaker timeout
- State Transitions: Circuit open/closed/half-open states
- Error Handling: Network errors, HTTP error status codes, malformed responses
- Dependencies: Axios for HTTP, CircuitBreaker for failure management

## Step 2: Set Up the Test Environment

Create a new test file and set up the testing environment:

```javascript
// myComponent.test.js
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import MyComponent from '../path/to/myComponent';

// Mock dependencies
vi.mock('../path/to/dependency', () => ({
  default: {
    method1: vi.fn(),
    method2: vi.fn()
  }
}));

describe('MyComponent', () => {
  let component;
  
  beforeEach(() => {
    // Clear mock calls
    vi.clearAllMocks();
    
    // Create a fresh instance for each test
    component = new MyComponent({
      // Test configuration
      option1: 'value1',
      option2: 'value2'
    });
  });
  
  afterEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Clean up any global changes
    if (global.setTimeout !== originalSetTimeout) {
      global.setTimeout = originalSetTimeout;
    }
  });
  
  // Tests will go here
});
```

## Step 3: Test Core Functionality

Start with tests for the core functionality:

```javascript
describe('Core Functionality', () => {
  it('should perform its primary function correctly', async () => {
    // Arrange: Set up test conditions
    mockDependency.method1.mockResolvedValue('expected result');
    
    // Act: Call the method being tested
    const result = await component.performAction('input');
    
    // Assert: Verify results
    expect(result).toBe('expected result');
    expect(mockDependency.method1).toHaveBeenCalledWith('input');
  });
  
  it('should handle required parameters correctly', async () => {
    // Test with valid parameters
    await component.performAction('valid input');
    expect(mockDependency.method1).toHaveBeenCalledWith('valid input');
    
    // Test with invalid parameters
    await expect(component.performAction('')).rejects.toThrow('Invalid input');
    await expect(component.performAction(null)).rejects.toThrow('Invalid input');
  });
});
```

## Step 4: Test Configuration Options

Test behavior with different configuration options:

```javascript
describe('Configuration Options', () => {
  it('should use default options when not provided', () => {
    // Create with minimal configuration
    const defaultComponent = new MyComponent();
    
    // Verify default values
    expect(defaultComponent.options.timeout).toBe(30000);
    expect(defaultComponent.options.retries).toBe(3);
  });
  
  it('should use custom options when provided', () => {
    // Create with custom configuration
    const customComponent = new MyComponent({
      timeout: 5000,
      retries: 5
    });
    
    // Verify custom values
    expect(customComponent.options.timeout).toBe(5000);
    expect(customComponent.options.retries).toBe(5);
  });
  
  it('should validate options and reject invalid values', () => {
    // Test with invalid options
    expect(() => new MyComponent({ timeout: -1 })).toThrow('Invalid timeout');
    expect(() => new MyComponent({ retries: 'invalid' })).toThrow('Invalid retries');
  });
});
```

## Step 5: Test Time-Dependent Behavior

For components with time-dependent behavior, use mock time:

```javascript
describe('Time-Dependent Behavior', () => {
  it('should respect timeout settings', async () => {
    // Mock Date.now for deterministic timing
    const originalDateNow = Date.now;
    Date.now = vi.fn().mockReturnValue(1000);
    
    // Start an operation with timeout
    const operationPromise = component.performLongOperation();
    
    // Advance time just below timeout
    Date.now = vi.fn().mockReturnValue(1000 + component.options.timeout - 1);
    
    // Operation should still be running
    expect(component.isOperationRunning()).toBe(true);
    
    // Advance time past timeout
    Date.now = vi.fn().mockReturnValue(1000 + component.options.timeout + 1);
    
    // Operation should time out
    await expect(operationPromise).rejects.toThrow('Operation timed out');
    expect(component.isOperationRunning()).toBe(false);
    
    // Restore original Date.now
    Date.now = originalDateNow;
  });
  
  it('should implement retry with correct delays', async () => {
    // Mock setTimeout to track delays and execute immediately
    const delays = [];
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = vi.fn((callback, delay) => {
      delays.push(delay);
      callback(); // Execute immediately
      return 123; // Fake timer ID
    });
    
    // Make function fail on first two attempts, succeed on third
    mockDependency.method1
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValueOnce('success');
    
    // Execute operation
    const result = await component.performWithRetry();
    
    // Verify result and retry count
    expect(result).toBe('success');
    expect(mockDependency.method1).toHaveBeenCalledTimes(3);
    
    // Verify delays (should be exponential with base of retryDelay)
    expect(delays.length).toBe(2); // Two retries
    expect(delays[1]).toBeGreaterThan(delays[0]); // Second delay > first
    
    // Restore original setTimeout
    global.setTimeout = originalSetTimeout;
  });
});
```

## Step 6: Test State Transitions

For components with state machines:

```javascript
describe('State Transitions', () => {
  it('should start in the correct initial state', () => {
    expect(component.getState()).toBe('READY');
  });
  
  it('should transition through states correctly', () => {
    // Initial state
    expect(component.getState()).toBe('READY');
    
    // Trigger state change
    component.start();
    expect(component.getState()).toBe('RUNNING');
    
    // Trigger next state change
    component.complete();
    expect(component.getState()).toBe('COMPLETED');
    
    // Verify state-dependent behavior
    expect(component.canStart()).toBe(false);
    expect(component.isCompleted()).toBe(true);
  });
  
  it('should maintain state history', () => {
    // Perform multiple transitions
    component.start();
    component.pause();
    component.resume();
    component.complete();
    
    // Get history
    const history = component.getStateHistory();
    
    // Verify transitions
    expect(history.length).toBe(5); // Initial + 4 transitions
    expect(history[0].state).toBe('READY');
    expect(history[4].state).toBe('COMPLETED');
  });
});
```

## Step 7: Test Error Handling

Test error handling for different scenarios:

```javascript
describe('Error Handling', () => {
  it('should handle network errors', async () => {
    // Mock network error
    mockDependency.method1.mockRejectedValue(new Error('Network error'));
    
    // Execute and verify handling
    await expect(component.performAction()).rejects.toThrow('Network error');
    expect(component.getErrorCount()).toBe(1);
    expect(component.getLastError().message).toBe('Network error');
  });
  
  it('should handle HTTP errors', async () => {
    // Mock HTTP error response
    mockDependency.method1.mockResolvedValue({
      status: 404,
      statusText: 'Not Found'
    });
    
    // Execute and verify handling
    await expect(component.performAction()).rejects.toThrow('Not Found');
    expect(component.getErrorCount()).toBe(1);
  });
  
  it('should handle unexpected error types', async () => {
    // Mock various error types
    const errorTypes = [
      'String error',
      null,
      undefined,
      { custom: 'error object' }
    ];
    
    for (const error of errorTypes) {
      // Reset error state
      component.resetErrors();
      
      // Mock error
      mockDependency.method1.mockImplementation(() => {
        throw error;
      });
      
      // Execute and verify handling
      await expect(component.performAction()).rejects.toThrow();
      expect(component.hasErrors()).toBe(true);
    }
  });
  
  it('should recover from errors', async () => {
    // Fail then succeed
    mockDependency.method1
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockResolvedValueOnce('success');
    
    // First attempt fails
    await expect(component.performAction()).rejects.toThrow('Temporary error');
    
    // Second attempt succeeds
    const result = await component.performAction();
    expect(result).toBe('success');
    
    // Verify recovery
    expect(component.isHealthy()).toBe(true);
    expect(component.getErrorCount()).toBe(0);
  });
});
```

## Step 8: Test Integration with Other Components

Test integration with other components:

```javascript
describe('Component Integration', () => {
  it('should integrate with external component', async () => {
    // Create real (not mocked) external component
    const externalComponent = new ExternalComponent();
    
    // Create component using real external component
    const integratedComponent = new MyComponent({
      externalComponent
    });
    
    // Test their integration
    const result = await integratedComponent.performIntegratedAction();
    
    // Verify result
    expect(result).toBe('expected integrated result');
    
    // Verify external component state
    expect(externalComponent.getState()).toBe('expected state');
  });
  
  it('should propagate errors from external component', async () => {
    // Create external component configured to fail
    const failingExternalComponent = new ExternalComponent({
      failOnPurpose: true
    });
    
    // Create component using failing external component
    const integratedComponent = new MyComponent({
      externalComponent: failingExternalComponent
    });
    
    // Test error propagation
    await expect(integratedComponent.performIntegratedAction())
      .rejects.toThrow('External component error');
      
    // Verify both components' error states
    expect(failingExternalComponent.hasErrors()).toBe(true);
    expect(integratedComponent.hasErrors()).toBe(true);
  });
});
```

## Step 9: Test Edge Cases

Identify and test edge cases specific to your component:

```javascript
describe('Edge Cases', () => {
  it('should handle empty/null inputs', async () => {
    await expect(component.performAction('')).rejects.toThrow('Invalid input');
    await expect(component.performAction(null)).rejects.toThrow('Invalid input');
    await expect(component.performAction(undefined)).rejects.toThrow('Invalid input');
  });
  
  it('should handle large inputs', async () => {
    // Create a very large input
    const largeInput = 'a'.repeat(1000000);
    
    // Should handle without error
    await component.performAction(largeInput);
  });
  
  it('should handle maximum retries with zero successes', async () => {
    // Mock to fail always
    mockDependency.method1.mockRejectedValue(new Error('Persistent failure'));
    
    // Execute with retry
    await expect(component.performActionWithRetry()).rejects.toThrow('Persistent failure');
    
    // Should have attempted exactly maxRetries + 1 times
    expect(mockDependency.method1).toHaveBeenCalledTimes(component.options.retries + 1);
  });
  
  it('should handle concurrent operations', async () => {
    // Start multiple operations concurrently
    const promises = [
      component.performAction('1'),
      component.performAction('2'),
      component.performAction('3')
    ];
    
    // All should complete without error
    await expect(Promise.all(promises)).resolves.toBeDefined();
  });
});
```

## Step 10: Test Performance Characteristics

Test that the component's performance meets expectations:

```javascript
describe('Performance Characteristics', () => {
  it('should complete within expected time', async () => {
    // Track actual execution time
    const startTime = performance.now();
    
    // Execute operation
    await component.performAction();
    
    // Calculate duration
    const duration = performance.now() - startTime;
    
    // Should be reasonably fast (adjust threshold as needed)
    expect(duration).toBeLessThan(500); // 500ms max
  });
  
  it('should limit resource consumption', async () => {
    // For memory-intensive operations, check memory usage before and after
    // (This is a simplified example - measuring actual memory usage is more complex)
    
    // Execute operation multiple times
    for (let i = 0; i < 100; i++) {
      await component.performAction();
    }
    
    // Verify no memory leaks or excessive usage
    // (This would require more sophisticated tools in a real scenario)
  });
});
```

## Step 11: Document Special Testing Patterns

Document any component-specific testing patterns for future reference:

```javascript
/**
 * MyComponent Test Helpers
 * 
 * This component requires special testing patterns:
 * 
 * 1. Time Mocking: Use Date.now mocking for deterministic time-based tests
 * 2. State Progression: Test all states in sequence to verify full lifecycle
 * 3. Error Recovery: Test recovery path after various error types
 */

// Helper function for time-based tests
function advanceTime(ms) {
  const currentTime = Date.now();
  Date.now = vi.fn().mockReturnValue(currentTime + ms);
}

// Helper function for testing state progression
async function progressThroughStates(component, actions) {
  const states = [];
  
  for (const action of actions) {
    await component[action]();
    states.push(component.getState());
  }
  
  return states;
}
```

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on state from other tests.

2. **Restore Global Mocks**: Always restore global mocks like `Date.now` and `setTimeout` in `afterEach` to prevent test pollution.

3. **Deterministic Time**: Use time mocking for deterministic testing of time-dependent behavior.

4. **Clear Expectations**: Each test should have clear expectations that verify specific behavior.

5. **Comprehensive Coverage**: Test happy paths, error paths, edge cases, and configuration variations.

6. **Test Both Units and Integration**: Test both isolated unit behavior and integration with other components.

7. **Focus on Resilience**: Prioritize testing error handling, recovery, and stability under unusual conditions.

## Next Steps

After following this tutorial, you should have a comprehensive test suite for your API-related component. To further improve your tests:

1. **Measure Coverage**: Use Vitest's coverage reports to identify untested code paths.

2. **Add Property-Based Tests**: Consider adding property-based tests for complex algorithms.

3. **Add Load Testing**: For performance-critical components, add load testing.

4. **Continuous Refinement**: As bugs are found, add regression tests to prevent recurrence.

---

For reference patterns and examples, see:
- [Resilient API Testing Patterns](../patterns/RESILIENT_API_TESTING_PATTERNS.md)
- [Circuit Breaker Coverage Improvements](../coverage/CIRCUIT_BREAKER_COVERAGE_IMPROVEMENTS_2025-04-01.md)
- [API Client Coverage Improvements](../coverage/API_CLIENT_COVERAGE_IMPROVEMENTS_2025-04-01.md)