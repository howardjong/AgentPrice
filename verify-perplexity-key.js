/**
 * Verify Perplexity API Key with Models Test
 * 
 * This script tests the Perplexity API with a step-by-step approach to
 * test different aspects of the API.
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const TEST_QUERY = 'What day is it today?'; // Simple query
const OUTPUT_FILE = 'perplexity-key-test-results.json';

// Test models to try
const TEST_MODELS = [
  'llama-3-8b-instruct',
  'sonar-small-online',
  'sonar-medium-online',
  'mixtral-8x7b-instruct',
  'mistral-7b-instruct',
  'claude-3-haiku-20240307',
  'sonar-small-chat',
  'sonar-medium-chat',
  'codellama-70b-instruct',
  'sonar-deep-research',
  'gemma-7b-it'
];

async function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  
  await fs.appendFile('perplexity-key-verification.log', `[${timestamp}] ${message}\n`)
    .catch(err => console.error(`Error writing to log: ${err.message}`));
}

// Make sure the API key is available
function checkApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is not set');
  }
  return apiKey;
}

// Test a specific model
async function testModel(modelName) {
  try {
    await log(`Testing model: ${modelName}`);
    
    const apiKey = checkApiKey();
    
    const requestData = {
      model: modelName,
      messages: [
        { role: 'user', content: TEST_QUERY }
      ],
      max_tokens: 50,
      temperature: 0.0,
      stream: false
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    // Make request with a 10 second timeout for standard models
    const response = await axios.post(PERPLEXITY_API_URL, requestData, {
      headers,
      timeout: 10000 // 10 second timeout
    });
    
    await log(`✅ Model ${modelName} is available!`);
    
    if (response.data.choices && response.data.choices[0]) {
      const content = response.data.choices[0].message.content;
      await log(`Response: "${content.trim().substring(0, 50)}..."`);
    } else {
      await log(`Unexpected response format: ${JSON.stringify(response.data)}`);
    }
    
    return { modelName, status: 'success', data: response.data };
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error?.type === 'invalid_model') {
      await log(`❌ Model ${modelName} is not available: ${error.response.data.error.message}`);
      return { modelName, status: 'invalid_model', error: error.response.data.error.message };
    } else if (error.response) {
      await log(`❌ Error with ${modelName}: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      return { modelName, status: 'error', error: `${error.response.status}: ${JSON.stringify(error.response.data)}` };
    } else {
      await log(`❌ Unknown error with ${modelName}: ${error.message}`);
      return { modelName, status: 'error', error: error.message };
    }
  }
}

// Test if deep research model is available by attempting to initialize a request
async function testDeepResearchInit() {
  try {
    await log(`Testing deep research initialization...`);
    
    const apiKey = checkApiKey();
    
    const requestData = {
      model: 'sonar-deep-research',
      messages: [
        { role: 'user', content: 'What were the key findings of the last 3 research papers about climate change impacts on agriculture?' }
      ],
      max_tokens: 4000,
      search_context: {
        search_queries: ['climate change agriculture research papers recent findings']
      },
      temperature: 0.0,
      stream: false
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    // Make request with a longer timeout for deep research
    const response = await axios.post(PERPLEXITY_API_URL, requestData, {
      headers,
      timeout: 30000 // 30 second timeout
    });
    
    // If we get a poll URL, the deep research model is working
    if (response.data.status === 'in_progress' && response.data.poll_url) {
      await log(`✅ Deep research initialization successful!`);
      await log(`Poll URL: ${response.data.poll_url}`);
      return {
        model: 'sonar-deep-research',
        status: 'success',
        pollUrl: response.data.poll_url,
        responseStatus: response.data.status,
        data: response.data
      };
    } else {
      await log(`Deep research response did not contain expected polling info: ${JSON.stringify(response.data)}`);
      return {
        model: 'sonar-deep-research',
        status: 'unexpected_format',
        data: response.data
      };
    }
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error?.type === 'invalid_model') {
      await log(`❌ Deep research is not available: ${error.response.data.error.message}`);
      return { model: 'sonar-deep-research', status: 'invalid_model', error: error.response.data.error.message };
    } else if (error.response) {
      await log(`❌ Error with deep research: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      return { model: 'sonar-deep-research', status: 'error', error: `${error.response.status}: ${JSON.stringify(error.response.data)}` };
    } else if (error.code === 'ECONNABORTED') {
      await log(`Deep research request timed out - this may be normal for initialization`);
      return { model: 'sonar-deep-research', status: 'timeout', error: 'Request timed out' };
    } else {
      await log(`❌ Unknown error with deep research: ${error.message}`);
      return { model: 'sonar-deep-research', status: 'error', error: error.message };
    }
  }
}

// Main test function
async function runVerification() {
  try {
    await log('=== Starting Perplexity API Key Verification ===');
    
    // First check if the API key exists
    checkApiKey();
    await log('✅ API key is available');
    
    const results = {
      timestamp: new Date().toISOString(),
      modelTests: [],
      deepResearchTest: null
    };
    
    // Test regular models
    for (const model of TEST_MODELS) {
      if (model === 'sonar-deep-research') continue; // We'll test this separately
      const result = await testModel(model);
      results.modelTests.push(result);
    }
    
    // Test deep research model specially
    results.deepResearchTest = await testDeepResearchInit();
    
    // Save all the results
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2));
    await log(`Results saved to ${OUTPUT_FILE}`);
    
    // Summary
    const workingModels = results.modelTests.filter(r => r.status === 'success').map(r => r.modelName);
    
    await log('=== Verification Summary ===');
    await log(`Total models tested: ${results.modelTests.length + 1}`);
    await log(`Working models: ${workingModels.length}`);
    if (workingModels.length > 0) {
      await log(`Working model names: ${workingModels.join(', ')}`);
    }
    
    await log(`Deep research model status: ${results.deepResearchTest.status}`);
    
    await log('=== Perplexity API Key Verification Complete ===');
    
  } catch (error) {
    await log(`❌ Verification failed: ${error.message}`);
    
    if (error.response) {
      await log(`Status: ${error.response.status}`);
      await log(`Response data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Run the verification
runVerification();