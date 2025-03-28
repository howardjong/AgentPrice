# Jest to Vitest Migration Plan

## Overview

This document outlines the comprehensive plan for migrating our test suite from Jest to Vitest. The migration will follow a phased approach to minimize disruption and ensure all functionality is properly tested throughout the transition.

## Why Migrate to Vitest?

- **Performance**: Vitest leverages Vite's dev server for significantly faster test execution
- **ESM Compatibility**: Better support for ES modules without configuration workarounds
- **Memory Efficiency**: Reduced memory footprint, especially important for our resource-intensive tests
- **Watch Mode**: Improved watch mode with faster reloads
- **Similar API**: Vitest has a Jest-compatible API that minimizes code changes

## Migration Strategy

### Phase 1: Foundation (Complete)

- ✅ Set up Vitest configuration
- ✅ Create parallel test files
- ✅ Implement memory optimizations
- ✅ Create migration scripts and tools

### Phase 2: Core Services (COMPLETE)

- ✅ Migrate critical external API services
  - ✅ anthropicService
  - ✅ perplexityService
- ✅ Migrate utility functions
  - ✅ circuitBreaker
  - ✅ apiClient (including advanced HTTP retry tests)
  - ✅ costTracker
  - ✅ tokenOptimizer
  - ✅ tieredResponseStrategy

### Phase 3: Integration Components (COMPLETE)

- ✅ Migrate service layers
  - ✅ serviceRouter (14 tests passing)
  - ✅ contextManager (14 tests passing)
  - ✅ redisClient (18 tests passing)
  - ✅ jobManager (12 tests passing, 6 complex tests skipped)
  - ✅ promptManager (13 tests passing)
- ✅ Support tools and infrastructure
  - ✅ Fixed system-status.js ES module compatibility
  - ✅ Improved WebSocket implementation for system monitoring
- ⏳ Migrate middleware and controllers

### Phase 4: Full Migration

- ⏳ Migrate remaining tests
- ⏳ Remove Jest dependencies
- ⏳ Update CI/CD pipelines
- ⏳ Document best practices

## Migration Process

For each component, follow these steps:

1. **Create Vitest Equivalent**: Create a `.vitest.js` version of the existing `.test.js` file
2. **Adapt Test Structure**: Modify the test to work with Vitest specific features
3. **Run Both Test Suites**: Verify both Jest and Vitest versions pass
4. **Verify Coverage**: Ensure no functionality is lost in migration
5. **Backup Jest File**: Create a backup of the original Jest test file
6. **Remove Jest File**: Remove the original Jest test file
7. **Update Progress Document**: Document the migration in TEST_MIGRATION_PROGRESS.md

## Common Migration Patterns

### Mock Functions

```javascript
// Jest
jest.mock('module-name');
const mockFn = jest.fn();

// Vitest
import { vi } from 'vitest';
vi.mock('module-name');
const mockFn = vi.fn();
```

### Before/After Hooks

```javascript
// Jest
beforeEach(() => {
  // setup
});
afterEach(() => {
  // teardown
});

// Vitest
import { beforeEach, afterEach } from 'vitest';
beforeEach(() => {
  // setup
});
afterEach(() => {
  // teardown
});
```

### Assertions

```javascript
// Jest
expect(value).toBe(expected);

// Vitest - same API
expect(value).toBe(expected);
```

## Known Issues and Solutions

### Hoisting of Mock Calls

**Issue**: Vitest hoists all `vi.mock()` calls to the top of the file, which can cause issues with imports.

**Solution**: Use inline `mockImplementation` instead of importing and using mocks directly:

```javascript
// Instead of:
import { myMock } from './__mocks__/myModule';
vi.mock('./myModule');

// Use:
vi.mock('./myModule', () => ({
  myFunction: vi.fn().mockImplementation(() => 'mocked value')
}));
```

### Promise Rejection Mocking

**Issue**: In Vitest, `mockRejectedValueOnce` can behave differently than in Jest, causing tests to fail or hang.

**Solution**: Use `mockImplementation` with explicit Promise rejection or throw statements:

```javascript
// More reliable approach for rejections:
vi.spyOn(service, 'method').mockImplementation(() => {
  throw new Error('Test error');
});

// Or for one-time rejection:
vi.spyOn(service, 'method').mockImplementationOnce(() => {
  return Promise.reject(new Error('Test error'));
});
```

See [jest-to-vitest-mocking.md](./docs/jest-to-vitest-mocking.md) for detailed examples.

### Asynchronous Tests

**Issue**: Some tests may time out differently between Jest and Vitest.

**Solution**: Adjust timeouts explicitly in Vitest tests:

```javascript
test('async test', async () => {
  // Test code
}, 10000); // 10 second timeout
```

### Real vs Mock Timers

**Issue**: Jest's automatic timers can cause issues with axios-mock-adapter in Vitest.

**Solution**: Explicitly use real timers for HTTP tests and reset them properly:

```javascript
// In tests with real network calls or mock adapters:
beforeEach(() => {
  vi.useRealTimers(); // Use real timers instead of mocks
});

afterEach(() => {
  vi.clearAllTimers();
  vi.clearAllMocks();
});
```

### Test Helpers

**Issue**: Jest-specific test helper files may contain incompatible code.

**Solution**: Instead of maintaining separate helper files that need migration, implement simple helpers directly in the test file:

```javascript
// Simple helper function defined in the test file
const traceTest = (testName) => {
  console.log(`Running test: ${testName}`);
  const memUsage = process.memoryUsage();
  console.log(`Memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
};
```

## Testing Best Practices

1. **Isolated Tests**: Tests should be independent and not rely on specific execution order
2. **Clean Mocks**: Reset mocks between tests to avoid test pollution
3. **Test Performance**: Keep tests fast to encourage running them frequently
4. **Coverage**: Aim for high test coverage, especially for critical services
5. **Documentation**: Document complex test setups and non-obvious test cases

## Resources

- [Vitest Documentation](https://vitest.dev/guide/)
- [Migration from Jest](https://vitest.dev/guide/migration.html)
- [VITEST_MOCKING_GUIDE.md](./VITEST_MOCKING_GUIDE.md) - Custom mocking guide for our codebase
- [TEST_DEVELOPMENT_GUIDE.md](./TEST_DEVELOPMENT_GUIDE.md) - Guide for writing new tests
- [jest-to-vitest-mocking.md](./docs/jest-to-vitest-mocking.md) - Specific guide for mocking promises and error handling