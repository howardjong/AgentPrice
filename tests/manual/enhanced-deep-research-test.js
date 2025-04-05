
/**
 * Enhanced Deep Research Test
 * 
 * This test focuses on properly handling the Perplexity sonar-deep-research model
 * with robust polling, rate limit respect, and proper error handling.
 * 
 * Usage:
 *   node tests/manual/enhanced-deep-research-test.js [--query="Your query"]
 */

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
dotenv.config();

// Constants for deep research polling
const POLL_INITIAL_DELAY = 3000; // 3 seconds
const POLL_MAX_ATTEMPTS = 60; // Up to 180 seconds (3 minutes) polling
const POLL_BACKOFF_FACTOR = 1.2; // Gradually increase wait time
const POLL_MAX_DELAY = 10000; // Max 10 seconds between polls
const RATE_LIMIT_DELAY = 15000; // 15 seconds between deep research requests

// Output directory for results
const OUTPUT_DIR = path.join(process.cwd(), 'test-results', 'deep-research');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    query: "What are the latest pricing strategies for SaaS products in 2025?",
    debug: false,
    saveResults: true
  };
  
  for (const arg of args) {
    if (arg.startsWith('--query=')) {
      options.query = arg.substring('--query='.length);
    } else if (arg === '--debug') {
      options.debug = true;
    } else if (arg === '--no-save') {
      options.saveResults = false;
    }
  }
  
  return options;
}

// Simple delay function
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Perplexity Deep Research API Client
 * Handles the asynchronous nature of deep research
 */
class PerplexityDeepResearchClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.perplexity.ai';
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }
  
  /**
   * Initiates a deep research query
   */
  async startDeepResearch(query) {
    const requestId = uuidv4();
    console.log(`\n[${new Date().toISOString()}] Starting deep research (ID: ${requestId})`);
    console.log(`Query: "${query}"`);
    
    try {
      const response = await this.client.post('/chat/completions', {
        model: 'sonar-deep-research',
        messages: [{
          role: 'user',
          content: query
        }],
        options: {
          date: (new Date()).toISOString().split('T')[0]
        }
      });
      
      if (response.status === 202) {
        // Async operation initiated, extract task_id
        const taskId = response.headers['operation-location'];
        console.log(`Deep research started asynchronously. Task ID: ${taskId}`);
        return { taskId, requestId, status: 'pending' };
      } else if (response.status === 200) {
        // Operation completed synchronously (unusual for deep research)
        console.log(`Deep research completed synchronously (unusual for deep research)`);
        return { 
          status: 'completed',
          requestId,
          result: response.data,
          modelUsed: response.data.model || 'unknown'
        };
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      if (error.response?.status === 429) {
        console.error(`[${new Date().toISOString()}] Rate limit exceeded. Waiting before retry.`);
        return { status: 'rate_limited', requestId };
      }
      
      console.error(`[${new Date().toISOString()}] Error starting deep research:`, 
        error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Polls for the completion of a deep research task
   */
  async pollDeepResearchResult(taskId, requestId) {
    console.log(`\n[${new Date().toISOString()}] Starting polling for task: ${taskId}`);
    
    let attempts = 0;
    let delayMs = POLL_INITIAL_DELAY;
    
    while (attempts < POLL_MAX_ATTEMPTS) {
      attempts++;
      
      try {
        await delay(delayMs);
        console.log(`[${new Date().toISOString()}] Polling attempt ${attempts}/${POLL_MAX_ATTEMPTS}`);
        
        const response = await this.client.get(taskId);
        
        if (response.status === 200) {
          console.log(`[${new Date().toISOString()}] Polling successful!`);
          return {
            status: 'completed',
            requestId,
            result: response.data,
            modelUsed: response.data.model || 'sonar-deep-research',
            attempts
          };
        }
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`Task not ready yet, continuing to poll...`);
        } else if (error.response?.status === 429) {
          console.warn(`Rate limit hit during polling. Adding extra delay.`);
          // Add extra delay for rate limit
          await delay(RATE_LIMIT_DELAY);
        } else {
          console.error(`Polling error:`, error.response?.data || error.message);
          if (attempts > POLL_MAX_ATTEMPTS / 2) {
            throw error; // Only throw after several attempts
          }
        }
      }
      
      // Implement backoff strategy
      delayMs = Math.min(delayMs * POLL_BACKOFF_FACTOR, POLL_MAX_DELAY);
    }
    
    throw new Error(`Deep research polling timed out after ${attempts} attempts`);
  }
  
  /**
   * Complete deep research workflow with polling
   */
  async performDeepResearch(query) {
    const startTime = Date.now();
    
    // Start the deep research
    const researchTask = await this.startDeepResearch(query);
    
    if (researchTask.status === 'rate_limited') {
      console.log(`Waiting ${RATE_LIMIT_DELAY/1000} seconds for rate limit reset...`);
      await delay(RATE_LIMIT_DELAY);
      return this.performDeepResearch(query); // Retry after delay
    }
    
    if (researchTask.status === 'completed') {
      // This would be unusual for deep research, but handle it anyway
      return this.processResult(researchTask.result, startTime, researchTask.requestId);
    }
    
    // Poll for results
    const pollingResult = await this.pollDeepResearchResult(
      researchTask.taskId, 
      researchTask.requestId
    );
    
    return this.processResult(pollingResult.result, startTime, pollingResult.requestId, pollingResult.attempts);
  }
  
  /**
   * Process and format the final result
   */
  processResult(result, startTime, requestId, pollAttempts = 0) {
    const duration = Date.now() - startTime;
    const content = result.choices[0].message.content;
    const citations = result.citations || [];
    
    // Extract model used
    const modelUsed = result.model || 'sonar-deep-research';
    
    // Format and extract data
    return {
      requestId,
      query: result.choices[0].message.content.split('\n')[0], // First line usually has query
      content,
      citations,
      modelUsed,
      requestedModel: 'sonar-deep-research',
      duration,
      pollAttempts,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Save test results to a file
 */
async function saveTestResults(results, outputDir) {
  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const shortQuery = results.query.substring(0, 40).replace(/[^a-zA-Z0-9]/g, '-');
    const filename = `deep-research-${shortQuery}-${timestamp}.json`;
    const outputPath = path.join(outputDir, filename);
    
    // Save results
    await fs.writeFile(
      outputPath,
      JSON.stringify(results, null, 2)
    );
    
    console.log(`\nTest results saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error saving test results:', error);
  }
}

/**
 * Main test function
 */
async function runDeepResearchTest() {
  console.log('=================================================');
  console.log('        ENHANCED DEEP RESEARCH TEST');
  console.log('=================================================');
  
  const options = parseArgs();
  console.log('Options:', options);
  
  // Verify API key
  if (!process.env.PERPLEXITY_API_KEY) {
    console.error('ERROR: Missing PERPLEXITY_API_KEY environment variable');
    process.exit(1);
  }
  
  // Create client
  const client = new PerplexityDeepResearchClient(process.env.PERPLEXITY_API_KEY);
  
  console.log(`\nRunning deep research test with query: "${options.query}"`);
  console.log(`Using model: sonar-deep-research`);
  
  try {
    // Start timer
    const startTime = Date.now();
    
    // Run the deep research
    const results = await client.performDeepResearch(options.query);
    
    // Calculate duration
    const totalDuration = Date.now() - startTime;
    
    // Log results
    console.log('\n=================================================');
    console.log('             TEST RESULTS');
    console.log('=================================================');
    console.log(`Total test duration: ${(totalDuration / 1000).toFixed(1)} seconds`);
    console.log(`API processing time: ${(results.duration / 1000).toFixed(1)} seconds`);
    console.log(`Poll attempts: ${results.pollAttempts}`);
    console.log(`Model requested: sonar-deep-research`);
    console.log(`Model used: ${results.modelUsed}`);
    console.log(`Content length: ${results.content.length} characters`);
    console.log(`Citations count: ${results.citations.length}`);
    
    // Print content preview
    console.log('\nContent preview:');
    console.log('--------------------------------------------------');
    console.log(results.content.substring(0, 500) + '...');
    console.log('--------------------------------------------------');
    
    // Print citations
    if (results.citations.length > 0) {
      console.log('\nFirst 3 citations:');
      results.citations.slice(0, 3).forEach((citation, i) => {
        console.log(`${i+1}. ${citation.title || 'Untitled'}: ${citation.url || 'No URL'}`);
      });
    }
    
    // Save results if requested
    if (options.saveResults) {
      await saveTestResults(results, OUTPUT_DIR);
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
runDeepResearchTest();
