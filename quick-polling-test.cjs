/**
 * Quick Polling Test
 * 
 * This script demonstrates the polling mechanism with the standard model
 * for faster execution
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const STANDARD_MODEL = 'llama-3.1-sonar-small-128k-online';
const TEST_QUERY = 'What are the top 5 SaaS pricing optimization strategies for 2024?';
const MAX_POLLING_ATTEMPTS = 10;
const POLLING_INTERVAL_MS = 2000; // 2 seconds for quicker test

// Helper for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Simple logger
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
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
 * Execute a query against the Perplexity API
 */
async function executeQuery(query, options = {}) {
  const {
    model = STANDARD_MODEL,
    systemPrompt = '',
    temperature = 0.2,
    maxTokens = 2048
  } = options;
  
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    throw new Error('Perplexity API key is required');
  }
  
  log(`Querying Perplexity with model ${model}: "${query}"`);
  
  const startTime = Date.now();
  
  const requestData = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query }
    ],
    max_tokens: maxTokens,
    temperature
  };
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  
  const response = await axios.post(PERPLEXITY_API_URL, requestData, { headers });
  
  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
  log(`Initial API call completed in ${elapsedTime} seconds`);
  
  return {
    rawResponse: response.data,
    elapsedTime
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
  if (!response) {
    return [];
  }
  
  // If response has a citations array, use it
  if (response.citations && Array.isArray(response.citations)) {
    return response.citations;
  }
  
  return [];
}

/**
 * Process the completed API response
 */
async function processResponse(response) {
  // Extract information
  const modelInfo = extractModelInfo(response);
  const content = extractContent(response);
  const citations = extractCitations(response);
  
  // Create test-results directory if needed
  try {
    await fs.mkdir('test-results', { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      log(`Error creating test-results directory: ${error.message}`);
    }
  }
  
  // Save results
  const timestamp = Date.now();
  
  const responseFilename = path.join('test-results', `quick-test-response-${timestamp}.json`);
  await fs.writeFile(responseFilename, JSON.stringify(response, null, 2));
  
  const contentFilename = path.join('test-results', `quick-test-content-${timestamp}.md`);
  await fs.writeFile(contentFilename, content);
  
  // Return summary
  return {
    model: modelInfo,
    contentLength: content.length,
    citationsCount: citations.length,
    content,
    citations,
    responseFilename,
    contentFilename
  };
}

/**
 * Main test function
 */
async function runTest() {
  log('=== Starting Quick Polling Test ===');
  
  if (!checkApiKey()) {
    return;
  }
  
  try {
    log(`Testing with query: "${TEST_QUERY}"`);
    
    // Start the query
    const startTime = Date.now();
    const result = await executeQuery(TEST_QUERY, {
      systemPrompt: 'You are a research assistant providing detailed information about SaaS pricing strategies.',
      temperature: 0.1,
      maxTokens: 2000
    });
    
    // Process the response
    const processed = await processResponse(result.rawResponse);
    
    // Summary
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log('\n=== Test Results ===');
    log(`Total time: ${totalTime} seconds`);
    log(`Model: ${processed.model}`);
    log(`Content length: ${processed.contentLength} characters`);
    log(`Citations: ${processed.citationsCount}`);
    
    // Preview some of the content
    const previewLength = Math.min(500, processed.content.length);
    log('\nContent Preview:');
    log('--------------------------------------');
    log(processed.content.substring(0, previewLength) + '...');
    log('--------------------------------------');
    
    // Show citations
    if (processed.citations.length > 0) {
      log('\nCitations:');
      processed.citations.forEach((citation, index) => {
        log(`${index + 1}. ${citation}`);
      });
    }
    
    log(`\nFull response saved to: ${processed.responseFilename}`);
    log(`Content saved to: ${processed.contentFilename}`);
    
    log('\n=== Test Completed Successfully ===');
    
  } catch (error) {
    log(`\n❌ Error during test: ${error.message}`);
    if (error.response) {
      log(`API Error Status: ${error.response.status}`);
      log(`API Error Data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Run the test
runTest();