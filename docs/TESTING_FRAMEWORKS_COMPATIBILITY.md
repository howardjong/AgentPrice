# Testing Frameworks Compatibility in ESM Environment

## Overview

This document outlines the challenges and solutions for running Jest and Vitest tests in parallel within an ESM (ECMAScript Modules) environment. Our project has migrated from Jest to Vitest for improved compatibility with ES modules and better performance, but understanding the compatibility issues is important for projects in transition.

## Key Compatibility Issues

### 1. ES Modules vs. CommonJS

- **Jest**: Originally designed for CommonJS, Jest has limited ESM support. This causes errors like:
  - `ReferenceError: require is not defined` - When using CommonJS in an ESM context
  - `SyntaxError: Cannot use import statement outside a module` - When using ESM syntax in a CommonJS context
  - `ReferenceError: You are trying to import a file after the Jest environment has been torn down` - Due to ES module teardown issues

- **Vitest**: Built with native ESM support, Vitest handles ES modules without these issues.

### 2. Module Teardown Issues

- **Jest**: Has difficulty with ES module teardown, especially for dynamically imported modules.
- **Vitest**: Properly handles module teardown in an ESM environment.

### 3. Mocking Differences

- **Jest**: Uses `jest.mock()` with hoisting behavior, which can be challenging in an ESM environment.
- **Vitest**: Uses `vi.mock()` also with hoisting but more compatible with ESM files.

## Running Tests in Parallel

Our attempt to run Jest and Vitest tests in parallel revealed the following:

1. **Direct Parallel Execution**: Not reliable due to fundamental differences in how each framework handles the module system.

2. **Selective Test Runner**: We developed a script (`scripts/selective-test-runner.js`) that can run tests with either framework individually but not simultaneously.

3. **ESM-Specific Errors**: Jest consistently fails with ESM-specific errors when trying to load modules:
   - `Cannot use import statement outside a module`
   - `require is not defined`

## Solutions Implemented

1. **Complete Migration**: We've achieved 100% migration from Jest to Vitest as shown in `TEST_MIGRATION_PROGRESS.md`.

2. **Selective Test Running**: When tests need to be run with a specific framework:
   ```bash
   node scripts/selective-test-runner.js run vitest "path/to/test.vitest.js"
   ```

3. **Comparison Tool**: For verifying consistent behavior across frameworks (useful during migration):
   ```bash
   node scripts/selective-test-runner.js compare "path/to/test"
   ```

4. **Memory-Optimized Test Runner**: For large test suites:
   ```bash
   node scripts/run-vitest.js --pattern "path/to/test"
   ```

## Best Practices for ESM Testing

1. **Use One Framework**: Avoid running Jest and Vitest in the same process; rely on one framework (preferably Vitest for ESM).

2. **Consistent Mocking**: Follow consistent mocking patterns documented in `tests/VITEST_MOCKING_GUIDE.md`.

3. **Module Teardown**: Ensure proper cleanup in `afterEach` and `afterAll` blocks.

4. **Memory Management**: Use the memory optimization techniques documented in the migration plan.

## Conclusion

While running Jest and Vitest tests in parallel is theoretically possible, it's practically challenging due to fundamental differences in module system handling. Our recommendation is to complete the migration to Vitest for ESM projects to avoid these compatibility issues. The tools we've developed help manage this transition while ensuring consistent test behavior.