/**
 * Simple Perplexity Real API Test
 * 
 * This script tests the Perplexity API with a real API key.
 * It's designed to run with the PERPLEXITY_API_KEY environment variable set.
 */

import fs from 'fs/promises';
import axios from 'axios';

// Global variables for logging and output
let output = [];
let queryResultFile = null;

function log(message) {
  console.log(message);
  output.push(message);
}

// Extract model info from Perplexity response
function extractModelInfo(response) {
  if (!response) return { model: 'unknown', hasModelInfo: false, hasReferences: false };
  
  const modelInfo = {
    model: response.model || 'unknown',
    hasModelInfo: !!response.model,
    hasReferences: Array.isArray(response.references) && response.references.length > 0,
    referenceCount: Array.isArray(response.references) ? response.references.length : 0,
    isDeepResearch: response.model === 'sonar-deep-research' || 
                    (response.search_context && !!response.search_context.query)
  };
  
  return modelInfo;
}

// Function to check if the API key is available
function checkApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    log('⚠️ PERPLEXITY_API_KEY environment variable is not set.');
    log('This test requires a valid Perplexity API key to run.');
    return false;
  }
  
  log('✓ PERPLEXITY_API_KEY is available.');
  return true;
}

// Function to query the Perplexity API
async function queryPerplexity(query, options = {}) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    throw new Error('Perplexity API key is not available.');
  }
  
  // Generate a unique file name for the response
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  queryResultFile = `perplexity-response-${timestamp}.txt`;
  
  const model = options.model || 'sonar';
  
  try {
    log(`Querying Perplexity API with model: ${model}`);
    log(`Query: "${query}"`);
    
    const response = await axios({
      method: 'post',
      url: 'https://api.perplexity.ai/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      data: {
        model: model,
        messages: [{ role: 'user', content: query }]
      },
      timeout: 30000 // 30 second timeout
    });
    
    if (!response.data || !response.data.choices || !response.data.choices.length) {
      throw new Error('Invalid response from Perplexity API');
    }
    
    const result = response.data.choices[0].message.content;
    
    // Save the full response to file
    await fs.writeFile(queryResultFile, JSON.stringify(response.data, null, 2));
    log(`Full response saved to ${queryResultFile}`);
    
    return {
      model: response.data.model,
      content: result,
      references: response.data.choices[0].message.references || []
    };
  } catch (error) {
    log(`❌ Error querying Perplexity API: ${error.message}`);
    
    // Save error details to file
    await fs.writeFile('perplexity-error.txt', JSON.stringify({
      error: error.message,
      details: error.response ? error.response.data : 'No response data',
      status: error.response ? error.response.status : 'No status code'
    }, null, 2));
    
    throw error;
  }
}

// Main test function
async function runRealApiTest() {
  output = [];
  
  log('======= PERPLEXITY REAL API TEST =======');
  
  // Check if API key is available
  if (!checkApiKey()) {
    return false;
  }
  
  // Define a simple test query
  const testQuery = "What is the meaning of life in 2 sentences?";
  
  // Test with standard model (sonar)
  log('\n--- Testing with sonar model ---');
  try {
    const result = await queryPerplexity(testQuery, { model: 'sonar' });
    
    log('\nReceived response:');
    log(`Content (truncated): ${result.content.substring(0, 100)}...`);
    
    // Extract and validate model info
    const modelInfo = extractModelInfo(result);
    log('\nModel Information:');
    log(`Model: ${modelInfo.model}`);
    log(`Has references: ${modelInfo.hasReferences ? 'Yes' : 'No'}`);
    log(`Reference count: ${modelInfo.referenceCount}`);
    
    // Check if the test passed
    const modelCorrect = modelInfo.model === 'sonar' || modelInfo.model.includes('sonar');
    
    log(`\nModel validation: ${modelCorrect ? '✓' : '❌'}`);
    log(`Test status: ${modelCorrect ? 'PASSED' : 'FAILED'}`);
  } catch (error) {
    log(`\n❌ Test failed with error: ${error.message}`);
    return false;
  }
  
  // Save test results to file
  try {
    await fs.writeFile('perplexity-real-test-output.txt', output.join('\n'));
    log('\nTest output written to perplexity-real-test-output.txt');
  } catch (error) {
    log(`Error writing output file: ${error.message}`);
  }
  
  return true;
}

// Run the test if executed directly
const isMainModule = import.meta.url.startsWith('file:');
if (isMainModule) {
  console.log('Starting Perplexity real API test...');
  
  runRealApiTest()
    .then(success => {
      console.log('\nTest completed with status:', success ? 'PASSED' : 'FAILED');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

export { runRealApiTest, extractModelInfo };