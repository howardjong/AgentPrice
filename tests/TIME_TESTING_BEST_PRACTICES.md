# Time Testing Best Practices

This document outlines best practices for testing time-dependent functionality in the Multi-LLM Research System. It provides guidance on how to effectively use the time-testing utilities to create reliable tests for code that depends on time-related functions.

## Common Testing Challenges with Time

Time-dependent code presents several challenges for testing:

1. **Unpredictability**: Real-time execution makes tests non-deterministic
2. **Test duration**: Tests that rely on actual elapsed time can be slow
3. **Flakiness**: Time-dependent tests can fail intermittently due to system loads or execution environments
4. **Complexity**: Time-dependent behavior can be difficult to test thoroughly

## Using the Time Testing Utilities

The `time-testing-utils.js` module provides several utilities to help with time-dependent testing.

### TimeController

The `TimeController` class provides comprehensive time manipulation capabilities:

```javascript
import { createTimeController } from '../utils/time-testing-utils';

describe('MyTimeBasedComponent', () => {
  let timeController;
  
  beforeEach(() => {
    // Create and set up time controller before each test
    timeController = createTimeController().setup();
  });
  
  afterEach(() => {
    // Restore original time functions
    timeController.restore();
  });
  
  it('should execute callbacks after a delay', async () => {
    let callbackExecuted = false;
    
    // Start with time = 0
    timeController.setTime(0);
    
    // Create a timeout that should execute after 1000ms
    setTimeout(() => {
      callbackExecuted = true;
    }, 1000);
    
    // Advance time by 500ms - callback should not have executed yet
    await timeController.advanceTime(500);
    expect(callbackExecuted).toBe(false);
    
    // Advance time by another 600ms - callback should have executed
    await timeController.advanceTime(600);
    expect(callbackExecuted).toBe(true);
  });
  
  it('should handle interval callbacks', async () => {
    const executionCount = { value: 0 };
    
    // Start with time = 0
    timeController.setTime(0);
    
    // Create an interval that executes every 1000ms
    const intervalId = setInterval(() => {
      executionCount.value++;
    }, 1000);
    
    // Advance time by 3500ms - callback should execute 3 times
    await timeController.advanceTime(3500);
    expect(executionCount.value).toBe(3);
    
    // Clear the interval
    clearInterval(intervalId);
    
    // Advance time further - count should not increase
    await timeController.advanceTime(2000);
    expect(executionCount.value).toBe(3);
  });
});
```

### Simple Performance.now Mocking

For simpler tests that just need to test functionality that uses `performance.now()`:

```javascript
import { mockPerformanceNowSequence } from '../utils/time-testing-utils';
import { vi } from 'vitest';

describe('FunctionUsingPerformanceNow', () => {
  beforeEach(() => {
    // Mock performance.now to return a sequence of times
    vi.stubGlobal('performance', {
      ...performance,
      now: mockPerformanceNowSequence(1000, 2500, 4000)
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should calculate correct duration', () => {
    // First call returns 1000, second call returns 2500
    const startTime = performance.now();
    // Do something...
    const endTime = performance.now();
    
    // Duration should be 2500 - 1000 = 1500
    expect(endTime - startTime).toBe(1500);
  });
});
```

### Integration Testing with Real Time

For integration tests where mocking time might be impractical:

```javascript
import { wait, withTimeout } from '../utils/time-testing-utils';

describe('IntegrationTest', () => {
  it('should complete an async operation within a reasonable time', async () => {
    // withTimeout helps prevent tests from hanging
    await withTimeout(async () => {
      // Start an operation
      const operation = startAsyncOperation();
      
      // Wait for a set period
      await wait(100);
      
      // Check if operation completed
      expect(operation.isComplete()).toBe(true);
    }, 5000); // Test will fail if it takes longer than 5 seconds
  });
});
```

## Best Practices

### 1. Mock Time Whenever Possible

Always prefer mocking time over using actual time delays in tests. This makes tests:
- Faster
- More reliable
- Deterministic

### 2. Use TimeController for Complex Time Requirements

For cases where you need to test multiple time-dependent operations, setTimeouts, or intervals, use the `TimeController` class.

### 3. Restore Time Functions After Each Test

Always restore the original time functions after each test using `timeController.restore()` or `vi.restoreAllMocks()`.

### 4. Be Aware of Node.js vs. Browser Differences

Remember that the time utilities are designed to work in a Node.js test environment. In browser environments, some behaviors might differ slightly.

### 5. Set Reasonable Timeouts for Integration Tests

When using real time in integration tests, always set reasonable timeouts to prevent tests from hanging indefinitely.

### 6. Test Edge Cases

Be sure to test edge cases in time-based functionality:
- Zero delay timeouts
- Very large delays
- Negative delays (which might be converted to 0)
- Multiple overlapping timeouts or intervals

### 7. Avoid Testing Implementation Details

Focus on testing the observable behavior of time-dependent code rather than implementation details.

### 8. Use Vitest's Built-in Timer Mocks When Appropriate

For simple cases, Vitest's built-in timer mocks may be sufficient:

```javascript
import { vi } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('should execute after timeout', () => {
  const spy = vi.fn();
  setTimeout(spy, 1000);
  
  // Fast-forward time
  vi.advanceTimersByTime(1000);
  
  expect(spy).toHaveBeenCalled();
});
```

### 9. Be Careful with Async/Await and Timers

When using async/await with Vitest's fake timers or the TimeController, be sure to use the async versions of time advancement methods (`advanceTimersByTimeAsync`, `advanceTime`).

## Troubleshooting Common Issues

### Tests Hang Indefinitely

This can happen when:
- A promise never resolves
- An infinite loop occurs

Solution: Use the `withTimeout` utility to add a safety timeout to tests.

### Inconsistent Test Results

This can occur when:
- Time mocking is incomplete
- Real time functions are still being used somewhere

Solution: Ensure all time functions are properly mocked, including `Date.now()`, `performance.now()`, `setTimeout`, and `setInterval`.

### Mock Functions Not Called in Expected Order

When testing time-dependent code, the order of execution can be critical.

Solution: Use the `TimeController.advanceTime()` method to carefully control the passage of time and the execution order of callbacks.

## Migration Guide: Replacing Old Time Mocks

### Old Pattern 1: Direct stubbing

```javascript
// Old approach
const mockPerformanceNow = vi.fn()
  .mockReturnValueOnce(1000)
  .mockReturnValueOnce(2500);
vi.stubGlobal('performance', { now: mockPerformanceNow });

// New approach
vi.stubGlobal('performance', { 
  now: mockPerformanceNowSequence(1000, 2500) 
});
```

### Old Pattern 2: Manual time manipulation

```javascript
// Old approach
let currentTime = 0;
vi.stubGlobal('Date', {
  ...Date,
  now: vi.fn(() => currentTime)
});
// Later in test
currentTime = 5000;

// New approach
const timeController = createTimeController().setup();
// Later in test
timeController.setTime(5000);
```

### Old Pattern 3: setTimeout testing

```javascript
// Old approach
vi.useFakeTimers();
setTimeout(callback, 1000);
vi.advanceTimersByTime(1000);
expect(callback).toHaveBeenCalled();
vi.useRealTimers();

// New approach
const timeController = createTimeController().setup();
setTimeout(callback, 1000);
await timeController.advanceTime(1000);
expect(callback).toHaveBeenCalled();
timeController.restore();
```