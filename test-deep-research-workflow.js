/**
 * Test for Deep Research Workflow
 * 
 * This script tests the entire deep research workflow including:
 * 1. Initial query
 * 2. Follow-up question generation
 * 3. Follow-up research
 * 4. Synthesis
 * 
 * Note: This is a longer-running test that may take several minutes to complete.
 */

import perplexityService from './services/perplexityService.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Main test function
async function runDeepResearchTest() {
  console.log('Testing Deep Research Workflow...');
  const testStartTime = Date.now();
  
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
    
    // The research query - use a more complex query for deep research
    const query = 'What are the most effective pricing strategies for SaaS products with different customer segments?';
    console.log(`Starting deep research for query: "${query}"`);
    
    // Run the deep research workflow
    const options = {
      model: 'sonar',
      maxTokens: 2048,
      followUpLimit: 2,  // Limit follow-up questions to 2 for test purposes
      requestId: 'test-' + Date.now().toString()
    };
    
    const startTime = Date.now();
    console.log(`Using model: ${options.model}`);
    console.log('Starting deep research workflow...');
    
    // Begin the deep research process
    const result = await perplexityService.conductDeepResearch(query, options);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`✅ Deep research completed in ${duration.toFixed(1)} seconds`);
    
    // Display basic information about the research
    console.log(`\nResearch summary:`);
    console.log(`- Follow-up questions generated: ${result.followUpQuestions.length}`);
    console.log(`- Sources found: ${result.citations.length}`);
    console.log(`- Content length: ${result.content.length} characters`);
    
    // Show the follow-up questions that were generated
    console.log('\nFollow-up questions:');
    result.followUpQuestions.forEach((q, i) => console.log(`${i+1}. ${q}`));
    
    // Show a sample of the sources
    console.log('\nSample sources:');
    result.citations.slice(0, 5).forEach(source => console.log(`- ${source.substring(0, 100)}`));
    
    // Show a preview of the content
    console.log('\nContent preview:');
    console.log('--------------------------------------');
    console.log(result.content.substring(0, 500) + '...');
    console.log('--------------------------------------');
    
    // Save the results
    const outputFile = path.join(outputDir, `deep-research-${new Date().toISOString().replace(/:/g, '-')}.json`);
    await fs.writeFile(outputFile, JSON.stringify(result, null, 2));
    console.log(`Results saved to ${outputFile}`);
    
    // Report total test time
    const testEndTime = Date.now();
    const testDuration = (testEndTime - testStartTime) / 1000;
    console.log(`\nTotal test execution time: ${testDuration.toFixed(1)} seconds`);
    
  } catch (error) {
    console.error('❌ Error during deep research test:', error);
  }
}

// Run the test
runDeepResearchTest();