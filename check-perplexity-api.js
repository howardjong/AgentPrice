/**
 * Simple Perplexity API Check - ES Module Version
 * 
 * Tests both regular and deep research models
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

// Constants
const API_URL = 'https://api.perplexity.ai/chat/completions';
const RESULTS_DIR = './test-results';
const LOG_PREFIX = '[API-CHECK]';

/**
 * Logging helper
 */
async function log(message) {
  console.log(`${new Date().toISOString()} ${LOG_PREFIX} ${message}`);
}

/**
 * Check if API key is available
 */
function checkApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY environment variable not set');
  }
  return apiKey;
}

/**
 * Test a specific Perplexity model
 */
async function testModel(model, query) {
  await log(`Testing model: ${model}`);
  const apiKey = checkApiKey();
  
  try {
    await log(`Sending query: "${query}"`);
    
    const response = await axios.post(
      API_URL,
      {
        model,
        messages: [{ role: 'user', content: query }],
        temperature: 0.3,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: model === 'sonar-deep-research' ? 60000 : 30000, // Longer timeout for deep research
      }
    );
    
    await log(`Success with model ${model}`);
    await saveResponse(model, query, response.data);
    return response.data;
  } catch (error) {
    if (error.response) {
      await log(`Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      await log(`No response received: ${error.message}`);
    } else {
      await log(`Error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Save response to a file
 */
async function saveResponse(model, query, data) {
  try {
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `${RESULTS_DIR}/perplexity-${model}-${timestamp}.json`;
    
    const saveData = {
      query,
      model,
      timestamp,
      response: data
    };
    
    await fs.writeFile(filename, JSON.stringify(saveData, null, 2));
    await log(`Response saved to ${filename}`);
  } catch (error) {
    await log(`Error saving response: ${error.message}`);
  }
}

/**
 * Extract model information from the response
 */
function extractModelInfo(response) {
  try {
    if (response && response.model) {
      return response.model;
    }
    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Main function
 */
async function main() {
  await log('=== Starting Perplexity API Check ===');
  
  try {
    const testQuery = 'What is the current date today?';
    
    // Test a standard model
    const stdModelName = 'llama-3.1-sonar-small-128k-online';
    const stdResponse = await testModel(stdModelName, testQuery);
    
    if (stdResponse) {
      const model = extractModelInfo(stdResponse);
      const content = stdResponse.choices?.[0]?.message?.content || 'No content';
      await log(`Standard model ${model} response: ${content.substring(0, 100)}...`);
    }
    
    // Start a deep research query
    // Note: This will usually return a poll URL rather than a complete response
    await log('Testing deep research model (Note: this will start an async request)');
    const deepResearchQuery = 'What are the latest pricing trends for SaaS startups in 2024?';
    const deepResponse = await testModel('sonar-deep-research', deepResearchQuery);
    
    if (deepResponse) {
      await log('Deep research request initiated successfully');
      // Check for poll URL in deep research response
      if (deepResponse.poll_url) {
        await log(`Poll URL received: ${deepResponse.poll_url}`);
      } else {
        await log('No poll URL in response - unusual for deep research');
      }
    }
    
  } catch (error) {
    await log(`Error: ${error.message}`);
  }
  
  await log('=== Perplexity API Check Complete ===');
}

// Run the script
main().catch(console.error);