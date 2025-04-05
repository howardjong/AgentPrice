/**
 * Test Deep Research Model - ES Module Version
 * 
 * This script specifically tests the sonar-deep-research model
 * with the Perplexity API to see if it's available.
 */

import axios from 'axios';
import fs from 'fs/promises';

// Constants
const API_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const LOG_FILE = './deep-research-model-test.log';
const LOG_PREFIX = '[DEEP-RESEARCH-TEST]';

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

// Test deep research model
async function testDeepResearchModel() {
  const modelName = 'sonar-deep-research';
  await log(`Testing deep research model: ${modelName}`);
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${checkApiKey()}`
  };
  
  const payload = {
    model: modelName,
    messages: [
      { role: 'system', content: 'You are a knowledgeable research assistant with access to up-to-date information.' },
      { role: 'user', content: 'What are the latest pricing strategies for SaaS companies in 2025? Keep it brief and focus on the most innovative approaches.' }
    ],
    temperature: 0.7,
    max_tokens: 300,
    search_context: 'high'
  };
  
  try {
    await log(`Sending request to ${API_ENDPOINT}...`);
    await log(`Request payload: ${JSON.stringify(payload, null, 2)}`);
    
    const response = await axios.post(API_ENDPOINT, payload, { 
      headers, 
      timeout: 30000 // Longer timeout for deep research
    });
    
    await log(`✅ SUCCESS with model ${modelName}`);
    
    // Log response structure for debugging
    await log(`Response structure: ${JSON.stringify(Object.keys(response.data), null, 2)}`);
    
    // Save successful response
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `./test-results/deep-research-test-${timestamp}.json`;
    
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
    
    // Check for poll URL (which indicates async processing)
    let pollUrl = null;
    
    if (response.data?.choices?.[0]?.message?.poll_url) {
      pollUrl = response.data.choices[0].message.poll_url;
    } else if (response.data?.choices?.[0]?.poll_url) {
      pollUrl = response.data.choices[0].poll_url;
    } else if (response.data?.poll_url) {
      pollUrl = response.data.poll_url;
    }
    
    if (pollUrl) {
      await log(`📊 Poll URL found: ${pollUrl}`);
      await log(`This indicates that the deep research is being processed asynchronously, which is the expected behavior.`);
      
      // Save poll URL in a special file
      const pollUrlFile = `./test-results/deep-research-poll-url-${timestamp}.json`;
      await fs.writeFile(
        pollUrlFile,
        JSON.stringify({
          model: modelName,
          timestamp,
          pollUrl,
          requestId: response.data?.id || 'unknown'
        }, null, 2)
      );
      
      await log(`Poll URL saved to ${pollUrlFile}`);
    } else {
      await log(`⚠️ No poll URL was found in the response. This is unexpected for deep research.`);
      
      // Still try to extract content if available
      try {
        const content = response.data?.choices?.[0]?.message?.content || 'No content found';
        await log(`Immediate response content: "${content.substring(0, 100)}..."`);
        await log(`Note: Deep research should be asynchronous, so an immediate response is unexpected.`);
      } catch (err) {
        await log(`Couldn't extract content from response`);
      }
    }
    
    return true;
  } catch (error) {
    if (error.response) {
      await log(`❌ ERROR with model ${modelName}: ${error.message}`);
      await log(`Status: ${error.response.status}`);
      
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
  await log('=== Starting Deep Research Model Test ===');
  
  try {
    // Check API key before starting
    checkApiKey();
    await log('✅ API key is available');
    
    // Test deep research model
    const result = await testDeepResearchModel();
    
    if (result) {
      await log('✅ Deep research model test successful');
    } else {
      await log('❌ Deep research model test failed');
    }
    
  } catch (error) {
    await log(`❌ Error: ${error.message}`);
  }
  
  await log('=== Deep Research Model Test Complete ===');
}

// Run the script
main().catch(console.error);