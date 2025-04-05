/**
 * Enhanced Perplexity API Test
 * 
 * This script provides a comprehensive test for the Perplexity API,
 * with enhanced model tracking and error handling.
 * 
 * Features:
 * - Tests both standard sonar and deep research modes
 * - Enforces rate limiting
 * - Provides detailed output with model validation
 * - Enhanced error handling
 */

import perplexityService from '../../services/perplexityService.js';
import { v4 as uuidv4 } from 'uuid';

// Rate limit configuration
const REQUESTS_PER_MINUTE = 5;
const MINUTE_IN_MS = 60 * 1000;
const DELAY_BETWEEN_REQUESTS = Math.ceil(MINUTE_IN_MS / REQUESTS_PER_MINUTE);
const TIMEOUT_MS = 120 * 1000; // 2 minutes timeout

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Test queries - vary complexity
const TEST_QUERIES = [
  {
    name: 'Basic Quantum Computing',
    query: 'What is quantum computing?',
    useDeepResearch: false,
    expectedModel: 'sonar',
    timeout: 30000
  },
  {
    name: 'Latest AI Developments',
    query: 'What are the recent advances in artificial intelligence?',
    useDeepResearch: false, 
    expectedModel: 'sonar',
    timeout: 30000
  }
];

// Optional deep research test - only run if specifically requested due to longer duration
const DEEP_RESEARCH_TEST = {
  name: 'Quantum Computing Breakthroughs',
  query: 'What are the latest breakthroughs in quantum computing research?',
  useDeepResearch: true,
  expectedModel: 'sonar-deep-research',
  timeout: 180000
};

/**
 * Run a single Perplexity API test
 */
async function runSingleTest(test) {
  const testId = uuidv4().substring(0, 8);
  console.log(`\n🧪 TESTING: ${test.name} [${testId}]`);
  console.log(`Query: "${test.query}"`);
  console.log(`Expected model: ${test.expectedModel}`);
  console.log('-----------------------------------------------------');
  
  const startTime = Date.now();
  
  try {
    // Set a timeout promise to handle hanging requests
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Test timed out after ${test.timeout/1000} seconds`)), test.timeout)
    );
    
    // Define the actual test promise
    const testPromise = test.useDeepResearch
      ? perplexityService.conductDeepResearch(test.query, {
          model: test.expectedModel,
          fullResponse: true,
          maxTokens: 1000
        })
      : perplexityService.processWebQuery(test.query, {
          model: test.expectedModel,
          fullResponse: true,
          maxTokens: 1000
        });
    
    // Race the test against the timeout
    const results = await Promise.race([testPromise, timeoutPromise]);
    
    // Calculate duration
    const duration = Date.now() - startTime;
    console.log(`✅ Test completed in ${(duration / 1000).toFixed(2)} seconds`);
    
    // Display model information
    console.log('\n📊 MODEL INFORMATION:');
    console.log(`Requested model: ${test.expectedModel}`);
    console.log(`Actual model: ${results.model}`);
    console.log(`Model validation: ${results.model === test.expectedModel ? '✓ MATCH' : '❌ MISMATCH'}`);
    
    // Show content summary
    console.log('\n📝 CONTENT SUMMARY:');
    console.log(`Content length: ${results.content.length} characters`);
    
    if (results.citations && results.citations.length > 0) {
      console.log(`Citations: ${results.citations.length}`);
      console.log('\n📚 SAMPLE CITATIONS:');
      results.citations.slice(0, 3).forEach((citation, i) => {
        console.log(`${i+1}. ${citation}`);
      });
    }
    
    // Show token usage if available
    if (results.apiResponse && results.apiResponse.usage) {
      console.log('\n📈 TOKEN USAGE:');
      console.log(`Prompt tokens: ${results.apiResponse.usage.prompt_tokens}`);
      console.log(`Completion tokens: ${results.apiResponse.usage.completion_tokens}`);
      console.log(`Total tokens: ${results.apiResponse.usage.total_tokens}`);
    }
    
    return {
      success: true,
      query: test.query,
      model: {
        expected: test.expectedModel,
        actual: results.model,
        match: results.model === test.expectedModel
      },
      duration: duration,
      contentLength: results.content.length,
      citationsCount: results.citations ? results.citations.length : 0
    };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    if (error.stack) {
      console.error('Error stack:', error.stack);
    }
    
    return {
      success: false,
      query: test.query,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Run all Perplexity API tests
 */
async function runAllTests() {
  console.log('🔍 STARTING ENHANCED PERPLEXITY API TESTS');
  console.log('===========================================');
  
  const results = [];
  
  // First run regular tests
  for (const test of TEST_QUERIES) {
    const result = await runSingleTest(test);
    results.push(result);
    
    // Add delay between tests to respect rate limits
    if (results.length < TEST_QUERIES.length) {
      const delayMs = Math.max(1000, Math.min(5000, DELAY_BETWEEN_REQUESTS / 2));
      console.log(`\nWaiting ${delayMs}ms before next test to respect rate limits...`);
      await delay(delayMs);
    }
  }
  
  // Optionally run deep research test if enabled
  // It's skipped by default to avoid long test times
  if (process.env.RUN_DEEP_RESEARCH_TEST === 'true') {
    console.log('\n⚠️ Running deep research test (this may take several minutes)...');
    const deepResult = await runSingleTest(DEEP_RESEARCH_TEST);
    results.push(deepResult);
  } else {
    console.log('\n⏩ Skipping deep research test (enable with RUN_DEEP_RESEARCH_TEST=true)');
  }
  
  // Print summary
  console.log('\n===========================================');
  console.log('📋 TEST SUMMARY:');
  
  let successCount = 0;
  let failCount = 0;
  
  results.forEach((result, i) => {
    if (result.success) {
      successCount++;
      console.log(`✅ Test #${i+1}: ${TEST_QUERIES[i].name} - Success`);
      if (result.model) {
        console.log(`   Model: ${result.model.match ? 'Correctly used ' + result.model.actual : 'Used ' + result.model.actual + ' instead of ' + result.model.expected}`);
      }
    } else {
      failCount++;
      console.log(`❌ Test #${i+1}: ${TEST_QUERIES[i].name} - Failed: ${result.error}`);
    }
  });
  
  console.log('\n🏁 FINAL RESULTS:');
  console.log(`Tests passed: ${successCount}/${results.length}`);
  console.log(`Tests failed: ${failCount}/${results.length}`);
  
  return {
    passCount: successCount,
    failCount: failCount,
    total: results.length,
    details: results
  };
}

// Only run tests when file is executed directly
if (process.argv[1] === import.meta.url) {
  runAllTests()
    .then(summary => {
      if (summary.failCount > 0) {
        console.log('\n❌ Some tests failed!');
        process.exit(1);
      } else {
        console.log('\n✅ All tests passed!');
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('Fatal error running tests:', error);
      process.exit(1);
    });
}

export { runSingleTest, runAllTests };