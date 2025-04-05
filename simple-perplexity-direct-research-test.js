/**
 * Simple Direct Perplexity Research Test
 * 
 * This script directly tests the Perplexity API for research purposes
 * without going through the full deep research workflow.
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Logger function
function log(message) {
  console.log(message);
}

// Check if API key is available
function checkApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    log('⚠️ PERPLEXITY_API_KEY environment variable is not set.');
    return false;
  }
  log('✅ PERPLEXITY_API_KEY is available');
  return true;
}

// Query Perplexity API directly with a research query
async function performResearch(query, options = {}) {
  if (!checkApiKey()) {
    throw new Error('API key is not available');
  }

  // Get API key
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  // Prepare research-focused system message
  const systemMessage = options.systemPrompt || 
    'You are an expert research assistant. Conduct a comprehensive analysis of this topic. ' +
    'Include key insights, varied perspectives, and cite your sources. Organize your findings ' +
    'clearly with section headings. Focus on providing substantive, detailed, and accurate information.';
  
  // Prepare request based on latest Perplexity API docs
  const requestData = {
    model: options.model || 'sonar',
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: query }
    ],
    temperature: options.temperature || 0.2,
    max_tokens: options.max_tokens || 2048
  };
  
  log(`\nSending research request to Perplexity API (model: ${requestData.model}):`);
  log(JSON.stringify(requestData.messages[0], null, 2));
  
  // Make API request
  try {
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 30000 // 30 second timeout to avoid hanging
      }
    );
    
    return response.data;
    
  } catch (error) {
    log('❌ API request failed:');
    if (error.response) {
      log(`Status: ${error.response.status}`);
      log('Response data:');
      log(JSON.stringify(error.response.data, null, 2));
    } else {
      log(error.message);
    }
    throw error;
  }
}

// Main test function
async function runDirectResearchTest() {
  log('=== Running Direct Perplexity Research Test ===');
  
  try {
    // Test with a simpler research query
    const query = 'What are three key factors to consider in SaaS pricing?';
    log(`\nExecuting research query: "${query}"`);
    
    const response = await performResearch(query, {
      model: 'sonar',  // Basic model
      temperature: 0.2,  // Lower temperature for more focused/factual responses
      max_tokens: 1024  // Shorter response to speed up the test
    });
    
    log('\n✅ Research query successful!');
    log(`\nModel used: ${response.model || 'unknown'}`);
    
    // Extract and display the response content
    const content = response.choices[0]?.message?.content || 'No content returned';
    log('\nResponse content:');
    log('--------------------------------------');
    log(content.substring(0, 500) + '...');
    log('--------------------------------------');
    
    // Save the full response for analysis
    const outputDir = 'test-results';
    await fs.mkdir(outputDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const outputFile = path.join(outputDir, `perplexity-research-${timestamp}.json`);
    await fs.writeFile(outputFile, JSON.stringify(response, null, 2));
    log(`\nFull response saved to ${outputFile}`);
    
    return { success: true, response };
    
  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`);
    return { success: false, error };
  }
}

// Run the test
runDirectResearchTest();