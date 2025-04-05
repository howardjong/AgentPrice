/**
 * Check Official Perplexity Models
 * 
 * This script tries the official model names from Perplexity's April 2025 documentation
 */

import axios from 'axios';
import fs from 'fs/promises';

// Constants
const API_URL = 'https://api.perplexity.ai/chat/completions';
const LOG_FILE = 'perplexity-official-models-check.log';

async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  await fs.appendFile(LOG_FILE, `${logMessage}\n`)
    .catch(err => console.error(`Error writing to log: ${err.message}`));
}

function checkApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is not set');
  }
  return apiKey;
}

async function testModel(modelName) {
  try {
    const apiKey = checkApiKey();
    await log(`Testing model: ${modelName}`);
    
    const requestData = {
      model: modelName,
      messages: [
        { role: 'user', content: 'What is the capital of France?' }
      ],
      max_tokens: 100,
      temperature: 0.0,
      stream: false
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    const response = await axios.post(API_URL, requestData, {
      headers,
      timeout: 15000 // 15 second timeout
    });
    
    const status = response.status;
    await log(`Response status: ${status}`);
    
    // Check if this is a valid model
    await log(`Model ${modelName} is VALID and accessible`);
    
    // Save successful response
    const responseFile = `${modelName}-success.json`;
    await fs.writeFile(responseFile, JSON.stringify(response.data, null, 2));
    
    return {
      model: modelName,
      status: 'success',
      httpStatus: status
    };
    
  } catch (error) {
    await log(`Error with model ${modelName}: ${error.message}`);
    
    let errorType = 'unknown';
    let errorMessage = error.message;
    let httpStatus = 500;
    
    if (error.response) {
      httpStatus = error.response.status;
      await log(`HTTP status: ${httpStatus}`);
      
      if (error.response.data && error.response.data.error) {
        errorType = error.response.data.error.type || 'unknown';
        errorMessage = error.response.data.error.message || error.message;
      }
      
      await log(`Error type: ${errorType}`);
      await log(`Error message: ${errorMessage}`);
      
      // Save error response
      const errorFile = `${modelName}-error.json`;
      await fs.writeFile(errorFile, JSON.stringify(error.response.data, null, 2));
    }
    
    return {
      model: modelName,
      status: 'error',
      errorType,
      errorMessage,
      httpStatus
    };
  }
}

async function testDeepResearch() {
  try {
    const apiKey = checkApiKey();
    const modelName = 'sonar-deep-research';
    
    await log(`Testing deep research model: ${modelName}`);
    
    const requestData = {
      model: modelName,
      messages: [
        { role: 'user', content: 'What are current SaaS pricing strategies in 2025?' }
      ],
      max_tokens: 500,
      temperature: 0.0,
      stream: false
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    const response = await axios.post(API_URL, requestData, {
      headers,
      timeout: 30000 // 30 second timeout
    });
    
    const status = response.status;
    await log(`Response status: ${status}`);
    
    // Save response
    const responseFile = `${modelName}-response.json`;
    await fs.writeFile(responseFile, JSON.stringify(response.data, null, 2));
    
    // Check if this is a poll response (indicating deep research)
    if (response.data && response.data.poll_url) {
      await log(`Deep research model is working correctly! Found poll URL.`);
      return {
        model: modelName,
        status: 'success',
        isDeepResearch: true,
        pollUrl: response.data.poll_url
      };
    } else {
      await log(`Model ${modelName} returned a response but no poll URL found.`);
      return {
        model: modelName,
        status: 'success',
        isDeepResearch: false
      };
    }
    
  } catch (error) {
    await log(`Error with deep research model: ${error.message}`);
    
    if (error.response) {
      await log(`Status: ${error.response.status}`);
      await log(`Response data: ${JSON.stringify(error.response.data)}`);
      
      // Save error response
      const errorFile = `sonar-deep-research-error.json`;
      await fs.writeFile(errorFile, JSON.stringify(error.response.data, null, 2));
    }
    
    return {
      model: 'sonar-deep-research',
      status: 'error',
      error: error.message
    };
  }
}

async function runModelCheck() {
  await log('=== Starting Official Perplexity Models Check ===');
  
  // List of models to test based on April 2025 documentation
  const models = [
    // Deep Research Model
    // Test separately as it has special behavior
    
    // Online Models
    'sonar-small-online',
    'sonar-medium-online',
    'sonar-large-online',
    
    // Chat Models
    'sonar-small-chat',
    'sonar-medium-chat',
    'sonar-large-chat',
    
    // Multilingual models
    'codellama-70b-instruct',
    'mistral-7b-instruct',
    'mixtral-8x7b-instruct',
    'llama-3-70b-instruct',
    'llama-3-8b-instruct'
  ];
  
  const results = [];
  
  for (const model of models) {
    const result = await testModel(model);
    results.push(result);
    
    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Test deep research model separately
  const deepResearchResult = await testDeepResearch();
  results.push(deepResearchResult);
  
  // Summarize results
  await log('=== Model Check Results ===');
  
  const validModels = results.filter(r => r.status === 'success');
  const invalidModels = results.filter(r => r.status === 'error');
  
  await log(`Valid models (${validModels.length}):`);
  for (const model of validModels) {
    await log(`- ${model.model}`);
  }
  
  await log(`Invalid models (${invalidModels.length}):`);
  for (const model of invalidModels) {
    await log(`- ${model.model}: ${model.errorMessage || 'Unknown error'}`);
  }
  
  await log('=== Official Models Check Complete ===');
  
  // Write summary to file
  const summary = {
    timestamp: new Date().toISOString(),
    validModels: validModels.map(m => m.model),
    invalidModels: invalidModels.map(m => ({
      model: m.model,
      error: m.errorMessage || 'Unknown error'
    }))
  };
  
  await fs.writeFile('perplexity-models-summary.json', JSON.stringify(summary, null, 2));
}

// Run the check
runModelCheck();