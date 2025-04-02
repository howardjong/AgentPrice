# ES Module Mocking Migration Plan

This document outlines the strategy for improving our test suite's ES module mocking approach to align with Vitest best practices and enhance test reliability.

## Current Status

According to our analysis on **2025-04-02**, our test suite has several areas for improvement regarding ES module mocking:

- Only **4%** of files place `vi.mock()` calls before imports
- Only **7%** of files use `vi.resetModules()` for proper isolation
- Only **17%** of files have proper mock cleanup
- Only **0.5%** of files include the `__esModule: true` flag in mocks
- About **49%** of files handle default exports properly
- Only **0.5%** of files handle named exports properly

## Migration Goals

1. Improve the reliability of our test suite with better ES module mocking
2. Implement consistent patterns across all test files
3. Reduce test interference and flakiness
4. Make tests more maintainable and easier to understand

## Migration Approach

### Phase 1: Automated Fixes (Week 1)

1. Run the `scripts/fix-esm-mocking.js` script to automatically address the most critical issues:
   - Moving `vi.mock()` calls before imports
   - Adding module reset and cleanup hooks
   - Adding `__esModule: true` flag to module mocks

2. Verify that the automated fixes don't break existing tests:
   - Run the test suite and fix any regressions
   - Focus on maintaining current functionality while improving patterns

### Phase 2: High-Priority Files (Week 2)

1. Manually update the highest-priority files (those in critical paths):
   - Services tests (jobManager, researchService, etc.)
   - API endpoint tests
   - WebSocket/Socket.IO tests

2. For these files, implement all best practices from the template:
   - Use dynamic imports where beneficial
   - Implement proper call tracking
   - Handle environment variables correctly

### Phase 3: Remaining Files (Weeks 3-4)

1. Update remaining files with a focus on:
   - Files with complex mocking needs
   - Files with test interference issues
   - Files with consistent failures

2. Document file-specific solutions in comments to help other developers

### Phase 4: Template Integration (Week 5)

1. Update the project's test documentation to include the new standards
2. Create additional templates as needed for specific testing scenarios
3. Integrate module mocking best practices into the team's development workflow

## Implementation Details

### Automated Fix Script

We've created `scripts/fix-esm-mocking.js` to automate common fixes. This script:
- Reorders `vi.mock()` calls to appear before imports
- Adds module reset and cleanup hooks if missing
- Adds `__esModule: true` flag to module mocks where missing

### Manual Fix Template

For manual updates, developers should use the template in `tests/docs/templates/esm-mocking-template.js`.

### Testing the Changes

After each phase:
1. Run the full test suite
2. Use the coverage report to verify that functionality hasn't been lost
3. Check for improvements in test reliability and reduced flakiness

## Validation

We'll validate the success of the migration with:

1. Re-running the ES module mocking analysis script after each phase
2. Tracking improvements in test reliability metrics
3. Monitoring build times and test execution times for improvements

## Rollback Plan

If issues arise:
1. Restore .bak files created by the automated fix script
2. Prioritize fixing critical path tests
3. Consider a phased approach with smaller batches of files