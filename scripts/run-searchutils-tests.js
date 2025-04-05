#!/usr/bin/env node

/**
 * SearchUtils Test Runner
 * 
 * This script provides a command-line interface for running tests specifically for 
 * the searchUtils module with detailed coverage reporting.
 * 
 * Usage:
 *   node scripts/run-searchutils-tests.js [options]
 * 
 * Options:
 *   --watch           Run in watch mode to monitor changes
 *   --coverage        Generate coverage report
 *   --verbose         Show detailed test output
 *   --help            Show this help information
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get current file and directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line args
const args = process.argv.slice(2);

// Help message
if (args.includes('--help')) {
  console.log(`
SearchUtils Test Runner
=====================

This script runs tests specifically for the searchUtils module with detailed coverage reporting.

Usage:
  node scripts/run-searchutils-tests.js [options]

Options:
  --watch           Run in watch mode to monitor changes
  --coverage        Generate coverage report
  --verbose         Show detailed test output
  --help            Show this help information

Examples:
  # Run tests with coverage report
  node scripts/run-searchutils-tests.js --coverage

  # Run tests in watch mode
  node scripts/run-searchutils-tests.js --watch

  # Run tests with detailed output
  node scripts/run-searchutils-tests.js --verbose
`);
  process.exit(0);
}

// Extract options from command line
const watchMode = args.includes('--watch');
const coverageMode = args.includes('--coverage');
const verboseMode = args.includes('--verbose');

// Define directories
const reportsDir = path.join(process.cwd(), 'test-results', 'searchutils');

// Ensure the reports directory exists
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// Build the vitest command
let command = 'npx vitest run tests/unit/utils/searchUtils.vitest.js';

// Add options
if (watchMode) {
  command = command.replace('run', 'watch');
}

if (coverageMode) {
  command += ' --coverage';
}

if (verboseMode) {
  command += ' --reporter verbose';
}

// Display test configuration
console.log('\n===============================================');
console.log('  SearchUtils Test Runner');
console.log('===============================================');
console.log(`Mode:    ${watchMode ? 'WATCH' : 'SINGLE RUN'}`);
console.log(`Coverage: ${coverageMode ? 'ENABLED' : 'DISABLED'}`);
console.log(`Verbosity: ${verboseMode ? 'DETAILED' : 'NORMAL'}`);
console.log('===============================================\n');

// Run the test
try {
  console.log(`Executing: ${command}\n`);
  
  // Run the command
  execSync(command, { 
    stdio: 'inherit',
    env: {
      ...process.env,
      // Add any environment variables needed for the tests
      NODE_ENV: 'test'
    }
  });
  
  console.log('\n===============================================');
  console.log(`✅ SearchUtils tests completed successfully!`);
  console.log('===============================================\n');
  
  // Generate summary if in coverage mode
  if (coverageMode) {
    console.log('Generating coverage summary report...');
    
    try {
      // Extract coverage data from the vitest output
      execSync('node check-searchutils-coverage.js', { 
        stdio: 'inherit' 
      });
      
      // Generate function coverage report
      console.log('\nGenerating function coverage report...');
      execSync('node check-searchutils-function-coverage.js', {
        stdio: 'inherit'
      });
      
      console.log('\nCoverage reports generated:');
      console.log('- Overall coverage: searchUtils-coverage-summary.md');
      console.log('- Function coverage: searchUtils-function-coverage.md');
    } catch (error) {
      console.error('\nError generating coverage summary:', error.message);
    }
  }
  
} catch (error) {
  console.error('\n===============================================');
  console.error('❌ SearchUtils tests failed');
  console.error('===============================================\n');
  
  console.error(`Error: ${error.message}`);
  process.exit(1);
}