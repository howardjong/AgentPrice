/**
 * Simple Perplexity API Check
 * 
 * This script makes a simple request to the Perplexity API
 * to verify the API key is working.
 */

import axios from 'axios';
import fs from 'fs/promises';

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const STANDARD_MODEL = 'sonar-medium-online'; // Using standard model, not deep research
const TEST_QUERY = 'What day is it today?'; // Simple query

async function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  
  await fs.appendFile('simple-perplexity-check.log', `[${timestamp}] ${message}\n`)
    .catch(err => console.error(`Error writing to log: ${err.message}`));
}

async function checkApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is not set');
  }
  return apiKey;
}

async function runSimpleCheck() {
  try {
    await log('=== Starting Simple Perplexity API Check ===');
    
    const apiKey = checkApiKey();
    await log('✅ API key is available');
    
    const requestData = {
      model: STANDARD_MODEL,
      messages: [
        { role: 'user', content: TEST_QUERY }
      ],
      max_tokens: 100,
      temperature: 0.0,
      stream: false
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    await log(`Sending request to ${PERPLEXITY_API_URL}`);
    await log(`Using model: ${STANDARD_MODEL}`);
    await log(`Query: "${TEST_QUERY}"`);
    
    // Make request with a 10 second timeout
    const response = await axios.post(PERPLEXITY_API_URL, requestData, {
      headers,
      timeout: 10000 // 10 second timeout
    });
    
    await log('✅ API request successful');
    
    if (response.data.choices && response.data.choices[0]) {
      const content = response.data.choices[0].message.content;
      await log(`Response: "${content}"`);
    } else {
      await log(`Unexpected response format: ${JSON.stringify(response.data)}`);
    }
    
    // Save the full response for analysis
    await fs.writeFile('simple-perplexity-response.json', JSON.stringify(response.data, null, 2));
    await log('Response saved to simple-perplexity-response.json');
    
    await log('=== Simple Perplexity API Check Complete ===');
    
  } catch (error) {
    await log(`❌ Error: ${error.message}`);
    
    if (error.response) {
      await log(`Status: ${error.response.status}`);
      await log(`Response data: ${JSON.stringify(error.response.data)}`);
    } else if (error.code === 'ECONNABORTED') {
      await log('Request timed out. The Perplexity API did not respond within the timeout period.');
    }
  }
}

// Run the check
runSimpleCheck();