/**
 * Check Perplexity API Access - ES Module Version
 * 
 * This script verifies that we can successfully connect to the Perplexity API
 * and get responses from our known working model.
 */

import axios from 'axios';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const API_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const WORKING_MODEL = 'llama-3.1-sonar-small-128k-online';
const LOG_FILE = 'perplexity-api-access-check.log';

// Logging helper
async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  try {
    await fs.appendFile(LOG_FILE, logMessage + '\n');
  } catch (error) {
    console.error(`Warning: Could not write to log file: ${error.message}`);
  }
}

// Check if API key is available
function checkApiKey() {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY environment variable is not set');
  }
  return true;
}

// Test the API with our working model
async function testApiAccess() {
  try {
    await log('=== Starting Perplexity API Access Check ===');
    
    // Verify API key is set
    checkApiKey();
    await log('✅ API key environment variable is set');
    
    // Prepare simple test query
    const query = 'What are the three most important factors in SaaS pricing strategy? Keep it very brief.';
    await log(`Testing API with query: "${query}"`);
    await log(`Using model: ${WORKING_MODEL}`);
    
    const payload = {
      model: WORKING_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a knowledgeable business consultant. Provide concise answers.'
        },
        {
          role: 'user',
          content: query
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    };
    
    // Make the API request
    await log('Sending request to Perplexity API...');
    const startTime = Date.now();
    
    const response = await axios.post(
      API_ENDPOINT,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
        },
        timeout: 30000 // 30 seconds
      }
    );
    
    const elapsed = (Date.now() - startTime) / 1000;
    await log(`✅ Received response in ${elapsed.toFixed(2)} seconds`);
    
    // Extract content
    const content = response.data.choices[0].message.content;
    await log('Response content:');
    await log(`---\n${content}\n---`);
    
    // Check for citations
    const citations = response.data.citations || [];
    await log(`Found ${citations.length} citations`);
    
    // Log model info
    const model = response.data.model || WORKING_MODEL;
    await log(`Model used: ${model}`);
    
    // Save full response to file
    const resultFile = `perplexity-response-${new Date().toISOString().replace(/:/g, '-')}.txt`;
    await fs.writeFile(resultFile, JSON.stringify(response.data, null, 2));
    await log(`Full response saved to ${resultFile}`);
    
    await log('✅ API access check completed successfully');
    
    return {
      success: true,
      content,
      citations,
      model
    };
    
  } catch (error) {
    await log(`❌ Error testing API access: ${error.message}`);
    
    if (error.response) {
      await log(`API Error Status: ${error.response.status}`);
      await log(`API Error Data: ${JSON.stringify(error.response.data)}`);
    }
    
    return {
      success: false,
      error: error.message,
      details: error.response ? error.response.data : null
    };
  }
}

// Run the test
testApiAccess().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});