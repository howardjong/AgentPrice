/**
 * Deep Research Testing Script
 * 
 * This script focuses specifically on testing the Perplexity deep research 
 * functionality in both mock and live API modes.
 * 
 * Usage:
 *   node tests/manual/testDeepResearch.js [--use-real-apis] [--query="Your query"] [--model=model_name]
 * 
 * Options:
 *   --use-real-apis     Use real APIs instead of mocks (requires API keys)
 *   --query="..."       Custom research query
 *   --model=...         Specific model to use (defaults to llama-3.1-sonar-large-128k-online)
 *   --save-results      Save test results to file
 *   --timeout=60000     Timeout in milliseconds (default: 60000 - 1 minute)
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Default output directory for test results
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'test-results', 'deep-research');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    useRealAPIs: args.includes('--use-real-apis'),
    saveResults: args.includes('--save-results'),
    model: 'llama-3.1-sonar-large-128k-online',
    query: 'What are the most effective pricing strategies for SaaS products in 2025?',
    timeout: 60000 // 1 minute default timeout
  };
  
  // Parse query
  const queryArg = args.find(arg => arg.startsWith('--query='));
  if (queryArg) {
    options.query = queryArg.substring('--query='.length);
  }
  
  // Parse model
  const modelArg = args.find(arg => arg.startsWith('--model='));
  if (modelArg) {
    options.model = modelArg.substring('--model='.length);
  }
  
  // Parse timeout
  const timeoutArg = args.find(arg => arg.startsWith('--timeout='));
  if (timeoutArg) {
    options.timeout = parseInt(timeoutArg.substring('--timeout='.length), 10);
  }
  
  return options;
}

// Save test results to a file
async function saveTestResults(results, outputDir) {
  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `deep-research-results-${timestamp}.json`;
    const outputPath = path.join(outputDir, filename);
    
    // Save results
    await fs.writeFile(
      outputPath,
      JSON.stringify(results, null, 2)
    );
    
    console.log(`Test results saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error saving test results:', error);
    throw error;
  }
}

// Main test function
async function testDeepResearch() {
  console.log('=================================================');
  console.log('  Deep Research Test');
  console.log('=================================================');
  
  try {
    const options = parseArgs();
    const testId = uuidv4();
    
    console.log('Test Options:');
    console.log(JSON.stringify(options, null, 2));
    console.log('=================================================');
    
    let perplexityService;
    
    // Load appropriate service based on test mode
    if (options.useRealAPIs) {
      try {
        // Load environment variables
        const { config } = await import('dotenv');
        config();
        console.log('Environment variables loaded from .env file');
        
        // Check for required API key
        if (!process.env.PERPLEXITY_API_KEY) {
          throw new Error('Missing PERPLEXITY_API_KEY environment variable');
        }
        
        // Import real service
        perplexityService = (await import('../../services/perplexityService.js')).default;
      } catch (error) {
        console.error('Failed to initialize real service:', error);
        process.exit(1);
      }
    } else {
      // Import mock service
      const { mockPerplexityService } = await import('../workflows/single-query-workflow/mock-services.js');
      perplexityService = mockPerplexityService;
    }
    
    // Set up timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Test timed out after ${options.timeout}ms`)), options.timeout);
    });
    
    // Set up research promise
    const researchPromise = (async () => {
      const startTime = Date.now();
      
      console.log(`Starting deep research [${testId}]: "${options.query}"`);
      console.log(`Using model: ${options.model}`);
      
      // Get service health status
      const healthStatus = perplexityService.getHealthStatus 
        ? perplexityService.getHealthStatus() 
        : { status: 'unknown' };
        
      console.log('Service health status:', healthStatus);
      
      // Perform the research
      const researchResults = await perplexityService.performDeepResearch(options.query, {
        model: options.model,
        requestId: testId,
        enableChunking: true
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`Research completed in ${duration}ms`);
      console.log(`Content length: ${researchResults.content.length} characters`);
      console.log(`Sources: ${researchResults.citations?.length || 0}`);
      
      // Format test results
      const results = {
        testId,
        query: options.query,
        model: options.model,
        duration,
        contentLength: researchResults.content.length,
        citations: researchResults.citations || [],
        followUpQuestions: researchResults.followUpQuestions || [],
        mode: options.useRealAPIs ? 'LIVE' : 'MOCK',
        timestamp: new Date().toISOString(),
        success: true
      };
      
      // Save summary of the content (first 1000 chars) for debugging
      results.contentSummary = researchResults.content.substring(0, 1000) + 
        (researchResults.content.length > 1000 ? '...' : '');
      
      // Save full content if requested
      if (options.saveResults) {
        results.content = researchResults.content;
        const resultPath = await saveTestResults(results, DEFAULT_OUTPUT_DIR);
        results.resultPath = resultPath;
      }
      
      return results;
    })();
    
    // Run the test with timeout
    try {
      const results = await Promise.race([researchPromise, timeoutPromise]);
      
      console.log('=================================================');
      console.log('✅ Test completed successfully');
      
      console.log('\nSummary:');
      console.log(`- Mode: ${results.mode}`);
      console.log(`- Query: "${results.query}"`);
      console.log(`- Model: ${results.model}`);
      console.log(`- Content length: ${results.contentLength} characters`);
      console.log(`- Sources: ${results.citations.length}`);
      console.log(`- Duration: ${results.duration}ms`);
      
      if (results.resultPath) {
        console.log(`\nResults saved to: ${results.resultPath}`);
      }
      
      console.log('=================================================');
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      console.log('=================================================');
    }
  } catch (error) {
    console.error('Fatal error during setup:', error);
  }
}

// Run the test
testDeepResearch();