/**
 * Enhanced Deep Research Test with Improved Model Detection
 * 
 * This script tests the Perplexity deep research functionality with proper
 * model naming conventions, improved polling detection, and robust result handling.
 * 
 * Features:
 * - Uses the correct 'sonar-deep-research' model name
 * - Implements robust poll URL detection
 * - Enhanced error logging
 * - Proper timeout handling
 * - Detailed success/failure tracking
 */

import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const API_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const RESULTS_DIR = path.join(process.cwd(), 'test-results', 'deep-research');
const COMPLETED_DIR = path.join(process.cwd(), 'test-results', 'deep-research-completed');
const MAX_POLLING_ATTEMPTS = 60; // 30 minutes with 30-second intervals
const POLLING_INTERVAL = 30000; // 30 seconds
const LOG_FILE = 'enhanced-deep-research-test.log';

/**
 * Generate a unique request ID
 */
function generateRequestId() {
  return uuidv4().substr(0, 8);
}

/**
 * Append to log file
 */
async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  try {
    await fs.appendFile(LOG_FILE, logMessage + '\n');
  } catch (error) {
    console.error(`Error writing to log file: ${error.message}`);
  }
}

/**
 * Ensure necessary directories exist
 */
async function ensureDirectories() {
  try {
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    await fs.mkdir(COMPLETED_DIR, { recursive: true });
    await log('✅ Directories created successfully');
  } catch (error) {
    await log(`❌ Error creating directories: ${error.message}`);
  }
}

/**
 * Check if API key is set
 */
function checkApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY environment variable is not set');
  }
  return apiKey;
}

/**
 * Initiate deep research request
 */
async function initiateDeepResearch(query, options = {}) {
  const requestId = options.requestId || generateRequestId();
  
  await log(`Starting deep research [${requestId}] with query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
  
  // Prepare request payload
  const model = 'sonar-deep-research'; // Correct model name
  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: options.systemPrompt || 'You are a knowledgeable research assistant with access to up-to-date information.'
      },
      {
        role: 'user',
        content: query
      }
    ],
    temperature: options.temperature || 0.3,
    max_tokens: options.maxTokens || 4000,
    search_context: options.searchContext || 'high'
  };
  
  // Save the intermediate request data
  const intermediateFile = path.join(RESULTS_DIR, `request-${requestId}-${new Date().toISOString().replace(/:/g, '-')}-intermediate.json`);
  await fs.writeFile(intermediateFile, JSON.stringify({
    requestId,
    timestamp: new Date().toISOString(),
    query,
    model,
    options: {
      temperature: payload.temperature,
      maxTokens: payload.max_tokens,
      searchContext: payload.search_context
    },
    payload
  }, null, 2));
  
  await log(`Sending request to ${API_ENDPOINT} with model ${model}`);
  
  try {
    const apiKey = checkApiKey();
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      timeout: 60000 // 60 second timeout
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      await log(`❌ API Error: ${response.status} ${response.statusText}`);
      
      // Save error information
      const errorFile = path.join(RESULTS_DIR, `error-${requestId}-${new Date().toISOString().replace(/:/g, '-')}.json`);
      await fs.writeFile(errorFile, JSON.stringify({
        requestId,
        timestamp: new Date().toISOString(),
        query,
        status: response.status,
        statusText: response.statusText,
        error: errorData
      }, null, 2));
      
      return {
        success: false,
        requestId,
        status: 'error',
        error: `API Error: ${response.status} ${response.statusText}`,
        details: errorData
      };
    }
    
    const responseData = await response.json();
    await log(`✅ Received response from API (status: ${response.status})`);
    
    // Save the response data
    const responseFile = path.join(RESULTS_DIR, `response-${requestId}-${new Date().toISOString().replace(/:/g, '-')}.json`);
    await fs.writeFile(responseFile, JSON.stringify(responseData, null, 2));
    
    // Check if this is a polling response
    const pollUrl = extractPollUrl(responseData);
    
    if (pollUrl) {
      await log(`⏳ Research requires polling. Poll URL: ${pollUrl}`);
      
      // Save poll information
      const pollFile = path.join(RESULTS_DIR, `poll-${requestId}-${new Date().toISOString().replace(/:/g, '-')}.json`);
      await fs.writeFile(pollFile, JSON.stringify({
        requestId,
        timestamp: new Date().toISOString(),
        pollUrl,
        query
      }, null, 2));
      
      return {
        success: true,
        requestId,
        status: 'polling_required',
        pollUrl,
        data: responseData
      };
    } else if (isCompletedResponse(responseData)) {
      await log('✅ Research completed synchronously (unusual for deep research)');
      
      // Save completed result
      const completedFile = path.join(COMPLETED_DIR, `completed-${requestId}-${new Date().toISOString().replace(/:/g, '-')}.json`);
      await fs.writeFile(completedFile, JSON.stringify(responseData, null, 2));
      
      return {
        success: true,
        requestId,
        status: 'completed',
        data: responseData,
        content: extractContent(responseData),
        citations: extractCitations(responseData)
      };
    } else {
      await log('⚠️ Unclear response status (no poll URL and not completed)');
      
      return {
        success: true,
        requestId,
        status: 'unclear',
        data: responseData
      };
    }
  } catch (error) {
    await log(`❌ Error initiating deep research: ${error.message}`);
    
    // Save error information
    const errorFile = path.join(RESULTS_DIR, `error-${requestId}-${new Date().toISOString().replace(/:/g, '-')}.json`);
    await fs.writeFile(errorFile, JSON.stringify({
      requestId,
      timestamp: new Date().toISOString(),
      query,
      error: error.message,
      stack: error.stack
    }, null, 2));
    
    return {
      success: false,
      requestId,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Poll for research results
 */
async function pollForResults(pollUrl, requestId, maxAttempts = MAX_POLLING_ATTEMPTS) {
  if (!pollUrl) {
    await log(`❌ No poll URL provided for request ${requestId}`);
    return {
      success: false,
      requestId,
      status: 'error',
      error: 'No poll URL provided'
    };
  }
  
  await log(`Starting polling for request ${requestId}: ${pollUrl}`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await log(`Poll attempt ${attempt}/${maxAttempts} for request ${requestId}`);
    
    try {
      const apiKey = checkApiKey();
      
      const response = await fetch(pollUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 30000 // 30 second timeout
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        await log(`❌ Poll Error: ${response.status} ${response.statusText}`);
        
        // If this is a not found error, it might be that the poll URL is invalid
        if (response.status === 404) {
          await log(`⚠️ Poll URL returned 404 - this might be an invalid poll URL`);
        }
        
        // If this is not the last attempt, wait and continue
        if (attempt < maxAttempts) {
          const backoffTime = Math.min(POLLING_INTERVAL * Math.pow(1.5, attempt - 1), 5 * 60 * 1000); // Max 5 minutes
          await log(`Backing off for ${backoffTime/1000} seconds before retry`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          continue;
        }
        
        return {
          success: false,
          requestId,
          status: 'error',
          error: `Poll Error: ${response.status} ${response.statusText}`,
          details: errorData,
          pollAttempts: attempt
        };
      }
      
      const responseData = await response.json();
      
      // Save poll result
      const pollResultFile = path.join(RESULTS_DIR, `poll-result-${requestId}-attempt-${attempt}-${new Date().toISOString().replace(/:/g, '-')}.json`);
      await fs.writeFile(pollResultFile, JSON.stringify(responseData, null, 2));
      
      // Check if research is completed
      if (isCompletedResponse(responseData)) {
        await log(`✅ Research completed after ${attempt} polling attempts`);
        
        // Save completed result
        const completedFile = path.join(COMPLETED_DIR, `completed-${requestId}-${new Date().toISOString().replace(/:/g, '-')}.json`);
        await fs.writeFile(completedFile, JSON.stringify(responseData, null, 2));
        
        return {
          success: true,
          requestId,
          status: 'completed',
          data: responseData,
          content: extractContent(responseData),
          citations: extractCitations(responseData),
          pollAttempts: attempt
        };
      }
      
      await log(`⏳ Research still in progress after poll attempt ${attempt}`);
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
      
    } catch (error) {
      await log(`❌ Error during poll attempt ${attempt}: ${error.message}`);
      
      // If this is not the last attempt, wait and continue
      if (attempt < maxAttempts) {
        const backoffTime = Math.min(POLLING_INTERVAL * Math.pow(1.5, attempt - 1), 5 * 60 * 1000); // Max 5 minutes
        await log(`Backing off for ${backoffTime/1000} seconds before retry`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      } else {
        await log(`⚠️ Max polling attempts reached (${maxAttempts})`);
        return {
          success: false,
          requestId,
          status: 'error',
          error: `Max polling attempts reached: ${error.message}`,
          pollAttempts: attempt
        };
      }
    }
  }
  
  await log(`⏳ Polling timed out after ${maxAttempts} attempts`);
  return {
    success: false,
    requestId,
    status: 'timeout',
    error: 'Polling timed out'
  };
}

/**
 * Conduct complete deep research (initialization and polling)
 */
async function conductDeepResearch(query, options = {}) {
  const requestId = options.requestId || generateRequestId();
  const maxPollingTime = options.maxPollingTime || 30; // Default 30 minutes
  
  // Calculate max attempts based on polling time and interval
  const maxAttempts = Math.ceil((maxPollingTime * 60 * 1000) / POLLING_INTERVAL);
  
  await log(`Starting complete deep research process for query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
  await log(`Max polling time: ${maxPollingTime} minutes (${maxAttempts} attempts)`);
  
  try {
    // Initiate the research
    const initiateResult = await initiateDeepResearch(query, {
      ...options,
      requestId
    });
    
    if (!initiateResult.success) {
      await log(`❌ Failed to initiate deep research: ${initiateResult.error}`);
      return initiateResult;
    }
    
    // If polling is required, start polling
    if (initiateResult.status === 'polling_required' && initiateResult.pollUrl) {
      await log(`Starting polling phase for request ${requestId}`);
      
      return await pollForResults(
        initiateResult.pollUrl,
        requestId,
        maxAttempts
      );
    } else if (initiateResult.status === 'completed') {
      await log(`✅ Deep research completed without polling needed`);
      return initiateResult;
    } else {
      await log(`⚠️ Unclear status after initiating research: ${initiateResult.status}`);
      return initiateResult;
    }
  } catch (error) {
    await log(`❌ Error in deep research process: ${error.message}`);
    return {
      success: false,
      requestId,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Check if a response indicates completion
 */
function isCompletedResponse(response) {
  if (!response) return false;
  
  // Check for citations (usually indicates completion)
  if (response.citations && response.citations.length > 0) return true;
  
  // Check for choices with content
  if (response.choices && 
      response.choices[0] && 
      response.choices[0].message && 
      response.choices[0].message.content) {
    // If the finish_reason is 'stop', it's completed
    if (response.choices[0].finish_reason === 'stop') return true;
    
    // Even without a finish_reason, substantial content usually means completion
    const content = response.choices[0].message.content;
    if (content && content.length > 200) return true;
  }
  
  // Check for specific status field
  if (response.status === 'completed') return true;
  
  return false;
}

/**
 * Extract poll URL from response
 */
function extractPollUrl(response) {
  if (!response) return null;
  
  // Case 1: Direct poll_url field in response (most common)
  if (response.poll_url) return response.poll_url;
  
  // Case 2: Poll URL in choices array
  if (response.choices && response.choices[0]) {
    const choice = response.choices[0];
    
    // Check in the root of the choice
    if (choice.poll_url) return choice.poll_url;
    
    // Check in the message object
    if (choice.message && choice.message.poll_url) return choice.message.poll_url;
  }
  
  // Case 3: Poll URL in message object (root level)
  if (response.message && response.message.poll_url) return response.message.poll_url;
  
  // Case 4: Poll URL in metadata
  if (response.metadata && response.metadata.poll_url) return response.metadata.poll_url;
  
  return null;
}

/**
 * Extract content from response
 */
function extractContent(response) {
  if (!response) return null;
  
  // Case 1: Content in choices array (most common)
  if (response.choices && 
      response.choices[0] && 
      response.choices[0].message && 
      response.choices[0].message.content) {
    return response.choices[0].message.content;
  }
  
  // Case 2: Content directly in response
  if (response.content) return response.content;
  
  // Case 3: Content in message object
  if (response.message && response.message.content) return response.message.content;
  
  return null;
}

/**
 * Extract citations from response
 */
function extractCitations(response) {
  if (!response) return [];
  
  // Case 1: Citations directly in response (most common)
  if (response.citations) return response.citations;
  
  // Case 2: Citations in message object
  if (response.choices && 
      response.choices[0] && 
      response.choices[0].message && 
      response.choices[0].message.citations) {
    return response.choices[0].message.citations;
  }
  
  // Case 3: Citations in message object (root level)
  if (response.message && response.message.citations) return response.message.citations;
  
  return [];
}

/**
 * Main function
 */
async function main() {
  await log('=== Starting Enhanced Deep Research Test ===');
  
  try {
    // Check API key
    checkApiKey();
    await log('✅ Perplexity API key is available');
    
    // Ensure directories exist
    await ensureDirectories();
    
    // Define a research query
    const query = 'What are the latest pricing strategies for SaaS companies in 2025, specifically focusing on value-based pricing models? Please include examples of successful implementation and case studies.';
    
    await log(`Starting deep research with query: "${query.substring(0, 100)}..."`);
    
    // Run the complete research process with a 30-minute timeout
    const result = await conductDeepResearch(query, {
      temperature: 0.3,
      maxTokens: 4000,
      maxPollingTime: 30, // 30 minutes
      systemPrompt: 'You are a knowledgeable research assistant specializing in business strategy and pricing models. Provide detailed, well-structured answers with specific examples and data points.'
    });
    
    if (result.success && result.status === 'completed') {
      await log('✅ Deep research completed successfully!');
      await log(`Content length: ${result.content ? result.content.length : 0} characters`);
      await log(`Citations: ${result.citations ? result.citations.length : 0}`);
    } else {
      await log(`❌ Deep research did not complete successfully: ${result.error || 'Unknown error'}`);
    }
    
  } catch (error) {
    await log(`❌ Fatal error in test execution: ${error.message}`);
    console.error(error);
  } finally {
    await log('=== Enhanced Deep Research Test Complete ===');
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error in main function:', error);
  process.exit(1);
});