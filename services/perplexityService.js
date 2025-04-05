/**
 * Perplexity Service
 * 
 * Handles interactions with the Perplexity API, including basic queries and deep research.
 * Supports both the old and new API response formats.
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const CircuitBreaker = require('../utils/circuitBreaker');
const logger = require('../utils/logger');
const RobustAPIClient = require('../utils/apiClient');

// Constants
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-sonar-small-128k-online';
const PERPLEXITY_FALLBACK_MODEL = 'sonar-small-online';
const REQUESTS_PER_MINUTE = 5;
const MINUTE_IN_MS = 60 * 1000;
const DELAY_BETWEEN_REQUESTS = Math.ceil(MINUTE_IN_MS / REQUESTS_PER_MINUTE);

// Helper for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Create API client with circuit breaker
const apiClient = new RobustAPIClient({
  baseURL: PERPLEXITY_API_URL,
  timeout: 60000,
  defaultModel: DEFAULT_MODEL,
  fallbackModel: PERPLEXITY_FALLBACK_MODEL,
  retryDelay: DELAY_BETWEEN_REQUESTS,
  maxRetries: 3
});

// Circuit breaker for Perplexity API
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000,
  name: 'perplexity-api'
});

/**
 * Extracts model information from a Perplexity API response
 * 
 * @param {Object} response - The API response object
 * @param {string} defaultModel - Default model name to use if extraction fails
 * @returns {string} The extracted model name or defaultModel
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
  
  // Check old format with direct content
  if (response.content && typeof response.content === 'string') {
    // For backward compatibility with original format
    return defaultModel;
  }
  
  // If all extraction attempts fail, return the default
  return defaultModel;
}

/**
 * Extract citations from Perplexity response
 * 
 * Handles both the new format with a dedicated citations array
 * and the old format where citations are embedded in the text.
 * 
 * @param {Object} response - The API response
 * @returns {Array} Array of citation URLs
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
 * Extracts content from Perplexity API response, handling different formats
 * 
 * @param {Object} response - The API response
 * @returns {string} The extracted content text
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
 * Executes a basic query against the Perplexity API
 * 
 * @param {string} query - The question to ask
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} The standardized response
 */
async function executeQuery(query, options = {}) {
  const {
    model = DEFAULT_MODEL,
    systemPrompt = '',
    temperature = 0.2,
    maxTokens = 2048,
    apiKey = process.env.PERPLEXITY_API_KEY
  } = options;
  
  if (!apiKey) {
    throw new Error('Perplexity API key is required');
  }
  
  try {
    logger.info(`Querying Perplexity API with model: ${model}`);
    
    const requestData = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      max_tokens: maxTokens,
      temperature
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    // Use circuit breaker to execute the API call
    const response = await circuitBreaker.execute(async () => {
      return await axios.post(PERPLEXITY_API_URL, requestData, { headers });
    });
    
    // Extract information from the response
    const rawResponse = response.data;
    const modelInfo = extractModelInfo(rawResponse, model);
    const content = extractContent(rawResponse);
    const citations = extractCitations(rawResponse);
    
    // Add delay to respect rate limits
    await delay(DELAY_BETWEEN_REQUESTS);
    
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
    logger.error(`Error querying Perplexity API: ${error.message}`);
    
    // Enhanced error handling
    if (error.response) {
      const status = error.response.status;
      
      if (status === 429) {
        logger.warn('Perplexity API rate limit exceeded, retry after delay');
        await delay(DELAY_BETWEEN_REQUESTS * 2);
        return executeQuery(query, options);
      }
      
      logger.error(`API error: ${status} - ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Conducts deep research using the Perplexity API
 * 
 * The deep research workflow includes:
 * 1. Initial query
 * 2. Follow-up question generation
 * 3. Follow-up research
 * 4. Synthesis
 * 
 * @param {string} query - The research question
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} The complete research results
 */
async function conductDeepResearch(query, options = {}) {
  const requestId = uuidv4();
  logger.info(`Starting deep research for request ${requestId}`);
  
  const {
    model = DEFAULT_MODEL,
    systemPrompt = 'You are a helpful research assistant. Provide comprehensive, accurate information with specific examples and citations.',
    maxFollowups = 3,
    temperature = 0.2,
    apiKey = process.env.PERPLEXITY_API_KEY
  } = options;
  
  try {
    // Step 1: Initial query
    logger.info(`[${requestId}] Performing initial research query`);
    const initialResults = await executeQuery(query, {
      model,
      systemPrompt,
      temperature,
      apiKey
    });
    
    // Step 2: Generate follow-up questions
    logger.info(`[${requestId}] Generating follow-up questions`);
    const followupPrompt = `Based on the following research: 
    
    "${initialResults.content}"
    
    What are the ${maxFollowups} most important follow-up questions to research further to provide a more comprehensive answer to the original question: "${query}"?
    
    Return the questions as a numbered list without any introduction or conclusion.`;
    
    const followupQuestionsResponse = await executeQuery(followupPrompt, {
      model,
      systemPrompt: 'You are a research planning assistant. Create follow-up questions that will help deepen the research.',
      temperature: 0.3,
      apiKey
    });
    
    // Parse follow-up questions from the response
    const followupQuestions = followupQuestionsResponse.content
      .split('\n')
      .filter(line => /^\d+\./.test(line.trim()))
      .map(question => question.replace(/^\d+\.\s*/, '').trim())
      .slice(0, maxFollowups);
    
    logger.info(`[${requestId}] Generated ${followupQuestions.length} follow-up questions`);
    
    // Step 3: Research follow-up questions
    logger.info(`[${requestId}] Researching follow-up questions`);
    const followupResults = [];
    
    for (let i = 0; i < followupQuestions.length; i++) {
      const followupQuestion = followupQuestions[i];
      logger.info(`[${requestId}] Researching follow-up question ${i + 1}: ${followupQuestion}`);
      
      try {
        const followupResult = await executeQuery(followupQuestion, {
          model,
          systemPrompt: `You are a research assistant answering a follow-up question related to: "${query}". 
          Provide specific, detailed information with citations.`,
          temperature,
          apiKey
        });
        
        followupResults.push({
          question: followupQuestion,
          answer: followupResult.content,
          citations: followupResult.citations,
          model: followupResult.model
        });
        
      } catch (error) {
        logger.error(`[${requestId}] Error researching follow-up question: ${error.message}`);
        followupResults.push({
          question: followupQuestion,
          answer: `Error researching this question: ${error.message}`,
          citations: [],
          error: true
        });
      }
    }
    
    // Step 4: Synthesize all research
    logger.info(`[${requestId}] Synthesizing research results`);
    const researchSummary = `
    Original research: ${initialResults.content}
    
    Follow-up research:
    ${followupResults.map(r => `Question: ${r.question}\nAnswer: ${r.answer}`).join('\n\n')}
    `;
    
    const synthesisPrompt = `Synthesize the following research into a comprehensive, well-structured answer to the original question: "${query}"
    
    ${researchSummary}
    
    Include all relevant information, examples, and cite sources properly. Structure your response with clear sections and highlight key insights.`;
    
    const synthesisResult = await executeQuery(synthesisPrompt, {
      model,
      systemPrompt: 'You are a research synthesis expert. Create a comprehensive answer that incorporates all the research findings.',
      temperature: 0.2,
      maxTokens: 4000,
      apiKey
    });
    
    // Compile all citations
    const allCitations = [
      ...initialResults.citations,
      ...followupResults.flatMap(r => r.citations),
      ...synthesisResult.citations
    ];
    
    // Remove duplicates from citations
    const uniqueCitations = [...new Set(allCitations)];
    
    logger.info(`[${requestId}] Deep research completed successfully`);
    
    // Return complete research package
    return {
      requestId,
      originalQuery: query,
      initialResearch: initialResults,
      followupQuestions,
      followupResults,
      synthesis: synthesisResult.content,
      allCitations: uniqueCitations,
      completedAt: new Date().toISOString(),
      models: {
        initial: initialResults.model,
        followups: followupResults.map(r => r.model),
        synthesis: synthesisResult.model
      }
    };
    
  } catch (error) {
    logger.error(`[${requestId}] Error conducting deep research: ${error.message}`);
    throw error;
  }
}

module.exports = {
  executeQuery,
  conductDeepResearch,
  extractModelInfo,
  extractCitations,
  extractContent
};