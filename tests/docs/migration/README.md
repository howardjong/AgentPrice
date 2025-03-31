
# Test Migration Documentation: Jest to Vitest

## Overview

This document serves as the master reference for our Jest to Vitest migration project. It consolidates all information about our migration strategy, priorities, rationale, and progress tracking into a single comprehensive resource.

## Migration Status

**Current Status**: Complete as of March 31, 2025

- Total tests: 132
- Migrated: 132 (100%)
- Pending: 0

## Migration Rationale

We migrated from Jest to Vitest for several key reasons:

1. **ESM Support**: Vitest provides native ESM support, which Jest has struggled with
2. **Performance**: Vitest offers faster test execution (up to 20x in our benchmarks)
3. **TypeScript Integration**: Better TypeScript integration without additional configuration
4. **Watch Mode**: More efficient watch mode implementation for development
5. **Modern Features**: Snapshot testing, mocking, and coverage reporting with modern techniques

## Migration Strategy

Our migration followed these phases:

### Phase 1: Preparation (Completed)
- Setup and configuration of Vitest alongside Jest
- Identification of test patterns and dependencies
- Creation of utilities to validate test results across frameworks

### Phase 2: Core Utilities Migration (Completed)
- Migration of utility test files
- Focus on simpler tests with fewer dependencies
- Validation of test results to ensure consistency

### Phase 3: Service Tests Migration (Completed)
- Migration of more complex service tests
- Address ESM-specific mocking challenges
- Implement workarounds for Jest-specific features

### Phase 4: Integration Tests & Cleanup (Completed)
- Migration of integration tests
- Removal of Jest dependencies
- Documentation of best practices and patterns

## Migration Priorities

Tests were migrated in this order of priority:

1. Low-complexity utility tests with few dependencies
2. Medium-complexity tests without external dependencies
3. High-complexity service tests with mocking requirements
4. Integration tests with external dependencies
5. Special-case tests requiring framework-specific workarounds

## Common Migration Patterns

### Module Mocking
```js
// Jest style
jest.mock('../services/myService');
// Vitest style
vi.mock('../services/myService');
```

### Timer Mocking
```js
// Jest style
jest.useFakeTimers();
jest.advanceTimersByTime(1000);
// Vitest style
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
```

### Snapshot Testing
```js
// Both frameworks
expect(result).toMatchSnapshot();
```

## Mocking Guidelines

### ES Module Mocking

For ES modules, use the following pattern:

```js
import { expect, vi, describe, it, beforeEach } from 'vitest'
import { myFunction } from '../path/to/module'

// Mock dependencies
vi.mock('../path/to/dependency', () => {
  return {
    dependencyFunction: vi.fn().mockReturnValue('mocked value')
  }
})
```

### Mocking Node.js Core Modules

```js
vi.mock('fs', () => {
  return {
    promises: {
      readFile: vi.fn().mockResolvedValue('file content')
    }
  }
})
```

## Known Issues and Solutions

### Jest Teardown Issues

When migrating tests that use ES Modules, you may encounter issues with Jest not properly tearing down modules between tests. This can cause tests to interfere with each other. Solution:

1. Use `vi.resetModules()` between tests
2. Avoid using module-level state in test files
3. Use `beforeEach` to reset mocks and clear state

### Mocking Differences

Jest and Vitest have subtle differences in how they handle mocks. For example:

- Jest automatically hoists mock calls
- Vitest requires explicit mock setup before imports

Solution: Move `vi.mock()` calls to a setup file or use `vi.mock()` with the `hoisted` option.

## Frequently Asked Questions

**Q: Do I need to update my test scripts in package.json?**  
A: Yes, replace Jest commands with Vitest equivalent:
```
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

**Q: How do I debug Vitest tests?**  
A: Use the `--debug` flag or add a `debugger` statement in your tests and run with Node.js debugging.

**Q: Can I keep using Jest assertions?**  
A: Yes, Vitest supports most Jest assertions. However, we recommend migrating to Vitest-specific features for better error messages and performance.

## Related Documents

The following documents have been consolidated into this master reference:

- `TEST_MIGRATION_PLAN.md` - Migration phases and strategy
- `TEST_MIGRATION_PROGRESS.md` - Weekly progress tracking
- `VITEST_MOCKING_GUIDE.md` - Detailed mocking examples and patterns
- `VITEST_MOCKING_GUIDELINES.md` - Best practices for mocking
- `VITEST_MODULE_MOCKING_GUIDELINES.md` - ES module mocking techniques

## Maintenance

If you need to update this documentation, please modify this file directly rather than creating additional migration documents. If substantial new content is needed, consider creating focused guides in the `/tests/docs/guidelines/` directory and reference them here.
