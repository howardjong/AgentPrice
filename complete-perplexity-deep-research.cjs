/**
 * Complete Perplexity Deep Research Test - CommonJS Version
 * 
 * This script runs a complete end-to-end test of Perplexity's deep research
 * capability, handling the initial request, polling phase, and result collection.
 * 
 * Key features:
 * - Proper timeout handling
 * - Poll URL extraction and management
 * - Detailed response saving and parsing
 * - Extensive logging
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configuration
const PERPLEXITY_API_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const DEEP_RESEARCH_MODEL = 'sonar-deep-research';
const LOG_FILE = 'perplexity-deep-research-job-' + 
  new Date().toISOString().replace(/:/g, '-').split('.')[0].replace('T', '-') + '.log';
const RESULTS_DIR = path.join('test-results', 'deep-research');
const COMPLETED_DIR = path.join('test-results', 'deep-research-results');
const INITIAL_TIMEOUT = 60000; // 60 seconds for initial request
const POLL_INTERVAL = 30000;   // 30 seconds between poll attempts
const MAX_POLL_ATTEMPTS = 60;  // Up to 30 minutes of polling
const QUERY = "What are the most effective pricing strategies for SaaS companies in 2025 that balance customer acquisition costs and lifetime value?";

// Ensure result directories exist
async function ensureDirectoriesExist() {
  try {
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    await fs.mkdir(COMPLETED_DIR, { recursive: true });
    await log('Created result directories');
  } catch (error) {
    await log(`Error creating directories: ${error.message}`);
  }
}

// Generate a unique request ID
function generateRequestId() {
  return uuidv4();
}

// Log to console and file
async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  try {
    await fs.appendFile(LOG_FILE, logMessage + '\n');
  } catch (error) {
    console.error(`Warning: Could not write to log file: ${error.message}`);
  }
}

// Check if API key is available
function checkApiKey() {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY environment variable is not set');
  }
  return true;
}

/**
 * Initiate deep research request
 */
async function initiateDeepResearch(requestId, query) {
  await log(`[${requestId}] Initiating deep research request for query: "${query.substring(0, 50)}..."`);
  
  const payload = {
    model: DEEP_RESEARCH_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a knowledgeable research assistant with expertise in business strategy and pricing models.'
      },
      {
        role: 'user',
        content: query
      }
    ],
    temperature: 0.7,
    max_tokens: 4000,
    search_context: 'high'
  };
  
  await log(`[${requestId}] Request payload: ${JSON.stringify(payload)}`);
  
  try {
    await log(`[${requestId}] Sending request to ${PERPLEXITY_API_ENDPOINT}`);
    
    const response = await axios.post(
      PERPLEXITY_API_ENDPOINT,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
        },
        timeout: INITIAL_TIMEOUT
      }
    );
    
    const responseData = response.data;
    await log(`[${requestId}] Received response with status ${response.status}`);
    
    // Save intermediate result
    const resultFile = path.join(RESULTS_DIR, `request-${requestId}-${new Date().toISOString().replace(/:/g, '-')}-intermediate.json`);
    await fs.writeFile(resultFile, JSON.stringify(responseData, null, 2));
    await log(`[${requestId}] Saved intermediate result to ${resultFile}`);
    
    return {
      success: true,
      data: responseData,
      resultFile
    };
    
  } catch (error) {
    await log(`[${requestId}] ❌ Error initiating deep research: ${error.message}`);
    
    // Log detailed error information
    if (error.response) {
      await log(`[${requestId}] API Error Status: ${error.response.status}`);
      await log(`[${requestId}] API Error Data: ${JSON.stringify(error.response.data)}`);
      
      // Save error response
      const errorFile = path.join(RESULTS_DIR, `request-${requestId}-error-${new Date().toISOString().replace(/:/g, '-')}.json`);
      await fs.writeFile(errorFile, JSON.stringify({
        error: error.message,
        status: error.response.status,
        data: error.response.data
      }, null, 2));
      await log(`[${requestId}] Saved error details to ${errorFile}`);
    } else if (error.request) {
      await log(`[${requestId}] No response received from API`);
      await log(`[${requestId}] Request details: ${JSON.stringify(error.request)}`);
    }
    
    return {
      success: false,
      error: error.message,
      details: error.response ? error.response.data : null
    };
  }
}

/**
 * Extract poll URL from response
 */
function extractPollUrl(response) {
  if (!response || !response.data) return null;
  
  // Check common formats for poll URLs
  if (response.data.poll_url) return response.data.poll_url;
  if (response.data.poll) return response.data.poll;
  
  // Check inside choices array
  if (response.data.choices && response.data.choices[0]) {
    const choice = response.data.choices[0];
    if (choice.poll_url) return choice.poll_url;
    if (choice.message && choice.message.poll_url) return choice.message.poll_url;
  }
  
  // Check metadata
  if (response.data.metadata && response.data.metadata.poll_url) {
    return response.data.metadata.poll_url;
  }
  
  return null;
}

/**
 * Check if response is a final completion
 */
function isCompletedResponse(response) {
  if (!response || !response.data) return false;
  
  // Check if response has citations (usually indicates completion)
  if (response.data.citations && response.data.citations.length > 0) return true;
  
  // Check if choices exist and have content
  if (response.data.choices && 
      response.data.choices[0] && 
      response.data.choices[0].message && 
      response.data.choices[0].message.content) {
    return true;
  }
  
  // Check for specific status field
  if (response.data.status === 'completed') return true;
  
  return false;
}

/**
 * Poll for deep research results
 */
async function pollForResults(requestId, pollUrl, maxAttempts = MAX_POLL_ATTEMPTS) {
  if (!pollUrl) {
    await log(`[${requestId}] No poll URL available for polling`);
    return {
      success: false,
      error: 'No poll URL available'
    };
  }
  
  await log(`[${requestId}] Starting to poll for results: ${pollUrl}`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await log(`[${requestId}] Poll attempt ${attempt}/${maxAttempts}`);
    
    try {
      const response = await axios.get(pollUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
        },
        timeout: 30000
      });
      
      const responseData = response.data;
      
      // Save intermediate polling result
      const resultFile = path.join(RESULTS_DIR, `request-${requestId}-poll-${attempt}-${new Date().toISOString().replace(/:/g, '-')}.json`);
      await fs.writeFile(resultFile, JSON.stringify(responseData, null, 2));
      await log(`[${requestId}] Saved poll result ${attempt} to ${resultFile}`);
      
      // Check if research is completed
      if (isCompletedResponse(response)) {
        await log(`[${requestId}] ✅ Deep research completed after ${attempt} poll attempts`);
        
        // Save completed result
        const completedFile = path.join(COMPLETED_DIR, `request-${requestId}-completed-${new Date().toISOString().replace(/:/g, '-')}.json`);
        await fs.writeFile(completedFile, JSON.stringify(responseData, null, 2));
        await log(`[${requestId}] Saved completed result to ${completedFile}`);
        
        // Extract and log useful information
        extractAndLogContent(requestId, responseData);
        
        return {
          success: true,
          data: responseData,
          completedFile
        };
      }
      
      await log(`[${requestId}] Research still in progress, waiting ${POLL_INTERVAL/1000} seconds before next poll`);
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      
    } catch (error) {
      await log(`[${requestId}] ❌ Error during poll attempt ${attempt}: ${error.message}`);
      
      if (error.response) {
        await log(`[${requestId}] Poll Error Status: ${error.response.status}`);
        await log(`[${requestId}] Poll Error Data: ${JSON.stringify(error.response.data)}`);
      }
      
      // If this is not the last attempt, wait and continue
      if (attempt < maxAttempts) {
        const backoffTime = Math.min(POLL_INTERVAL * Math.pow(1.5, attempt - 1), 5 * 60 * 1000); // Max 5 minutes
        await log(`[${requestId}] Backing off for ${backoffTime/1000} seconds before retry`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      } else {
        await log(`[${requestId}] ❌ Exceeded maximum poll attempts (${maxAttempts}), giving up`);
        return {
          success: false,
          error: `Exceeded maximum poll attempts: ${error.message}`
        };
      }
    }
  }
  
  await log(`[${requestId}] ❌ Polling timed out without completion`);
  return {
    success: false,
    error: 'Polling timed out without completion'
  };
}

/**
 * Extract and log content from the completed research
 */
async function extractAndLogContent(requestId, responseData) {
  await log(`[${requestId}] === Extracting useful information from response ===`);
  
  // Extract model information
  const model = extractModelInfo(responseData);
  await log(`[${requestId}] Model: ${model}`);
  
  // Extract content
  const content = extractContent(responseData);
  if (content) {
    const contentPreview = content.substring(0, 200) + '...';
    await log(`[${requestId}] Content preview: ${contentPreview}`);
  } else {
    await log(`[${requestId}] No content found in response`);
  }
  
  // Extract citations
  const citations = extractCitations(responseData);
  if (citations && citations.length > 0) {
    await log(`[${requestId}] Found ${citations.length} citations`);
    for (let i = 0; i < Math.min(5, citations.length); i++) {
      await log(`[${requestId}] Citation ${i+1}: ${citations[i]}`);
    }
    if (citations.length > 5) {
      await log(`[${requestId}] ... and ${citations.length - 5} more citations`);
    }
  } else {
    await log(`[${requestId}] No citations found in response`);
  }
}

/**
 * Extract model information from response
 */
function extractModelInfo(response, defaultModel = DEEP_RESEARCH_MODEL) {
  if (!response) return defaultModel;
  
  // Try various paths where model info might be found
  if (response.model) return response.model;
  if (response.data && response.data.model) return response.data.model;
  
  return defaultModel;
}

/**
 * Extract content from response
 */
function extractContent(response) {
  if (!response) return null;
  
  // Try to find content in different response formats
  if (response.choices && 
      response.choices[0] && 
      response.choices[0].message && 
      response.choices[0].message.content) {
    return response.choices[0].message.content;
  }
  
  if (response.data && 
      response.data.choices && 
      response.data.choices[0] && 
      response.data.choices[0].message && 
      response.data.choices[0].message.content) {
    return response.data.choices[0].message.content;
  }
  
  if (response.content) return response.content;
  if (response.data && response.data.content) return response.data.content;
  
  return null;
}

/**
 * Extract citations from response
 */
function extractCitations(response) {
  if (!response) return [];
  
  // Try to find citations in different response formats
  if (response.citations) return response.citations;
  if (response.data && response.data.citations) return response.data.citations;
  
  // Some responses include citations in the message
  if (response.choices && 
      response.choices[0] && 
      response.choices[0].message && 
      response.choices[0].message.citations) {
    return response.choices[0].message.citations;
  }
  
  if (response.data && 
      response.data.choices && 
      response.data.choices[0] && 
      response.data.choices[0].message && 
      response.data.choices[0].message.citations) {
    return response.data.choices[0].message.citations;
  }
  
  return [];
}

/**
 * Main function to run the complete flow
 */
async function main() {
  try {
    await ensureDirectoriesExist();
    await log('=== Starting Complete Deep Research Process ===');
    
    // Check API key
    checkApiKey();
    await log('✅ API key is available');
    
    // Generate request ID
    const requestId = generateRequestId();
    await log(`Request ID: ${requestId}`);
    
    // Start deep research
    await log(`Initiating deep research with request ID: ${requestId}`);
    await log(`Query: ${QUERY}`);
    
    const initiateResult = await initiateDeepResearch(requestId, QUERY);
    
    if (!initiateResult.success) {
      await log(`❌ Failed to initiate deep research: ${initiateResult.error}`);
      return;
    }
    
    // Extract poll URL
    const pollUrl = extractPollUrl(initiateResult);
    
    if (!pollUrl) {
      // Check if this is already a completed response (synchronous completion)
      if (isCompletedResponse(initiateResult)) {
        await log(`✅ Received completed response immediately (no polling needed)`);
        await extractAndLogContent(requestId, initiateResult.data);
        return;
      }
      
      await log(`❌ No poll URL found in response and response is not complete`);
      await log(`Response structure: ${JSON.stringify(Object.keys(initiateResult.data))}`);
      return;
    }
    
    await log(`Found poll URL: ${pollUrl}`);
    
    // Poll for results
    const pollResult = await pollForResults(requestId, pollUrl);
    
    if (!pollResult.success) {
      await log(`❌ Failed to get completed results from polling: ${pollResult.error}`);
      return;
    }
    
    await log(`✅ Successfully completed deep research for request ${requestId}`);
    
  } catch (error) {
    await log(`❌ Error in main process: ${error.message}`);
  }
}

// Run the main function
main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});