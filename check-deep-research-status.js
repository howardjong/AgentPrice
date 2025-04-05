/**
 * Check Deep Research Status
 * 
 * This script checks the status of previously initiated deep research requests
 * by looking for poll URLs in the deep-research-results directory.
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Constants
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, 'test-results', 'deep-research');
const LOG_FILE = 'deep-research-status-check.log';

async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  await fs.appendFile(LOG_FILE, `${logMessage}\n`)
    .catch(err => console.error(`Error writing to log: ${err.message}`));
}

/**
 * Find all poll data files
 */
async function findPollDataFiles() {
  try {
    // Ensure directory exists
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    
    const allFiles = await fs.readdir(RESULTS_DIR);
    const pollDataFiles = allFiles.filter(file => file.startsWith('poll-data-'));
    
    return pollDataFiles.map(file => path.join(RESULTS_DIR, file));
  } catch (error) {
    await log(`Error finding poll data files: ${error.message}`);
    return [];
  }
}

/**
 * Check status of a single research request
 */
async function checkResearchStatus(pollDataPath) {
  try {
    await log(`Checking status for ${path.basename(pollDataPath)}`);
    
    // Read poll data
    const pollDataText = await fs.readFile(pollDataPath, 'utf8');
    const pollData = JSON.parse(pollDataText);
    
    const { pollUrl, requestId } = pollData;
    if (!pollUrl) {
      throw new Error('Poll URL not found in poll data');
    }
    
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY is not set');
    }
    
    await log(`Polling URL: ${pollUrl}`);
    
    // Make the polling request
    const response = await axios.get(pollUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 30000
    });
    
    await log(`Received response with status code: ${response.status}`);
    
    // Save the poll response
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const responseFile = path.join(RESULTS_DIR, `poll-response-${requestId}-${timestamp}.json`);
    await fs.writeFile(responseFile, JSON.stringify(response.data, null, 2));
    await log(`Saved response to ${responseFile}`);
    
    // Check the status
    const status = getResponseStatus(response.data);
    await log(`Research status: ${status}`);
    
    // If completed, save as a completed response
    if (status === 'completed') {
      const completeFile = path.join(RESULTS_DIR, `complete-response-${requestId}.json`);
      await fs.writeFile(completeFile, JSON.stringify(response.data, null, 2));
      await log(`Research complete! Saved to ${completeFile}`);
      
      // Extract and log content
      const content = extractContent(response.data);
      await log(`Content length: ${content.length} characters`);
      
      // Extract and log model info
      const modelInfo = extractModelInfo(response.data);
      await log(`Model used: ${modelInfo}`);
    }
    
    return {
      requestId,
      status,
      pollUrl,
      response: response.data
    };
    
  } catch (error) {
    await log(`Error checking research status: ${error.message}`);
    
    if (error.response) {
      await log(`Status: ${error.response.status}`);
      await log(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    
    return {
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Get the status of a response (completed, in_progress, etc.)
 */
function getResponseStatus(response) {
  if (!response) return 'unknown';
  
  // Case 1: Direct status field (polling responses)
  if (response.status) {
    return response.status;
  }
  
  // Case 2: Poll URL indicates in-progress research (initial responses)
  if (response.poll_url) {
    return 'in_progress';
  }
  
  // Case 3: Standard chat completion response
  if (response.choices && response.choices[0] && response.choices[0].message) {
    return 'completed';
  }
  
  // Case 4: Completion object format (some deep research responses)
  if (response.completion && response.completion.text) {
    return 'completed';
  }
  
  return 'unknown';
}

/**
 * Extract model information from a Perplexity API response
 */
function extractModelInfo(response, defaultModel = "unknown") {
  if (!response) return defaultModel;
  
  // Case 1: Direct model field in response
  if (response.model) {
    return response.model;
  }
  
  // Case 2: Extract from completion.model if available
  if (response.completion && response.completion.model) {
    return response.completion.model;
  }
  
  return defaultModel;
}

/**
 * Extract content from Perplexity response
 */
function extractContent(response) {
  if (!response) return '';
  
  // Case 1: Standard chat completion format
  if (response.choices && response.choices[0] && response.choices[0].message) {
    return response.choices[0].message.content;
  }
  
  // Case 2: Completion object format from polling response
  if (response.completion && response.completion.text) {
    return response.completion.text;
  }
  
  return '';
}

/**
 * Main function to check all research statuses
 */
async function checkAllResearchStatuses() {
  await log('=== Starting Deep Research Status Check ===');
  
  try {
    // Find all poll data files
    const pollDataFiles = await findPollDataFiles();
    await log(`Found ${pollDataFiles.length} research requests to check`);
    
    if (pollDataFiles.length === 0) {
      await log('No deep research requests found to check');
      return;
    }
    
    // Check each research request
    const results = [];
    
    for (const pollDataFile of pollDataFiles) {
      const result = await checkResearchStatus(pollDataFile);
      results.push(result);
      
      // Simple delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Summarize results
    await log('=== Status Check Results ===');
    for (const result of results) {
      await log(`RequestId: ${result.requestId || 'unknown'}, Status: ${result.status}`);
    }
    
  } catch (error) {
    await log(`Error in status check: ${error.message}`);
  } finally {
    await log('=== Deep Research Status Check Complete ===');
  }
}

// Run the status check
checkAllResearchStatuses();