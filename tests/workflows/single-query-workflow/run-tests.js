#!/usr/bin/env node
/**
 * Single Query Workflow Test Runner Script
 * 
 * This script allows running workflow tests from the command line with various options.
 * 
 * Usage:
 *   node run-tests.js [--variant=VARIANT] [--use-real-apis] [--test-file=FILE] [--query="..."]
 * 
 * Options:
 *   --variant=NAME       Test variant to run (basic, performance, reliability, etc.)
 *   --use-real-apis      Use real APIs instead of mocks (requires API keys)
 *   --query="..."        Custom query to test
 *   --test-file=FILE     Specific test file to run (e.g., basic, performance)
 *   --save-results       Save test results to file
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import { testVariants } from './test-config.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  useRealAPIs: args.includes('--use-real-apis'),
  saveResults: args.includes('--save-results'),
  variant: null,
  testFile: null,
  query: null
};

// Process argument options
for (const arg of args) {
  if (arg.startsWith('--variant=')) {
    options.variant = arg.substring('--variant='.length);
  } else if (arg.startsWith('--test-file=')) {
    options.testFile = arg.substring('--test-file='.length);
  } else if (arg.startsWith('--query=')) {
    options.query = arg.substring('--query='.length);
  }
}

// Display variants if requested
if (options.variant === 'list') {
  console.log('Available test variants:');
  Object.entries(testVariants).forEach(([key, data]) => {
    console.log(`- ${key}: ${data.name}`);
    console.log(`  ${data.description}`);
  });
  process.exit(0);
}

// Display test files if requested
if (options.testFile === 'list') {
  console.log('Available test files:');
  console.log('- basic: Basic end-to-end test');
  console.log('- performance: Performance testing');
  console.log('- reliability: Testing across various query types');
  console.log('- error-handling: Error condition testing');
  process.exit(0);
}

// Set environment variable for real API tests
if (options.useRealAPIs) {
  process.env.ENABLE_LIVE_API_TESTS = 'true';
}

// Build vitest command
let vitestCommand = 'npx vitest run';

// Add specific file if requested
if (options.testFile) {
  const testFilePath = join(__dirname, 'tests', `${options.testFile}.test.js`);
  vitestCommand += ` ${testFilePath}`;
} else if (options.variant) {
  // If a variant is specified without a specific file, run the entire suite
  vitestCommand += ` ${join(__dirname, 'test-suite.js')}`;
} else {
  // Default to running the entire suite
  vitestCommand += ` ${join(__dirname, 'test-suite.js')}`;
}

// Add environment variables for test options
if (options.variant) {
  process.env.TEST_VARIANT = options.variant;
}

if (options.query) {
  process.env.TEST_QUERY = options.query;
}

if (options.saveResults) {
  process.env.SAVE_TEST_RESULTS = 'true';
}

console.log(`Running command: ${vitestCommand}`);
console.log('Test options:', JSON.stringify(options, null, 2));

try {
  // Execute the test command
  execSync(vitestCommand, { stdio: 'inherit' });
} catch (error) {
  console.error('Tests failed with error:', error.message);
  process.exit(1);
}