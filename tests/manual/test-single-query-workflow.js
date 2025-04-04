#!/usr/bin/env node
/**
 * Manual test script for Single Query Workflow
 * 
 * This script allows running the Single Query Workflow test suite from the command line.
 * It provides more control and output than running the tests through Vitest.
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import test utilities from the workflow test suite
const testWorkflowPath = path.join(__dirname, '..', 'workflows', 'single-query-workflow');
const { runAndValidateTest, loadFixtures } = await import(path.join(testWorkflowPath, 'test-utils.js'));
const { testVariants } = await import(path.join(testWorkflowPath, 'test-config.js'));

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  variant: args[0] || 'basic',
  useRealAPIs: args.includes('--use-real-apis'),
  query: args.find(arg => arg.startsWith('--query='))?.substring('--query='.length),
  saveResults: true
};

async function runTest() {
  try {
    console.log(`
=====================================================
  Single Query Workflow Manual Test Runner
=====================================================
Running test with options:
${JSON.stringify(options, null, 2)}
=====================================================
`);
    
    // Create results directory if it doesn't exist
    const resultsDir = path.join(process.cwd(), 'test-results', 'single-query-workflow');
    await fs.mkdir(resultsDir, { recursive: true }).catch(() => {});
    
    // Load fixtures
    await loadFixtures();
    
    // Get variant info
    const variantInfo = testVariants[options.variant] || 
                       { name: 'Custom Test', description: 'Custom test configuration' };
    
    console.log(`Running test variant: ${variantInfo.name}`);
    console.log(variantInfo.description);
    console.log('');
    
    // Run the test
    console.log('Starting test...');
    const startTime = Date.now();
    
    const results = await runAndValidateTest(options.variant, {
      query: options.query,
      useRealAPIs: options.useRealAPIs,
      saveResults: options.saveResults
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Print results
    console.log('\nTest completed in', duration, 'ms');
    console.log('Success:', results.success);
    
    if (!results.success) {
      console.error('Error:', results.error);
      process.exit(1);
    }
    
    // Print workflow stages timing
    console.log('\nWorkflow Stages:');
    Object.entries(results.stageTiming).forEach(([stage, timing]) => {
      const stageDuration = timing.end - timing.start;
      console.log(`- ${stage}: ${stageDuration}ms`);
    });
    
    // Print validation results
    console.log('\nValidation Results:');
    console.log(`Valid: ${results.validation.valid}`);
    
    if (results.validation.errors.length > 0) {
      console.log('Errors:');
      results.validation.errors.forEach(error => console.log(`- ${error}`));
    }
    
    if (results.validation.warnings.length > 0) {
      console.log('Warnings:');
      results.validation.warnings.forEach(warning => console.log(`- ${warning}`));
    }
    
    // Print output summary
    console.log('\nOutput Summary:');
    console.log(`- Query: "${options.query || results.query}"`);
    console.log(`- Clarified Query: "${results.clarifiedQuery}"`);
    console.log(`- Research Content: ${results.researchContent.length} characters`);
    console.log(`- Sources: ${results.sources.length}`);
    console.log(`- Chart Type: ${results.plotlyConfig.data[0].type}`);
    
    // Save results to file
    console.log('\nResults saved to:', path.join(resultsDir, `${options.variant || 'custom'}-manual-test.json`));
    
    return results;
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

// Run the test
await runTest();