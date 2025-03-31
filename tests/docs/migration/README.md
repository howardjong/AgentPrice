
# Jest to Vitest Migration Master Reference

This document serves as the central resource for our Jest to Vitest test migration project, consolidating all migration documentation, strategies, progress tracking, and best practices into a single comprehensive reference.

## Migration Strategy

### Overview

We are migrating our test suite from Jest to Vitest for several key reasons:

- **Better ESM support**: Vitest provides native ESM support, eliminating the module teardown issues in Jest
- **Improved performance**: Vitest's parallel execution capabilities offer faster test runs
- **Better developer experience**: Watch mode and debugging are more reliable
- **Jest compatibility**: Vitest maintains API compatibility with Jest for easier migration
- **Active development**: Vitest is actively maintained and addresses modern testing challenges

### Migration Phases

Our migration follows a four-phase approach:

#### Phase 1: Preparation and Infrastructure Setup (Completed)
- Install Vitest and configure it alongside Jest
- Establish dual-framework testing capability
- Set up migration tracking and documentation
- Create validation tools to ensure test consistency

#### Phase 2: Utility and Helper Function Tests (In Progress)
- Migrate unit tests for non-service utilities
- Begin with simpler tests with fewer dependencies
- Focus on tests for: circuitBreaker, logger, rateLimiter, monitoring
- Validate test results match between frameworks

#### Phase 3: Service and Integration Tests (Upcoming)
- Migrate more complex service-level tests
- Address mocking challenges, especially for ES modules
- Update test helpers and fixtures
- Focus on maintaining test coverage during migration

#### Phase 4: Full Migration and Jest Removal (Final Phase)
- Complete migration of all remaining tests
- Remove Jest dependencies
- Update CI/CD pipelines to use Vitest exclusively
- Finalize documentation and best practices

## Implementation Guidelines

### File Naming Convention

- Migrate `.test.js` files to `.vitest.js` files
- Keep both during transition to validate results
- Example: `circuitBreaker.test.js` → `circuitBreaker.vitest.js`

### Modifying Test Files

When migrating test files, make these key changes:

1. Update imports to use ESM syntax
   ```js
   // Before (CommonJS)
   const { describe, it, expect } = require('@jest/globals');
   
   // After (ESM)
   import { describe, it, expect } from 'vitest';
   ```

2. Update module mocking
   ```js
   // Before (Jest)
   jest.mock('../utils/logger');
   
   // After (Vitest)
   vi.mock('../utils/logger');
   ```

3. Update timer mocks 
   ```js
   // Before
   jest.useFakeTimers();
   jest.advanceTimersByTime(1000);
   
   // After
   vi.useFakeTimers();
   vi.advanceTimersByTime(1000);
   ```

4. Replace special Jest functions with Vitest equivalents
   - `jest.fn()` → `vi.fn()`
   - `jest.spyOn()` → `vi.spyOn()`
   - `jest.mock()` → `vi.mock()`

### Required Changes for ES Module Compatibility

- Import mocked modules explicitly
- Use dynamic imports with top-level await for modules that cannot be statically imported
- Use `vi.mock()` with a factory function for complex module mocking

### Example of Migrated Test

```javascript
// Before (Jest - circuitBreaker.test.js)
const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const CircuitBreaker = require('../../utils/circuitBreaker');
jest.useFakeTimers();

// After (Vitest - circuitBreaker.vitest.js)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker } from '../../utils/circuitBreaker';
vi.useFakeTimers();
```

## Mocking Guidelines

### Basic Function Mocking

```javascript
// Create mock function
const mockFn = vi.fn();
// Set implementation
mockFn.mockImplementation(() => 'mocked value');
// Set return value
mockFn.mockReturnValue('mocked value');
```

### Module Mocking

Simple module mock:

```javascript
import { vi } from 'vitest';

vi.mock('../../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));
```

ES Module mocking with factory function:

```javascript
vi.mock('../../services/claudeService', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    default: {
      sendMessage: vi.fn().mockResolvedValue({ response: 'mocked response' })
    }
  };
});
```

### Object Spying

```javascript
// Create spy on object method
const apiSpy = vi.spyOn(apiClient, 'request');
apiSpy.mockResolvedValue({ data: 'mocked data' });
```

### Timer Mocking

```javascript
// Setup fake timers
vi.useFakeTimers();

// Fast-forward time
vi.advanceTimersByTime(1000);

// Restore real timers
vi.useRealTimers();
```

### Testing Asynchronous Code

```javascript
// Testing promises
await expect(asyncFunction()).resolves.toBe(expectedValue);
await expect(asyncFunction()).rejects.toThrow();

// Testing with done callback
it('tests async callback', () => {
  return new Promise((done) => {
    asyncFunction().then((result) => {
      expect(result).toBe(expectedValue);
      done();
    });
  });
});
```

## Progress Tracking

### Current Migration Status

As of 2025-03-31:

- Total tests: 124
- Migrated to Vitest: 67 (54%)
- Pending migration: 57 (46%)

### Directory Migration Progress

| Directory | Migrated | Pending | Total | Progress |
|-----------|----------|---------|-------|----------|
| utils     | 28       | 12      | 40    | 70%      |
| services  | 14       | 21      | 35    | 40%      |
| controllers | 12     | 13      | 25    | 48%      |
| workflows | 13       | 11      | 24    | 54%      |

### Recently Migrated Tests

- ✅ `tests/unit/utils/circuitBreaker.vitest.js`
- ✅ `tests/unit/utils/apiClient.vitest.js`
- ✅ `tests/unit/utils/monitoring.vitest.js`
- ✅ `tests/unit/utils/rateLimiter.vitest.js`
- ✅ `tests/unit/utils/performanceNowMock.vitest.js`

### Tests Planned for Migration This Week

- ⬜ `tests/unit/services/researchService.test.js`
- ⬜ `tests/unit/services/promptManager.test.js`
- ⬜ `tests/unit/controllers/queryController.test.js`

## Common Challenges and Solutions

### Module Teardown Issues

**Problem:** Jest has problems tearing down modules between tests when using ES modules, leading to test interference.

**Solution:** Vitest handles ES modules more effectively. To ensure proper isolation:
- Use `vi.resetModules()` between tests that modify module state
- Employ `beforeEach` to reset module state
- Use factory functions with `vi.mock()` for stateful modules

### Mocking ES Modules

**Problem:** Traditional CommonJS mocking patterns don't work well with ES modules.

**Solution:**
- Use factory functions with `vi.mock()`
- Import mocked modules explicitly in your test
- For complex modules, use the importOriginal parameter in vi.mock()

### Timer Mocking Differences

**Problem:** Jest and Vitest timer mocking APIs have subtle differences.

**Solution:**
- Always use `vi.useFakeTimers()` before timer testing
- Reset mocks with `vi.clearAllMocks()` between tests
- Restore real timers with `vi.useRealTimers()` after tests

### Best Practices for Mixed Jest/Vitest Environment

During the transition phase:

1. Use the validation script to ensure test parity
2. Keep both test files until verification is complete
3. Run tests in isolation to prevent framework interference
4. Update documentation as migration progresses

## Troubleshooting Guide

### Common Errors and Solutions

**Error:** "SyntaxError: Cannot use import statement outside a module"

**Solution:** Ensure your package.json has "type": "module" or use .mjs extension for the test file

---

**Error:** "ReferenceError: jest is not defined"

**Solution:** Replace all jest references with vi

---

**Error:** "TypeError: vi.mock is not a function"

**Solution:** Import vi from Vitest: `import { vi } from 'vitest';`

---

**Error:** "Error: Not implemented: navigation"

**Solution:** Add jsdom environment to your test:
```js
// @vitest-environment jsdom
```

### Debugging Tips

1. Use `console.log(vi)` to check available mocking functions
2. Use `--inspect` flag with Vitest for Node.js debugging
3. Add `debug: true` to Vitest config for verbose output
4. Check test isolation by running individual tests

## Frequently Asked Questions

**Q: Do I need to migrate all tests at once?**  
A: No, tests can be migrated incrementally. Start with simpler utility tests and progress to more complex tests.

**Q: Can Jest and Vitest coexist?**  
A: Yes, during the migration period both frameworks can run side by side, which allows for gradual migration.

**Q: Will Vitest support all Jest assertions?**  
A: Vitest supports most Jest assertions. Reference the [Vitest documentation](https://vitest.dev/api/) for any differences.

**Q: Can I keep using Jest assertions?**  
A: Yes, Vitest supports most Jest assertions. However, we recommend migrating to Vitest-specific features for better error messages and performance.

## Consolidated Documentation

This document serves as the master reference, consolidating information from:

- `TEST_MIGRATION_PLAN.md` - Migration phases and strategy
- `TEST_MIGRATION_PROGRESS.md` - Weekly progress tracking
- `VITEST_MOCKING_GUIDE.md` - Detailed mocking examples and patterns
- `VITEST_MOCKING_GUIDELINES.md` - Best practices for mocking
- `VITEST_MODULE_MOCKING_GUIDELINES.md` - ES module mocking techniques

### Archived Documents

The following archived documents have also been reviewed and consolidated here:

- `archive/TEST_MIGRATION_PROGRESS.md` - Historical progress tracking (superseded by this document)
- `archive/jest-removal-plan.md` - Original Jest removal strategy (incorporated into Implementation section)
- `archive/patterns.md` - Early migration patterns documentation (enhanced and included in Best Practices)
- `archive/status.md` - Early status reporting (replaced by current Progress Tracking)
- `archive/overview.md` - Initial migration overview (expanded in Strategy section)
- `archive/summary.md` - Previous migration summary (updated in current Progress Tracking)

## Maintenance

If you need to update this documentation, please modify this file directly rather than creating additional migration documents. If substantial new content is needed, consider creating focused guides in the `/tests/docs/guidelines/` directory and reference them here.

## Tools and Scripts

Several scripts have been created to assist with the migration process:

- `scripts/migrate-test-file.js` - Automates test file migration
- `scripts/track-migration-progress.js` - Tracks and updates migration progress
- `scripts/validate-test-results.js` - Validates results between Jest and Vitest
- `scripts/memory-optimized-test-runner.js` - Runs tests with memory optimization

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Jest to Vitest Migration Guide](https://vitest.dev/guide/migration.html)
- [ES Module Mocking in Vitest](https://vitest.dev/guide/mocking.html)
