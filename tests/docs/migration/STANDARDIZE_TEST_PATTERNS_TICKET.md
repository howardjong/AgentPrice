# Ticket: Standardize Test Patterns Across Vitest Files

## Description

After the successful migration from Jest to Vitest, our pre-merge validation script has identified inconsistent test patterns across multiple test files. This ticket aims to standardize these patterns to improve maintainability, readability, and consistency across the test suite.

## Background

The pre-merge validation script (`scripts/pre-merge-validation.js`) checks for consistent test patterns but currently reports warnings for the majority of our test files. These warnings are non-critical and do not affect the functionality of the tests, but they represent an opportunity for standardization.

## Requirements

### 1. Standardize Import Patterns

Update all test files to use the recommended import pattern for Vitest:

```javascript
// Recommended pattern
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
```

Instead of other patterns such as:

```javascript
// Deprecated patterns
import * as vitest from 'vitest';
const { describe, it, expect } = vitest;

// Or
const { describe, it, expect } = require('vitest');
```

### 2. Update Test Files in Batches

Given the large number of affected files, implement the changes in batches:

1. Core services (claudeService, perplexityService, redisClient, contextManager, promptManager)
2. Job management and research services
3. Utility functions
4. WebSocket and API tests
5. Miscellaneous tests

### 3. Create Automated Fix Script

Develop a script similar to `fix-socketio-cleanup.js` that will:

1. Detect files using inconsistent import patterns
2. Update them to use the recommended pattern
3. Create backups of the original files
4. Support dry-run and verbose modes for safe execution

### 4. Documentation Update

1. Update `VITEST_MOCKING_GUIDE.md` with clear examples of the recommended import patterns
2. Add a section to `MIGRATION_SUMMARY.md` about the standardization effort

### 5. Validation

1. Ensure all tests continue to pass after the pattern standardization
2. Verify that the pre-merge validation script no longer reports warnings about inconsistent patterns

## Affected Files

Based on the latest pre-merge validation run, the following files need to be updated:

```
tests/unit/services/researchService.vitest.js
tests/unit/services/claudeService.vitest.js
tests/unit/services/redisClient.vitest.js
...
[See pre-merge-validation-results.txt for the complete list]
```

## Acceptance Criteria

1. All test files use the recommended import pattern for Vitest
2. The pre-merge validation script reports no warnings about inconsistent test patterns
3. All tests continue to pass with the standardized patterns
4. Documentation is updated to reflect the standardized patterns

## Non-Goals

1. Rewriting test logic or changing test behavior
2. Adding new tests or improving test coverage
3. Modifying the production code

## Estimated Effort

Medium (3-5 days)

## Dependencies

None. This work can be done independently after the Jest to Vitest migration is complete.

## Notes

The standardization effort should be approached methodically, with careful testing after each batch of files is updated. The automated fix script will help reduce the manual effort and minimize the risk of human error.