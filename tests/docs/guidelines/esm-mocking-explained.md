# ES Module Mocking in Vitest

## The Problem

When Vitest mocks modules in an ES module environment, it needs to handle both CommonJS-style modules and ES modules correctly. However, there's a critical difference in how imports work between these two module systems:

1. **CommonJS**: Uses `require()` and assigns the entire module to a variable
2. **ES Modules**: Uses `import` syntax with special handling for default exports and named exports

The primary issue occurs when mocking ES modules that use default exports. In a real ES module, the default export is stored as a property called `default` on the module object, with a special `__esModule: true` flag to mark it as an ES module.

When mocking an ES module, you must include this flag, or your imports won't work correctly.

## Symptoms of Missing the `__esModule` Flag

If you see errors like these, you likely have an ES module mocking issue:

- `TypeError: cannot read property 'X' of undefined`
- `TypeError: ServiceName.methodName is not a function` 
- Imported default exports being undefined
- Import statements work in application code but not in tests

These errors typically happen because the default import is not being correctly recognized without the `__esModule: true` flag.

## The Solution

Always add `__esModule: true` to your mocks when mocking ES modules:

```javascript
// Correct way to mock an ES module with default export
vi.mock('../../services/apiService.js', () => ({
  __esModule: true,  // This is the critical flag!
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

// Correct way to mock an ES module with named exports
vi.mock('../../utils/helpers.js', () => ({
  __esModule: true,  // This is the critical flag!
  formatDate: vi.fn(),
  parseData: vi.fn()
}));
```

## Using the ESM Flag Fixer Script

We've created a tool to automatically find and fix any ES module mocks missing the `__esModule: true` flag:

```bash
# Fix a specific file
node scripts/fix-esm-flags.js path/to/test/file.vitest.js

# Fix all test files in the project
node scripts/fix-esm-flags.js
```

### How the Script Works

1. It scans test files for `vi.mock()` statements
2. It identifies ES module style mocks (using object literals or return statements)
3. It checks if they already have the `__esModule: true` flag
4. If the flag is missing, it adds it to the mock
5. It creates a backup (.bak) of any files it modifies

### Common Patterns It Detects

- Arrow function with object literal: `vi.mock('path', () => ({ ... }))`
- Regular function with return statement: `vi.mock('path', () => { return { ... } })`

## Preventing Future Issues

1. **Use Consistent Patterns**: Adopt a standard mocking template for ES modules
2. **Code Reviews**: Check for the `__esModule: true` flag in mock definitions
3. **Automated Testing**: Run automated checks as part of CI/CD process
4. **Documentation**: Ensure all team members understand ES module mocking requirements

## Example: Correct ES Module Mocking

See `tests/demo/esmoduleFlags.vitest.js` for a complete example of proper ES module mocking:

```javascript
// Example of ES module with properly set __esModule flag
vi.mock('../../services/client.js', () => ({
  __esModule: true,
  default: {
    connect: vi.fn().mockResolvedValue(true),
    fetch: vi.fn().mockResolvedValue({ data: 'test' }),
    disconnect: vi.fn().mockResolvedValue(true)
  }
}));

// Example of ES module with named exports and __esModule flag
vi.mock('../../utils/dataProcessor.js', () => ({
  __esModule: true,
  processData: vi.fn().mockReturnValue({ processed: true }),
  formatData: vi.fn().mockReturnValue('formatted'),
  analyzeData: vi.fn().mockReturnValue({ analysis: true })
}));
```