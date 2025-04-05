/**
 * Perplexity Deep Research Polled Test
 * 
 * This script tests the Perplexity API with the sonar-deep-research model
 * using a polling mechanism to handle longer execution times.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const DEEP_RESEARCH_MODEL = 'sonar-deep-research';
const OUTPUT_DIR = 'test-results/deep-research';
const TEST_QUERY = 'What strategies should startups use to price their SaaS products in 2024?';
const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = 60;  // 5 minutes total

// Helper for logging
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Check API key
function checkApiKey() {
  if (!process.env.PERPLEXITY_API_KEY) {
    log('⚠️ PERPLEXITY_API_KEY environment variable is not set');
    process.exit(1);
  }
  log('✅ Perplexity API key is available');
}

/**
 * Execute a query against the Perplexity API with polling for completion
 */
async function executeDeepResearchQuery(query, options = {}) {
  const requestId = uuidv4().substring(0, 8);
  
  const {
    model = DEEP_RESEARCH_MODEL,
    systemPrompt = '',
    temperature = 0.2,
    maxTokens = 4000,
    searchContext = "high",
    pollInterval = POLL_INTERVAL_MS,
    maxAttempts = MAX_POLL_ATTEMPTS
  } = options;
  
  log(`[${requestId}] Starting deep research query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
  log(`[${requestId}] Using model: ${model}, search context: ${searchContext}`);
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
    };
    
    const requestData = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      max_tokens: maxTokens,
      temperature,
      search_context: searchContext,
      // Setting stream to false for this test
      stream: false,
      // Add a unique ID to help track the request
      metadata: {
        request_id: requestId
      }
    };
    
    // Create a file to store intermediate results
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const intermediateFile = path.join(OUTPUT_DIR, `request-${requestId}-${timestamp}-intermediate.json`);
    const finalFile = path.join(OUTPUT_DIR, `request-${requestId}-${timestamp}-final.json`);
    
    // Save request information
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(intermediateFile, JSON.stringify({
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
    }, null, 2));
    
    // Start timing
    const startTime = Date.now();
    
    // Make the initial API request
    log(`[${requestId}] Sending request to Perplexity API`);
    const response = await axios.post(PERPLEXITY_API_URL, requestData, { headers });
    const initialDuration = (Date.now() - startTime) / 1000;
    
    // If we get an immediate response, process it
    if (response.data && response.status === 200) {
      log(`[${requestId}] Query completed immediately in ${initialDuration.toFixed(2)} seconds!`);
      
      // Process response
      const result = processResponse(response.data, model, query, requestId);
      
      // Save result
      await fs.writeFile(finalFile, JSON.stringify({
        requestId,
        query,
        options: {
          model,
          systemPrompt,
          temperature,
          maxTokens,
          searchContext
        },
        status: 'completed',
        startTime: new Date().toISOString(),
        completionTime: new Date().toISOString(),
        duration: initialDuration,
        result
      }, null, 2));
      
      return result;
    }
    
    // If we get here, the request is still processing or we need to poll
    log(`[${requestId}] Request accepted but still processing. Starting polling...`);
    
    // Save intermediate state
    await fs.writeFile(intermediateFile, JSON.stringify({
      requestId,
      query,
      options: {
        model,
        systemPrompt,
        temperature,
        maxTokens,
        searchContext
      },
      status: 'polling',
      startTime: new Date().toISOString(),
      lastPollTime: new Date().toISOString(),
      pollAttempt: 0
    }, null, 2));
    
    // Start polling for results
    let pollAttempt = 0;
    while (pollAttempt < maxAttempts) {
      log(`[${requestId}] Polling attempt ${pollAttempt + 1}/${maxAttempts}...`);
      
      // Wait for the poll interval
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      try {
        // Poll for result - in a real implementation, we would have an endpoint to check
        // For this test, we'll just make the request again
        const pollResponse = await axios.post(PERPLEXITY_API_URL, requestData, { headers });
        const currentDuration = (Date.now() - startTime) / 1000;
        
        // Update intermediate state
        await fs.writeFile(intermediateFile, JSON.stringify({
          requestId,
          query,
          options: {
            model,
            systemPrompt,
            temperature,
            maxTokens,
            searchContext
          },
          status: 'polling',
          startTime: new Date().toISOString(),
          lastPollTime: new Date().toISOString(),
          pollAttempt,
          currentDuration: `${currentDuration.toFixed(2)} seconds`
        }, null, 2));
        
        // If we get a response, process it
        if (pollResponse.data && pollResponse.status === 200) {
          log(`[${requestId}] Query completed on poll ${pollAttempt + 1} in ${currentDuration.toFixed(2)} seconds!`);
          
          // Process response
          const result = processResponse(pollResponse.data, model, query, requestId);
          
          // Save result
          await fs.writeFile(finalFile, JSON.stringify({
            requestId,
            query,
            options: {
              model,
              systemPrompt,
              temperature,
              maxTokens,
              searchContext
            },
            status: 'completed',
            startTime: new Date().toISOString(),
            completionTime: new Date().toISOString(),
            duration: currentDuration,
            pollAttempts: pollAttempt + 1,
            result
          }, null, 2));
          
          return result;
        }
        
      } catch (error) {
        log(`[${requestId}] Error on poll ${pollAttempt + 1}: ${error.message}`);
        
        // If we get a rate limit error, wait longer
        if (error.response && error.response.status === 429) {
          const extraWait = 10000; // 10 seconds extra
          log(`[${requestId}] Rate limit hit, waiting an extra ${extraWait/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, extraWait));
        }
      }
      
      pollAttempt++;
    }
    
    // If we get here, we've exceeded the maximum number of polling attempts
    throw new Error(`Exceeded maximum polling attempts (${maxAttempts})`);
    
  } catch (error) {
    log(`[${requestId}] ❌ Error executing deep research query: ${error.message}`);
    if (error.response) {
      log(`[${requestId}] Status: ${error.response.status}`);
      log(`[${requestId}] Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    throw error;
  }
}

/**
 * Process API response
 */
function processResponse(response, defaultModel, query, requestId) {
  // Extract data from response
  const modelInfo = extractModelInfo(response, defaultModel);
  const content = extractContent(response);
  const citations = extractCitations(response);
  
  // Log summary
  log(`[${requestId}] Model used: ${modelInfo}`);
  log(`[${requestId}] Content length: ${content.length} characters`);
  log(`[${requestId}] Citations found: ${citations.length}`);
  
  return {
    content,
    model: modelInfo,
    citations,
    rawResponse: response,
    requestOptions: {
      query,
      model: defaultModel
    }
  };
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
  
  // Try to extract from choices.metadata (possible format)
  if (response.choices && response.choices[0] && response.choices[0].metadata && response.choices[0].metadata.model) {
    return response.choices[0].metadata.model;
  }
  
  // Try to extract from content text (fallback)
  if (response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) {
    const content = response.choices[0].message.content;
    
    // Look for model mentions in text - pattern: "using the sonar-advanced model"
    const modelMentionRegex = /using\s+(?:the\s+)?['"]?(sonar|llama|claude)[-\w.]*/i;
    const match = content.match(modelMentionRegex);
    
    if (match && match[0]) {
      // Extract just the model name by removing the leading text
      return match[0].replace(/^using\s+(?:the\s+)?['"]?/i, '').trim();
    }
    
    // Secondary pattern: "model: sonar" or "model is sonar-advanced"
    const modelColonRegex = /model(?::|is|=)\s+['"]?(sonar|llama|claude)[-\w.]*/i;
    const matchColon = content.match(modelColonRegex);
    
    if (matchColon && matchColon[0]) {
      return matchColon[0].replace(/^model(?::|is|=)\s+['"]?/i, '').trim();
    }
  }
  
  // If all extraction attempts fail, return the default
  return defaultModel;
}

/**
 * Extract citations from Perplexity response
 */
function extractCitations(response) {
  if (!response) {
    return [];
  }
  
  // If response has a citations array, use it (new format)
  if (response.citations && Array.isArray(response.citations)) {
    return response.citations;
  }
  
  // Extract content from new format structure
  let content = '';
  if (response.choices && response.choices[0] && response.choices[0].message) {
    content = response.choices[0].message.content;
  } else if (response.content) {
    // Old format
    content = response.content;
  }
  
  // If no content to parse, return empty array
  if (!content) {
    return [];
  }
  
  // Extract citations from text using regex pattern matching
  const citations = [];
  const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  const matches = content.match(urlRegex);
  
  if (matches) {
    // Filter out duplicates
    return [...new Set(matches)];
  }
  
  return citations;
}

/**
 * Extract content from Perplexity response
 */
function extractContent(response) {
  if (!response) {
    return '';
  }
  
  // Handle new format (choices array with messages)
  if (response.choices && response.choices[0] && response.choices[0].message) {
    return response.choices[0].message.content;
  }
  
  // Handle old format (direct content property)
  if (response.content) {
    return response.content;
  }
  
  // Fallback for unknown format
  return JSON.stringify(response);
}

/**
 * Main test function
 */
async function runTest() {
  log('=== Starting Perplexity Deep Research Polled Test ===');
  
  try {
    // Check API key
    checkApiKey();
    
    // Create output directories
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Run deep research query
    log(`Starting deep research query test with: "${TEST_QUERY}"`);
    
    const systemPrompt = 'You are an expert business analyst and pricing strategist. Provide comprehensive research with specific examples, industry standards, and best practices. Cite credible sources when possible.';
    
    // Note: Reduced polling parameters for the test
    const results = await executeDeepResearchQuery(TEST_QUERY, {
      model: DEEP_RESEARCH_MODEL,
      systemPrompt,
      temperature: 0.2,
      searchContext: "high",
      // Poll every 10 seconds for a maximum of 2 minutes
      pollInterval: 10000,
      maxAttempts: 12
    });
    
    // Preview content
    log('\nContent Preview:');
    log('--------------------------------------');
    log(results.content.substring(0, 500) + '...');
    log('--------------------------------------');
    
    // Preview citations
    if (results.citations.length > 0) {
      log('\nCitations:');
      results.citations.forEach((citation, i) => {
        log(`${i+1}. ${citation}`);
      });
    }
    
    log('=== Deep Research Polled Test Completed Successfully ===');
    return { success: true, results };
    
  } catch (error) {
    log(`Error in test: ${error.message}`);
    if (error.stack) {
      log(`Stack trace: ${error.stack}`);
    }
    return { success: false, error: error.message };
  }
}

// Run the test
runTest().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});