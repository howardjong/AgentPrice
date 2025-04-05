
/**
 * Simple Perplexity Deep Research Test
 * 
 * A simplified test focusing solely on the Perplexity deep research functionality
 * This tests the core polling functionality without additional workflow steps
 */

const perplexityService = require('../../services/perplexityService');
const fs = require('fs').promises;
const path = require('path');

// Output directory
const OUTPUT_DIR = path.join(process.cwd(), 'test-results', 'deep-research');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const query = args.find(arg => arg.startsWith('--query='))?.substring('--query='.length) 
    || "What are the latest pricing strategies for SaaS products in 2025?";
  
  const saveResults = !args.includes('--no-save');
  const verbose = args.includes('--verbose');
  
  return { query, saveResults, verbose };
}

/**
 * Run the test
 */
async function runTest() {
  const options = parseArgs();
  console.log('=================================================');
  console.log('    SIMPLE PERPLEXITY DEEP RESEARCH TEST');
  console.log('=================================================');
  console.log(`Query: "${options.query}"`);
  
  try {
    // Verify API key
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('ERROR: Missing PERPLEXITY_API_KEY environment variable');
      process.exit(1);
    }
    
    // Get service status
    const status = perplexityService.getStatus();
    console.log('Service status:', status);
    
    if (status.status !== 'connected') {
      console.error('ERROR: Perplexity service is not connected properly');
      process.exit(1);
    }
    
    // Start timer
    const startTime = Date.now();
    console.log(`\n[${new Date().toISOString()}] Starting deep research...`);
    
    // Run the deep research
    const result = await perplexityService.performDeepResearch(
      options.query,
      {
        enableChunking: true,
        wantsDeepResearch: true,
        model: 'sonar-deep-research',
        verbose: options.verbose
      }
    );
    
    // Calculate duration
    const duration = Date.now() - startTime;
    
    // Print results
    console.log(`\n[${new Date().toISOString()}] Research completed in ${(duration/1000).toFixed(1)} seconds`);
    console.log(`Model requested: sonar-deep-research`);
    console.log(`Model used: ${result.modelUsed}`);
    console.log(`Content length: ${result.content.length} characters`);
    console.log(`Citations: ${result.citations.length}`);
    
    if (result.followUpQuestions && result.followUpQuestions.length > 0) {
      console.log('\nFollow-up questions:');
      result.followUpQuestions.forEach((q, i) => console.log(`  ${i+1}. ${q}`));
    }
    
    // Print content preview
    console.log('\nContent preview:');
    console.log('-'.repeat(50));
    console.log(result.content.substring(0, 500) + '...');
    console.log('-'.repeat(50));
    
    // Save results if requested
    if (options.saveResults) {
      // Create output directory if it doesn't exist
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filename = `perplexity-deep-research-${timestamp}.json`;
      const outputPath = path.join(OUTPUT_DIR, filename);
      
      // Save results
      await fs.writeFile(
        outputPath,
        JSON.stringify({
          query: options.query,
          model: {
            requested: 'sonar-deep-research',
            used: result.modelUsed
          },
          content: result.content,
          citations: result.citations,
          followUpQuestions: result.followUpQuestions || [],
          duration,
          timestamp: new Date().toISOString()
        }, null, 2)
      );
      
      console.log(`\nResults saved to: ${outputPath}`);
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
runTest();
