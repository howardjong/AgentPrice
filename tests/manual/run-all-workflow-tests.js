
/**
 * Run All Workflow Tests
 * 
 * This script runs all defined workflow test variants to provide
 * comprehensive coverage of the single-query workflow.
 * 
 * Usage:
 *   node tests/manual/run-all-workflow-tests.js [--use-real-apis]
 */

import { runWorkflowTest } from '../workflows/single-query-workflow/test-runner.js';
import { TEST_VARIANTS } from '../workflows/single-query-workflow/test-config.js';

// Parse command line arguments
const args = process.argv.slice(2);
const useRealAPIs = args.includes('--use-real-apis');
const saveResults = true; // Always save results for batch runs

async function runAllTests() {
  console.log('=================================================');
  console.log('  Running All Single Query Workflow Tests');
  console.log(`  Mode: ${useRealAPIs ? 'REAL APIs' : 'MOCK APIs'}`);
  console.log('=================================================');
  
  const startTime = Date.now();
  const results = {};
  const summary = {
    total: Object.keys(TEST_VARIANTS).length,
    passed: 0,
    failed: 0,
    skipped: 0
  };
  
  // Load environment variables if using real APIs
  if (useRealAPIs) {
    try {
      const { config } = await import('dotenv');
      config();
      console.log('Environment variables loaded from .env file');
    } catch (error) {
      console.warn('Failed to load .env file:', error.message);
    }
  }
  
  // Run each test variant
  for (const [variantName, variant] of Object.entries(TEST_VARIANTS)) {
    console.log(`\n-------------------------------------------------`);
    console.log(`Running test: ${variantName} (${variant.name})`);
    console.log(`${variant.description}`);
    
    try {
      const testResult = await runWorkflowTest(variantName, {
        useRealAPIs,
        saveResults,
        // Use a different query for each test to avoid rate limiting issues
        query: `What are the best practices for ${variantName} in software development?`
      });
      
      // Store and summarize results
      results[variantName] = testResult;
      
      if (testResult.success) {
        console.log(`✅ ${variantName}: Passed (${Math.round(testResult.metrics.test.duration)}ms)`);
        summary.passed++;
      } else {
        console.log(`❌ ${variantName}: Failed - ${testResult.error}`);
        summary.failed++;
      }
    } catch (error) {
      console.error(`❌ ${variantName}: Exception - ${error.message}`);
      results[variantName] = { success: false, error: error.message };
      summary.failed++;
    }
  }
  
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  console.log('\n=================================================');
  console.log('  Test Suite Summary');
  console.log('=================================================');
  console.log(`Total tests:    ${summary.total}`);
  console.log(`Passed:         ${summary.passed}`);
  console.log(`Failed:         ${summary.failed}`);
  console.log(`Skipped:        ${summary.skipped}`);
  console.log(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log('=================================================');
  
  // List failed tests if any
  if (summary.failed > 0) {
    console.log('\nFailed tests:');
    Object.entries(results)
      .filter(([_, result]) => !result.success)
      .forEach(([variant, result]) => {
        console.log(`- ${variant}: ${result.error}`);
      });
  }
}

// Run all tests
runAllTests().catch(console.error);
/**
 * Run All Workflow Tests
 * 
 * This script runs all the defined workflow test variants
 * in mock mode to verify functionality.
 */

const { runWorkflowTest } = require('../workflows/single-query-workflow/test-runner');
const { TEST_VARIANTS } = require('../workflows/single-query-workflow/test-config');

async function runAllTests() {
  console.log('======================================================');
  console.log('  Running All Single-Query Workflow Test Variants');
  console.log('======================================================');
  
  // Get list of all variants
  const variants = Object.keys(TEST_VARIANTS);
  const results = [];
  
  // Run each variant
  for (const variant of variants) {
    console.log(`\n[${results.length + 1}/${variants.length}] Running variant: ${variant}`);
    console.log('---------------------------------------------------------');
    
    const startTime = Date.now();
    
    try {
      // Run the test in mock mode
      const result = await runWorkflowTest(variant, {
        saveResults: true,
        saveFullResults: true
      });
      
      const duration = Date.now() - startTime;
      
      // Store basic results
      results.push({
        variant,
        success: result.success,
        duration,
        sources: result.sources?.length || 0,
        researchLength: result.researchContent?.length || 0,
        insights: result.chartData?.insights?.length || 0,
        error: result.error
      });
      
      // Output basic information
      console.log(`Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
      console.log(`Duration: ${duration}ms`);
      
      if (result.resultPath) {
        console.log(`Results saved to: ${result.resultPath}`);
      }
      
      if (result.metricsPath) {
        console.log(`Metrics saved to: ${result.metricsPath}`);
      }
    } catch (error) {
      console.error(`Error running variant ${variant}:`, error);
      results.push({
        variant,
        success: false,
        error: error.message
      });
    }
  }
  
  // Display summary
  console.log('\n======================================================');
  console.log('                   SUMMARY');
  console.log('======================================================');
  console.log(`Total variants: ${variants.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  
  console.log('\nResults by variant:');
  console.table(results);
}

// Run the tests
runAllTests().catch(console.error);
