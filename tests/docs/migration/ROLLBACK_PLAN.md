# Rollback Plan: Jest to Vitest Migration

## Overview

This document outlines the detailed rollback procedures to use if issues are identified after merging the Jest to Vitest migration branch. The plan includes options for complete rollback, partial rollback of specific components, and targeted fixes.

## Complete Rollback Procedure

Use this procedure if major, widespread issues are discovered and immediate reversion to the previous state is required.

### Step 1: Create a Rollback Branch
```bash
# Create a rollback branch from the current main
git checkout main
git checkout -b rollback-vitest-migration
```

### Step 2: Revert the Merge Commit
```bash
# Identify the merge commit
git log --merges -n 1

# Revert the merge commit
git revert -m 1 <merge-commit-hash>

# Resolve any conflicts
# ...

# Complete the revert
git commit -m "Revert Jest to Vitest migration due to [specific issues]"
```

### Step 3: Validate the Rollback
```bash
# Run the Jest test suite to verify it's working again
npm test
```

### Step 4: Publish the Rollback
```bash
# Push the rollback branch
git push origin rollback-vitest-migration

# Create a PR to merge the rollback into main
# Merge after review
```

## Partial Rollback Options

If only specific components are experiencing issues, consider these targeted rollback procedures.

### Option 1: Revert Service Consolidation Only

If issues are isolated to the Claude service consolidation:

```bash
# Create a targeted rollback branch
git checkout main
git checkout -b rollback-claude-consolidation

# Restore the previous files
git checkout <pre-migration-commit> -- services/anthropicService.js
git checkout <pre-migration-commit> -- tests/unit/services/anthropicService.test.js

# Update imports in affected files
# Modify any files that were updated to use claudeService.js
```

Validate:
```bash
# Run tests specific to Anthropic service
node scripts/run-vitest.js --testNamePattern "Anthropic"
```

### Option 2: Revert Socket.IO Testing Changes Only

If Socket.IO tests are unstable after the migration:

```bash
# Create a targeted rollback branch
git checkout main
git checkout -b rollback-socketio-tests

# Restore original Socket.IO test files
git checkout <pre-migration-commit> -- tests/unit/websocket/
```

Validate:
```bash
# Run WebSocket tests
node scripts/run-vitest.js --testNamePattern "Socket"
```

### Option 3: Restore Jest While Keeping Vitest

If you need to temporarily have both testing frameworks:

```bash
# Install Jest dependencies
npm install --save-dev jest @types/jest jest-environment-node

# Restore Jest configuration files
git checkout <pre-migration-commit> -- jest.config.js
git checkout <pre-migration-commit> -- jest.setup.js

# Update package.json scripts to support both
# "test:jest": "jest",
# "test": "node scripts/run-vitest.js"
```

## Component-Specific Recovery Procedures

### Claude Service Recovery

If issues are found with Claude service after removing anthropicService.js:

1. Identify the specific issue (API compatibility, model naming, etc.)
2. Check if a simple fix can be applied to claudeService.js
3. If not, follow these steps:

```bash
# Restore the original anthropicService.js
git checkout <pre-migration-commit> -- services/anthropicService.js

# Create a shim to maintain compatibility for imports
echo "// Compatibility shim for anthropicService.js
import Claude from './claudeService.js';
export default Claude;" > services/anthropicService.js

# Update any imports that might have changed
```

### Search Utilities Recovery

If issues are found with Search Utilities:

```bash
# Restore the original search utilities
git checkout <pre-migration-commit> -- utils/searchUtils.js
git checkout <pre-migration-commit> -- tests/unit/utils/searchUtils.vitest.js

# Run the tests to verify
node scripts/run-vitest.js --testNamePattern "Search"
```

### Socket.IO Testing Recovery

If Socket.IO tests become unstable:

1. Identify the specific test file(s) causing issues
2. Check for cleanup pattern implementation
3. If needed, restore individual test files:

```bash
# Restore specific test file(s)
git checkout <pre-migration-commit> -- tests/unit/websocket/problematic-test.vitest.js

# Or restore test utilities
git checkout <pre-migration-commit> -- tests/unit/websocket/socketio-test-utilities.js
```

## Restoring Jest Completely

If a decision is made to revert to Jest entirely:

### Step 1: Restore Jest Configuration and Dependencies
```bash
# Restore package.json from the backup we created
cp package.json.jest-backup package.json

# Restore Jest configuration files
git checkout <pre-migration-commit> -- jest.config.js
git checkout <pre-migration-commit> -- jest.setup.js
```

### Step 2: Restore Test Files
```bash
# Restore all Jest test files
git checkout <pre-migration-commit> -- $(git ls-files "*/*.test.js")
```

### Step 3: Remove Vitest Configuration
```bash
# Remove Vitest configuration
rm vitest.config.js
```

### Step 4: Reinstall Dependencies
```bash
# Reinstall all dependencies to make sure Jest is included
npm install
```

### Step 5: Validate
```bash
# Run the Jest test suite
npm test
```

## Preventative Measures

To minimize the need for rollbacks:

1. **Maintain Backups**: Keep backups of critical files before the merge
2. **Phase Rollout**: Consider a phased approach to the migration
3. **Double Validation**: Run both Jest and Vitest tests before fully removing Jest
4. **Monitoring**: Implement additional monitoring after the merge

## Recovery Time Estimates

- **Full Rollback**: 1-2 hours
- **Partial Component Rollback**: 2-4 hours
- **Targeted Fixes**: 4-8 hours depending on complexity

## Conclusion

This rollback plan provides comprehensive guidance for responding to any issues discovered after merging the Jest to Vitest migration. By having detailed procedures ready, we can minimize downtime and ensure continuity of development activities in case problems occur.

For any questions about this rollback plan, contact the Testing Framework Migration team.