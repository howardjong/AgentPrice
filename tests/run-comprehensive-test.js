/**
 * Comprehensive Testing Suite for Multi-LLM Research System
 * 
 * This script orchestrates multiple test strategies to provide a complete
 * verification of the system's functionality. It includes:
 * 
 * 1. SearchUtils tests - Verifies text search functionality
 * 2. Perplexity API tests - Tests basic and advanced search capabilities
 * 3. Model information extraction - Verifies correct model data tracking
 * 
 * Usage:
 *   node tests/run-comprehensive-test.js [options]
 * 
 * Options:
 *   --live-apis       Use real API calls (requires API keys)
 *   --deep-research   Run deep research tests (time-intensive)
 *   --verbose         Show detailed output
 */

import { runTests as runSearchUtilsTests } from './fix-searchutils-test.js';
import { runAllTests as runPerplexityTests } from './manual/enhanced-perplexity-test.js';
import fs from 'fs/promises';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  liveApis: args.includes('--live-apis'),
  deepResearch: args.includes('--deep-research'),
  verbose: args.includes('--verbose')
};

// Configure environment based on options
if (options.liveApis) {
  process.env.ENABLE_LIVE_API_TESTS = 'true';
}

if (options.deepResearch) {
  process.env.RUN_DEEP_RESEARCH_TEST = 'true';
}

// Banner and test intro
function printBanner() {
  console.log('\n========================================================');
  console.log('        MULTI-LLM RESEARCH SYSTEM TEST SUITE');
  console.log('========================================================\n');
  console.log('Mode:', options.liveApis ? 'LIVE API CALLS' : 'MOCK RESPONSES');
  console.log('Deep Research:', options.deepResearch ? 'ENABLED' : 'DISABLED');
  console.log('Verbosity:', options.verbose ? 'DETAILED' : 'STANDARD');
  console.log('--------------------------------------------------------\n');
}

// Results tracking
const results = {
  searchUtils: { success: false, details: null },
  perplexity: { success: false, details: null },
  timestamp: new Date().toISOString()
};

// Run all tests sequentially
async function runAllTests() {
  printBanner();
  
  try {
    // 1. Search Utils Tests
    console.log('🧪 RUNNING SEARCH UTILS TESTS...');
    const searchUtilsSuccess = runSearchUtilsTests();
    results.searchUtils.success = searchUtilsSuccess;
    
    // 2. Perplexity API Tests
    console.log('\n🧪 RUNNING PERPLEXITY API TESTS...');
    const perplexityResults = await runPerplexityTests();
    results.perplexity.success = perplexityResults.passCount === perplexityResults.total;
    results.perplexity.details = perplexityResults;
    
    // Save test results
    await saveTestResults();
    
    // Print summary
    printSummary();
    
    // Return overall success status
    return results.searchUtils.success && results.perplexity.success;
  } catch (error) {
    console.error('❌ TEST SUITE ERROR:', error);
    return false;
  }
}

// Save test results to file
async function saveTestResults() {
  try {
    // Create test-results directory if it doesn't exist
    const resultsDir = './test-results';
    await fs.mkdir(resultsDir, { recursive: true });
    
    // Save results to timestamped file
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `test-results-${timestamp}.json`;
    await fs.writeFile(
      path.join(resultsDir, filename),
      JSON.stringify(results, null, 2)
    );
    
    console.log(`\n📋 Test results saved to ${path.join(resultsDir, filename)}`);
  } catch (error) {
    console.error('Error saving test results:', error);
  }
}

// Print test summary
function printSummary() {
  console.log('\n========================================================');
  console.log('                    TEST SUMMARY');
  console.log('========================================================');
  console.log('Search Utils Tests:', results.searchUtils.success ? '✅ PASSED' : '❌ FAILED');
  
  if (results.perplexity.details) {
    const perplexityTests = results.perplexity.details;
    console.log('Perplexity API Tests:', perplexityTests.passCount === perplexityTests.total ? '✅ PASSED' : '❌ FAILED');
    console.log(`- Tests passed: ${perplexityTests.passCount}/${perplexityTests.total}`);
  } else {
    console.log('Perplexity API Tests: ❌ ERROR (no results)');
  }
  
  console.log('\nOVERALL RESULT:', 
    results.searchUtils.success && results.perplexity.success ? '✅ PASSED' : '❌ FAILED'
  );
  console.log('========================================================\n');
}

// Run tests if executed directly
if (process.argv[1] === import.meta.url) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error running test suite:', error);
      process.exit(1);
    });
}

export { runAllTests };