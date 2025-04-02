# Test Templates

This directory contains template files for creating new tests or refactoring existing tests according to our best practices.

## Available Templates

### ES Module Mocking Template

[esm-mocking-template.js](./esm-mocking-template.js) provides a comprehensive example of how to properly mock ES modules in Vitest tests. It demonstrates:

- Placing `vi.mock()` calls before any imports
- Using `vi.importActual()` to preserve original functionality
- Including the `__esModule: true` flag for proper ES module compatibility
- Handling both default and named exports
- Resetting modules between tests for better isolation
- Proper cleanup in `beforeEach`, `afterEach`, and `afterAll` hooks
- Techniques for tracking calls to dependencies
- Managing environment variables in tests

## Usage

To use these templates:

1. Copy the appropriate template to your test directory
2. Rename the file to match your test target (e.g., `myService.vitest.js`)
3. Replace the placeholder paths and function names with your actual module paths and function names
4. Add your specific test cases following the demonstrated patterns

## Best Practices

For detailed guidance on ES module mocking best practices, refer to:

- [Vitest Module Mocking Guidelines](../guidelines/vitest-module-mocking-guidelines.md)

## Migration

When refactoring existing tests to follow these patterns, focus on:

1. Moving all `vi.mock()` calls to the top of the file, before any imports
2. Adding proper module reset and cleanup in the appropriate hooks
3. Including the `__esModule: true` flag in all ES module mocks
4. Using dynamic imports where appropriate for better isolation