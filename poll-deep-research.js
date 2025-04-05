/**
 * Poll Deep Research Requests - ES Module Version
 * 
 * This script reads in-progress deep research requests and tries to poll
 * for their completion status.
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

// Constants
const RESULTS_DIR = './test-results/deep-research';
const POLL_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
};
const LOG_PREFIX = '[POLL]';

/**
 * Logging helper
 */
async function log(message) {
  console.log(`${new Date().toISOString()} ${LOG_PREFIX} ${message}`);
}

/**
 * Check if the API key is set
 */
function checkApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY environment variable not set');
  }
  return apiKey;
}

/**
 * Find all research request files that are in progress
 */
async function findInProgressRequests() {
  try {
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    const files = await fs.readdir(RESULTS_DIR);
    
    // Find all intermediate files (initial request data)
    const intermediateFiles = files.filter(f => f.includes('intermediate.json'));
    
    // Check which ones don't have a response yet
    const inProgressFiles = [];
    for (const file of intermediateFiles) {
      const requestId = file.split('-')[1]; // Extract request ID from filename
      // Check if a response file exists for this request
      const hasResponse = files.some(f => 
        f.includes(`request-${requestId}`) && f.includes('response'));
      
      if (!hasResponse) {
        inProgressFiles.push(file);
      }
    }
    
    return inProgressFiles;
  } catch (error) {
    await log(`Error finding in-progress requests: ${error.message}`);
    return [];
  }
}

/**
 * Get poll URL from our cache or try to generate it
 */
async function getPollUrl(requestId) {
  try {
    // Check if we have a poll URL file
    const pollUrlFile = `./data/poll_urls/poll_url_${requestId}.json`;
    try {
      const pollData = JSON.parse(await fs.readFile(pollUrlFile, 'utf8'));
      return pollData.poll_url;
    } catch (err) {
      // No poll URL file, try to construct it
      return `https://api.perplexity.ai/chat/completions/poll/${requestId}`;
    }
  } catch (error) {
    await log(`Error getting poll URL for ${requestId}: ${error.message}`);
    return null;
  }
}

/**
 * Poll a single request
 */
async function pollRequest(requestFile) {
  try {
    // Parse the request file
    const filePath = path.join(RESULTS_DIR, requestFile);
    const requestData = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const requestId = requestData.requestId;
    
    await log(`Polling request ${requestId}: "${requestData.query.substring(0, 50)}..."`);
    
    // Get poll URL (either from cache or construct it)
    const pollUrl = await getPollUrl(requestId);
    if (!pollUrl) {
      await log(`⚠️ Unable to determine poll URL for request ${requestId}`);
      return false;
    }
    
    await log(`Polling URL: ${pollUrl}`);
    
    // Make the poll request
    try {
      const response = await axios.get(pollUrl, {
        headers: {
          'Authorization': `Bearer ${checkApiKey()}`
        },
        timeout: 30000
      });
      
      // Save the poll response
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const responseFile = `request-${requestId}-${timestamp}-response.json`;
      const responsePath = path.join(RESULTS_DIR, responseFile);
      
      const saveData = {
        requestId,
        pollUrl,
        timestamp,
        status: response.data?.choices?.[0]?.finish_reason === 'stop' ? 'completed' : 'in_progress',
        response: response.data
      };
      
      await fs.writeFile(responsePath, JSON.stringify(saveData, null, 2));
      
      // Check if completed
      if (saveData.status === 'completed') {
        await log(`✅ Request ${requestId} is COMPLETE!`);
        // Extract content and citations
        const content = response.data?.choices?.[0]?.message?.content || '';
        const contentLength = content.length;
        const citations = response.data?.citations?.length || 0;
        
        await log(`Content length: ${contentLength}, Citations: ${citations}`);
        return true;
      } else {
        await log(`⏳ Request ${requestId} still in progress...`);
        return false;
      }
    } catch (error) {
      if (error.response) {
        await log(`⚠️ Poll error (${requestId}): Status ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else {
        await log(`⚠️ Poll error (${requestId}): ${error.message}`);
      }
      return false;
    }
  } catch (error) {
    await log(`Error polling request ${requestFile}: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  await log('=== Starting Deep Research Polling ===');
  
  try {
    // Check API key
    checkApiKey();
    
    // Find in-progress requests
    const inProgressFiles = await findInProgressRequests();
    
    if (inProgressFiles.length === 0) {
      await log('No in-progress research requests found to poll');
      return;
    }
    
    await log(`Found ${inProgressFiles.length} in-progress research requests to poll`);
    
    // Poll each request
    let completed = 0;
    for (const file of inProgressFiles) {
      const isComplete = await pollRequest(file);
      if (isComplete) completed++;
    }
    
    await log(`Polling complete. ${completed}/${inProgressFiles.length} requests completed.`);
    
  } catch (error) {
    await log(`Error: ${error.message}`);
  }
  
  await log('=== Deep Research Polling Complete ===');
}

// Run the script
main().catch(console.error);