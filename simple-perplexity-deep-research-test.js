/**
 * Simple Perplexity Deep Research Test
 * 
 * This script tests the conductDeepResearch function directly without using Redis or job queues.
 */

import perplexityService from './services/perplexityService.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Main test function
async function runTest() {
  console.log('Testing Perplexity Deep Research...');
  
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
    
    // The research query - using a simpler query for testing
    const query = 'What are three key factors to consider in SaaS pricing?';
    console.log(`Starting deep research for query: "${query}"`);
    
    // Run the deep research
    console.log('Calling conductDeepResearch...');
    const startTime = Date.now();
    
    // Try with the regular sonar model
    console.log('Using standard sonar model');
    const results = await perplexityService.conductDeepResearch(query, {
      model: 'sonar',
      maxTokens: 1024,  // Reduced token count for faster testing
      recencyFilter: 'month'
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`✅ Deep research completed in ${duration.toFixed(1)} seconds`);
    console.log(`Generated ${results.followUpQuestions?.length || 0} follow-up questions`);
    console.log(`Found ${results.citations?.length || 0} citations`);
    
    // Print a preview of the content
    console.log('\nContent preview:');
    console.log('--------------------------------------');
    console.log(results.content.substring(0, 500) + '...');
    console.log('--------------------------------------');
    
    // Save the results
    const outputFile = path.join(outputDir, `deep-research-results-${new Date().toISOString()}.json`);
    await fs.writeFile(outputFile, JSON.stringify(results, null, 2));
    console.log(`Results saved to ${outputFile}`);
    
  } catch (error) {
    console.error('❌ Error during deep research test:', error);
  }
}

// Run the test
runTest();