/**
 * Simple Perplexity API Test
 * 
 * This script runs a simple test of the Perplexity API integration
 * with rate limiting to avoid timeouts. It tests the updated API
 * response format handling.
 */

import perplexityService from './services/perplexityService.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Rate limit configuration
const REQUESTS_PER_MINUTE = 5;
const MINUTE_IN_MS = 60 * 1000;
const DELAY_BETWEEN_REQUESTS = Math.ceil(MINUTE_IN_MS / REQUESTS_PER_MINUTE);

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Main test function
async function testPerplexityAPI() {
  console.log('=== Testing Updated Perplexity API Integration ===');
  
  try {
    // Check API key
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('⚠️ PERPLEXITY_API_KEY environment variable is not set.');
      return;
    }
    
    console.log('✅ PERPLEXITY_API_KEY is available');
    
    // Check service status
    const status = perplexityService.getStatus();
    console.log('Service status:', status);
    
    // Create output directory
    const outputDir = 'test-results';
    await fs.mkdir(outputDir, { recursive: true });
    
    // Test queries
    const testQueries = [
      {
        name: 'Simple Query',
        query: 'What are three key factors to consider in SaaS pricing?',
        options: { model: 'sonar', maxTokens: 1024 }
      },
      {
        name: 'Deep Research Query',
        query: 'How should SaaS pricing differ across different market segments?',
        options: { 
          jobId: uuidv4(),
          wantsDeepResearch: true, 
          maxTokens: 2048,
          systemPrompt: 'Provide a comprehensive analysis with examples and best practices.'
        }
      }
    ];
    
    for (let i = 0; i < testQueries.length; i++) {
      const test = testQueries[i];
      console.log(`\n=== Test ${i+1}: ${test.name} ===`);
      console.log(`Query: "${test.query}"`);
      
      const startTime = Date.now();
      
      try {
        // Choose which method to call based on the test
        let result;
        if (test.options.wantsDeepResearch) {
          console.log('Using performDeepResearch with deep research model');
          result = await perplexityService.performDeepResearch(
            test.query, 
            test.options.jobId,
            test.options
          );
        } else {
          console.log('Using processWebQuery with model:', test.options.model);
          result = await perplexityService.processWebQuery(
            test.query,
            test.options
          );
        }
        
        const duration = (Date.now() - startTime) / 1000;
        console.log(`\nQuery completed in ${duration.toFixed(1)} seconds`);
        
        // Display results summary
        console.log('API Response Summary:');
        console.log(`- Model: ${result.model || result.modelUsed}`);
        console.log(`- Content length: ${result.content.length} characters`);
        console.log(`- Citations/sources: ${(result.citations || result.sources || []).length}`);
        
        // Content preview
        console.log('\nContent preview:');
        console.log('--------------------------------------');
        console.log(result.content.substring(0, 300) + '...');
        console.log('--------------------------------------');
        
        // Save results for inspection
        const outputFile = path.join(outputDir, `perplexity-${test.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().replace(/:/g, '-')}.json`);
        await fs.writeFile(outputFile, JSON.stringify(result, null, 2));
        console.log(`Results saved to ${outputFile}`);
        
        // Add delay between requests to respect rate limit
        if (i < testQueries.length - 1) {
          console.log(`\nWaiting ${DELAY_BETWEEN_REQUESTS}ms before next request to respect rate limit...`);
          await delay(DELAY_BETWEEN_REQUESTS);
        }
        
      } catch (error) {
        console.error(`Error in test ${i+1}:`, error.message);
      }
    }
    
    console.log('\n=== All tests completed ===');
    
  } catch (error) {
    console.error('Test script error:', error);
  }
}

// Run the test
testPerplexityAPI();