# Vitest Mocking Guidelines

This document provides guidelines for mocking modules in Vitest, especially for modules with mixed export patterns (both default and named exports).

## Table of Contents
- [Understanding Hoisting in Vitest Mocks](#understanding-hoisting-in-vitest-mocks)
- [Mocking Strategies](#mocking-strategies)
  - [Basic Module Mocking](#basic-module-mocking)
  - [Mocking Modules with Mixed Exports](#mocking-modules-with-mixed-exports)
  - [Using Mocked Functions](#using-mocked-functions)
- [Common Pitfalls](#common-pitfalls)
- [Best Practices](#best-practices)
- [Recommended Patterns](#recommended-patterns)

## Understanding Hoisting in Vitest Mocks

One of the most important concepts to understand when working with Vitest mocks is **hoisting**. When you use `vi.mock()`, Vitest hoists these calls to the top of the file, executing them before any imports. This leads to some non-intuitive behavior:

```javascript
// This is what you write
import myModule from './myModule';
vi.mock('./myModule');

// This is effectively what happens at runtime
vi.mock('./myModule');
import myModule from './myModule';
```

This means:
1. Variables defined after `vi.mock()` cannot be referenced inside the mock implementation
2. Mock implementations must use variables defined before any imports

## Mocking Strategies

### Basic Module Mocking

For simple modules with only a default export:

```javascript
// Mock implementation
const mockFunction = vi.fn();

// Mock the module
vi.mock('./simpleModule', () => {
  return {
    default: mockFunction
  };
});

// Import the module (after mocking)
import simpleModule from './simpleModule';
```

### Mocking Modules with Mixed Exports

For modules with both default and named exports:

```javascript
// Mock implementations
const mockDefaultFunction = vi.fn();
const mockNamedFunction = vi.fn();

// Mock the module with both default and named exports
vi.mock('./mixedModule', () => {
  return {
    default: mockDefaultFunction,
    namedFunction: mockNamedFunction
  };
});

// Import the module after mocking
import defaultExport, { namedFunction } from './mixedModule';
```

### Using Mocked Functions

Once mocked, you can control the function behavior:

```javascript
// Set up return value
mockFunction.mockReturnValue('mocked value');

// For async functions
mockFunction.mockResolvedValue('mocked async value');
mockFunction.mockRejectedValue(new Error('mock error'));

// For a single call
mockFunction.mockReturnValueOnce('one-time value');
```

## Common Pitfalls

1. **Accessing variables defined after `vi.mock()`**: This will not work due to hoisting
2. **Not resetting mocks between tests**: Use `beforeEach(() => { vi.resetAllMocks(); })` to ensure clean state
3. **Importing modules before mocking**: Always mock before importing to ensure the mock is applied
4. **Ignoring test isolation**: Use `mockImplementation`, `mockReturnValue`, and `mockReset` to maintain test isolation

## Best Practices

1. **Declare mock implementations at the top of the file**
   ```javascript
   // At the very top of your test file
   const mockFunction = vi.fn();
   vi.mock('./module', () => ({ default: mockFunction }));
   ```

2. **Reset mocks between tests**
   ```javascript
   beforeEach(() => {
     vi.resetAllMocks();
   });
   ```

3. **Restore mocks after tests**
   ```javascript
   afterEach(() => {
     vi.restoreAllMocks();
   });
   ```

4. **Use factory pattern for complex mocks**
   ```javascript
   // Define factory outside
   const createMockService = () => ({
     fetchData: vi.fn().mockResolvedValue({ data: 'mock' }),
     processData: vi.fn().mockReturnValue('processed')
   });
   
   // Use in mock
   vi.mock('./service', () => ({ default: createMockService() }));
   ```

## Recommended Patterns

### Mixed Export Pattern

For modules with both default and named exports, the recommended pattern is:

```javascript
// Mock implementations defined at top of file
const mockDefault = vi.fn();
const mockNamed1 = vi.fn();
const mockNamed2 = vi.fn();

// Mock before any imports
vi.mock('./complexModule', () => ({
  default: {
    method1: mockDefault
  },
  namedExport1: mockNamed1,
  namedExport2: mockNamed2
}));

// Import after mocking
import complexModule, { namedExport1, namedExport2 } from './complexModule';

describe('Tests with mixed export mocking', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Set up default behaviors
    mockDefault.mockReturnValue('default result');
    mockNamed1.mockResolvedValue('named result 1');
    mockNamed2.mockResolvedValue('named result 2');
  });
  
  it('should use the mocked implementations', async () => {
    const result1 = complexModule.method1();
    const result2 = await namedExport1();
    
    expect(result1).toBe('default result');
    expect(result2).toBe('named result 1');
  });
});
```

### Alternative: Manual Test Approach

When Vitest mocking becomes too complex or brittle, consider using manual tests:

```javascript
// Create dedicated test file with explicit mock implementations
// e.g., tests/manual/test-workflow.js

// Define mock services explicitly
const mockServices = {
  serviceA: {
    methodA: async () => 'mock result A'
  },
  serviceB: {
    methodB: async () => 'mock result B'
  }
};

// Test your workflow directly with the mocks
async function testWorkflow() {
  const { serviceA, serviceB } = mockServices;
  
  // Step 1
  const resultA = await serviceA.methodA();
  
  // Step 2
  const resultB = await serviceB.methodB(resultA);
  
  // Log or assert results manually
  console.log('Workflow result:', resultB);
  
  // Optional: Add simple assertions
  if (resultB !== 'expected output') {
    throw new Error(`Test failed: ${resultB} !== 'expected output'`);
  }
  
  return 'Test passed';
}

// Run the test
testWorkflow().catch(console.error);
```

This approach bypasses Vitest's mocking complexity in favor of explicit, readable tests that may be easier to maintain for complex workflows.

## Example Test Files

See the following examples for practical implementations:

- `tests/vitest/solutions/mixed-exports-solution.vitest.js` - Solution for modules with mixed exports
- `tests/manual/test-single-query-workflow.js` - Manual testing approach

## References

- [Vitest Mocking Documentation](https://vitest.dev/api/vi.html#vi-mock)
- [Vi Spying Documentation](https://vitest.dev/api/vi.html#vi-spyon)
- [Jest to Vitest Migration](https://vitest.dev/guide/migration.html)
