/**
 * Manual Test for Single Query Workflow
 * 
 * This script allows manual testing of the single-query workflow
 * with options to run in either mock mode or live API mode.
 * 
 * Usage:
 *   node tests/manual/test-single-query-workflow.js [--use-real-apis] [--query="Your query here"] [--type=chart_type]
 * 
 * Options:
 *   --use-real-apis    Use real APIs instead of mocks (requires API keys)
 *   --query="..."      Custom research query
 *   --type=...         Chart type (basic_bar, van_westendorp, conjoint)
 *   --save-results     Save test results to file
 */

import { testSingleQueryWorkflow } from '../workflows/single-query-workflow/test-runner.js';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    useRealAPIs: args.includes('--use-real-apis'),
    saveResults: args.includes('--save-results'),
    enableDeepResearch: !args.includes('--no-deep-research')
  };
  
  // Parse query
  const queryArg = args.find(arg => arg.startsWith('--query='));
  if (queryArg) {
    options.query = queryArg.substring('--query='.length);
  }
  
  // Parse chart type
  const typeArg = args.find(arg => arg.startsWith('--type='));
  if (typeArg) {
    options.visualizationType = typeArg.substring('--type='.length);
  }
  
  return options;
}

async function runTest() {
  console.log('=================================================');
  console.log('  Single Query Workflow Test');
  console.log('=================================================');
  
  try {
    const options = parseArgs();
    
    console.log('Test Options:');
    console.log(JSON.stringify(options, null, 2));
    console.log('=================================================');
    
    // Load environment variables if using real APIs
    if (options.useRealAPIs) {
      try {
        const { config } = await import('dotenv');
        config();
        console.log('Environment variables loaded from .env file');
      } catch (error) {
        console.warn('Failed to load .env file:', error.message);
        console.warn('Make sure API keys are available in environment variables or .env file');
      }
    }
    
    // Run the test
    const results = await testSingleQueryWorkflow(options);
    
    console.log('=================================================');
    if (results.success) {
      console.log('✅ Test completed successfully');
      
      // Display summary of results
      console.log('\nSummary:');
      console.log(`- Mode: ${results.testMode}`);
      console.log(`- Query: "${results.query}"`);
      console.log(`- Research length: ${results.researchContent.length} characters`);
      console.log(`- Sources: ${results.sources.length}`);
      console.log(`- Insights: ${results.chartData.insights.length}`);
      
      // Display timing information
      console.log('\nTiming:');
      console.log(`- Research: ${results.metrics.stages.research.duration}ms`);
      console.log(`- Data extraction: ${results.metrics.stages.dataExtraction.duration}ms`);
      console.log(`- Chart generation: ${results.metrics.stages.chartGeneration.duration}ms`);
      console.log(`- Total duration: ${results.metrics.totalDuration}ms`);
      
      // Display result path if saved
      if (results.resultPath) {
        console.log(`\nResults saved to: ${results.resultPath}`);
      }
    } else {
      console.error('❌ Test failed:', results.error);
      if (results.errorDetails) {
        console.error('Error details:', results.errorDetails);
      }
    }
    console.log('=================================================');
  } catch (error) {
    console.error('Fatal error running test:', error);
  }
}

// Run the test
runTest();