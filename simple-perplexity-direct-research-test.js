/**
 * Simple Direct Perplexity Research Test
 * 
 * This script directly tests the Perplexity API for research purposes
 * without going through the full deep research workflow.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const PERPLEXITY_MODEL = 'llama-3.1-sonar-small-128k-online';
const OUTPUT_DIR = 'test-results';
const TEST_QUERY = 'What are the most common pricing models for SaaS products in 2024?';

// Helper functions
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function checkApiKey() {
  if (!process.env.PERPLEXITY_API_KEY) {
    log('⚠️ PERPLEXITY_API_KEY environment variable is not set');
    process.exit(1);
  }
  log('✅ Perplexity API key is available');
}

async function performResearch(query, options = {}) {
  const { systemPrompt = '', temperature = 0.2, maxTokens = 2048 } = options;
  
  log(`Querying Perplexity with: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
    };
    
    const requestData = {
      model: PERPLEXITY_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      max_tokens: maxTokens,
      temperature: temperature
    };
    
    const startTime = Date.now();
    const response = await axios.post(PERPLEXITY_API_URL, requestData, { headers });
    const duration = (Date.now() - startTime) / 1000;
    
    log(`Query completed in ${duration.toFixed(2)} seconds`);
    
    // Extract and format result
    const result = {
      content: response.data.choices[0].message.content,
      model: response.data.model || 'unknown',
      citations: response.data.citations || [],
      usage: response.data.usage || {},
      rawResponse: response.data
    };
    
    return result;
  } catch (error) {
    log(`❌ Error querying Perplexity API: ${error.message}`);
    if (error.response) {
      log(`Status: ${error.response.status}`);
      log(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    throw error;
  }
}

async function runDirectResearchTest() {
  log('=== Starting Simple Direct Perplexity Research Test ===');
  
  try {
    // Check API key
    checkApiKey();
    
    // Create output directory if it doesn't exist
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Generate a timestamp for this test run
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const outputFile = path.join(OUTPUT_DIR, `perplexity-response-${timestamp}.txt`);
    
    // Perform research with system prompt
    const systemPrompt = 'You are an expert business analyst and pricing strategist. Provide comprehensive research with specific examples, industry standards, and best practices. Cite credible sources when possible.';
    
    log('Performing research with system prompt...');
    const researchResult = await performResearch(TEST_QUERY, { systemPrompt });
    
    // Log results
    log(`Model used: ${researchResult.model}`);
    log(`Response length: ${researchResult.content.length} characters`);
    log(`Number of citations: ${researchResult.citations.length}`);
    log(`Token usage: ${JSON.stringify(researchResult.usage)}`);
    
    // Preview content
    log('\nResponse preview:');
    log('--------------------------------------');
    log(researchResult.content.substring(0, 500) + '...');
    log('--------------------------------------');
    
    // Log citations
    if (researchResult.citations.length > 0) {
      log('\nCitations:');
      researchResult.citations.forEach((citation, index) => {
        log(`[${index + 1}] ${citation}`);
      });
    }
    
    // Save full response to file
    const outputContent = `
=== Perplexity Research Test Results ===
Query: ${TEST_QUERY}
Timestamp: ${timestamp}
Model: ${researchResult.model}
Token Usage: ${JSON.stringify(researchResult.usage)}

=== Response Content ===
${researchResult.content}

=== Citations (${researchResult.citations.length}) ===
${researchResult.citations.map((citation, index) => `[${index + 1}] ${citation}`).join('\n')}

=== Raw Response ===
${JSON.stringify(researchResult.rawResponse, null, 2)}
`;
    
    await fs.writeFile(outputFile, outputContent);
    log(`Full response saved to: ${outputFile}`);
    
    log('=== Test completed successfully ===');
    return { success: true, outputFile };
    
  } catch (error) {
    log(`❌ Test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run the test
runDirectResearchTest()
  .then(result => {
    if (!result.success) {
      process.exit(1);
    }
  })
  .catch(error => {
    log(`Unhandled error: ${error.message}`);
    process.exit(1);
  });

// ES Module exports
export { runDirectResearchTest, performResearch };