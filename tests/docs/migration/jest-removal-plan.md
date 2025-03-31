# Jest Removal Plan

## Overview

This document outlines the step-by-step process for safely removing Jest tests after our successful migration to Vitest. The goal is to complete the transition with minimal risk to the system's stability while ensuring full test coverage is maintained.

## Current Status

- **Migration Status**: 100% of tests migrated to Vitest
- **Test Files**: All test files have both `.test.js` (Jest) and `.vitest.js` (Vitest) versions
- **Test Coverage**: Full coverage maintained in Vitest versions

## Removal Process

### Phase 1: Verification (Day 1)

- [x] Confirm all Vitest tests pass with current configuration
- [ ] Run coverage report to ensure all functionality is tested
- [ ] Compare coverage reports between Jest and Vitest
- [ ] Document any discrepancies and address them

```bash
# Run all Vitest tests to ensure they pass
node scripts/run-vitest.js

# Generate Vitest coverage report
node scripts/run-vitest.js --coverage
```

### Phase 2: Update Test Scripts (Day 2)

- [ ] Back up current package.json
- [ ] Modify test scripts in package.json to use Vitest exclusively
- [ ] Add migration-specific scripts for tracking progress
- [ ] Test the new scripts to confirm they work as expected

```json
// Updated scripts in package.json
"scripts": {
  "test": "node scripts/run-vitest.js",
  "test:coverage": "node scripts/run-vitest.js --coverage",
  "test:watch": "node scripts/run-vitest.js --watch",
  "test:ui": "node scripts/run-vitest.js --ui",
  "prepare-migration": "node scripts/prepare-jest-removal.js"
}
```

### Phase 3: Prepare Removal Script (Day 3)

- [ ] Create a script to identify and list all Jest test files
- [ ] Add functionality to verify each Jest file has a Vitest counterpart
- [ ] Include dry-run option to simulate removal
- [ ] Test script in isolation with dry-run mode

### Phase 4: Trial Removal (Day 4)

- [ ] Select one non-critical module for trial removal
- [ ] Back up the Jest test files for this module
- [ ] Remove Jest test files for the selected module
- [ ] Run full test suite to verify everything works
- [ ] Monitor system behavior for 24 hours

### Phase 5: Batch Removal (Days 5-7)

- [ ] Organize remaining Jest test files into batches:
  - Batch 1: Utility functions (low risk)
  - Batch 2: Service modules (medium risk)
  - Batch 3: Core functionality (higher risk)

- [ ] For each batch:
  1. Back up all files in the batch
  2. Remove the Jest test files
  3. Run full Vitest test suite
  4. Verify system stability
  5. Wait 24 hours before proceeding to next batch

### Phase 6: Configuration Cleanup (Day 8)

- [ ] Remove Jest configuration files:
  - [ ] jest.config.js
  - [ ] jest.setup.js
  - [ ] Any other Jest-specific setup files

- [ ] Update .gitignore to remove Jest-specific patterns
- [ ] Verify system still works after configuration removal

### Phase 7: Dependency Cleanup (Day 9)

- [ ] Identify all Jest-related dependencies in package.json
- [ ] Create a list of dependencies to be removed
- [ ] Remove dependencies in small batches
- [ ] Test after each batch removal

### Phase 8: Final Verification (Day 10)

- [ ] Run complete system test suite
- [ ] Verify all APIs and functionality work as expected
- [ ] Generate final test coverage report
- [ ] Document the completed migration

## Rollback Plan

In case of issues at any stage, follow these rollback procedures:

1. **Issue with specific test files:**
   - Restore the backed-up Jest test files for the affected module
   - Run both Jest and Vitest tests for the module
   - Identify and fix discrepancies

2. **Issues after configuration changes:**
   - Restore backed-up configuration files
   - Restore necessary dependencies
   - Roll back package.json script changes

3. **Major system issues:**
   - Restore full backup of the test directory
   - Restore original package.json
   - Restore all configuration files
   - Re-install original dependencies

## Test Files to Remove

Below is the complete list of Jest test files that will be removed during this process:

| Jest Test File | Vitest Replacement | Module Type | Risk Level |
|----------------|-------------------|------------|------------|
| tests/unit/services/anthropicService.test.js | anthropicService.vitest.js | Service | Medium |
| tests/unit/services/perplexityService.test.js | perplexityService.vitest.js | Service | Medium |
| tests/unit/services/researchService.test.js | researchService.vitest.js | Service | Medium |
| tests/unit/services/contextManager.test.js | contextManager.vitest.js | Service | Medium |
| tests/unit/utils/circuitBreaker.test.js | circuitBreaker.vitest.js | Utility | Low |
| tests/unit/utils/logger.test.js | logger.vitest.js | Utility | Low |
| tests/unit/utils/resourceManager.test.js | resourceManager.vitest.js | Utility | Low |
| tests/unit/apiClient.test.js | apiClient.vitest.js | Utility | Low |
| tests/integration/workflow/research.test.js | research.vitest.js | Integration | High |

## Conclusion

This phased approach ensures a safe and methodical removal of Jest with minimal risk to system stability. By carefully verifying each step before proceeding, we maintain test coverage and system integrity throughout the transition.