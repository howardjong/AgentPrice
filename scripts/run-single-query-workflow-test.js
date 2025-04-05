#!/usr/bin/env node

/**
 * Single Query Workflow Test Runner
 * 
 * This script provides a command-line interface for running the enhanced
 * single-query workflow tests with either mock or real APIs.
 * 
 * Usage:
 *   node scripts/run-single-query-workflow-test.js [options]
 * 
 * Options:
 *   --use-real-apis     Use real API calls instead of mocks (requires API keys)
 *   --variant=<name>    Run a specific test variant (default: basic)
 *   --query="<text>"    Specify a test query string
 *   --help              Show help information
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
Single Query Workflow Test Runner
================================

This script runs the enhanced single-query workflow tests with either
mock or real APIs.

Usage:
  node scripts/run-single-query-workflow-test.js [options]

Options:
  --use-real-apis     Use real API calls instead of mocks (requires API keys)
  --variant=<name>    Run a specific test variant:
                      'basic', 'performance', 'deep-research', 'chartgen'
  --query="<text>"    Specify a test query string
  --help              Show this help information

Examples:
  # Run the basic test variant with mock APIs
  node scripts/run-single-query-workflow-test.js

  # Run the deep research variant with real APIs
  node scripts/run-single-query-workflow-test.js --use-real-apis --variant=deep-research

  # Run with a custom query
  node scripts/run-single-query-workflow-test.js --query="What are the latest advancements in renewable energy?"
`);
  process.exit(0);
}

// Extract options from command line
const useRealApis = args.includes('--use-real-apis');
let variant = 'basic';
let query = '';

// Parse variant and query from args
args.forEach(arg => {
  if (arg.startsWith('--variant=')) {
    variant = arg.substring('--variant='.length);
  } else if (arg.startsWith('--query=')) {
    query = arg.substring('--query='.length);
  }
});

// Ensure test-results directory exists
const outputDir = path.join(process.cwd(), 'test-results', 'single-query-workflow');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Display test configuration
console.log('\n===============================================');
console.log('  Single Query Workflow Test Runner');
console.log('===============================================');
console.log(`Mode:    ${useRealApis ? 'LIVE API CALLS' : 'MOCK API CALLS'}`);
console.log(`Variant: ${variant}`);
if (query) {
  console.log(`Query:   "${query}"`);
}
console.log('===============================================\n');

if (useRealApis) {
  console.log('⚠️  WARNING: Using live API calls which may incur costs');
  console.log('             API keys must be provided in environment variables\n');
  
  // Check if API keys are available
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!anthropicApiKey) {
    console.error('❌ ANTHROPIC_API_KEY not found in environment variables');
    console.error('   Please set this variable before running with real APIs');
    process.exit(1);
  }
  
  if (!perplexityApiKey) {
    console.error('❌ PERPLEXITY_API_KEY not found in environment variables');
    console.error('   Please set this variable before running with real APIs');
    process.exit(1);
  }
  
  console.log('✅ API keys verified in environment variables\n');
} else {
  console.log('🔶 Using mock API calls - safe for testing');
  console.log('   Test results will use pre-defined data\n');
}

// Construct test command
let command = `npx vitest run tests/unit/workflows/enhanced-single-query-workflow.vitest.js`;

// Run the test
try {
  console.log(`Executing: ${command}\n`);
  
  // Define environment variables for the test
  const env = {
    ...process.env,
    USE_REAL_APIS: useRealApis ? 'true' : 'false',
    ENABLE_LIVE_API_TESTS: useRealApis ? 'true' : 'false',
    TEST_VARIANT: variant
  };
  
  // Add query to environment if specified
  if (query) {
    env.TEST_QUERY = query;
  }
  
  // Run the command with the environment variables
  execSync(command, { 
    stdio: 'inherit',
    env: env
  });
  
  console.log('\n===============================================');
  console.log(`✅ Single Query Workflow Test completed successfully!`);
  console.log('===============================================\n');
  
  console.log(`Results have been saved to: ${outputDir}`);
  console.log('You can examine these files to see the complete workflow output.\n');
  
} catch (error) {
  console.error('\n===============================================');
  console.error('❌ Single Query Workflow Test failed');
  console.error('===============================================\n');
  
  console.error(`Error: ${error.message}`);
  process.exit(1);
}