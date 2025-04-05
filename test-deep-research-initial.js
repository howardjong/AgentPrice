/**
 * Test for Initial Deep Research Phase
 * 
 * This script tests just the first phase of the deep research workflow
 * to verify the updated API format integration.
 */

import perplexityService from './services/perplexityService.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Main test function
async function runInitialResearchTest() {
  console.log('Testing Initial Deep Research Phase...');
  
  try {
    // First check if the API key is available
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('⚠️ PERPLEXITY_API_KEY environment variable is not set.');
      return;
    }
    
    console.log('✅ PERPLEXITY_API_KEY is available');
    
    // Create output directory
    const outputDir = 'test-results';
    await fs.mkdir(outputDir, { recursive: true });
    
    // The research query - using a simple query for testing
    const query = 'What are three key factors to consider in SaaS pricing?';
    console.log(`Starting initial research for query: "${query}"`);
    
    // Run just the initial research query
    console.log('Calling processWebQuery...');
    const startTime = Date.now();
    
    // Try with the sonar model
    const options = {
      model: 'sonar',
      maxTokens: 1024,
      recencyFilter: 'month'
    };
    
    console.log(`Using model: ${options.model}`);
    const result = await perplexityService.processWebQuery(query, options);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`✅ Initial research completed in ${duration.toFixed(1)} seconds`);
    console.log('\nRaw result structure:');
    console.log(JSON.stringify(result, null, 2).substring(0, 500) + '...');
    console.log('--------------------------------------');
    
    // Extract and display sources if available
    try {
      const sources = perplexityService.extractSources(result);
      console.log(`\nExtracted ${sources.length} sources:`);
      if (sources.length > 0) {
        sources.slice(0, 5).forEach(source => console.log(`- ${source.substring(0, 100)}`));
      }
    } catch (err) {
      console.log('Error extracting sources:', err.message);
    }
    
    // Print a preview of the content
    console.log('\nContent preview:');
    console.log('--------------------------------------');
    try {
      // Try to get content from different possible structures
      let content = '';
      if (result.choices && result.choices[0]?.message?.content) {
        content = result.choices[0].message.content;
      } else if (result.content) {
        content = result.content;
      } else if (typeof result === 'string') {
        content = result;
      } else {
        content = 'Content not found in expected format';
      }
      console.log(content.substring(0, 500) + '...');
    } catch (err) {
      console.log('Error displaying content:', err.message);
    }
    console.log('--------------------------------------');
    
    // Save the results
    const outputFile = path.join(outputDir, `initial-research-${new Date().toISOString().replace(/:/g, '-')}.json`);
    await fs.writeFile(outputFile, JSON.stringify(result, null, 2));
    console.log(`Results saved to ${outputFile}`);
    
  } catch (error) {
    console.error('❌ Error during initial research test:', error);
  }
}

// Run the test
runInitialResearchTest();