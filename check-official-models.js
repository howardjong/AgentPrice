/**
 * Check Official Perplexity Models
 * 
 * This script tries the official model names from Perplexity's April 2025 documentation
 */

import axios from 'axios';
import fs from 'fs/promises';

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const TEST_QUERY = 'What day is it today?'; // Simple query
const OUTPUT_FILE = 'perplexity-official-models-test.json';

// Official models as of April 2025 
// https://docs.perplexity.ai/docs/model-cards
const OFFICIAL_MODELS = [
  'pplx-7b-online',
  'pplx-70b-online',
  'pplx-7b-chat',
  'pplx-70b-chat',
  'llama-2-70b-chat',
  'codellama-34b-instruct',
  'mistral-medium-latest',
  'mixtral-8x7b-instruct',
  'command-r',
  'command-r-plus',
  'sonar-small-chat',
  'sonar-small-online',
  'sonar-medium-chat',
  'sonar-medium-online',
  'sonar-large-chat',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
  'sonar-analytics',
  'sonar-deep-research'
];

async function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  
  await fs.appendFile('perplexity-official-models-check.log', `[${timestamp}] ${message}\n`)
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

// Test deep research model specially
async function testDeepResearch() {
  try {
    await log(`Testing deep research model...`);
    
    const apiKey = checkApiKey();
    
    const requestData = {
      model: 'sonar-deep-research',
      messages: [
        { role: 'user', content: 'What are the average prices of 5-star hotels in major European cities for April 2025?' }
      ],
      max_tokens: 1000,
      temperature: 0.0,
      stream: false
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    // Make request with a longer timeout
    const response = await axios.post(PERPLEXITY_API_URL, requestData, {
      headers,
      timeout: 20000 // 20 second timeout
    });
    
    await log(`✅ Deep research request successful!`);
    await log(`Response status: ${response.data.status || 'unknown'}`);
    
    if (response.data.status === 'in_progress' && response.data.poll_url) {
      await log(`Poll URL: ${response.data.poll_url}`);
    }
    
    return {
      modelName: 'sonar-deep-research',
      status: 'success',
      responseStatus: response.data.status,
      hasPollUrl: !!response.data.poll_url,
      data: response.data
    };
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error?.type === 'invalid_model') {
      await log(`❌ Deep research is not available: ${error.response.data.error.message}`);
      return { modelName: 'sonar-deep-research', status: 'invalid_model', error: error.response.data.error.message };
    } else if (error.response) {
      await log(`❌ Error with deep research: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      return { modelName: 'sonar-deep-research', status: 'error', error: `${error.response.status}: ${JSON.stringify(error.response.data)}` };
    } else if (error.code === 'ECONNABORTED') {
      await log(`Deep research request timed out - this may be normal`);
      return { modelName: 'sonar-deep-research', status: 'timeout', error: 'Request timed out' };
    } else {
      await log(`❌ Unknown error with deep research: ${error.message}`);
      return { modelName: 'sonar-deep-research', status: 'error', error: error.message };
    }
  }
}

// Main test function
async function runModelCheck() {
  try {
    await log('=== Starting Official Perplexity Models Check ===');
    
    // First check if the API key exists
    checkApiKey();
    await log('✅ API key is available');
    
    const results = {
      timestamp: new Date().toISOString(),
      modelTests: [],
      deepResearchTest: null
    };
    
    // Test standard models
    for (const model of OFFICIAL_MODELS) {
      if (model === 'sonar-deep-research') continue; // Skip for now
      const result = await testModel(model);
      results.modelTests.push(result);
    }
    
    // Test deep research model separately
    results.deepResearchTest = await testDeepResearch();
    
    // Save all the results
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2));
    await log(`Results saved to ${OUTPUT_FILE}`);
    
    // Summary
    const workingModels = results.modelTests.filter(r => r.status === 'success').map(r => r.modelName);
    
    await log('=== Model Check Summary ===');
    await log(`Total models tested: ${results.modelTests.length + 1}`);
    await log(`Working models: ${workingModels.length}`);
    if (workingModels.length > 0) {
      await log(`Working model names: ${workingModels.join(', ')}`);
    }
    
    await log(`Deep research model status: ${results.deepResearchTest?.status || 'not tested'}`);
    
    await log('=== Official Perplexity Models Check Complete ===');
    
  } catch (error) {
    await log(`❌ Check failed: ${error.message}`);
    
    if (error.response) {
      await log(`Status: ${error.response.status}`);
      await log(`Response data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Run the check
runModelCheck();