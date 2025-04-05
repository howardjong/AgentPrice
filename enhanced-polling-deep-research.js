/**
 * Enhanced Polling Deep Research Test
 * 
 * This script tests the Perplexity deep research API and implements
 * a polling mechanism to handle long-running research requests.
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

// Constants
const MAX_POLLING_ATTEMPTS = 3; // Keep low for initial test, real polling happens in check-status
const POLLING_INTERVAL_MS = 10000; // 10 seconds
const TEST_RESULTS_DIR = 'test-results';
const DEEP_RESEARCH_DIR = path.join(TEST_RESULTS_DIR, 'deep-research');
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// Command line arguments
const args = process.argv.slice(2);
const skipPolling = args.includes('--skip-polling');
const quickMode = args.includes('--quick');
const customQuery = args.find(arg => arg.startsWith('--query='))?.split('=')[1];

function generateRequestId() {
  return Math.random().toString(16).substring(2, 10);
}

async function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function checkApiKey() {
  if (!PERPLEXITY_API_KEY) {
    await log('❌ Error: PERPLEXITY_API_KEY environment variable is not set');
    process.exit(1);
  }
  
  await log('✅ Perplexity API key is available');
}

/**
 * Execute a query against the Perplexity API with the deep research model
 */
async function initiateDeepResearch(query, options = {}) {
  const requestId = options.requestId || generateRequestId();
  const model = options.model || 'sonar-deep-research';
  const systemPrompt = options.systemPrompt || 'You are an expert business analyst and pricing strategist. Provide comprehensive research with specific examples, industry standards, and best practices. Cite credible sources when possible.';
  const maxTokens = options.maxTokens || 4000;
  const temperature = options.temperature || 0.2;
  const searchContext = options.searchContext || 'high';
  
  await log(`Starting deep research [${requestId}] with query: "${query}"`);
  
  try {
    // Ensure the test results directory exists
    await fs.mkdir(TEST_RESULTS_DIR, { recursive: true });
    await fs.mkdir(DEEP_RESEARCH_DIR, { recursive: true });
    
    // Save intermediate request information
    const intermediateData = {
      requestId,
      query,
      options: {
        model,
        systemPrompt,
        temperature,
        maxTokens,
        searchContext
      },
      status: 'starting',
      startTime: new Date().toISOString()
    };
    
    const intermediateFilePath = path.join(
      DEEP_RESEARCH_DIR,
      `request-${requestId}-${intermediateData.startTime.replace(/:/g, '-')}-intermediate.json`
    );
    
    await fs.writeFile(intermediateFilePath, JSON.stringify(intermediateData, null, 2));
    
    // Log the API request we're about to make
    await log(`Sending request to https://api.perplexity.ai/chat/completions with model ${model}`);
    
    // Make the API request
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        max_tokens: maxTokens,
        temperature,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Check for poll URL in the response
    const pollUrl = extractPollUrl(response.data);
    
    if (pollUrl) {
      await log(`[${requestId}] Deep research started, polling URL received: ${pollUrl}`);
      
      // Update intermediate data with poll URL
      intermediateData.pollUrl = pollUrl;
      intermediateData.status = 'in_progress';
      intermediateData.initialResponseData = response.data;
      await fs.writeFile(intermediateFilePath, JSON.stringify(intermediateData, null, 2));
      
      // Decide whether to poll or exit early
      if (skipPolling) {
        await log(`[${requestId}] Polling skipped due to --skip-polling flag`);
        await log(`[${requestId}] Poll URL saved to ${intermediateFilePath}`);
        await log(`[${requestId}] Run check-deep-research-status.js to check status later`);
        return { pollUrl, status: 'in_progress', requestId };
      } else {
        // Do minimal polling to get an idea of the status
        return await pollForCompletion(pollUrl, requestId);
      }
    } else {
      // If there's no poll URL, this is likely a direct response
      await log(`[${requestId}] No polling URL found, processing direct response`);
      
      // Save the response data
      const responseFilePath = path.join(
        TEST_RESULTS_DIR,
        `standard-test-${Date.now()}.json`
      );
      
      await saveResponseToFile(response.data, responseFilePath);
      
      // Extract model info
      const modelInfo = extractModelInfo(response.data);
      await log(`[${requestId}] Using model: ${modelInfo}`);
      
      // Extract content
      const content = extractContent(response.data);
      const contentPreview = content.substring(0, 150) + (content.length > 150 ? '...' : '');
      await log(`[${requestId}] Response preview: ${contentPreview}`);
      
      // Save content to a separate file
      const contentFilePath = path.join(
        TEST_RESULTS_DIR,
        `quick-test-content-${Date.now()}.md`
      );
      
      await fs.writeFile(contentFilePath, content);
      await log(`[${requestId}] Saved content to ${contentFilePath}`);
      
      return { 
        status: 'completed',
        model: modelInfo,
        content: contentPreview,
        contentPath: contentFilePath,
        responsePath: responseFilePath,
        requestId
      };
    }
    
  } catch (error) {
    await log(`[${requestId}] Error initiating deep research: ${error.message}`);
    
    if (error.response) {
      await log(`[${requestId}] API Error Status: ${error.response.status}`);
      await log(`[${requestId}] API Error Data: ${JSON.stringify(error.response.data)}`);
      
      // Save error response
      const errorFilePath = path.join(
        TEST_RESULTS_DIR,
        `deep-research-error-initial-${requestId}.json`
      );
      
      await fs.writeFile(errorFilePath, JSON.stringify(error.response.data, null, 2));
      await log(`Saved response to ${errorFilePath}`);
    }
    
    throw error;
  }
}

/**
 * Poll for deep research completion
 */
async function pollForCompletion(pollUrl, requestId, maxAttempts = MAX_POLLING_ATTEMPTS) {
  await log(`[${requestId}] Starting polling for completion, max attempts: ${maxAttempts}`);
  
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    await log(`[${requestId}] Polling attempt ${attempts} of ${maxAttempts}`);
    
    try {
      const response = await axios.get(pollUrl, {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Extract response data
      const status = getResponseStatus(response.data);
      await log(`[${requestId}] Current status: ${status}`);
      
      // If research is complete, return the result
      if (status === 'completed') {
        const modelInfo = extractModelInfo(response.data);
        const content = extractContent(response.data);
        const contentPreview = content.substring(0, 150) + (content.length > 150 ? '...' : '');
        
        await log(`[${requestId}] Research completed using model: ${modelInfo}`);
        await log(`[${requestId}] Content preview: ${contentPreview}`);
        
        // Save full response
        const responseFilePath = path.join(
          TEST_RESULTS_DIR,
          `deep-research-complete-${requestId}-${Date.now()}.json`
        );
        
        await saveResponseToFile(response.data, responseFilePath);
        
        // Save content to a separate file
        const contentFilePath = path.join(
          TEST_RESULTS_DIR,
          `deep-research-content-${requestId}-${Date.now()}.md`
        );
        
        await fs.writeFile(contentFilePath, content);
        await log(`[${requestId}] Saved content to ${contentFilePath}`);
        
        return {
          status: 'completed',
          model: modelInfo,
          content: contentPreview,
          contentPath: contentFilePath,
          responsePath: responseFilePath,
          requestId
        };
      }
      
      // Update the intermediate file with the latest polling data
      const intermediateFiles = await fs.readdir(DEEP_RESEARCH_DIR);
      const matchingFile = intermediateFiles.find(file => file.includes(requestId) && file.includes('intermediate'));
      
      if (matchingFile) {
        const intermediateFilePath = path.join(DEEP_RESEARCH_DIR, matchingFile);
        const dataContent = await fs.readFile(intermediateFilePath, 'utf8');
        const data = JSON.parse(dataContent);
        
        data.latestPollingResponse = response.data;
        data.latestPollingAttempt = attempts;
        data.latestPollingTime = new Date().toISOString();
        
        await fs.writeFile(intermediateFilePath, JSON.stringify(data, null, 2));
      }
      
      // If still in progress, wait before next attempt
      if (status === 'in_progress' || status === 'processing') {
        await log(`[${requestId}] Still in progress, waiting ${POLLING_INTERVAL_MS/1000} seconds before next attempt`);
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
      } else {
        // Unknown status, log it and try again
        await log(`[${requestId}] Unknown status: ${status}, response: ${JSON.stringify(response.data)}`);
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
      }
      
    } catch (error) {
      await log(`[${requestId}] Error polling for completion (attempt ${attempts}): ${error.message}`);
      
      if (error.response) {
        await log(`[${requestId}] API Error Status: ${error.response.status}`);
        await log(`[${requestId}] API Error Data: ${JSON.stringify(error.response.data)}`);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
    }
  }
  
  // If we reach here, polling is complete but research is still in progress
  await log(`[${requestId}] Reached maximum polling attempts (${maxAttempts})`);
  await log(`[${requestId}] Deep research is still in progress, you can check later using check-deep-research-status.js`);
  
  return {
    status: 'in_progress',
    requestId,
    message: `Research still in progress after ${maxAttempts} polling attempts`
  };
}

/**
 * Utility to save response data to a file
 */
async function saveResponseToFile(response, filename) {
  await fs.writeFile(filename, JSON.stringify(response, null, 2));
  await log(`Saved response to ${filename}`);
  return filename;
}

/**
 * Get the status of a response (completed, in_progress, etc.)
 */
function getResponseStatus(response) {
  if (!response) return 'unknown';
  
  if (response.error) return 'error';
  
  // Check for content in the response which indicates completion
  if (response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) {
    return 'completed';
  }
  
  // If there's a status field, use that
  if (response.status) {
    return response.status;
  }
  
  // If there's a poll URL, it's still in progress
  if (response.poll_url) {
    return 'in_progress';
  }
  
  return 'unknown';
}

/**
 * Extract poll URL from response
 */
function extractPollUrl(response) {
  if (response && response.poll_url) {
    return response.poll_url;
  }
  return null;
}

/**
 * Extract model information from a Perplexity API response
 */
function extractModelInfo(response, defaultModel = "unknown") {
  if (!response) return defaultModel;
  
  if (response.model) {
    return response.model;
  }
  
  if (response.choices && 
      response.choices.length > 0 && 
      response.choices[0].message && 
      response.choices[0].message.role === 'assistant' && 
      response.choices[0].message.tool_calls &&
      response.choices[0].message.tool_calls.length > 0 &&
      response.choices[0].message.tool_calls[0].function &&
      response.choices[0].message.tool_calls[0].function.arguments) {
    
    try {
      const args = JSON.parse(response.choices[0].message.tool_calls[0].function.arguments);
      if (args.model) {
        return args.model;
      }
    } catch (e) {
      // Unable to parse arguments
    }
  }
  
  return defaultModel;
}

/**
 * Extract content from Perplexity response
 */
function extractContent(response) {
  if (!response) return '';
  
  // Standard completion format
  if (response.choices && 
      response.choices.length > 0 && 
      response.choices[0].message &&
      response.choices[0].message.content) {
    return response.choices[0].message.content;
  }
  
  // Extended tool call format
  if (response.choices && 
      response.choices.length > 0 && 
      response.choices[0].message && 
      response.choices[0].message.tool_calls &&
      response.choices[0].message.tool_calls.length > 0 &&
      response.choices[0].message.tool_calls[0].function &&
      response.choices[0].message.tool_calls[0].function.arguments) {
    
    try {
      const args = JSON.parse(response.choices[0].message.tool_calls[0].function.arguments);
      if (args.content) {
        return args.content;
      }
    } catch (e) {
      // Unable to parse arguments
    }
  }
  
  // Fallback
  if (response.content) {
    return response.content;
  }
  
  return JSON.stringify(response);
}

/**
 * Main test function which initiates deep research and polls for the result
 */
async function runPolledDeepResearch(maxPollingTime = 2) {
  await log(`=== Starting Enhanced Polling Deep Research Test ===`);
  await checkApiKey();
  
  // Define the query
  let query = customQuery || "What are the most effective pricing strategies for SaaS startups in 2024, and how do they compare across different market segments and growth stages?";
  
  // If in quick mode, use a simpler query
  if (quickMode) {
    query = customQuery || "What are the top 5 pricing strategies for SaaS startups in 2024?";
  }
  
  await log(`Testing deep research with query: "${query}"`);
  
  try {
    // Set up options
    const options = {
      requestId: uuidv4().replace(/-/g, '').substring(0, 16),
      model: 'sonar-deep-research', // Correct model name
      maxTokens: quickMode ? 2000 : 4000,
      searchContext: 'high'
    };
    
    // Execute the deep research query
    const result = await initiateDeepResearch(query, options);
    
    // Report the result
    if (result.status === 'completed') {
      await log(`\n✅ Deep research completed successfully using model: ${result.model}`);
      await log(`Content saved to: ${result.contentPath}`);
      await log(`Full response saved to: ${result.responsePath}`);
    } else if (result.status === 'in_progress') {
      await log(`\n⏳ Deep research is still in progress`);
      await log(`You can check the status later using check-deep-research-status.js`);
      
      if (result.pollUrl) {
        await log(`Poll URL: ${result.pollUrl}`);
      }
    } else {
      await log(`\n❓ Unknown status: ${result.status}`);
    }
    
    return result;
    
  } catch (error) {
    await log(`\n❌ Error during deep research test: ${error.message}`);
    
    if (error.response) {
      await log(`API Error Status: ${error.response.status}`);
      await log(`API Error Data: ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Test function with configurable options
 */
async function runTest(options = {}) {
  if (skipPolling) {
    await log('Running test with polling skipped');
  }
  
  if (quickMode) {
    await log('Running in quick mode with simplified query');
  }
  
  if (customQuery) {
    await log(`Using custom query: "${customQuery}"`);
  }
  
  try {
    await runPolledDeepResearch(options.maxPollingTime || 2);
  } catch (error) {
    await log(`Test failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the test with command line options
runTest().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});