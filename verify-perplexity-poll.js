/**
 * Verify Perplexity Poll URL
 * 
 * This script tests the Perplexity API and specifically focuses on
 * verifying we can get a poll URL and check job status.
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const DEEP_RESEARCH_MODEL = 'sonar-deep-research';
const TEST_QUERY = 'What are the current market trends for SaaS pricing in 2025?';

// Helper function for logging
async function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  
  // Also append to a log file
  const logFile = path.join(process.cwd(), 'perplexity-poll-verification.log');
  await fs.appendFile(logFile, formattedMessage + '\n', 'utf8').catch(err => {
    console.error(`Error writing to log: ${err.message}`);
  });
}

// Check if the API key is available
function checkApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is not set in the environment');
  }
  return apiKey;
}

// Extract poll URL from response
function extractPollUrl(response) {
  if (response && response.poll_url) {
    return response.poll_url;
  }
  return null;
}

// Get the status of a response
function getResponseStatus(response) {
  if (!response) return 'unknown';
  
  if (response.status === 'completed') return 'completed';
  if (response.status === 'in_progress') return 'in_progress';
  if (response.status === 'processing') return 'processing';
  
  // Check for poll_url as indicator of in-progress status
  if (response.poll_url) return 'in_progress';
  
  return 'unknown';
}

// Extract model information from a response
function extractModelInfo(response, defaultModel = 'unknown') {
  if (!response) return defaultModel;
  
  // Try different paths where model info might be found
  if (response.model) return response.model;
  if (response.choices && response.choices[0] && response.choices[0].model) {
    return response.choices[0].model;
  }
  
  return defaultModel;
}

// Save response to file for inspection
async function saveResponseToFile(response, filename) {
  try {
    await fs.writeFile(filename, JSON.stringify(response, null, 2), 'utf8');
    await log(`Response saved to ${filename}`);
  } catch (error) {
    await log(`Error saving response: ${error.message}`);
  }
}

// Main test function
async function runVerification() {
  try {
    await log('=== Starting Perplexity Poll URL Verification Test ===');
    
    // Check for API key
    const apiKey = checkApiKey();
    await log('✅ API key is available');
    
    // Make the initial deep research request
    await log(`Sending research query: "${TEST_QUERY}"`);
    await log(`Using model: ${DEEP_RESEARCH_MODEL}`);
    
    const requestData = {
      model: DEEP_RESEARCH_MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful research assistant.' },
        { role: 'user', content: TEST_QUERY }
      ],
      max_tokens: 4000,
      temperature: 0.2,
      stream: false
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    // Make the initial request with a timeout
    await log('Sending API request with 30 second timeout...');
    const initialResponse = await axios.post(PERPLEXITY_API_URL, requestData, { 
      headers,
      timeout: 30000 // 30 second timeout
    });
    await log('✅ Initial API request successful');
    
    // Save the initial response
    const initialResponseFile = path.join(process.cwd(), 'perplexity-initial-response.json');
    await saveResponseToFile(initialResponse.data, initialResponseFile);
    
    // Check for poll URL
    const pollUrl = extractPollUrl(initialResponse.data);
    
    if (pollUrl) {
      await log(`✅ Poll URL found: ${pollUrl}`);
      
      // Try to poll the URL once to verify we can check status
      await log('Making first poll request with 15 second timeout...');
      const pollResponse = await axios.get(pollUrl, { 
        headers,
        timeout: 15000 // 15 second timeout
      });
      
      // Get current status
      const status = getResponseStatus(pollResponse.data);
      const model = extractModelInfo(pollResponse.data, DEEP_RESEARCH_MODEL);
      
      await log(`✅ Poll request successful - Current status: ${status}`);
      await log(`Model being used: ${model}`);
      
      // Save the poll response
      const pollResponseFile = path.join(process.cwd(), 'perplexity-poll-response.json');
      await saveResponseToFile(pollResponse.data, pollResponseFile);
      
      await log('Poll URL verification test completed successfully');
      await log(`To continue polling manually, you can use: curl -H "Authorization: Bearer ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}" ${pollUrl}`);
    } else {
      await log('❌ No poll URL found in the response. This can happen if:');
      await log('   1. The deep research query was completed immediately (unlikely)');
      await log('   2. The API response format has changed');
      await log('   3. There was an error processing the deep research request');
      
      // Check if there's an error in the response
      if (initialResponse.data.error) {
        await log(`API Error: ${JSON.stringify(initialResponse.data.error)}`);
      }
    }
    
  } catch (error) {
    await log(`❌ Error: ${error.message}`);
    
    if (error.response) {
      await log(`API Error Status: ${error.response.status}`);
      await log(`API Error Data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Run the verification
runVerification().catch(console.error);