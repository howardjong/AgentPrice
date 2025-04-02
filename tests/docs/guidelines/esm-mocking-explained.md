# Understanding ES Module Mocking in Vitest

This document provides a deeper understanding of the ES module mocking patterns recommended in our testing guidelines.

## Core Concepts

### 1. Hoisting and Module Loading

In Vitest (like Jest), `vi.mock()` calls are **hoisted** to the top of the file before any imports. This means they are processed first, regardless of where they appear in your code. However, relying on this hoisting behavior can lead to confusion and maintainability issues.

**Best Practice**: Place `vi.mock()` calls explicitly at the top of your file, before any imports, to make the code's behavior clear and predictable.

**Rationale**: Explicitly ordering mocks before imports makes the code's intent clearer, improves readability, and prevents issues when multiple mocks depend on each other.

### 2. The __esModule Flag

ES Modules and CommonJS modules differ in how they export and import functionality. The `__esModule: true` flag is needed to signal that a mock is simulating an ES module.

**Best Practice**: Always include `__esModule: true` in the return object of `vi.mock()` implementations that mock ES modules.

**Rationale**: Without this flag, default exports may not be handled correctly, leading to subtle bugs where mocks don't behave as expected.

### 3. Module Resetting and Isolation

In Node.js, modules are cached after they're loaded. In tests, this can cause interference between test cases if modules maintain state.

**Best Practice**: Use `vi.resetModules()` in `beforeEach` to clear the module cache between tests.

**Rationale**: This ensures each test gets a fresh instance of imported modules, preventing state from leaking between tests and making them truly isolated.

### 4. Mock Cleanup

Vitest mocks maintain state about how they were called, which can interfere between tests if not properly cleaned up.

**Best Practice**: Use `vi.clearAllMocks()` in `beforeEach` and `vi.restoreAllMocks()` in `afterEach`.

**Rationale**: 
- `clearAllMocks()` resets the call history of all mocks, ensuring tests don't see calls from previous tests.
- `restoreAllMocks()` restores the original implementation of functions that were spied on, preventing mocks from affecting other tests.

### 5. Dynamic Imports for Test-Specific Mocking

Sometimes tests need different mock implementations for the same module.

**Best Practice**: Use dynamic imports with `import()` and reset modules between tests for test-specific mocking.

**Rationale**: Dynamic imports allow you to reload a module with different mocks for different tests, which isn't possible with static imports that are evaluated once at the top of the file.

## Common Patterns

### 1. Basic Module Mocking

```javascript
// At the top of the file, before imports
vi.mock('./path/to/module.js', () => ({
  __esModule: true,
  default: {
    method: vi.fn().mockReturnValue('mocked result')
  },
  namedExport: vi.fn()
}));

// Now import your module under test
import { functionThatUsesModule } from './path/to/function.js';
```

### 2. Preserving Original Functionality

```javascript
vi.mock('./path/to/module.js', async () => {
  const actual = await vi.importActual('./path/to/module.js');
  return {
    __esModule: true,
    default: {
      ...actual.default,
      // Only override specific methods
      specificMethod: vi.fn().mockReturnValue('mocked')
    }
  };
});
```

### 3. Dynamic Mocking for Different Tests

```javascript
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

test('scenario A', async () => {
  // Mock for this specific test
  vi.mock('./module.js', () => ({
    __esModule: true,
    default: { method: vi.fn().mockReturnValue('A') }
  }));
  
  // Import after mocking
  const { default: func } = await import('./function-under-test.js');
  
  // Test with the specific mock
  expect(func()).toBe('A');
});

test('scenario B', async () => {
  // Different mock for this test
  vi.mock('./module.js', () => ({
    __esModule: true,
    default: { method: vi.fn().mockReturnValue('B') }
  }));
  
  // Import after mocking (gets fresh module with new mock)
  const { default: func } = await import('./function-under-test.js');
  
  // Test with the different mock
  expect(func()).toBe('B');
});
```

### 4. Environment-Dependent Testing

```javascript
test('behaves differently based on environment', async () => {
  // Set environment variables before importing
  Object.defineProperty(process.env, 'FEATURE_FLAG', { value: 'enabled' });
  
  // Reset modules to clear cache
  vi.resetModules();
  
  // Import module (will see the environment variable)
  const { checkFeature } = await import('./feature.js');
  
  expect(checkFeature()).toBe(true);
});
```

## Troubleshooting Common Issues

### Issue: Mock is not being used

**Potential causes**:
1. Module was imported before mock was established
2. The mock path doesn't exactly match the import path used in the module under test
3. The module is using dynamic imports internally

**Solutions**:
1. Move `vi.mock()` calls to the top of the file
2. Use the exact same path in `vi.mock()` as used in the `import` statements
3. For modules using dynamic imports, you may need to mock `import()` itself

### Issue: TypeError: Cannot read property of undefined

**Potential causes**:
1. Missing the `__esModule: true` flag
2. Not properly handling default or named exports in the mock

**Solutions**:
1. Always include `__esModule: true` in the mock object
2. Check if the module uses default exports (`export default`) or named exports (`export const`)

### Issue: Tests interfere with each other

**Potential causes**:
1. Not resetting module cache between tests
2. Not clearing mock call history
3. Not restoring spied functions

**Solutions**:
1. Add `vi.resetModules()` in `beforeEach`
2. Add `vi.clearAllMocks()` in `beforeEach`
3. Add `vi.restoreAllMocks()` in `afterEach`

## Conclusion

Proper ES module mocking in Vitest requires attention to module loading order, export handling, and state isolation. By following these patterns consistently, we can create more reliable, maintainable, and isolated tests.