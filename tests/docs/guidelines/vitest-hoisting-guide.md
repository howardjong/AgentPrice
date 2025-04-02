# Vitest Hoisting Guide

## Overview of the Issue

In Vitest, `vi.mock()` calls are automatically hoisted to the top of the file during execution, similar to Jest's behavior with `jest.mock()`. However, when mock implementations reference variables defined *after* the mock calls (i.e., in subsequent import statements), this can cause reference errors.

Consider this example:

```javascript
import { describe, it, expect, vi } from 'vitest';
import { mockUserService } from '../mocks/serviceMocks';

// This mock implementation references mockUserService which is imported above
vi.mock('../../services/userService', () => ({
  default: mockUserService
}));

// Rest of the test file...
```

Even though the imports appear before the `vi.mock()` call in the source code, Vitest hoists the `vi.mock()` call to run before the imports, causing a reference error.

## Solution: Using hoistingImports Option

Vitest provides a solution through the `hoistingImports` option:

```javascript
vi.mock('../../services/userService', { 
  hoistingImports: true 
}, () => ({
  default: mockUserService
}));
```

The `hoistingImports: true` option tells Vitest to:
1. Hoist the mock declaration
2. But wait to execute the factory function until after imports have been processed

## How to Apply This Fix

We've created a script that automatically adds the `hoistingImports: true` option to all `vi.mock()` calls in a test file:

```bash
node scripts/fix-hoisting.js path/to/test/file.vitest.js
```

This will create a fixed version of the file with `.hoisted` extension for you to review before applying the changes.

## Alternative Approaches

1. **Moving Mocks Before Imports**: Physically moving all `vi.mock()` statements before any import statements. This works but makes the code less readable, as mock implementations might reference variables that appear later in the file.

2. **Using Inline Mocks**: Replace static mocks with inline mocks in each test. This works but adds verbosity and can lead to inconsistencies between tests.

3. **Using jest.requireActual and Manual Mocks**: Creating manual mock files for each module. More complex to set up and maintain.

## Best Practices

1. **Keep All Mocks Together**: Group all your `vi.mock()` calls together, preferably right after imports.

2. **Add Clear Comments**: Add a comment explaining that `hoistingImports: true` is being used.

3. **Always Use hoistingImports: true**: When your mock implementations reference imported variables, always use this option.

4. **Reset and Restore Mocks**: Include proper cleanup in your tests:
   ```javascript
   beforeEach(() => {
     vi.resetModules();
     vi.clearAllMocks();
   });
   
   afterEach(() => {
     vi.restoreAllMocks();
   });
   ```

5. **Add __esModule flag**: For ES module compatibility, add the `__esModule: true` flag to your mocks:
   ```javascript
   vi.mock('../../services/userService', { hoistingImports: true }, () => ({
     __esModule: true,
     default: mockUserService
   }));
   ```

## Resources

- [Vitest Mocking Documentation](https://vitest.dev/api/vi.html#vi-mock)
- [ES Module Mocking in Vitest](https://vitest.dev/guide/mocking.html#es-modules)