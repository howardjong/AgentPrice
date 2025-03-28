# Vitest Mocking Guide

## Key Differences from Jest

When migrating tests from Jest to Vitest, it's important to understand the key differences in mocking behavior:

1. **Hoisting Behavior**: 
   - Vitest hoists all `vi.mock()` calls to the top of the file, regardless of where they appear in your code.
   - This means you should import the modules **after** defining your mocks, not before.

2. **ESM Support**: 
   - Vitest handles ES modules better than Jest, but requires slightly different patterns.
   - Import mocking requires more precise control of import/mock order.

3. **Auto Mocking**: 
   - Vitest doesn't auto-mock modules by default, you need to explicitly define mock implementations.

## Best Practices for Mock Setup

### 1. Define Mocks First, Then Import

```javascript
// CORRECT - Define mocks before imports
vi.mock('../path/to/module', () => ({
  default: {
    methodName: vi.fn()
  }
}));

// Import AFTER mocks are defined
import { moduleName } from '../path/to/module';

// INCORRECT - Don't import before mocking
import { moduleName } from '../path/to/module'; // Wrong! Import after mocking
vi.mock('../path/to/module'); // This is hoisted but too late
```

### 2. Use Factory Functions for Complex Mocks

Create helper functions that return mock objects for complex dependencies:

```javascript
// Helper function in test-helpers.js
export function createMockPerplexityService() {
  return {
    processQuery: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      service: "Perplexity AI",
      healthy: true,
      totalCalls: 10,
      successRate: "95%"
    })
  };
}

// In your test file
vi.mock('../services/perplexityService', () => ({
  default: createMockPerplexityService()
}));
```

### 3. Reset Mocks Between Tests

Always reset mocks between tests to avoid cross-test contamination:

```javascript
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});
```

## Common Patterns

### Mocking Default Exports

```javascript
vi.mock('../path/to/module', () => ({
  default: {
    methodA: vi.fn(),
    methodB: vi.fn()
  }
}));
```

### Mocking Named Exports

```javascript
vi.mock('../path/to/module', () => ({
  namedExportA: vi.fn(),
  namedExportB: vi.fn()
}));
```

### Mocking Classes

```javascript
vi.mock('../path/to/module', () => ({
  default: class MockClass {
    constructor() {}
    methodA = vi.fn();
    methodB = vi.fn();
  }
}));
```

### Mocking API Responses

```javascript
// Setup for a specific test
mockFunction.mockResolvedValueOnce({
  data: {
    result: 'success',
    items: []
  }
});

// Or rejecting with an error
mockFunction.mockRejectedValueOnce(new Error('API Error'));
```

## Common Issues and Solutions

### 1. "Cannot access before initialization" Errors

**Problem**: Getting "Cannot access before initialization" when trying to use mocked imports.

**Solution**: Make sure you define all mocks before importing any modules:

```javascript
// Define mocks first
vi.mock('../module1');
vi.mock('../module2');

// Then import
import module1 from '../module1';
import module2 from '../module2';
```

### 2. Mocks Not Working as Expected

**Problem**: Mocks don't seem to work or original implementation still runs.

**Solution**: Check that you're importing the module after mocking it, and that your module path is correct.

### 3. Mock Reset Issues

**Problem**: Mock behavior from one test affects another test.

**Solution**: Use `vi.clearAllMocks()` in beforeEach/afterEach hooks.

## Further Resources

- [Vitest Documentation on Mocking](https://vitest.dev/api/vi.html#vi-mock)
- [Migration Guide from Jest to Vitest](https://vitest.dev/guide/migration.html)