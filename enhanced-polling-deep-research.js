/**
 * Enhanced Polling Deep Research Test
 * 
 * This script tests the Perplexity deep research API and implements
 * a polling mechanism to handle long-running research requests.
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

// Constants
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = 'https://api.perplexity.ai/chat/completions';
const LOG_FILE = 'perplexity-deep-research-polled-test.log';
const RESULTS_DIR = path.join(__dirname, 'test-results', 'deep-research');
const MAX_POLLING_ATTEMPTS = 30;  // With 5 seconds delay, this is ~2.5 minutes of polling
const POLLING_DELAY_MS = 5000;    // 5 seconds between polls

function generateRequestId() {
  return uuidv4();
}

async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  await fs.appendFile(LOG_FILE, `${logMessage}\n`)
    .catch(err => console.error(`Error writing to log: ${err.message}`));
}

async function checkApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is not set');
  }
  await log('✅ API key is available');
  return apiKey;
}

/**
 * Execute a query against the Perplexity API with the deep research model
 */
async function initiateDeepResearch(query, options = {}) {
  const requestId = options.requestId || generateRequestId();
  await log(`Initiating deep research with request ID: ${requestId}`);
  await log(`Query: ${query}`);
  
  try {
    const apiKey = await checkApiKey();
    
    // Ensure the results directory exists
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    
    const model = 'sonar-deep-research';
    const requestData = {
      model,
      messages: [
        { role: 'user', content: query }
      ],
      max_tokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.0,
      stream: false
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    await log(`Sending request to Perplexity API (${model})...`);
    const response = await axios.post(API_URL, requestData, {
      headers,
      timeout: 60000 // 60 second timeout
    });
    
    const status = response.status;
    await log(`Response status: ${status}`);
    
    // Save initial response
    const responseFile = path.join(RESULTS_DIR, `initial-response-${requestId}.json`);
    await fs.writeFile(responseFile, JSON.stringify(response.data, null, 2));
    await log(`Saved initial response to ${responseFile}`);
    
    // Check for poll URL
    const pollUrl = extractPollUrl(response.data);
    if (pollUrl) {
      await log(`Received poll URL: ${pollUrl}`);
      
      // Save poll data for potential future use
      const pollData = {
        requestId,
        pollUrl,
        timestamp: new Date().toISOString(),
        query
      };
      
      const pollDataFile = path.join(RESULTS_DIR, `poll-data-${requestId}.json`);
      await fs.writeFile(pollDataFile, JSON.stringify(pollData, null, 2));
      await log(`Saved poll data to ${pollDataFile}`);
      
      return {
        status: 'polling_required',
        requestId,
        pollUrl,
        initialResponse: response.data
      };
    } else {
      await log('No poll URL found - research completed synchronously');
      
      // Extract model info from response
      const modelInfo = extractModelInfo(response.data, model);
      await log(`Model used: ${modelInfo}`);
      
      return {
        status: 'completed',
        requestId,
        response: response.data
      };
    }
  } catch (error) {
    await log(`Error initiating deep research: ${error.message}`);
    
    if (error.response) {
      await log(`Status: ${error.response.status}`);
      await log(`Response data: ${JSON.stringify(error.response.data)}`);
      
      // Save error response
      const errorFile = path.join(RESULTS_DIR, `error-${requestId}.json`);
      await fs.writeFile(errorFile, JSON.stringify(error.response.data, null, 2));
    }
    
    throw error;
  }
}

/**
 * Poll for deep research completion
 */
async function pollForCompletion(pollUrl, requestId, maxAttempts = MAX_POLLING_ATTEMPTS) {
  await log(`Starting polling for request ${requestId}`);
  await log(`Max polling attempts: ${maxAttempts}`);
  
  try {
    const apiKey = await checkApiKey();
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await log(`Polling attempt ${attempt}/${maxAttempts}...`);
      
      try {
        const response = await axios.get(pollUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 30000 // 30 second timeout
        });
        
        // Save poll response
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const responseFile = path.join(RESULTS_DIR, `poll-response-${requestId}-${attempt}.json`);
        await fs.writeFile(responseFile, JSON.stringify(response.data, null, 2));
        
        // Check if research is complete
        const status = getResponseStatus(response.data);
        await log(`Poll response status: ${status}`);
        
        if (status === 'completed') {
          await log(`Research completed! Saving final response...`);
          
          // Save as completed response
          const completeFile = path.join(RESULTS_DIR, `complete-response-${requestId}.json`);
          await fs.writeFile(completeFile, JSON.stringify(response.data, null, 2));
          
          // Extract and log content
          const content = extractContent(response.data);
          await log(`Content received (${content.length} characters)`);
          
          // Extract and log model info
          const modelInfo = extractModelInfo(response.data);
          await log(`Model used: ${modelInfo}`);
          
          return {
            status: 'completed',
            requestId,
            attempts: attempt,
            response: response.data
          };
        }
        
        // If still in progress, wait before next attempt
        await log(`Research still in progress. Waiting ${POLLING_DELAY_MS/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, POLLING_DELAY_MS));
        
      } catch (error) {
        await log(`Error during polling attempt ${attempt}: ${error.message}`);
        
        if (error.response) {
          await log(`Status: ${error.response.status}`);
          await log(`Response data: ${JSON.stringify(error.response.data)}`);
        }
        
        // Wait before retry
        await log(`Waiting ${POLLING_DELAY_MS/1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, POLLING_DELAY_MS));
      }
    }
    
    // If we've exhausted all polling attempts
    await log(`Reached maximum polling attempts (${maxAttempts}). Research may still be in progress.`);
    return {
      status: 'timeout',
      requestId,
      attempts: maxAttempts
    };
    
  } catch (error) {
    await log(`Fatal error in polling process: ${error.message}`);
    throw error;
  }
}

/**
 * Utility to save response data to a file
 */
async function saveResponseToFile(response, filename) {
  try {
    await fs.writeFile(filename, JSON.stringify(response, null, 2));
    await log(`Saved data to ${filename}`);
  } catch (err) {
    await log(`Error saving response: ${err.message}`);
  }
}

/**
 * Get the status of a response (completed, in_progress, etc.)
 */
function getResponseStatus(response) {
  if (!response) return 'unknown';
  
  // Case 1: Direct status field (polling responses)
  if (response.status) {
    return response.status;
  }
  
  // Case 2: Poll URL indicates in-progress research (initial responses)
  if (response.poll_url) {
    return 'in_progress';
  }
  
  // Case 3: Standard chat completion response
  if (response.choices && response.choices[0] && response.choices[0].message) {
    return 'completed';
  }
  
  // Case 4: Completion object format (some deep research responses)
  if (response.completion && response.completion.text) {
    return 'completed';
  }
  
  return 'unknown';
}

/**
 * Extract poll URL from response
 */
function extractPollUrl(response) {
  if (!response) return null;
  
  // Case 1: Direct poll_url field in response
  if (response.poll_url) {
    return response.poll_url;
  }
  
  return null;
}

/**
 * Extract model information from a Perplexity API response
 */
function extractModelInfo(response, defaultModel = "unknown") {
  if (!response) return defaultModel;
  
  // Case 1: Direct model field in response
  if (response.model) {
    return response.model;
  }
  
  // Case 2: Extract from completion.model if available
  if (response.completion && response.completion.model) {
    return response.completion.model;
  }
  
  return defaultModel;
}

/**
 * Extract content from Perplexity response
 */
function extractContent(response) {
  if (!response) return '';
  
  // Case 1: Standard chat completion format
  if (response.choices && response.choices[0] && response.choices[0].message) {
    return response.choices[0].message.content;
  }
  
  // Case 2: Completion object format from polling response
  if (response.completion && response.completion.text) {
    return response.completion.text;
  }
  
  return '';
}

/**
 * Main test function which initiates deep research and polls for the result
 */
async function runPolledDeepResearch(maxPollingTime = 2) {
  const requestId = generateRequestId();
  const query = 'What are the current best practices for SaaS pricing strategies in 2025? Please include specific examples of successful companies.';
  
  await log('=== Starting Enhanced Deep Research Test with Polling ===');
  
  try {
    // Initiate the deep research request
    const initialResult = await initiateDeepResearch(query, { requestId });
    
    if (initialResult.status === 'polling_required') {
      await log('Deep research requires polling. This is expected behavior.');
      
      // Start polling with appropriate settings
      const maxAttempts = maxPollingTime * 60 / (POLLING_DELAY_MS / 1000); // Convert minutes to attempts
      await log(`Setting up polling for ${maxPollingTime} minutes (${maxAttempts} attempts)`);
      
      const pollingResult = await pollForCompletion(
        initialResult.pollUrl,
        requestId,
        maxAttempts
      );
      
      if (pollingResult.status === 'completed') {
        await log('✅ Deep research completed successfully!');
        return pollingResult;
      } else {
        await log(`⏳ Polling timed out after ${maxPollingTime} minutes.`);
        await log('The research request might still be processing on Perplexity\'s servers.');
        await log('You can check the status later by running the check-deep-research-status.js script.');
        return pollingResult;
      }
    } else if (initialResult.status === 'completed') {
      await log('✅ Deep research completed synchronously (unusual but possible)');
      return initialResult;
    }
  } catch (error) {
    await log(`❌ Error in deep research process: ${error.message}`);
  } finally {
    await log('=== Enhanced Deep Research Test Complete ===');
  }
}

/**
 * Test function with configurable options
 */
async function runTest(options = {}) {
  const maxPollingTime = options.maxPollingTime || 2; // Default 2 minutes of polling
  return runPolledDeepResearch(maxPollingTime);
}

// Run the test
runTest({ maxPollingTime: 5 }); // Poll for up to 5 minutes