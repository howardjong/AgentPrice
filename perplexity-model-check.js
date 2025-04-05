/**
 * Perplexity Model Check - ES Module Version
 * 
 * This script tests various models with the Perplexity API to find
 * which ones are currently working with our API key.
 */

import axios from 'axios';
import fs from 'fs/promises';

// Constants
const API_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const LOG_FILE = './perplexity-model-check.log';
const LOG_PREFIX = '[MODEL-CHECK]';

// Test a list of models including the newest model names
const TEST_MODELS = [
  // Llama models
  'llama-3.1-sonar-small-128k-online',
  'llama-3.1-sonar-small-online',
  'llama-3.1-sonar-small-chat',
  'llama-3.1-sonar-medium-128k-online',
  'llama-3.1-sonar-medium-online',
  'llama-3.1-sonar-medium-chat',
  'llama-3.1-70b-online',
  'llama-3.1-70b-chat',
  'llama-3.1-405b-online',
  'llama-3.1-8b',
  
  // Claude models
  'claude-3-5-sonnet-20240307',
  'claude-3-haiku-20240307',
  'claude-3-opus-20240229',
  
  // Mistral models
  'mistral-large-latest',
  'mistral-medium-latest',
  'mistral-small-latest',
  
  // GPT models
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  
  // Deep research model
  'sonar-deep-research',
  
  // Original Perplexity models
  'pplx-7b-online',
  'pplx-70b-online',
  'pplx-7b-chat',
  'pplx-70b-chat',
];

// Append to log file
async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} ${LOG_PREFIX} ${message}`;
  console.log(logMessage);
  
  try {
    await fs.appendFile(LOG_FILE, logMessage + '\n');
  } catch (error) {
    console.error('Error writing to log file:', error.message);
  }
}

// Check if API key is set
function checkApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY environment variable not set');
  }
  return apiKey;
}

// Test a specific model
async function testModel(modelName) {
  await log(`Testing model: ${modelName}`);
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${checkApiKey()}`
  };
  
  const payload = {
    model: modelName,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is the current date?' }
    ],
    temperature: 0.7,
    max_tokens: 100
  };
  
  try {
    await log(`Sending request to ${API_ENDPOINT} for model ${modelName}...`);
    const response = await axios.post(API_ENDPOINT, payload, { headers, timeout: 10000 });
    
    await log(`✅ SUCCESS with model ${modelName}`);
    
    // Save successful response
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `./test-results/perplexity-${modelName}-${timestamp}.json`;
    
    // Ensure directory exists
    await fs.mkdir('./test-results', { recursive: true });
    
    await fs.writeFile(
      filename,
      JSON.stringify({
        model: modelName,
        timestamp,
        response: response.data
      }, null, 2)
    );
    
    // Extract and log content
    try {
      const content = response.data?.choices?.[0]?.message?.content || 'No content found';
      await log(`Response from model ${modelName}: "${content.substring(0, 100)}..."`);
    } catch (err) {
      await log(`Couldn't extract content from model ${modelName} response`);
    }
    
    return true;
  } catch (error) {
    if (error.response) {
      await log(`❌ ERROR with model ${modelName}: ${error.message}`);
      await log(`Status: ${error.response.status}`);
      
      // For 401 errors (authentication), don't keep trying models
      if (error.response.status === 401) {
        await log(`❌ API KEY IS INVALID OR EXPIRED - stopping all tests`);
        return 'auth_error'; // Special return value for auth errors
      }
      
      // Log error response data for debugging
      try {
        await log(`Response data: ${JSON.stringify(error.response.data)}`);
      } catch (e) {
        await log(`Response data: ${error.response.data}`);
      }
    } else {
      await log(`❌ ERROR with model ${modelName}: ${error.message}`);
    }
    return false;
  }
}

// Main function
async function main() {
  await log('=== Starting Perplexity Model Check ===');
  
  try {
    // Check API key before starting
    checkApiKey();
    await log('✅ API key is available');
    
    // Test all models
    let workingModels = [];
    let failedModels = [];
    
    for (const model of TEST_MODELS) {
      const result = await testModel(model);
      
      if (result === 'auth_error') {
        await log('Stopping tests due to authentication error');
        break;
      } else if (result === true) {
        workingModels.push(model);
      } else {
        failedModels.push(model);
      }
      
      // Add a small delay between tests to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Summarize results
    await log('=== Model Check Summary ===');
    await log(`Working models (${workingModels.length}): ${workingModels.join(', ')}`);
    await log(`Failed models (${failedModels.length}): ${failedModels.join(', ')}`);
    
  } catch (error) {
    await log(`❌ Error: ${error.message}`);
  }
  
  await log('=== Perplexity Model Check Complete ===');
}

// Run the script
main().catch(console.error);