/**
 * Simple Direct Deep Research Test
 * 
 * A minimal test for the Perplexity deep research functionality
 * using direct API calls and CommonJS
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-sonar-small-128k-online';
const DEEP_RESEARCH_MODEL = 'sonar-deep-research';
const TEST_QUERY = 'What strategies should startups use to price their SaaS products in 2024?';

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
 * Execute a simple query against the Perplexity API
 */
async function executeQuery(query, options = {}) {
  const {
    model = DEFAULT_MODEL,
    systemPrompt = '',
    temperature = 0.2,
    maxTokens = 2048,
    searchContext = 'single-source'
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
  
  // Add search context for deep research requests
  if (searchContext && model === DEEP_RESEARCH_MODEL) {
    requestData.search_context = { type: searchContext };
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  
  const response = await axios.post(PERPLEXITY_API_URL, requestData, { headers });
  
  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
  log(`Query completed in ${elapsedTime} seconds`);
  
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
 * Main test function
 */
async function runTest() {
  log('=== Starting Simple Direct Deep Research Test ===');
  
  if (!checkApiKey()) {
    return;
  }
  
  // Create a test-results directory if it doesn't exist
  try {
    await fs.mkdir('test-results', { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      log(`Error creating test-results directory: ${error.message}`);
    }
  }
  
  try {
    log(`Testing standard model with query: "${TEST_QUERY}"`);
    
    // Test standard model first
    const standardResult = await executeQuery(TEST_QUERY);
    const standardModel = extractModelInfo(standardResult.rawResponse, DEFAULT_MODEL);
    const standardContent = extractContent(standardResult.rawResponse);
    
    log(`Standard model (${standardModel}) results: ${standardContent.length} characters`);
    
    // Save the standard model result
    const standardFilename = path.join('test-results', `standard-test-${Date.now()}.json`);
    await fs.writeFile(standardFilename, JSON.stringify(standardResult.rawResponse, null, 2));
    log(`Standard model results saved to ${standardFilename}`);
    
    // Now test deep research model
    log(`\nTesting deep research model with query: "${TEST_QUERY}"`);
    log('Note: This request will start the deep research process but may not complete within the script timeout');
    log('The process typically takes 5-30 minutes to complete on Perplexity servers');
    
    const deepResearchResult = await executeQuery(TEST_QUERY, {
      model: DEEP_RESEARCH_MODEL,
      systemPrompt: 'You are a research assistant conducting deep, comprehensive research.',
      searchContext: 'high'
    });
    
    const deepModel = extractModelInfo(deepResearchResult.rawResponse, DEEP_RESEARCH_MODEL);
    const deepContent = extractContent(deepResearchResult.rawResponse);
    
    log(`\nDeep research model (${deepModel}) initial response: ${deepContent.length} characters`);
    
    // Save the deep research result
    const deepFilename = path.join('test-results', `deep-research-test-${Date.now()}.json`);
    await fs.writeFile(deepFilename, JSON.stringify(deepResearchResult.rawResponse, null, 2));
    log(`Deep research model results saved to ${deepFilename}`);
    
    // Display status from deep research
    log('\nDeep Research Status:');
    if (deepResearchResult.rawResponse.choices && 
        deepResearchResult.rawResponse.choices[0] && 
        deepResearchResult.rawResponse.choices[0].delta) {
      log(`Delta: ${JSON.stringify(deepResearchResult.rawResponse.choices[0].delta)}`);
    }
    
    log('=== Test Completed ===');
    
  } catch (error) {
    log(`Error during test: ${error.message}`);
    if (error.response) {
      log(`API Error Status: ${error.response.status}`);
      log(`API Error Data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Run the test
runTest();