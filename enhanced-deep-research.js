/**
 * Enhanced Deep Research with Polling - ES Module Version
 * 
 * This script does a complete end-to-end deep research request using
 * Perplexity API's sonar-deep-research model, with proper handling
 * of the poll URL and polling mechanism.
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Constants
const RESULTS_DIR = './test-results/deep-research';
const POLL_DIR = './data/poll_urls';
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const LOG_PREFIX = '[DEEP-RESEARCH]';
const MAX_POLLING_ATTEMPTS = 10;
const POLLING_INTERVAL_MS = 60000; // 1 minute

/**
 * Generate a unique request ID
 */
function generateRequestId() {
  return uuidv4().split('-')[0]; // First segment of UUID for brevity
}

/**
 * Logging helper
 */
async function log(message) {
  const logLine = `${new Date().toISOString()} ${LOG_PREFIX} ${message}`;
  console.log(logLine);
  
  // Also append to log file
  try {
    const logDir = './logs';
    await fs.mkdir(logDir, { recursive: true });
    await fs.appendFile(
      path.join(logDir, 'deep-research.log'), 
      logLine + '\n'
    );
  } catch (err) {
    console.error('Error writing to log file:', err.message);
  }
}

/**
 * Check if API key is set
 */
function checkApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY environment variable not set');
  }
  return apiKey;
}

/**
 * Initiate a deep research query
 */
async function initiateDeepResearch(query, options = {}) {
  const {
    model = 'sonar-deep-research',
    temperature = 0.7,
    maxTokens = 4000,
    requestId = generateRequestId(),
    searchContext = 'high',
  } = options;
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${checkApiKey()}`
  };
  
  const payload = {
    model,
    messages: [
      { role: 'system', content: 'You are a knowledgeable research assistant with access to up-to-date information.' },
      { role: 'user', content: query }
    ],
    temperature,
    max_tokens: maxTokens,
    search_context: searchContext,
  };
  
  await log(`Initiating deep research request ${requestId} with model '${model}'`);
  await log(`Query: "${query}"`);
  
  try {
    // Ensure directories exist
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    await fs.mkdir(POLL_DIR, { recursive: true });
    
    // Save request data
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const requestFile = `request-${requestId}-${timestamp}-intermediate.json`;
    const requestPath = path.join(RESULTS_DIR, requestFile);
    
    const requestData = {
      requestId,
      timestamp,
      query,
      model,
      options: { temperature, maxTokens, searchContext },
      payload
    };
    
    await fs.writeFile(requestPath, JSON.stringify(requestData, null, 2));
    
    // Make the API request
    await log(`Making API request to ${PERPLEXITY_API_URL}`);
    
    const response = await axios.post(PERPLEXITY_API_URL, payload, { headers });
    
    // Save the initial response
    const initialResponseFile = `request-${requestId}-${timestamp}-initial.json`;
    const initialResponsePath = path.join(RESULTS_DIR, initialResponseFile);
    
    const responseData = {
      requestId,
      timestamp,
      status: 'initiated',
      initialResponse: response.data
    };
    
    await fs.writeFile(initialResponsePath, JSON.stringify(responseData, null, 2));
    
    // Extract poll URL (most important part for async deep research)
    let pollUrl = null;
    
    // Try several methods to find the poll URL
    if (response.data?.choices?.[0]?.message?.poll_url) {
      pollUrl = response.data.choices[0].message.poll_url;
    } else if (response.data?.choices?.[0]?.poll_url) {
      pollUrl = response.data.choices[0].poll_url;
    } else if (response.data?.poll_url) {
      pollUrl = response.data.poll_url;
    } else {
      // Last resort - construct from ID if available
      const id = response.data?.id || requestId;
      pollUrl = `https://api.perplexity.ai/chat/completions/poll/${id}`;
      await log(`⚠️ No poll URL found in response, constructed one: ${pollUrl}`);
    }
    
    if (pollUrl) {
      await log(`Poll URL identified: ${pollUrl}`);
      
      // Save poll URL for future reference
      const pollUrlFile = `poll_url_${requestId}.json`;
      const pollUrlPath = path.join(POLL_DIR, pollUrlFile);
      
      await fs.writeFile(pollUrlPath, JSON.stringify({
        requestId, 
        timestamp,
        poll_url: pollUrl
      }, null, 2));
      
      return {
        requestId,
        status: 'initiated',
        pollUrl,
        initialResponse: response.data
      };
    } else {
      throw new Error('Failed to extract or construct poll URL from response');
    }
  } catch (error) {
    await log(`❌ Error initiating deep research: ${error.message}`);
    if (error.response) {
      await log(`Response status: ${error.response.status}`);
      await log(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Poll for deep research completion
 */
async function pollForResults(pollData, maxAttempts = MAX_POLLING_ATTEMPTS) {
  const { requestId, pollUrl } = pollData;
  
  await log(`Starting to poll for results of request ${requestId}`);
  await log(`Poll URL: ${pollUrl}`);
  
  const headers = {
    'Authorization': `Bearer ${checkApiKey()}`
  };
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await log(`Poll attempt ${attempt}/${maxAttempts}`);
      
      const response = await axios.get(pollUrl, { headers });
      
      // Save each poll response
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const pollResponseFile = `request-${requestId}-${timestamp}-poll-${attempt}.json`;
      const pollResponsePath = path.join(RESULTS_DIR, pollResponseFile);
      
      const respData = {
        requestId,
        pollAttempt: attempt,
        timestamp,
        pollUrl,
        response: response.data
      };
      
      await fs.writeFile(pollResponsePath, JSON.stringify(respData, null, 2));
      
      // Check if completed
      const isCompleted = checkIfCompleted(response.data);
      
      if (isCompleted) {
        await log(`✅ Request ${requestId} completed on poll attempt ${attempt}!`);
        
        // Save final response in a separate file for easy access
        const finalResponseFile = `request-${requestId}-${timestamp}-final-response.json`;
        const finalResponsePath = path.join(RESULTS_DIR, finalResponseFile);
        
        await fs.writeFile(finalResponsePath, JSON.stringify({
          requestId,
          status: 'completed',
          timestamp,
          pollUrl,
          finalResponse: response.data,
          content: extractContent(response.data),
          modelInfo: extractModelInfo(response.data),
          citations: extractCitations(response.data)
        }, null, 2));
        
        return {
          status: 'completed',
          finalResponse: response.data,
          content: extractContent(response.data)
        };
      } else {
        await log(`⏳ Request ${requestId} still in progress (attempt ${attempt}/${maxAttempts})...`);
        
        // Wait before next poll
        if (attempt < maxAttempts) {
          await log(`Waiting ${POLLING_INTERVAL_MS/1000} seconds before next poll...`);
          await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
        }
      }
    } catch (error) {
      await log(`❌ Error polling (attempt ${attempt}): ${error.message}`);
      if (error.response) {
        await log(`Response status: ${error.response.status}`);
        await log(`Response data: ${JSON.stringify(error.response.data || '')}`);
      }
      
      // Wait before retry
      if (attempt < maxAttempts) {
        const backoff = Math.min(30000, 2000 * Math.pow(2, attempt - 1));
        await log(`Backing off for ${backoff/1000} seconds before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
  }
  
  await log(`⚠️ Maximum poll attempts (${maxAttempts}) reached without completion for request ${requestId}`);
  return {
    status: 'timeout',
    requestId,
    message: `Maximum poll attempts (${maxAttempts}) reached without completion`
  };
}

/**
 * Check if a response indicates completion
 */
function checkIfCompleted(response) {
  return response?.choices?.[0]?.finish_reason === 'stop' || 
         response?.finish_reason === 'stop';
}

/**
 * Extract model information from a Perplexity API response
 */
function extractModelInfo(response, defaultModel = "unknown") {
  if (!response) return defaultModel;
  
  // Try various locations where model info might be present
  if (response.model) {
    return response.model;
  } else if (response.choices && response.choices[0]?.message?.model) {
    return response.choices[0].message.model;
  } else if (response.choices && response.choices[0]?.model) {
    return response.choices[0].model;
  }
  
  return defaultModel;
}

/**
 * Extract citations from Perplexity response
 */
function extractCitations(response) {
  if (!response) return [];
  
  // Try primary citations location
  if (response.citations && Array.isArray(response.citations)) {
    return response.citations;
  }
  
  // Check alternative locations
  if (response.choices && response.choices[0]?.message?.citations) {
    return response.choices[0].message.citations;
  }
  
  return [];
}

/**
 * Extract content from Perplexity response
 */
function extractContent(response) {
  if (!response) return '';
  
  // Try various locations where content might be present
  if (response.choices && response.choices[0]?.message?.content) {
    return response.choices[0].message.content;
  } else if (response.choices && response.choices[0]?.content) {
    return response.choices[0].content;
  } else if (response.content) {
    return response.content;
  }
  
  return '';
}

/**
 * Run a complete deep research query with polling
 */
async function runDeepResearch(query, options = {}) {
  try {
    // Step 1: Initiate deep research
    const initResult = await initiateDeepResearch(query, options);
    
    // Step 2: Poll for results
    return await pollForResults(initResult);
  } catch (error) {
    await log(`❌ Error in runDeepResearch: ${error.message}`);
    return { status: 'error', error: error.message };
  }
}

/**
 * Main function
 */
async function main() {
  await log('=== Starting Enhanced Deep Research Test ===');
  
  try {
    // Check API key
    checkApiKey();
    
    // Define research query
    const query = "What are the latest pricing strategies for SaaS companies in 2025, specifically focusing on value-based pricing models? Please include examples of successful implementation and case studies.";
    
    // Run deep research with polling
    await log(`Starting deep research with query: "${query}"`);
    const result = await runDeepResearch(query, {
      temperature: 0.3, // Lower temperature for more focused research
      maxTokens: 4000,  // Request substantial content
      searchContext: 'high' // High search depth
    });
    
    // Log final result
    if (result.status === 'completed') {
      await log('=== Deep Research Complete ===');
      
      // Log first 200 chars of content
      const contentPreview = result.content.substring(0, 200).replace(/\n/g, ' ');
      await log(`Result preview: ${contentPreview}...`);
    } else {
      await log(`=== Deep Research Failed: ${result.status} ===`);
      await log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    await log(`❌ Error in main: ${error.message}`);
  }
  
  await log('=== Enhanced Deep Research Test Complete ===');
}

// Run the script
main().catch(console.error);