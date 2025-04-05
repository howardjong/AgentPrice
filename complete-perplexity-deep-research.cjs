/**
 * Complete Perplexity Deep Research Test
 * 
 * This script conducts a full test of the Perplexity deep research functionality
 * with proper polling and result saving.
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const DEEP_RESEARCH_MODEL = 'sonar-deep-research';
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
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  
  // Also append to log file for persistence
  fs.appendFile('perplexity-deep-research.log', `[${timestamp}] ${message}\n`)
    .catch(error => console.error(`Failed to write to log file: ${error.message}`));
}

// Check for API key
function checkApiKey() {
  if (!process.env.PERPLEXITY_API_KEY) {
    log('❌ PERPLEXITY_API_KEY environment variable is not set.');
    return false;
  }
  log('✅ Perplexity API key is available');
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
  log(`Starting deep research [${requestId}] with query: "${query}"`);
  
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
    const response = await axios.post(PERPLEXITY_API_URL, requestData, { headers });
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`[${requestId}] Initial API call completed in ${elapsedTime} seconds`);
    
    // Check for in-progress status in the response
    const status = getResponseStatus(response.data);
    
    if (status === 'in_progress') {
      log(`[${requestId}] Deep research is in progress, will begin polling...`);
      
      return {
        status: 'in_progress',
        requestId,
        initialResponse: response.data,
        elapsedTime
      };
    } else {
      log(`[${requestId}] Received immediate completion (unusual for deep research)`);
      
      return {
        status: 'completed',
        requestId,
        finalResponse: response.data,
        elapsedTime
      };
    }
  } catch (error) {
    log(`[${requestId}] Error initiating deep research: ${error.message}`);
    if (error.response) {
      log(`[${requestId}] API Error Status: ${error.response.status}`);
      log(`[${requestId}] API Error Data: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Poll for the completion of a deep research query
 */
async function pollForCompletion(requestId, initialResponse, options = {}) {
  const {
    maxAttempts = MAX_POLLING_ATTEMPTS,
    interval = POLLING_INTERVAL_MS
  } = options;
  
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    throw new Error('Perplexity API key is required for polling');
  }
  
  // Extract necessary information for polling
  const pollInfo = extractPollingInfo(initialResponse);
  
  if (!pollInfo || !pollInfo.pollUrl) {
    throw new Error('Could not extract polling information from initial response');
  }
  
  log(`[${requestId}] Beginning polling with URL: ${pollInfo.pollUrl}`);
  log(`[${requestId}] Will poll up to ${maxAttempts} times with ${interval/1000} second intervals`);
  
  // Save the initial response for debugging
  await saveResponseToFile(initialResponse, `deep-research-initial-${requestId}.json`);
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  
  // Start polling
  let currentAttempt = 1;
  const pollStartTime = Date.now();
  
  while (currentAttempt <= maxAttempts) {
    log(`[${requestId}] Polling attempt ${currentAttempt}/${maxAttempts}`);
    
    try {
      const response = await axios.get(pollInfo.pollUrl, { headers });
      
      // Check if the research is complete
      const status = getResponseStatus(response.data);
      
      // Save polling response for debugging
      await saveResponseToFile(
        response.data, 
        `deep-research-poll-${requestId}-attempt-${currentAttempt}.json`
      );
      
      if (status === 'completed') {
        const totalTime = ((Date.now() - pollStartTime) / 1000).toFixed(2);
        log(`[${requestId}] ✅ Deep research completed after ${totalTime} seconds (${currentAttempt} polling attempts)`);
        
        // Save the final completed response
        await saveResponseToFile(
          response.data,
          `deep-research-completed-${requestId}.json`
        );
        
        return {
          status: 'completed',
          requestId,
          finalResponse: response.data,
          pollingAttempts: currentAttempt,
          totalTimeSeconds: parseFloat(totalTime)
        };
      }
      
      log(`[${requestId}] Status: ${status}, continuing to poll...`);
      
      // Wait before the next polling attempt
      await delay(interval);
      currentAttempt++;
      
    } catch (error) {
      log(`[${requestId}] Error during polling attempt ${currentAttempt}: ${error.message}`);
      
      if (error.response) {
        log(`[${requestId}] API Error Status: ${error.response.status}`);
        log(`[${requestId}] API Error Data: ${JSON.stringify(error.response.data)}`);
        
        // Save error response for debugging
        await saveResponseToFile(
          error.response.data,
          `deep-research-error-${requestId}-attempt-${currentAttempt}.json`
        );
      }
      
      // If we get a 429 (rate limit), wait longer before retrying
      if (error.response && error.response.status === 429) {
        log(`[${requestId}] Rate limit hit (429), waiting 60 seconds before retry...`);
        await delay(60000); // Wait 60 seconds
      } else {
        // For other errors, continue with normal polling interval
        await delay(interval);
      }
      
      currentAttempt++;
      continue;
    }
  }
  
  // If we've reached the maximum number of polling attempts
  throw new Error(`[${requestId}] Deep research polling exceeded maximum attempts (${maxAttempts})`);
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
    
    log(`Saved response to ${filePath}`);
    return filePath;
  } catch (error) {
    log(`Error saving response to file: ${error.message}`);
    return null;
  }
}

/**
 * Extract polling information from an initial response
 */
function extractPollingInfo(response) {
  // New format: Look for a polling URL in response.metadata.poll_url
  if (response.metadata && response.metadata.poll_url) {
    return {
      pollUrl: response.metadata.poll_url
    };
  }
  
  // Alternate format: Look in the choices
  if (response.choices && 
      response.choices[0] && 
      response.choices[0].metadata && 
      response.choices[0].metadata.poll_url) {
    return {
      pollUrl: response.choices[0].metadata.poll_url
    };
  }
  
  return null;
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
 * Extract content from Perplexity response
 */
function extractContent(response) {
  if (!response) {
    return '';
  }
  
  // Handle new format (choices array with messages)
  if (response.choices && 
      response.choices[0] && 
      response.choices[0].message) {
    return response.choices[0].message.content;
  }
  
  return '';
}

/**
 * Extract citations from Perplexity response
 */
function extractCitations(response) {
  // New format - check metadata level
  if (response.metadata && 
      response.metadata.citations && 
      Array.isArray(response.metadata.citations)) {
    return response.metadata.citations;
  }
  
  // Alternate format - check choices[0].metadata level
  if (response.choices && 
      response.choices[0] && 
      response.choices[0].metadata && 
      response.choices[0].metadata.citations && 
      Array.isArray(response.choices[0].metadata.citations)) {
    return response.choices[0].metadata.citations;
  }
  
  // Legacy format - check root level
  if (response.citations && Array.isArray(response.citations)) {
    return response.citations;
  }
  
  return [];
}

/**
 * Process the completed response and save artifacts
 */
async function processCompletedResponse(requestId, finalResponse) {
  // Extract information
  const modelInfo = extractModelInfo(finalResponse, DEEP_RESEARCH_MODEL);
  const content = extractContent(finalResponse);
  const citations = extractCitations(finalResponse);
  
  // Create test-results directory if needed
  try {
    await fs.mkdir('test-results', { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      log(`Error creating test-results directory: ${error.message}`);
    }
  }
  
  // Save the processed content
  const timestamp = Date.now();
  const contentFilename = path.join('test-results', `deep-research-content-${requestId}-${timestamp}.md`);
  await fs.writeFile(contentFilename, content);
  
  // Save a JSON summary with metadata
  const summaryFilename = path.join('test-results', `deep-research-summary-${requestId}-${timestamp}.json`);
  const summary = {
    requestId,
    timestamp,
    model: modelInfo,
    contentLength: content.length,
    citationsCount: citations.length,
    contentFilename,
    citations
  };
  
  await fs.writeFile(summaryFilename, JSON.stringify(summary, null, 2));
  
  log(`[${requestId}] Saved content to ${contentFilename}`);
  log(`[${requestId}] Saved summary to ${summaryFilename}`);
  
  return {
    model: modelInfo,
    contentLength: content.length,
    citationsCount: citations.length,
    content,
    citations,
    contentFilename,
    summaryFilename
  };
}

/**
 * Main function to conduct deep research with polling
 */
async function conductDeepResearchWithPolling(query, options = {}) {
  // 1. Initiate the deep research
  const initialResult = await initiateDeepResearch(query, options);
  const requestId = initialResult.requestId;
  
  // 2. If already completed (unlikely), process results
  if (initialResult.status === 'completed') {
    log(`[${requestId}] Research was already completed in initial request (rare for deep research)`);
    return await processCompletedResponse(requestId, initialResult.finalResponse);
  }
  
  // 3. Otherwise, poll for completion
  log(`[${requestId}] Research is in progress, starting polling...`);
  const pollingResult = await pollForCompletion(requestId, initialResult.initialResponse, {
    maxAttempts: options.maxPollingAttempts || MAX_POLLING_ATTEMPTS,
    interval: options.pollingInterval || POLLING_INTERVAL_MS
  });
  
  // 4. Process and save the final results
  log(`[${requestId}] Processing completed research results...`);
  const processedResults = await processCompletedResponse(requestId, pollingResult.finalResponse);
  
  // 5. Return the combined results
  return {
    ...processedResults,
    requestId,
    pollingAttempts: pollingResult.pollingAttempts,
    totalTimeSeconds: pollingResult.totalTimeSeconds
  };
}

/**
 * Main test function
 */
async function runTest() {
  log('=== Starting Perplexity Deep Research Test ===');
  
  if (!checkApiKey()) {
    return;
  }
  
  try {
    log(`Testing deep research with query: "${TEST_QUERY}"`);
    
    // Start the deep research
    const startTime = Date.now();
    
    const result = await conductDeepResearchWithPolling(TEST_QUERY, {
      systemPrompt: 'You are a research assistant providing detailed information about SaaS pricing strategies. Include comprehensive pricing data, trends, benchmarks, and citations in your research.',
      temperature: 0.1,
      maxTokens: 4000
    });
    
    // Calculate total time
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Display results summary
    log('\n=== Deep Research Test Results ===');
    log(`Request ID: ${result.requestId}`);
    log(`Total time: ${totalTime} seconds`);
    log(`Polling attempts: ${result.pollingAttempts || 'N/A'}`);
    log(`Model: ${result.model}`);
    log(`Content length: ${result.contentLength} characters`);
    log(`Citations: ${result.citationsCount}`);
    
    // Preview some of the content
    const previewLength = Math.min(500, result.content.length);
    log('\nContent Preview:');
    log('--------------------------------------');
    log(result.content.substring(0, previewLength) + '...');
    log('--------------------------------------');
    
    // Show some citations
    if (result.citations && result.citations.length > 0) {
      log('\nSample Citations:');
      result.citations.slice(0, 5).forEach((citation, index) => {
        log(`${index + 1}. Title: ${citation.title || 'N/A'}`);
        log(`   URL: ${citation.url || 'N/A'}`);
      });
      
      if (result.citations.length > 5) {
        log(`... and ${result.citations.length - 5} more citations`);
      }
    }
    
    log(`\nFull content saved to: ${result.contentFilename}`);
    log(`Summary saved to: ${result.summaryFilename}`);
    
    log('\n=== Deep Research Test Completed Successfully ===');
    
  } catch (error) {
    log(`\n❌ Error during deep research test: ${error.message}`);
    if (error.response) {
      log(`API Error Status: ${error.response.status}`);
      log(`API Error Data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Run the test
runTest();