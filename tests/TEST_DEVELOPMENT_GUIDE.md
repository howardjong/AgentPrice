# Test Development Guide

## Introduction

This guide provides best practices for writing and maintaining tests using Vitest in the MLRS project. Our testing approach focuses on reliability, performance, and maintainability.

## Getting Started

### Running Tests

Use one of the following methods to run tests:

1. Run all tests:
   ```
   npx vitest run
   ```

2. Run specific tests:
   ```
   npx vitest run tests/path/to/test.js
   ```

3. Run tests with our optimized runner:
   ```
   node scripts/run-vitest.js --pattern 'tests/unit/services/*.vitest.js'
   ```

4. Run tests with UI:
   ```
   node scripts/run-vitest.js --ui
   ```

### Creating New Tests

1. New test files should be created with a `.vitest.js` extension
2. Place tests in the appropriate directory within `tests/`
3. Follow the mocking pattern described in `VITEST_MOCKING_GUIDE.md`
4. Use the `traceTest()` utility to monitor memory usage

## Best Practices

### File Structure

Organize your test file with this structure:

```javascript
/**
 * Test description
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { traceTest } from '../utils/test-helpers.js';

// Define mocks first - IMPORTANT: This must come before imports
vi.mock('../path/to/module', () => ({
  default: {
    // mock implementation
  }
}));

// Import mocked modules
import moduleName from '../path/to/module';

// Helper functions for this test file
function createMockData() {
  // implementation
}

describe('Component Name', () => {
  traceTest('Component Name');
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should do something specific', () => {
    // Setup
    // ...
    
    // Execute
    // ...
    
    // Verify
    // ...
  });
});
```

### Memory Management

1. Always reset mocks between tests
2. Avoid creating large objects in test setup
3. Clean up resources in `afterEach` hooks
4. Use the memory-optimized test runner for large test suites
5. Pay attention to the memory usage logs from `traceTest()`

### Mocking

1. Use the factory functions in `test-helpers.js` for common mocks
2. Ensure mocks are defined before imports
3. Use `vi.clearAllMocks()` in `beforeEach` and `afterEach` hooks
4. Implement only what's needed in your mocks - don't over-mock

### Testing Async Code

1. Always use `async/await` for asynchronous tests
2. Properly handle promise rejections with try/catch or expect.rejects
3. Avoid mixing callback and promise-based approaches

### API Services

When testing API service modules:

1. Mock the underlying API client or HTTP functions
2. Test success paths with realistic mock responses
3. Test error paths with appropriate error handling
4. Verify retry logic and circuit breaker functionality
5. Test timeout handling

## Advanced Techniques

### Testing with Real Dependencies

For critical integration paths, you may need tests with real dependencies:

```javascript
describe('Integration', () => {
  // Don't mock critical components for this test
  vi.unmock('../path/to/critical/module');
  
  it('should integrate correctly', async () => {
    // This test will use the real module
  });
});
```

### Performance Testing

Use the `performance` mark and measure APIs:

```javascript
it('should perform within acceptable limits', async () => {
  performance.mark('start');
  
  // Code to test
  await someFunction();
  
  performance.mark('end');
  performance.measure('operation', 'start', 'end');
  
  const timing = performance.getEntriesByName('operation')[0].duration;
  expect(timing).toBeLessThan(100); // Under 100ms
});
```

### Custom Matchers

For specialized assertions, create custom matchers:

```javascript
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () => `expected ${received} to be within range ${floor}-${ceiling}`
    };
  }
});

it('should be within expected range', () => {
  expect(result).toBeWithinRange(1, 10);
});
```

## Troubleshooting

### Common Issues

1. **"Cannot access before initialization"**
   - Ensure your `vi.mock()` calls come before imports

2. **Tests interfering with each other**
   - Make sure to reset mocks and state between tests

3. **Slow tests**
   - Use the memory-optimized runner
   - Check for memory leaks using `traceTest()`
   - Consider running fewer tests in parallel

4. **ESM compatibility issues**
   - Follow the mocking pattern in `VITEST_MOCKING_GUIDE.md`
   - Use dynamic imports when necessary

## Resources

- [Vitest Documentation](https://vitest.dev/guide/)
- Project-specific resources:
  - `tests/VITEST_MOCKING_GUIDE.md`
  - `tests/MIGRATION_SUMMARY.md`
  - `tests/utils/test-helpers.js`