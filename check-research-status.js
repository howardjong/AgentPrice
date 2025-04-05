/**
 * Check Deep Research Status - ES Module Version
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

// Constants
const RESULTS_DIR = './test-results/deep-research';
const LOG_PREFIX = '[RESEARCH-STATUS]';

/**
 * Logging helper
 */
async function log(message) {
  console.log(`${new Date().toISOString()} ${LOG_PREFIX} ${message}`);
}

/**
 * Find all deep research request files
 */
async function findResearchRequests() {
  try {
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    const files = await fs.readdir(RESULTS_DIR);
    // Find intermediate files (initial request data)
    return files.filter(f => f.includes('intermediate.json'));
  } catch (error) {
    await log(`Error finding research requests: ${error.message}`);
    return [];
  }
}

/**
 * Process each research request
 */
async function processRequests(files) {
  if (files.length === 0) {
    await log('No research requests found');
    return;
  }
  
  await log(`Found ${files.length} research requests`);
  
  for (const file of files) {
    try {
      const filePath = path.join(RESULTS_DIR, file);
      const requestData = JSON.parse(await fs.readFile(filePath, 'utf8'));
      await log(`Request ${requestData.requestId}: "${requestData.query.substring(0, 50)}..."`);
      
      // Look for response files for this request
      const requestPrefix = `request-${requestData.requestId}`;
      const allFiles = await fs.readdir(RESULTS_DIR);
      const responseFiles = allFiles.filter(f => 
        f.includes(requestPrefix) && f.includes('response'));
      
      if (responseFiles.length > 0) {
        await log(`Found ${responseFiles.length} response files for request ${requestData.requestId}`);
        
        // Check the last response
        const lastResponseFile = responseFiles.sort().pop();
        const responsePath = path.join(RESULTS_DIR, lastResponseFile);
        const responseData = JSON.parse(await fs.readFile(responsePath, 'utf8'));
        
        if (responseData.status === 'completed') {
          await log(`✅ Request ${requestData.requestId} is COMPLETE`);
          // Summary of response
          const model = responseData.response?.model || 'unknown';
          const contentLength = responseData.response?.choices?.[0]?.message?.content?.length || 0;
          const citations = responseData.response?.citations?.length || 0;
          
          await log(`Model: ${model}, Content length: ${contentLength}, Citations: ${citations}`);
        } else {
          await log(`⏳ Request ${requestData.requestId} status: ${responseData.status || 'unknown'}`);
        }
      } else {
        await log(`⏳ No response files found for request ${requestData.requestId} (still in progress)`);
      }
    } catch (error) {
      await log(`Error processing request file ${file}: ${error.message}`);
    }
  }
}

/**
 * Main function
 */
async function main() {
  await log('=== Starting Deep Research Status Check ===');
  
  try {
    const files = await findResearchRequests();
    await processRequests(files);
  } catch (error) {
    await log(`Error: ${error.message}`);
  }
  
  await log('=== Deep Research Status Check Complete ===');
}

// Run the script
main().catch(console.error);