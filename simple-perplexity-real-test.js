/**
 * Simple Perplexity Real API Test
 * 
 * This script tests the Perplexity API with a real API key.
 * It's designed to run with the PERPLEXITY_API_KEY environment variable set.
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Logger function
function log(message) {
  console.log(message);
}

// Extract model information from response
function extractModelInfo(response) {
  const model = response?.model || 'unknown';
  return { model };
}

// Check if API key is available
function checkApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    log('⚠️ PERPLEXITY_API_KEY environment variable is not set.');
    return false;
  }
  log('✅ PERPLEXITY_API_KEY is available');
  return true;
}

// Query Perplexity API directly
async function queryPerplexity(query, options = {}) {
  if (!checkApiKey()) {
    throw new Error('API key is not available');
  }

  // Get API key
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  // Prepare request based on latest Perplexity API docs
  const requestData = {
    model: options.model || 'sonar',
    messages: [
      { role: "user", content: query }
    ]
  };
  
  // Add optional parameters
  if (options.temperature) {
    requestData.temperature = options.temperature;
  }
  
  if (options.max_tokens) {
    requestData.max_tokens = options.max_tokens;
  }
  
  log(`\nSending request to Perplexity API (model: ${requestData.model}):`);
  log(JSON.stringify(requestData, null, 2));
  
  // Make API request
  try {
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    return response.data;
    
  } catch (error) {
    log('❌ API request failed:');
    if (error.response) {
      log(`Status: ${error.response.status}`);
      log('Response data:');
      log(JSON.stringify(error.response.data, null, 2));
    } else {
      log(error.message);
    }
    throw error;
  }
}

// Main test function
async function runRealApiTest() {
  log('=== Running Real Perplexity API Test ===');
  
  try {
    // Test with a simple query
    const query = 'What are three important factors to consider in SaaS pricing?';
    log(`\nExecuting query: "${query}"`);
    
    // Try with basic "sonar" model which is generally supported
    const response = await queryPerplexity(query, {
      model: 'sonar',  // Basic model
      temperature: 0.7,
      max_tokens: 1024
    });
    
    log('\n✅ Query successful!');
    log(`\nModel used: ${response.model || 'unknown'}`);
    
    // Extract and display the response content
    const content = response.choices[0]?.message?.content || 'No content returned';
    log('\nResponse content:');
    log('--------------------------------------');
    log(content);
    log('--------------------------------------');
    
    // Save the full response for analysis
    const outputDir = 'test-results';
    await fs.mkdir(outputDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const outputFile = path.join(outputDir, `perplexity-response-${timestamp}.json`);
    await fs.writeFile(outputFile, JSON.stringify(response, null, 2));
    log(`\nFull response saved to ${outputFile}`);
    
    return { success: true, response };
    
  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`);
    return { success: false, error };
  }
}

// Run the test
runRealApiTest();