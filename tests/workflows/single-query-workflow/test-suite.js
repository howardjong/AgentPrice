/**
 * Single Query Workflow Test Suite
 * 
 * This module provides a complete test suite for the single-query workflow,
 * including all test variants.
 */

import { describe, beforeAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

// Import individual test files
import './tests/basic.test.js';
import './tests/performance.test.js';
import './tests/reliability.test.js';
import './tests/error-handling.test.js';

// Import test utilities
import { loadFixtures } from './test-utils.js';

describe('Single Query Workflow Complete Test Suite', () => {
  beforeAll(async () => {
    // Create test results directory if it doesn't exist
    const testResultsDir = path.join(process.cwd(), 'test-results', 'single-query-workflow');
    await fs.mkdir(testResultsDir, { recursive: true }).catch(() => {});
    
    // Load fixtures
    await loadFixtures();
    
    console.log(`
=================================================
  Single Query Workflow Test Suite
=================================================
Test results will be saved to: ${testResultsDir}

This test suite includes:
- Basic workflow tests
- Performance tests
- Reliability tests across query types
- Error handling tests

To run a specific test variant:
- Use the 'test-runner.js' module directly
- Or run an individual test file
=================================================
`);
  });
});