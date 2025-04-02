# Jest to Vitest Migration: Merge Preparation Plan

## Overview

This document outlines the comprehensive plan for merging our Jest to Vitest migration branch into main. It includes verification steps, validation procedures, and rollback contingencies to ensure a smooth transition.

## Pre-Merge Verification Checklist

### Test Coverage & Functionality
- [x] Run full Vitest test suite: `node scripts/run-vitest.js --coverage`
- [x] Verify all 100+ tests are passing
- [x] Check Socket.IO tests using new connection management patterns
- [x] Verify Claude Service tests with consolidated implementation
- [x] Confirm Search Utilities tests (47/48 passing)
- [x] Validate Perplexity Service rate-limiting tests
- [x] Compare coverage report with 80%+ target for all critical modules
- [x] Verify the skipped test in SearchUtils is properly documented

### Jest Removal Verification
- [x] Verify all tests have been migrated from Jest to Vitest
- [x] Confirm Jest configuration files are ready for removal
- [x] Ensure no production code is importing from Jest
- [x] Remove Jest dependencies from package.json using `scripts/remove-jest-dependencies.js`

### Documentation Review
- [x] Check that all coverage documentation is up-to-date
- [x] Verify consistency in the migration documentation
- [x] Confirm all test patterns are properly documented
- [x] Update rollback plan to include Jest dependency restoration instructions

## Technical Validation

### Vitest Configuration
- [x] Verify `vitest.config.js` has proper settings for ESM compatibility
- [x] Confirm timeouts are properly configured
- [x] Check memory management settings

### Socket.IO Testing
- [x] Verify all tests follow the cleanup pattern from SOCKETIO_TESTING_BEST_PRACTICES.md
- [x] Confirm explicit removal of event listeners with `removeAllListeners()`
- [x] Check for short timeouts for all async operations
- [x] Verify proper cleanup tracking system
- [x] Ensure try/catch blocks for all socket operations

### Service Consolidation
- [x] Verify all imports reference `claudeService.js` instead of `anthropicService.js`
- [x] Run the pre-merge validation script to check for anthropicService references
- [x] Confirm model naming follows the convention in MODEL_NAMING_STANDARD.md
- [x] Check for any missed references to deprecated model names

### ES Module Compatibility
- [ ] Verify all mock implementations follow the pattern in VITEST_MOCKING_GUIDE.md
- [ ] Check for proper handling of default and named exports in mocks
- [ ] Ensure mock cleanup is properly implemented in all test suites

### Database Testing
- [ ] Run tests for database migrations with proper isolation
- [ ] Verify that no tests are making destructive changes to real databases
- [ ] Confirm proper use of test transactions or in-memory databases for tests

## Merge Strategy

### Preparation
- [ ] Update branch with latest main:
  ```bash
  git checkout your-branch
  git fetch origin
  git rebase origin/main
  # Resolve any conflicts
  ```

- [ ] Create and test integration branch:
  ```bash
  git checkout -b integration-branch
  # Run comprehensive tests on this branch
  ```

### Pre-Flight Testing
- [ ] Run all tests in isolation mode:
  ```bash
  node scripts/run-vitest.js --run-isolated
  ```

- [ ] Execute performance-sensitive tests separately:
  ```bash
  node scripts/run-vitest.js --testNamePattern "performance" --run-isolated
  ```

- [ ] Test Socket.IO components with extra logging:
  ```bash
  DEBUG=socket.io* node scripts/run-vitest.js --testNamePattern "Socket"
  ```

- [ ] Run a memory profile on the test suite:
  ```bash
  node --inspect scripts/run-vitest.js
  # Connect Chrome DevTools and capture memory snapshots
  ```

### Merge Process
- [ ] Prepare detailed merge commit message
- [ ] Schedule merge during low-traffic period
- [ ] Perform the merge
- [ ] Run immediate post-merge verification tests

## Communication Plan

- [ ] Create detailed PR description including:
  - Summary of all changes
  - Links to key documentation files
  - Coverage improvements metrics
  - Potential impact on development workflow

- [ ] Schedule dedicated code review session focused on:
  - Socket.IO testing patterns
  - Vitest mocking approaches
  - Service consolidation impact

- [ ] Create rollout announcement detailing:
  - New testing commands replacing Jest commands
  - How to run and debug tests in the new environment
  - Performance improvements from the migration

## Validation Script

The pre-merge validation script (`pre-merge-validation.js`) should be run to:
- Check for any remaining Jest imports
- Verify no anthropicService references remain
- Ensure Claude service includes standard model references
- Check Socket.IO tests for proper cleanup patterns
- Verify Jest removal is complete
- Check for consistent test patterns

## Rollback Plan

### Immediate Rollback Procedure
If critical issues are discovered immediately after merge:
```bash
git revert <merge-commit-hash>
```

### Partial Rollback Options
- Option to revert service consolidation only
- Option to revert Socket.IO testing changes only
- Process to restore Jest if needed

### Recovery Steps for Major Components
- Step-by-step recovery procedures for:
  - Claude Service
  - Perplexity Service
  - Socket.IO testing
  - Search Utilities

## Post-Merge Verification

- [ ] Run immediate verification of critical paths:
  ```bash
  node scripts/verify-critical-paths.js
  ```

- [ ] Run full test suite:
  ```bash
  node scripts/run-vitest.js
  ```

- [ ] Verify documentation accuracy:
  - Ensure all README files reflect current codebase
  - Verify all examples in documentation work with merged code

- [ ] Check for performance regressions:
  ```bash
  node scripts/performance-comparison.js
  ```

## Sign-Off Requirements

Before final merge, obtain sign-off from:
- [ ] Test Lead
- [ ] Technical Lead
- [ ] Integration Lead
- [ ] Documentation Lead

## Notes and Observations

1. **Inconsistent Test Patterns Warning**:
   - The pre-merge validation script reports warnings about inconsistent test patterns in many test files.
   - These warnings are non-critical and do not affect the functionality of the tests.
   - A future ticket should be created to address these inconsistencies and standardize the test patterns across all test files.
   - For now, these warnings can be safely ignored for the merge.

2. **Jest Dependency Removal**:
   - The Jest dependencies have been successfully removed from package.json using the `scripts/remove-jest-dependencies.js` script.
   - A backup of the original package.json has been created at package.json.jest-backup.
   - The node_modules directory has been updated to reflect these changes.

3. **Socket.IO Test Cleanup**:
   - All Socket.IO tests have been updated with proper cleanup patterns using the `scripts/fix-socketio-cleanup.js` script.
   - Socket.IO tests now properly implement removeAllListeners() to ensure clean teardown of event listeners.
   - Backups of the original Socket.IO test files are stored in the tests/backups/websocket/ directory.

## Appendix: Key Documentation References

- [MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)
- [JEST_REMOVAL_PLAN.md](./JEST_REMOVAL_PLAN.md)
- [VITEST_MOCKING_GUIDE.md](../guidelines/VITEST_MOCKING_GUIDE.md)
- [SOCKETIO_TESTING_BEST_PRACTICES.md](../guidelines/SOCKETIO_TESTING_BEST_PRACTICES.md)
- [MODEL_NAMING_STANDARD.md](../guidelines/MODEL_NAMING_STANDARD.md)