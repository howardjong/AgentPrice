#!/usr/bin/env node

/**
 * Script to run the single query workflow test with either mock or live APIs
 * 
 * Usage:
 *   node scripts/run-query-workflow-test.js [--live]
 * 
 * Options:
 *   --live   Use live external APIs instead of mocks (requires API keys)
 *   --help   Show help information
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line args
const args = process.argv.slice(2);
const useLiveApis = args.includes('--live');
const showHelp = args.includes('--help');

// Show help if requested
if (showHelp) {
  console.log(`
Single Query Workflow Test Runner

This script runs the single query workflow test to verify the end-to-end workflow
of generating clarifying questions, performing research, and creating visualizations.

Usage:
  node scripts/run-query-workflow-test.js [--live]

Options:
  --live   Use live external APIs instead of mocks (requires API keys)
  --help   Show this help information

Examples:
  # Run with mocked API calls (default, safe option):
  node scripts/run-query-workflow-test.js

  # Run with live API calls (requires API keys, may incur costs):
  node scripts/run-query-workflow-test.js --live

Notes:
  - Results will be saved to the tests/output directory
  - Running with --live may incur costs for API usage
  - Make sure your API keys are set in your environment variables
    before running with --live
  `);
  process.exit(0);
}

// Check for required API keys if using live mode
if (useLiveApis) {
  const requiredKeys = [
    'ANTHROPIC_API_KEY',
    'PERPLEXITY_API_KEY'
  ];
  
  const missingKeys = requiredKeys.filter(key => !process.env[key]);
  
  if (missingKeys.length > 0) {
    console.error('\nError: Missing required API keys for live mode:');
    missingKeys.forEach(key => console.error(`  - ${key}`));
    console.error('\nPlease set these environment variables before running with --live');
    console.error('You can run without --live to use mocked API calls instead.\n');
    process.exit(1);
  }
}

// Ensure output directory exists
const outputDir = path.join(process.cwd(), 'tests', 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Set up environment for the test
process.env.USE_LIVE_APIS = useLiveApis ? 'true' : 'false';

// Display info about the test run
console.log('\n===============================================');
console.log(`Running Single Query Workflow Test with ${useLiveApis ? 'LIVE' : 'MOCK'} APIs`);
console.log('===============================================\n');

if (useLiveApis) {
  console.log('⚠️  WARNING: Using live API calls which may incur costs');
  console.log('             Test results will reflect real data\n');
} else {
  console.log('🔶 Using mock API calls - safe for testing');
  console.log('   Test results will use pre-defined data\n');
}

// Run the test
try {
  const command = `npx vitest run tests/vitest/workflows/single-query-workflow.vitest.js ${useLiveApis ? '--no-threads' : ''}`;
  console.log(`Executing: ${command}\n`);
  
  // Run the command and display output
  execSync(command, { 
    stdio: 'inherit',
    env: {
      ...process.env,
      USE_LIVE_APIS: useLiveApis ? 'true' : 'false'
    }
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