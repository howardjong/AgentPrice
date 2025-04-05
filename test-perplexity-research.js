/**
 * Perplexity Research Test
 * 
 * Tests the updated Perplexity API integration with rate limiting
 * Respects rate limit of 5 requests per minute for the sonar model
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

// Test function for simpler research mode
async function testPerplexityResearch() {
  try {
    console.log('=== Testing Perplexity Research API Integration ===');
    
    // Check API key
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('⚠️ PERPLEXITY_API_KEY environment variable is not set.');
      return;
    }
    
    console.log('✅ PERPLEXITY_API_KEY is available');
    
    // Create output directory
    const outputDir = 'test-results';
    await fs.mkdir(outputDir, { recursive: true });
    
    // Service status check
    const status = perplexityService.getStatus();
    console.log('Service status:', status);
    
    // Test queries with different complexities
    const testQueries = [
      {
        query: 'What are three key factors to consider in SaaS pricing?',
        description: 'Simple pricing query'
      },
      {
        query: 'How should SaaS companies price products for enterprise versus small business segments?',
        description: 'Segment pricing query'
      }
    ];
    
    for (let i = 0; i < testQueries.length; i++) {
      const testCase = testQueries[i];
      const jobId = uuidv4();
      
      console.log(`\n=== Test Case ${i+1}: ${testCase.description} ===`);
      console.log(`Query: "${testCase.query}"`);
      console.log('Job ID:', jobId);
      
      const startTime = Date.now();
      
      try {
        // Use the direct web query for faster testing
        const results = await perplexityService.processWebQuery(testCase.query, {
          model: 'sonar',
          maxTokens: 1024
        });
        
        const duration = (Date.now() - startTime) / 1000;
        
        console.log(`\nQuery completed in ${duration.toFixed(1)} seconds`);
        console.log(`Model used: ${results.model}`);
        console.log(`Content length: ${results.content.length} characters`);
        console.log(`Citations found: ${results.citations.length}`);
        
        // Show content preview
        console.log('\nContent preview:');
        console.log('--------------------------------------');
        console.log(results.content.substring(0, 300) + '...');
        console.log('--------------------------------------');
        
        // Show sources
        if (results.citations.length > 0) {
          console.log('\nCitations:');
          results.citations.slice(0, 5).forEach((source, i) => {
            console.log(`${i + 1}. ${source}`);
          });
        }
        
        // Save results
        const outputFile = path.join(outputDir, `perplexity-test-${i+1}-${new Date().toISOString().replace(/:/g, '-')}.json`);
        await fs.writeFile(outputFile, JSON.stringify(results, null, 2));
        console.log(`Results saved to ${outputFile}`);
        
        // Add delay between requests to respect rate limit
        if (i < testQueries.length - 1) {
          console.log(`\nWaiting ${DELAY_BETWEEN_REQUESTS}ms before next request to respect rate limit...`);
          await delay(DELAY_BETWEEN_REQUESTS);
        }
      } catch (error) {
        console.error(`Error in test case ${i+1}:`, error.message);
      }
    }
    
    console.log('\n=== Perplexity Research Test Completed ===');
    
  } catch (error) {
    console.error('Test script error:', error);
  }
}

// Test for deep research with follow-up questions
async function testDeepResearchSimplified() {
  try {
    console.log('\n=== Testing Deep Research (Simplified) ===');
    
    // Use a single query for simplified testing
    const query = 'What are the effective pricing strategies for SaaS products?';
    const jobId = uuidv4();
    
    console.log(`Query: "${query}"`);
    console.log('Job ID:', jobId);
    
    const startTime = Date.now();
    
    try {
      // First do the initial research
      console.log('Performing initial research...');
      const initialResults = await perplexityService.processWebQuery(query, {
        model: 'sonar',
        maxTokens: 2048
      });
      
      console.log('Generating follow-up questions based on initial results...');
      // Generate follow-up questions based on initial results
      const followUpPrompt = `Based on the following research, what are 2-3 important follow-up questions that would help expand the research?\n\n${initialResults.content}`;
      
      const followUpResponse = await perplexityService.processWebQuery(followUpPrompt, {
        model: 'sonar', 
        maxTokens: 1024
      });
      
      // Show results
      const duration = (Date.now() - startTime) / 1000;
      console.log(`\nDeep research simulation completed in ${duration.toFixed(1)} seconds`);
      
      console.log('\nInitial research preview:');
      console.log('--------------------------------------');
      console.log(initialResults.content.substring(0, 300) + '...');
      console.log('--------------------------------------');
      
      console.log('\nFollow-up questions generated:');
      console.log('--------------------------------------');
      console.log(followUpResponse.content);
      console.log('--------------------------------------');
      
      // Save results
      const outputDir = 'test-results';
      const outputFile = path.join(outputDir, `deep-research-simplified-${new Date().toISOString().replace(/:/g, '-')}.json`);
      
      const combinedResults = {
        initialResearch: initialResults,
        followUpQuestions: followUpResponse,
        duration: duration
      };
      
      await fs.writeFile(outputFile, JSON.stringify(combinedResults, null, 2));
      console.log(`Results saved to ${outputFile}`);
      
    } catch (error) {
      console.error('Error in deep research test:', error.message);
    }
    
    console.log('\n=== Deep Research Test Completed ===');
    
  } catch (error) {
    console.error('Test script error:', error);
  }
}

// Run tests
async function runTests() {
  await testPerplexityResearch();
  
  // Add delay before running deep research test
  console.log(`\nWaiting ${DELAY_BETWEEN_REQUESTS}ms before deep research test...`);
  await delay(DELAY_BETWEEN_REQUESTS);
  
  await testDeepResearchSimplified();
}

// Run tests when executed directly
runTests();