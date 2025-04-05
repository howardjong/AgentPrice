/**
 * Simple Perplexity API Test 
 * 
 * Tests the specific model with the current API key
 */

import axios from 'axios';
import fs from 'fs/promises';

const url = "https://api.perplexity.ai/chat/completions";

async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  await fs.appendFile('perplexity-model-test.log', `${logMessage}\n`)
    .catch(err => console.error(`Error writing to log: ${err.message}`));
}

async function testPerplexityModel(modelName) {
  try {
    await log(`Testing model: ${modelName}`);
    
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY is not set');
    }
    
    const payload = {
      model: modelName,
      messages: [
        {role: "user", content: "Provide an in-depth analysis of the impact of AI on global job markets over the next decade."}
      ],
      max_tokens: 500,
      temperature: 0.0,
      stream: false
    };
    
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    };
    
    await log(`Sending request to ${url}`);
    
    const response = await axios.post(url, payload, { headers, timeout: 10000 });
    
    await log(`Response status: ${response.status}`);
    await log(`Response data: ${JSON.stringify(response.data, null, 2)}`);
    
    // Save response to file
    const filename = `perplexity-${modelName}-response.json`;
    await fs.writeFile(filename, JSON.stringify(response.data, null, 2));
    await log(`Response saved to ${filename}`);
    
    return true;
  } catch (error) {
    await log(`ERROR with model ${modelName}: ${error.message}`);
    
    if (error.response) {
      await log(`Status: ${error.response.status}`);
      await log(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
      
      // Save error response
      const filename = `perplexity-${modelName}-error.json`;
      await fs.writeFile(filename, JSON.stringify(error.response.data, null, 2));
      await log(`Error response saved to ${filename}`);
    }
    
    return false;
  }
}

async function testAllModels() {
  await log('=== Starting Perplexity Model Test ===');
  
  // List of models to test
  const models = [
    'sonar-small-online',
    'sonar-medium-online',
    'sonar-large-online',
    'sonar-small-chat',
    'sonar-medium-chat',
    'sonar-large-chat',
    'sonar-deep-research',
    'mistral-7b-instruct',
    'mixtral-8x7b-instruct',
    'codellama-70b-instruct'
  ];
  
  const results = {};
  
  for (const model of models) {
    results[model] = await testPerplexityModel(model);
    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  await log('=== Model Test Results ===');
  for (const [model, success] of Object.entries(results)) {
    await log(`${model}: ${success ? 'SUCCESS' : 'FAILED'}`);
  }
  
  await log('=== Model Testing Complete ===');
}

// Run the tests
testAllModels();