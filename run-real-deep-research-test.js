/**
 * Run Deep Research Test with Real APIs
 * 
 * This script runs the single-query workflow test with real APIs
 * for deep research operations using the Perplexity API.
 * 
 * NOTE: We use the runTest function directly instead of runWorkflowTest
 * to avoid vitest dependencies when running outside the test environment.
 */

// Use ESM imports since this project is set up with "type": "module"
import * as path from 'path';
import { promises as fs } from 'fs';

// Set environment variables for real API testing
process.env.USE_REAL_APIS = 'true';
process.env.ENABLE_LIVE_API_TESTS = 'true';

// The query to use for deep research
const query = 'What are the latest developments in quantum computing and their potential applications in cryptography?';

// Import the test runner package dynamically to avoid vitest dependency issues
async function importTestRunner() {
  // Need to use dynamic import for ESM modules
  const { runTest } = await import('./tests/workflows/single-query-workflow/test-runner.js');
  return { runTest };
}

async function main() {
  console.log('Starting Deep Research Test with Real APIs');
  console.log('Query:', query);
  console.log('Environment Variables:');
  console.log('  USE_REAL_APIS:', process.env.USE_REAL_APIS);
  console.log('  ENABLE_LIVE_API_TESTS:', process.env.ENABLE_LIVE_API_TESTS);
  console.log('  ANTHROPIC_API_KEY available:', !!process.env.ANTHROPIC_API_KEY);
  console.log('  PERPLEXITY_API_KEY available:', !!process.env.PERPLEXITY_API_KEY);
  
  try {
    // Import the test runner
    const { runTest } = await importTestRunner();
    
    // Run the test with real APIs and deep research
    const results = await runTest({
      variant: 'deep-research',
      query,
      useRealAPIs: true,
      enableDeepResearch: true,
      timeout: 300000, // 5 minute timeout
      saveResults: true,
      perplexityOptions: {
        model: 'sonar-deep-research', // Explicitly use deep research model
        timeout: 300000, // 5 minute timeout
        maxTokens: 4096 // Use maximum tokens for comprehensive research
      }
    });
    
    console.log('\n======= TEST RESULTS =======');
    console.log('Success:', results.success);
    console.log('Query:', results.query);
    console.log('Clarified Query:', results.clarifiedQuery);
    console.log('Model Used:', results.modelUsed);
    console.log('Sources Count:', results?.sources?.length || 0);
    console.log('Content Length:', results?.researchContent?.length || 0);
    
    if (results.chartData) {
      console.log('Chart Type:', results.chartData.chartType);
    }
    
    console.log('Test Results Saved To:', results.resultPath);
    
    if (results.success) {
      console.log('\n✅ TEST COMPLETED SUCCESSFULLY!');
    } else {
      console.log('\n❌ TEST FAILED!');
      console.log('Error:', results.error);
    }
    
    return results;
  } catch (error) {
    console.error('Error running test:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the main function
main().then(results => {
  console.log('Script execution completed.');
  process.exit(results.success ? 0 : 1);
}).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});