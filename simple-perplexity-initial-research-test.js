/**
 * Simple Perplexity Initial Research Test
 * 
 * This script tests just the initial research query against the Perplexity API.
 * It verifies that the API works with the current response format.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-sonar-small-128k-online';
const OUTPUT_DIR = 'test-results';
const TEST_QUERY = 'What strategies should startups use to price their SaaS products in 2024?';

// Helper for logging
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Check API key
function checkApiKey() {
  if (!process.env.PERPLEXITY_API_KEY) {
    log('⚠️ PERPLEXITY_API_KEY environment variable is not set');
    process.exit(1);
  }
  log('✅ Perplexity API key is available');
}

/**
 * Execute a query against the Perplexity API
 */
async function executeQuery(query, options = {}) {
  const {
    model = DEFAULT_MODEL,
    systemPrompt = '',
    temperature = 0.2,
    maxTokens = 2048,
  } = options;
  
  log(`Querying Perplexity with model ${model}: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
    };
    
    const requestData = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      max_tokens: maxTokens,
      temperature
    };
    
    const startTime = Date.now();
    const response = await axios.post(PERPLEXITY_API_URL, requestData, { headers });
    const duration = (Date.now() - startTime) / 1000;
    
    log(`Query completed in ${duration.toFixed(2)} seconds`);
    
    // Extract information from response
    const rawResponse = response.data;
    const modelInfo = extractModelInfo(rawResponse, model);
    const content = extractContent(rawResponse);
    const citations = extractCitations(rawResponse);
    
    // Return standardized response
    return {
      content,
      model: modelInfo,
      citations,
      rawResponse,
      requestOptions: {
        query,
        model,
        temperature,
        maxTokens
      },
      duration
    };
    
  } catch (error) {
    log(`❌ Error querying Perplexity API: ${error.message}`);
    if (error.response) {
      log(`Status: ${error.response.status}`);
      log(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    throw error;
  }
}

/**
 * Extract model information from a Perplexity API response
 */
function extractModelInfo(response, defaultModel = "unknown") {
  if (!response) {
    return defaultModel;
  }
  
  // Try direct model property (new format)
  if (response.model) {
    return response.model;
  }
  
  // Try to extract from choices.metadata (possible format)
  if (response.choices && response.choices[0] && response.choices[0].metadata && response.choices[0].metadata.model) {
    return response.choices[0].metadata.model;
  }
  
  // Try to extract from content text (fallback)
  if (response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) {
    const content = response.choices[0].message.content;
    
    // Look for model mentions in text - pattern: "using the sonar-advanced model"
    const modelMentionRegex = /using\s+(?:the\s+)?['"]?(sonar|llama|claude)[-\w.]*/i;
    const match = content.match(modelMentionRegex);
    
    if (match && match[0]) {
      // Extract just the model name by removing the leading text
      return match[0].replace(/^using\s+(?:the\s+)?['"]?/i, '').trim();
    }
    
    // Secondary pattern: "model: sonar" or "model is sonar-advanced"
    const modelColonRegex = /model(?::|is|=)\s+['"]?(sonar|llama|claude)[-\w.]*/i;
    const matchColon = content.match(modelColonRegex);
    
    if (matchColon && matchColon[0]) {
      return matchColon[0].replace(/^model(?::|is|=)\s+['"]?/i, '').trim();
    }
  }
  
  // If all extraction attempts fail, return the default
  return defaultModel;
}

/**
 * Extract citations from Perplexity response
 */
function extractCitations(response) {
  if (!response) {
    return [];
  }
  
  // If response has a citations array, use it (new format)
  if (response.citations && Array.isArray(response.citations)) {
    return response.citations;
  }
  
  // Extract content from new format structure
  let content = '';
  if (response.choices && response.choices[0] && response.choices[0].message) {
    content = response.choices[0].message.content;
  } else if (response.content) {
    // Old format
    content = response.content;
  }
  
  // If no content to parse, return empty array
  if (!content) {
    return [];
  }
  
  // Extract citations from text using regex pattern matching
  const citations = [];
  const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  const matches = content.match(urlRegex);
  
  if (matches) {
    // Filter out duplicates
    return [...new Set(matches)];
  }
  
  return citations;
}

/**
 * Extract content from Perplexity response
 */
function extractContent(response) {
  if (!response) {
    return '';
  }
  
  // Handle new format (choices array with messages)
  if (response.choices && response.choices[0] && response.choices[0].message) {
    return response.choices[0].message.content;
  }
  
  // Handle old format (direct content property)
  if (response.content) {
    return response.content;
  }
  
  // Fallback for unknown format
  return JSON.stringify(response);
}

/**
 * Main test function
 */
async function runTest() {
  log('=== Starting Simple Perplexity Initial Research Test ===');
  
  try {
    // Check API key
    checkApiKey();
    
    // Create output directory if it doesn't exist
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Generate timestamp for this test run
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const outputFile = path.join(OUTPUT_DIR, `initial-research-test-${timestamp}.json`);
    
    // Run research query
    log(`Starting research query test with: "${TEST_QUERY}"`);
    
    const systemPrompt = 'You are an expert business analyst and pricing strategist. Provide comprehensive research with specific examples, industry standards, and best practices. Cite credible sources when possible.';
    
    const initialResults = await executeQuery(TEST_QUERY, {
      systemPrompt,
      temperature: 0.2
    });
    
    // Log summary
    log('\nResearch Summary:');
    log(`- Model used: ${initialResults.model}`);
    log(`- Response time: ${initialResults.duration.toFixed(2)} seconds`);
    log(`- Content length: ${initialResults.content.length} characters`);
    log(`- Citations found: ${initialResults.citations.length} sources`);
    
    // Preview content
    log('\nContent Preview:');
    log('--------------------------------------');
    log(initialResults.content.substring(0, 500) + '...');
    log('--------------------------------------');
    
    // Preview citations
    if (initialResults.citations.length > 0) {
      log('\nCitations:');
      initialResults.citations.forEach((citation, i) => {
        log(`${i+1}. ${citation}`);
      });
    }
    
    // Save results
    await fs.writeFile(outputFile, JSON.stringify(initialResults, null, 2));
    log(`\nFull research results saved to: ${outputFile}`);
    
    log('=== Initial Research Test Completed Successfully ===');
    return { success: true, outputFile, results: initialResults };
    
  } catch (error) {
    log(`Error in test: ${error.message}`);
    if (error.stack) {
      log(`Stack trace: ${error.stack}`);
    }
    return { success: false, error: error.message };
  }
}

// Run the test
runTest().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});