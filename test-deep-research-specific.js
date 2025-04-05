/**
 * Test Deep Research Specifically
 * 
 * This script tests only the deep research capability with the 
 * correctly formatted request based on the latest documentation.
 */

import axios from 'axios';
import fs from 'fs/promises';

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const DEEP_RESEARCH_MODEL = 'sonar-deep-research';
const OUTPUT_DIR = './test-results/deep-research';
const REQUEST_ID = `test-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const LOG_FILE = 'deep-research-test.log';

async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  await fs.appendFile(LOG_FILE, `${logMessage}\n`)
    .catch(err => console.error(`Error writing to log: ${err.message}`));
}

async function ensureOutputDir() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await log(`Created output directory: ${OUTPUT_DIR}`);
  } catch (error) {
    await log(`Error creating output directory: ${error.message}`);
  }
}

async function saveResponseToFile(response, filename) {
  try {
    await fs.writeFile(filename, JSON.stringify(response, null, 2));
    await log(`Saved response to ${filename}`);
  } catch (error) {
    await log(`Error saving response: ${error.message}`);
  }
}

function getResponseStatus(response) {
  if (response && response.status) {
    return response.status;
  } else if (response && response.choices && response.choices[0] && response.choices[0].message) {
    return 'completed'; // Standard chat completion response
  }
  return 'unknown';
}

function extractPollUrl(response) {
  if (response && response.poll_url) {
    return response.poll_url;
  }
  return null;
}

async function executeDeepResearch() {
  try {
    await log(`=== Starting Deep Research Test ===`);
    await ensureOutputDir();
    
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY is not set');
    }
    await log('API key is available');
    
    const requestData = {
      model: DEEP_RESEARCH_MODEL,
      messages: [
        { 
          role: 'user', 
          content: 'What are the current pricing strategies used by SaaS companies in 2025, especially for AI-powered tools?' 
        }
      ],
      max_tokens: 3000,
      temperature: 0.0,
      stream: false
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    await log(`Sending deep research request to ${PERPLEXITY_API_URL}`);
    await log(`Model: ${DEEP_RESEARCH_MODEL}`);
    
    const response = await axios.post(PERPLEXITY_API_URL, requestData, {
      headers,
      timeout: 45000 // 45 second timeout for initial request
    });
    
    await log(`Received response with status code: ${response.status}`);
    
    const responseFile = `${OUTPUT_DIR}/initial-response-${REQUEST_ID}.json`;
    await saveResponseToFile(response.data, responseFile);
    
    const responseStatus = getResponseStatus(response.data);
    await log(`Response status: ${responseStatus}`);
    
    const pollUrl = extractPollUrl(response.data);
    if (pollUrl) {
      await log(`Poll URL found: ${pollUrl}`);
      await log(`This indicates the deep research is working!`);
      
      // Save poll URL for future polling
      const pollDataFile = `${OUTPUT_DIR}/poll-data-${REQUEST_ID}.json`;
      await saveResponseToFile({ pollUrl, requestId: REQUEST_ID }, pollDataFile);
    } else {
      await log(`No poll URL found. Deep research may not be working as expected.`);
    }
    
    await log(`=== Deep Research Test Complete ===`);
    
  } catch (error) {
    await log(`ERROR: ${error.message}`);
    
    if (error.response) {
      await log(`Status: ${error.response.status}`);
      await log(`Response data: ${JSON.stringify(error.response.data)}`);
      
      // Save error response
      const errorFile = `${OUTPUT_DIR}/error-response-${REQUEST_ID}.json`;
      await saveResponseToFile(error.response.data, errorFile);
    } else if (error.code === 'ECONNABORTED') {
      await log('Request timed out. The API did not respond within the timeout period.');
    }
  }
}

// Run the test
executeDeepResearch();