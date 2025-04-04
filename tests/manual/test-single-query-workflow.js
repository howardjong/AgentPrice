
/**
 * Manual Test for Single Query Workflow
 * 
 * This script allows manual testing of the single-query workflow
 * with options to run in either mock mode or live API mode.
 * 
 * Usage:
 *   node tests/manual/test-single-query-workflow.js [--variant=basic] [--use-real-apis] [--query="Your query"]
 * 
 * Options:
 *   --variant=NAME     Test variant to run (basic, performance, reliability, noDeepResearch, charts)
 *   --use-real-apis    Use real APIs instead of mocks (requires API keys)
 *   --query="..."      Custom research query
 *   --type=...         Chart type (basic_bar, van_westendorp, conjoint)
 *   --save-results     Save test results to file
 *   --log-level=LEVEL  Set logging level (debug, info, warn, error)
 */

const { runWorkflowTest } = require('../workflows/single-query-workflow/test-runner.js');
const { TEST_VARIANTS } = require('../workflows/single-query-workflow/test-config.js');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    useRealAPIs: args.includes('--use-real-apis'),
    saveResults: args.includes('--save-results'),
    enableDeepResearch: !args.includes('--no-deep-research')
  };
  
  // Parse variant
  const variantArg = args.find(arg => arg.startsWith('--variant='));
  if (variantArg) {
    options.variant = variantArg.substring('--variant='.length);
  }
  
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
  
  // Parse log level
  const logLevelArg = args.find(arg => arg.startsWith('--log-level='));
  if (logLevelArg) {
    options.logLevel = logLevelArg.substring('--log-level='.length);
  }
  
  return options;
}

async function runTest() {
  console.log('=================================================');
  console.log('  Single Query Workflow Test');
  console.log('=================================================');
  
  try {
    const options = parseArgs();
    const variant = options.variant || 'basic';
    
    // Display available variants if requested
    if (variant === 'list') {
      console.log('\nAvailable test variants:');
      Object.entries(TEST_VARIANTS).forEach(([key, data]) => {
        console.log(`- ${key}: ${data.name}`);
        console.log(`  ${data.description}`);
      });
      console.log('=================================================');
      return;
    }
    
    console.log(`Test Variant: ${variant} (${TEST_VARIANTS[variant]?.name || 'Custom Test'})`);
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
    
    // Run the test using the enhanced framework
    const results = await runWorkflowTest(variant, options);
    
    console.log('=================================================');
    if (results.success) {
      console.log('✅ Test completed successfully');
      
      // Display summary of results
      console.log('\nSummary:');
      console.log(`- Mode: ${results.testMode}`);
      console.log(`- Variant: ${results.variant} (${results.variantName})`);
      console.log(`- Query: "${results.query}"`);
      console.log(`- Research length: ${results.researchContent.length} characters`);
      console.log(`- Sources: ${results.sources?.length || 0}`);
      console.log(`- Insights: ${results.chartData.insights.length}`);
      
      // Display timing information
      console.log('\nTiming:');
      Object.entries(results.metrics.stages).forEach(([stage, data]) => {
        console.log(`- ${stage}: ${data.duration.toFixed(2)}ms`);
      });
      console.log(`- Total duration: ${results.metrics.test.duration.toFixed(2)}ms`);
      
      // Display API call summary if available
      if (results.metrics.apiCalls) {
        console.log('\nAPI Calls:');
        Object.entries(results.metrics.apiCalls).forEach(([service, operations]) => {
          console.log(`- ${service}:`);
          Object.entries(operations).forEach(([op, data]) => {
            console.log(`  - ${op}: ${data.count} calls, ${data.totalDuration.toFixed(2)}ms total`);
          });
        });
      }
      
      // Display result path if saved
      if (results.resultPath) {
        console.log(`\nResults saved to: ${results.resultPath}`);
      }
      
      // Display metrics path if saved
      if (results.metricsPath) {
        console.log(`Metrics saved to: ${results.metricsPath}`);
      }
    } else {
      console.error('❌ Test failed:', results.error);
      if (results.errorDetails) {
        console.error('Error details:', results.errorDetails);
      }
      
      // Show metrics even on failure
      if (results.metrics?.errors?.length > 0) {
        console.log('\nErrors encountered:');
        results.metrics.errors.forEach((err, i) => {
          console.log(`[${i+1}] ${err.stage}: ${err.message}`);
        });
      }
    }
    console.log('=================================================');
  } catch (error) {
    console.error('Fatal error running test:', error);
  }
}

// Run the test
runTest();
