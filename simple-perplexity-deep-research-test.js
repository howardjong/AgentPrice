/**
 * Simple Perplexity Deep Research Test
 * 
 * This script tests the conductDeepResearch function directly without using Redis or job queues.
 * It focuses on verifying that the Perplexity API's deep research functionality works with the
 * current response format.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-sonar-small-128k-online';
const REQUESTS_PER_MINUTE = 5;
const MINUTE_IN_MS = 60 * 1000;
const DELAY_BETWEEN_REQUESTS = Math.ceil(MINUTE_IN_MS / REQUESTS_PER_MINUTE);
const OUTPUT_DIR = 'test-results';
const TEST_QUERY = 'What strategies should startups use to price their SaaS products in 2024?';

// Helper for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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
      }
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
 * Conducts deep research using the Perplexity API
 * This simplified version skips Redis and job queues for direct testing
 */
async function conductSimplifiedDeepResearch(query, options = {}) {
  const requestId = uuidv4().substring(0, 8);
  log(`Starting deep research for request ${requestId}`);
  
  const {
    model = DEFAULT_MODEL,
    systemPrompt = 'You are a helpful research assistant. Provide comprehensive, accurate information with specific examples and citations.',
    maxFollowups = 2, // Using a smaller number to keep test time reasonable
    temperature = 0.2,
  } = options;
  
  try {
    // Step 1: Initial query
    log(`[${requestId}] Performing initial research query`);
    const initialResults = await executeQuery(query, {
      model,
      systemPrompt,
      temperature
    });
    
    // Record initial step
    log(`[${requestId}] Initial query complete - Model: ${initialResults.model}`);
    log(`[${requestId}] Response length: ${initialResults.content.length} chars`);
    log(`[${requestId}] Citations found: ${initialResults.citations.length}`);
    
    // Add delay to respect rate limits
    log(`[${requestId}] Waiting ${DELAY_BETWEEN_REQUESTS}ms before next API call...`);
    await delay(DELAY_BETWEEN_REQUESTS);
    
    // Step 2: Generate follow-up questions
    log(`[${requestId}] Generating follow-up questions`);
    const followupPrompt = `Based on the following research: 
    
    "${initialResults.content.substring(0, 1500)}..."
    
    What are the ${maxFollowups} most important follow-up questions to research further to provide a more comprehensive answer to the original question: "${query}"?
    
    Return the questions as a numbered list without any introduction or conclusion.`;
    
    const followupQuestionsResponse = await executeQuery(followupPrompt, {
      model,
      systemPrompt: 'You are a research planning assistant. Create follow-up questions that will help deepen the research.',
      temperature: 0.3
    });
    
    // Parse follow-up questions from the response
    const followupQuestions = followupQuestionsResponse.content
      .split('\n')
      .filter(line => /^\d+\./.test(line.trim()))
      .map(question => question.replace(/^\d+\.\s*/, '').trim())
      .slice(0, maxFollowups);
    
    log(`[${requestId}] Generated ${followupQuestions.length} follow-up questions:`);
    followupQuestions.forEach((q, i) => log(`  ${i+1}. ${q}`));
    
    // Add delay to respect rate limits
    log(`[${requestId}] Waiting ${DELAY_BETWEEN_REQUESTS}ms before next API call...`);
    await delay(DELAY_BETWEEN_REQUESTS);
    
    // Step 3: Research first follow-up question only (to keep test shorter)
    if (followupQuestions.length > 0) {
      const followupQuestion = followupQuestions[0];
      log(`[${requestId}] Researching follow-up question: ${followupQuestion}`);
      
      const followupResult = await executeQuery(followupQuestion, {
        model,
        systemPrompt: `You are a research assistant answering a follow-up question related to: "${query}". 
        Provide specific, detailed information with citations.`,
        temperature
      });
      
      log(`[${requestId}] Follow-up research complete - Model: ${followupResult.model}`);
      log(`[${requestId}] Response length: ${followupResult.content.length} chars`);
      log(`[${requestId}] Citations found: ${followupResult.citations.length}`);
      
      // Add delay to respect rate limits
      log(`[${requestId}] Waiting ${DELAY_BETWEEN_REQUESTS}ms before next API call...`);
      await delay(DELAY_BETWEEN_REQUESTS);
      
      // Step 4: Synthesize (limited) research
      log(`[${requestId}] Synthesizing research results`);
      const researchSummary = `
      Original research: ${initialResults.content.substring(0, 1500)}...
      
      Follow-up research on question "${followupQuestion}":
      ${followupResult.content.substring(0, 1500)}...
      `;
      
      const synthesisPrompt = `Synthesize the following research into a brief, well-structured answer to the original question: "${query}"
      
      ${researchSummary}
      
      Include relevant information, examples, and cite sources properly. Your answer should be concise (max 500 words) and highlight only the key insights.`;
      
      const synthesisResult = await executeQuery(synthesisPrompt, {
        model,
        systemPrompt: 'You are a research synthesis expert. Create a concise answer that incorporates the key research findings.',
        temperature: 0.2
      });
      
      // Compile and de-duplicate all citations
      const allCitations = [
        ...initialResults.citations,
        ...followupResult.citations,
        ...synthesisResult.citations
      ];
      const uniqueCitations = [...new Set(allCitations)];
      
      log(`[${requestId}] Deep research completed with ${uniqueCitations.length} unique citations`);
      
      // Prepare final results
      const results = {
        requestId,
        originalQuery: query,
        initialResearch: {
          model: initialResults.model,
          content: initialResults.content,
          citations: initialResults.citations
        },
        followupQuestions,
        followupResearch: {
          question: followupQuestion,
          model: followupResult.model,
          content: followupResult.content,
          citations: followupResult.citations
        },
        synthesis: {
          model: synthesisResult.model,
          content: synthesisResult.content,
          citations: synthesisResult.citations
        },
        allCitations: uniqueCitations,
        completedAt: new Date().toISOString()
      };
      
      return results;
    } else {
      throw new Error("No follow-up questions were generated");
    }
    
  } catch (error) {
    log(`[${requestId}] Error conducting deep research: ${error.message}`);
    throw error;
  }
}

/**
 * Main test function
 */
async function runTest() {
  log('=== Starting Simple Perplexity Deep Research Test ===');
  
  try {
    // Check API key
    checkApiKey();
    
    // Create output directory if it doesn't exist
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Generate timestamp for this test run
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const outputFile = path.join(OUTPUT_DIR, `deep-research-test-${timestamp}.json`);
    
    // Run deep research
    log(`Starting deep research test with query: "${TEST_QUERY}"`);
    const startTime = Date.now();
    
    const research = await conductSimplifiedDeepResearch(TEST_QUERY, {
      systemPrompt: 'You are an expert business analyst and pricing strategist. Provide comprehensive research with specific examples, industry standards, and best practices. Cite credible sources when possible.',
      maxFollowups: 2
    });
    
    const duration = (Date.now() - startTime) / 1000;
    log(`Deep research completed in ${duration.toFixed(1)} seconds`);
    
    // Log summary
    log('\nResearch Summary:');
    log(`- Models used: Initial: ${research.initialResearch.model}, Followup: ${research.followupResearch.model}, Synthesis: ${research.synthesis.model}`);
    log(`- Citations found: ${research.allCitations.length} unique sources`);
    log(`- Follow-up questions generated: ${research.followupQuestions.length}`);
    
    // Preview synthesis
    log('\nSynthesis Preview:');
    log('--------------------------------------');
    log(research.synthesis.content.substring(0, 500) + '...');
    log('--------------------------------------');
    
    // Save results
    await fs.writeFile(outputFile, JSON.stringify(research, null, 2));
    log(`\nFull research results saved to: ${outputFile}`);
    
    log('=== Deep Research Test Completed Successfully ===');
    return { success: true, outputFile, research };
    
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