/**
 * Check Deep Research Status
 * 
 * This script checks the status of previously initiated deep research requests
 * by looking for poll URLs in the deep-research-results directory.
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Constants
const DEEP_RESEARCH_DIR = path.join('test-results', 'deep-research');
const RESEARCH_OUTPUT_DIR = path.join('test-results', 'deep-research-results');
const MAX_POLLING_ATTEMPTS = 10;
const POLLING_INTERVAL_MS = 30000; // 30 seconds between polls

// Ensure API key is available
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

async function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Find all poll data files
 */
async function findPollDataFiles() {
  try {
    // Ensure directories exist
    await fs.mkdir(DEEP_RESEARCH_DIR, { recursive: true });
    await fs.mkdir(RESEARCH_OUTPUT_DIR, { recursive: true });
    
    // Get all files in the deep research directory
    const files = await fs.readdir(DEEP_RESEARCH_DIR);
    
    // Filter for intermediate files that might contain poll URLs
    return files
      .filter(file => file.includes('intermediate'))
      .map(file => path.join(DEEP_RESEARCH_DIR, file));
    
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
    await log(`Checking status for: ${path.basename(pollDataPath)}`);
    
    // Read the intermediate data file
    const dataContent = await fs.readFile(pollDataPath, 'utf8');
    const data = JSON.parse(dataContent);
    
    // Check if we already have poll URL or response data
    if (!data.pollUrl && !data.responseData) {
      await log(`No poll URL or response data found for ${data.requestId}`);
      
      // Make initial API request to get poll URL
      if (!data.initialResponseData) {
        await log(`Making initial API request for ${data.requestId}`);
        
        const response = await axios.post(
          'https://api.perplexity.ai/chat/completions',
          {
            model: data.options.model,
            messages: [
              { role: 'system', content: data.options.systemPrompt || 'You are a helpful research assistant.' },
              { role: 'user', content: data.query }
            ],
            max_tokens: data.options.maxTokens || 4000,
            temperature: data.options.temperature || 0.2,
            stream: false
          },
          {
            headers: {
              'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        // Extract poll URL if available
        data.initialResponseData = response.data;
        
        if (response.data && response.data.poll_url) {
          data.pollUrl = response.data.poll_url;
          await log(`Found poll URL for ${data.requestId}: ${data.pollUrl}`);
        } else {
          await log(`No poll URL found in initial response for ${data.requestId}`);
        }
        
        // Update the data file
        await fs.writeFile(pollDataPath, JSON.stringify(data, null, 2));
      }
      
      return { requestId: data.requestId, status: 'pending', message: 'No poll URL available' };
    }
    
    // If we have poll URL but no final response, poll for status
    if (data.pollUrl && !data.responseData) {
      await log(`Polling status for ${data.requestId} at ${data.pollUrl}`);
      
      let attempts = 0;
      let finalResponse = null;
      
      while (attempts < MAX_POLLING_ATTEMPTS) {
        attempts++;
        
        try {
          const response = await axios.get(data.pollUrl, {
            headers: {
              'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          // Save the latest polling response
          data.latestPollingResponse = response.data;
          await fs.writeFile(pollDataPath, JSON.stringify(data, null, 2));
          
          // Check the status of the response
          const status = getResponseStatus(response.data);
          await log(`Status for ${data.requestId}: ${status}`);
          
          if (status === 'completed') {
            finalResponse = response.data;
            break;
          } else if (status === 'error') {
            await log(`Error in polling response for ${data.requestId}: ${JSON.stringify(response.data)}`);
            break;
          }
          
          // Wait before the next polling attempt
          await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
          
        } catch (error) {
          await log(`Error polling for ${data.requestId}: ${error.message}`);
          
          if (error.response) {
            await log(`API Error Status: ${error.response.status}`);
            await log(`API Error Data: ${JSON.stringify(error.response.data)}`);
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
        }
      }
      
      if (finalResponse) {
        data.responseData = finalResponse;
        data.status = 'completed';
        data.completionTime = new Date().toISOString();
        
        // Extract content and save to separate file
        const content = extractContent(finalResponse);
        const modelInfo = extractModelInfo(finalResponse);
        
        await log(`Research completed for ${data.requestId} using model: ${modelInfo}`);
        
        // Save content to a markdown file
        const contentFilePath = path.join(
          RESEARCH_OUTPUT_DIR,
          `research-${data.requestId}-${data.completionTime.replace(/:/g, '-')}.md`
        );
        
        await fs.writeFile(contentFilePath, content);
        await log(`Saved research content to ${contentFilePath}`);
        
        // Save full response data
        const responseFilePath = path.join(
          RESEARCH_OUTPUT_DIR,
          `response-${data.requestId}-${data.completionTime.replace(/:/g, '-')}.json`
        );
        
        await fs.writeFile(responseFilePath, JSON.stringify(finalResponse, null, 2));
        await log(`Saved full response to ${responseFilePath}`);
        
        // Update the data file
        await fs.writeFile(pollDataPath, JSON.stringify(data, null, 2));
        
        return {
          requestId: data.requestId,
          status: 'completed',
          model: modelInfo,
          contentPath: contentFilePath,
          responsePath: responseFilePath
        };
      } else {
        data.status = 'in_progress';
        data.lastChecked = new Date().toISOString();
        
        // Update the data file
        await fs.writeFile(pollDataPath, JSON.stringify(data, null, 2));
        
        return {
          requestId: data.requestId,
          status: 'in_progress',
          message: `Still in progress after ${attempts} polling attempts`
        };
      }
    }
    
    // If we already have response data, report it
    if (data.responseData) {
      const modelInfo = extractModelInfo(data.responseData);
      
      return {
        requestId: data.requestId,
        status: 'completed',
        model: modelInfo,
        completionTime: data.completionTime
      };
    }
    
    return { requestId: data.requestId, status: 'unknown' };
    
  } catch (error) {
    await log(`Error checking research status for ${pollDataPath}: ${error.message}`);
    return { status: 'error', error: error.message };
  }
}

/**
 * Get the status of a response (completed, in_progress, etc.)
 */
function getResponseStatus(response) {
  if (!response) return 'unknown';
  
  if (response.error) return 'error';
  
  // Check for content in the response which indicates completion
  if (response.choices && response.choices[0] && response.choices[0].message) {
    return 'completed';
  }
  
  // If there's a status field, use that
  if (response.status) {
    return response.status;
  }
  
  // If there's a poll URL, it's still in progress
  if (response.poll_url) {
    return 'in_progress';
  }
  
  return 'unknown';
}

/**
 * Extract model information from a Perplexity API response
 */
function extractModelInfo(response, defaultModel = "unknown") {
  if (!response) return defaultModel;
  
  if (response.model) {
    return response.model;
  }
  
  if (response.choices && 
      response.choices.length > 0 && 
      response.choices[0].message && 
      response.choices[0].message.role === 'assistant' && 
      response.choices[0].message.tool_calls &&
      response.choices[0].message.tool_calls.length > 0 &&
      response.choices[0].message.tool_calls[0].function &&
      response.choices[0].message.tool_calls[0].function.arguments) {
    
    try {
      const args = JSON.parse(response.choices[0].message.tool_calls[0].function.arguments);
      if (args.model) {
        return args.model;
      }
    } catch (e) {
      // Unable to parse arguments
    }
  }
  
  return defaultModel;
}

/**
 * Extract content from Perplexity response
 */
function extractContent(response) {
  if (!response) return '';
  
  // Standard completion format
  if (response.choices && 
      response.choices.length > 0 && 
      response.choices[0].message &&
      response.choices[0].message.content) {
    return response.choices[0].message.content;
  }
  
  // Extended tool call format
  if (response.choices && 
      response.choices.length > 0 && 
      response.choices[0].message && 
      response.choices[0].message.tool_calls &&
      response.choices[0].message.tool_calls.length > 0 &&
      response.choices[0].message.tool_calls[0].function &&
      response.choices[0].message.tool_calls[0].function.arguments) {
    
    try {
      const args = JSON.parse(response.choices[0].message.tool_calls[0].function.arguments);
      if (args.content) {
        return args.content;
      }
    } catch (e) {
      // Unable to parse arguments
    }
  }
  
  // Fallback
  if (response.content) {
    return response.content;
  }
  
  return JSON.stringify(response);
}

/**
 * Main function to check all research statuses
 */
async function checkAllResearchStatuses() {
  try {
    await log('Starting status check for all deep research requests...');
    
    // Find all poll data files
    const pollDataFiles = await findPollDataFiles();
    await log(`Found ${pollDataFiles.length} research requests to check`);
    
    if (pollDataFiles.length === 0) {
      await log('No research requests found. Exiting.');
      return;
    }
    
    // Check status for each poll data file
    const results = [];
    
    for (const pollDataFile of pollDataFiles) {
      const result = await checkResearchStatus(pollDataFile);
      results.push(result);
    }
    
    // Generate summary
    await log('\n=== Deep Research Status Summary ===');
    for (const result of results) {
      await log(`Request ${result.requestId}: ${result.status}`);
      
      if (result.status === 'completed') {
        await log(`  Model: ${result.model}`);
        await log(`  Completed: ${result.completionTime}`);
        
        if (result.contentPath) {
          await log(`  Content saved to: ${result.contentPath}`);
        }
      }
      
      if (result.message) {
        await log(`  Message: ${result.message}`);
      }
    }
    
    await log('Status check complete.');
    
  } catch (error) {
    await log(`Error checking research statuses: ${error.message}`);
  }
}

// Run the main function
if (PERPLEXITY_API_KEY) {
  checkAllResearchStatuses().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
} else {
  console.error('Error: PERPLEXITY_API_KEY environment variable is not set.');
  process.exit(1);
}