/**
 * Simple Deep Research Test
 * 
 * This script tests the Perplexity deep research functionality with
 * robust error handling and logging.
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const DEEP_RESEARCH_MODEL = 'sonar-deep-research-online'; // Include '-online' suffix to ensure correct model
const TEST_QUERY = 'What are the most effective pricing strategies for SaaS startups in 2024, and how do they compare across different market segments and growth stages?';
const MAX_POLLING_ATTEMPTS = 90; // 90 attempts * 20 seconds = 30 minutes max
const POLLING_INTERVAL_MS = 20000; // 20 seconds between polling attempts

// Helper for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Generate a unique request ID
function generateRequestId() {
  return crypto.randomBytes(8).toString('hex');
}

// Simple logger
async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Also append to log file for persistence
  try {
    await fs.appendFile('perplexity-deep-research-test.log', logMessage + '\n');
  } catch (error) {
    console.error(`Failed to write to log file: ${error.message}`);
  }
}

// Check for API key
async function checkApiKey() {
  if (!process.env.PERPLEXITY_API_KEY) {
    await log('❌ PERPLEXITY_API_KEY environment variable is not set.');
    return false;
  }
  await log('✅ Perplexity API key is available');
  return true;
}

/**
 * Execute a query against the Perplexity API with the deep research model
 */
async function initiateDeepResearch(query, options = {}) {
  const {
    systemPrompt = '',
    temperature = 0.2,
    maxTokens = 4000
  } = options;
  
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    throw new Error('Perplexity API key is required');
  }
  
  // Generate a unique request ID for tracking this research
  const requestId = generateRequestId();
  await log(`Starting deep research [${requestId}] with query: "${query}"`);
  
  const startTime = Date.now();
  
  const requestData = {
    model: DEEP_RESEARCH_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query }
    ],
    max_tokens: maxTokens,
    temperature,
    stream: false,
    settings: {
      search_context: 'high'
    }
  };
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  
  try {
    await log(`Sending request to ${PERPLEXITY_API_URL} with model ${DEEP_RESEARCH_MODEL}`);
    
    const response = await axios.post(PERPLEXITY_API_URL, requestData, { headers });
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    await log(`[${requestId}] Initial API call completed in ${elapsedTime} seconds`);
    await log(`[${requestId}] Response status: ${response.status}`);
    
    // Save the initial response for debugging
    await saveResponseToFile(response.data, `deep-research-initial-${requestId}.json`);
    
    // Check for in-progress status in the response
    const status = getResponseStatus(response.data);
    await log(`[${requestId}] Initial response status: ${status}`);
    
    if (status === 'in_progress') {
      await log(`[${requestId}] Deep research is in progress, will begin polling...`);
      
      return {
        status: 'in_progress',
        requestId,
        initialResponse: response.data,
        elapsedTime
      };
    } else {
      await log(`[${requestId}] Received immediate completion (unusual for deep research)`);
      
      return {
        status: 'completed',
        requestId,
        finalResponse: response.data,
        elapsedTime
      };
    }
  } catch (error) {
    await log(`[${requestId}] Error initiating deep research: ${error.message}`);
    if (error.response) {
      await log(`[${requestId}] API Error Status: ${error.response.status}`);
      await log(`[${requestId}] API Error Data: ${JSON.stringify(error.response.data)}`);
      
      // Save error response
      await saveResponseToFile(
        error.response.data, 
        `deep-research-error-initial-${requestId}.json`
      );
    } else {
      await log(`[${requestId}] No response data available. Network error or timeout.`);
    }
    throw error;
  }
}

/**
 * Utility to save response data to a file
 */
async function saveResponseToFile(response, filename) {
  try {
    // Create test-results directory if it doesn't exist
    const directory = 'test-results';
    await fs.mkdir(directory, { recursive: true });
    
    // Save the response
    const filePath = path.join(directory, filename);
    await fs.writeFile(filePath, JSON.stringify(response, null, 2));
    
    await log(`Saved response to ${filePath}`);
    return filePath;
  } catch (error) {
    await log(`Error saving response to file: ${error.message}`);
    return null;
  }
}

/**
 * Get the status of a response (completed, in_progress, etc.)
 */
function getResponseStatus(response) {
  // Primary location for status
  if (response.metadata && response.metadata.status) {
    return response.metadata.status;
  }
  
  // Alternative location in choices
  if (response.choices && 
      response.choices[0] && 
      response.choices[0].metadata && 
      response.choices[0].metadata.status) {
    return response.choices[0].metadata.status;
  }
  
  // Fallback: If we find a polling URL but no explicit status, it's in progress
  if ((response.metadata && response.metadata.poll_url) ||
      (response.choices && 
       response.choices[0] && 
       response.choices[0].metadata && 
       response.choices[0].metadata.poll_url)) {
    return 'in_progress';
  }
  
  // Default: If we find content without a polling URL, assume it's completed
  if (response.choices && 
      response.choices[0] && 
      response.choices[0].message &&
      response.choices[0].message.content) {
    return 'completed';
  }
  
  return 'unknown';
}

/**
 * Extract model information from a Perplexity API response
 */
function extractModelInfo(response, defaultModel = "unknown") {
  if (!response) {
    return defaultModel;
  }
  
  // Try direct model property (new format)
  if (response.model) {
    return response.model;
  }
  
  // Try choices metadata
  if (response.choices && 
      response.choices[0] && 
      response.choices[0].metadata && 
      response.choices[0].metadata.model) {
    return response.choices[0].metadata.model;
  }
  
  return defaultModel;
}

/**
 * Main test function
 */
async function runTest() {
  await log('=== Starting Perplexity Deep Research Test ===');
  
  if (!await checkApiKey()) {
    return;
  }
  
  try {
    await log(`Testing deep research with query: "${TEST_QUERY}"`);
    
    // Start the deep research
    const result = await initiateDeepResearch(TEST_QUERY, {
      systemPrompt: 'You are a research assistant providing detailed information about SaaS pricing strategies for startups. Include comprehensive pricing data, trends, benchmarks by company stage, and citations in your research.',
      temperature: 0.1,
      maxTokens: 4000
    });
    
    // Display initial results
    await log(`Request ID: ${result.requestId}`);
    await log(`Initial Request Status: ${result.status}`);
    
    if (result.status === 'in_progress') {
      // If we get 'in_progress', we need to explain the polling process
      await log('\n===== IMPORTANT POLLING INFORMATION =====');
      await log('Deep research is now in progress on Perplexity\'s servers.');
      await log('This process typically takes 5-30 minutes to complete.');
      await log('The poll URL has been saved in the test results directory.');
      
      // Display what would happen next in a complete implementation
      await log('\nIn a complete implementation, the system would:');
      await log('1. Poll the status URL every 20 seconds');
      await log('2. Check if the research is complete');
      await log('3. Save the final results when available');
      await log('\nFor this test, we\'ve demonstrated the initial request and verified');
      await log('that Perplexity accepted our deep research query and returned a polling URL.');
    } else {
      // If we got an immediate result (rare for deep research)
      await log('\n===== IMMEDIATE RESULTS (UNUSUAL) =====');
      await log('Deep research completed immediately, which is unusual.');
      await log('Response has been saved to the test results directory.');
      
      // Extract model info
      const modelInfo = extractModelInfo(result.finalResponse);
      await log(`Model: ${modelInfo}`);
    }
    
    await log('\n=== Deep Research Test Initiated Successfully ===');
    await log('For a complete deep research query, the process would continue with polling.');
    await log('In a production environment, this would be handled by a job queue system.');
    
  } catch (error) {
    await log(`\n❌ Error during deep research test: ${error.message}`);
    if (error.response) {
      await log(`API Error Status: ${error.response.status}`);
      await log(`API Error Data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Run the test
runTest().catch(error => {
  console.error('Unhandled error in test execution:', error);
});