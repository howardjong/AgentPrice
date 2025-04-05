/**
 * Simple Deep Research Test
 * 
 * This script tests the Perplexity API deep research functionality directly
 * without going through the test runner infrastructure.
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

// Helper function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Main test function
async function runTest() {
  console.log('=== Testing Perplexity Deep Research Functionality ===');
  
  try {
    // Create output directory if it doesn't exist
    const outputDir = 'test-results';
    await fs.mkdir(outputDir, { recursive: true });
    
    // Check API key
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('⚠️ PERPLEXITY_API_KEY environment variable is not set.');
      return;
    }
    
    console.log('✅ PERPLEXITY_API_KEY is available');
    
    // Get service status
    const status = perplexityService.getStatus();
    console.log('Service status:', status);
    
    // Define test queries and parameters
    const testQuery = "What are the key differences between value-based and cost-plus pricing strategies for SaaS?";
    const jobId = uuidv4();
    
    console.log(`\n=== Starting Deep Research Test ===`);
    console.log(`Query: "${testQuery}"`);
    console.log(`Job ID: ${jobId}`);
    
    // First step: Make an initial query using standard search model
    // This is similar to the first step of conductDeepResearch but as a standalone test
    console.log('\n1. Making initial query for general information...');
    const startTime = Date.now();
    
    const initialResults = await perplexityService.processWebQuery(testQuery, {
      model: 'sonar',
      maxTokens: 2048, 
      temperature: 0.2,
      systemPrompt: 'You are an expert research assistant. Provide a comprehensive overview of this topic, focusing on key points and citing reliable sources.'
    });
    
    const initialDuration = (Date.now() - startTime) / 1000;
    console.log(`Initial query completed in ${initialDuration.toFixed(1)} seconds`);
    console.log(`Model used: ${initialResults.model}`);
    console.log(`Content length: ${initialResults.content.length} characters`);
    console.log(`Citations found: ${initialResults.citations.length}`);
    
    // Save initial results
    const initialOutputFile = path.join(outputDir, `perplexity-deep-research-initial-${new Date().toISOString().replace(/:/g, '-')}.json`);
    await fs.writeFile(initialOutputFile, JSON.stringify(initialResults, null, 2));
    console.log(`Initial results saved to ${initialOutputFile}`);
    
    // Content preview
    console.log('\nContent preview:');
    console.log('--------------------------------------');
    console.log(initialResults.content.substring(0, 400) + '...');
    console.log('--------------------------------------');
    
    // Respect rate limit before next request
    console.log(`\nWaiting ${DELAY_BETWEEN_REQUESTS}ms before next request to respect rate limit...`);
    await delay(DELAY_BETWEEN_REQUESTS);
    
    // Second step: Generate follow-up questions
    console.log('\n2. Generating follow-up questions based on initial results...');
    const followUpStartTime = Date.now();
    
    const followUpResponse = await perplexityService.processWebQuery(
      `Based on the following research, what are 3 important follow-up questions that would help expand this research?\n\n${initialResults.content}`,
      {
        model: 'sonar',
        maxTokens: 1024,
        temperature: 0.7,
        systemPrompt: 'Generate specific, targeted follow-up research questions. Be concise.'
      }
    );
    
    const followUpDuration = (Date.now() - followUpStartTime) / 1000;
    console.log(`Follow-up questions generated in ${followUpDuration.toFixed(1)} seconds`);
    console.log(`Model used: ${followUpResponse.model}`);
    
    // Extract follow-up questions
    console.log('\nFollow-up questions:');
    console.log('--------------------------------------');
    console.log(followUpResponse.content);
    console.log('--------------------------------------');
    
    // Save follow-up results
    const followUpOutputFile = path.join(outputDir, `perplexity-deep-research-followup-${new Date().toISOString().replace(/:/g, '-')}.json`);
    await fs.writeFile(followUpOutputFile, JSON.stringify(followUpResponse, null, 2));
    console.log(`Follow-up questions saved to ${followUpOutputFile}`);
    
    // Respect rate limit
    console.log(`\nWaiting ${DELAY_BETWEEN_REQUESTS}ms before next request to respect rate limit...`);
    await delay(DELAY_BETWEEN_REQUESTS);
    
    // We'll only test one follow-up question to keep the test shorter
    // Extract first follow-up question (simple extraction)
    let followUpQuestion = '';
    const questionMatches = followUpResponse.content.match(/\d+\.\s+(.*?)(?=\d+\.|$)/gs);
    if (questionMatches && questionMatches.length > 0) {
      followUpQuestion = questionMatches[0].replace(/^\d+\.\s+/, '').trim();
    } else {
      // Fallback to first line with a question mark
      const lines = followUpResponse.content.split('\n');
      followUpQuestion = lines.find(line => line.includes('?')) || 'How do these pricing strategies affect customer retention?';
    }
    
    // Third step: Research one follow-up question
    console.log(`\n3. Researching follow-up question: "${followUpQuestion}"...`);
    const followUpResearchTime = Date.now();
    
    const followUpResearch = await perplexityService.processWebQuery(followUpQuestion, {
      model: 'sonar',
      maxTokens: 2048,
      temperature: 0.2,
      systemPrompt: 'Focus specifically on this aspect of the research topic. Be thorough and cite reliable sources.'
    });
    
    const followUpResearchDuration = (Date.now() - followUpResearchTime) / 1000;
    console.log(`Follow-up research completed in ${followUpResearchDuration.toFixed(1)} seconds`);
    console.log(`Model used: ${followUpResearch.model}`);
    console.log(`Content length: ${followUpResearch.content.length} characters`);
    console.log(`Citations found: ${followUpResearch.citations.length}`);
    
    // Content preview
    console.log('\nFollow-up research preview:');
    console.log('--------------------------------------');
    console.log(followUpResearch.content.substring(0, 400) + '...');
    console.log('--------------------------------------');
    
    // Save follow-up research
    const followUpResearchFile = path.join(outputDir, `perplexity-deep-research-followup-research-${new Date().toISOString().replace(/:/g, '-')}.json`);
    await fs.writeFile(followUpResearchFile, JSON.stringify(followUpResearch, null, 2));
    console.log(`Follow-up research saved to ${followUpResearchFile}`);
    
    // Note: In a full implementation, we would add a synthesis step here
    // to combine the initial research with follow-up findings
    
    const totalDuration = (Date.now() - startTime) / 1000;
    console.log(`\n=== Deep Research Test Completed in ${totalDuration.toFixed(1)} seconds ===`);
    console.log('Each step of the deep research process has been tested individually.');
    console.log('The complete conductDeepResearch method combines these steps into a single workflow.');
    
  } catch (error) {
    console.error('Test error:', error.message);
    if (error.response) {
      console.error('API Error Response:', error.response.data);
    }
  }
}

// Run the test
console.log('Starting deep research test...');
runTest().catch(console.error);