/**
 * Claude Service for conversation processing and visualization generation
 * 
 * IMPORTANT MODEL IDENTIFICATION NOTE:
 * - We're using claude-3-7-sonnet-20250219 which was released February 24, 2025
 */

import Anthropic from '@anthropic-ai/sdk';
import CircuitBreaker from '../utils/circuitBreaker.js';
import RobustAPIClient from '../utils/apiClient.js';
import logger from '../utils/logger.js';
import promptManager from './promptManager.js';
import { cacheLlmCall } from '../utils/llmCacheOptimizer.js';
import costTracker from '../utils/costTracker.js';
import tokenOptimizer from '../utils/tokenOptimizer.js';

// Create a robust API client with retries
const apiClient = new RobustAPIClient({
  maxRetries: 3,
  timeout: 60000, // 60 seconds
  rateLimitRetryDelay: 2000,
  exponentialBackoff: true
});

// Circuit breaker for preventing cascading failures
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 60000, // 1 minute
  minRequestThreshold: 10,
  progressiveReset: true
});

// Initialize the Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Default to claude-3-7-sonnet-20250219, the newest Anthropic model
const MODEL = process.env.CLAUDE_MODEL || "claude-3-7-sonnet-20250219";

// Track current health status
let serviceStatus = {
  healthy: true,
  lastError: null,
  lastSuccessful: Date.now(),
  totalCalls: 0,
  successfulCalls: 0,
  failedCalls: 0,
  averageLatency: 0
};

/**
 * Call the Anthropic API with circuit breaker and robust retries
 * 
 * @param {Function} endpoint - The Anthropic API endpoint function to call
 * @param {Object} params - Parameters for the API call
 * @returns {Promise<Object>} - The API response
 */
async function callAnthropicAPI(endpoint, params, options = {}) {
  // Use the cache if enabled and not explicitly disabled for this call
  if (!options.skipCache) {
    try {
      // First check the cache for a similar request
      const cacheKey = `anthropic:${params.model}:${JSON.stringify(params.messages)}`;
      const cachedResult = await cacheLlmCall(
        cacheKey,
        async () => executeAnthropicAPICall(endpoint, params, options),
        {
          ttl: options.cacheTtl || 3600, // 1 hour default
          similarityThreshold: options.similarityThreshold || 0.85,
          contentType: 'text'
        }
      );
      
      return cachedResult;
    } catch (error) {
      logger.warn('LLM caching failed, falling back to direct API call', { 
        error: error.message 
      });
      // Fall back to direct API call if caching fails
      return executeAnthropicAPICall(endpoint, params, options);
    }
  }
  
  // Execute without caching if cache is disabled
  return executeAnthropicAPICall(endpoint, params, options);
}

/**
 * Execute the actual API call to Anthropic
 */
async function executeAnthropicAPICall(endpoint, params, options = {}) {
  return circuitBreaker.executeRequest('anthropic', async () => {
    try {
      // Apply token optimization if enabled
      if (!options.skipTokenOptimization) {
        params = tokenOptimizer.optimizeRequestParams(params);
      }
      
      logger.debug('Calling Anthropic API', { 
        endpoint: endpoint.name,
        model: params.model,
        maxTokens: params.max_tokens
      });
      
      const start = Date.now();
      const response = await endpoint(params);
      const duration = Date.now() - start;
      
      // Update service health metrics
      serviceStatus.totalCalls++;
      serviceStatus.successfulCalls++;
      serviceStatus.lastSuccessful = Date.now();
      serviceStatus.averageLatency = (serviceStatus.averageLatency * (serviceStatus.successfulCalls - 1) + duration) / serviceStatus.successfulCalls;
      serviceStatus.healthy = true;
      
      // Track cost
      const outputTokenCount = response.usage?.completion_tokens || estimateTokens(response.content[0].text);
      const inputTokenCount = response.usage?.prompt_tokens || estimateTokens(JSON.stringify(params.messages));
      
      costTracker.trackApiCall({
        service: 'anthropic',
        model: params.model,
        inputTokens: inputTokenCount,
        outputTokens: outputTokenCount,
        duration
      });
      
      logger.info('Anthropic API response received', { 
        duration: `${duration}ms`,
        outputLength: response.content[0].text.length,
        model: params.model,
        inputTokens: inputTokenCount,
        outputTokens: outputTokenCount
      });
      
      return response;
    } catch (error) {
      // Update service health metrics
      serviceStatus.totalCalls++;
      serviceStatus.failedCalls++;
      serviceStatus.lastError = {
        message: error.message,
        timestamp: Date.now()
      };
      serviceStatus.healthy = false;
      
      // Check for rate limiting and handle specially
      if (error.status === 429) {
        logger.warn('Anthropic API rate limit exceeded', { error: error.message });
        throw new Error('RATE_LIMIT_EXCEEDED');
      }
      
      logger.error('Anthropic API error', { 
        error: error.message, 
        endpoint: endpoint.name,
        status: error.status,
        type: error.type
      });
      
      throw error;
    }
  });
}

/**
 * Generate clarifying questions for a research query
 * 
 * @param {string} query - The research query
 * @param {string} jobId - Optional job ID for tracking
 * @returns {Promise<Array<string>>} - Array of clarifying questions
 */
async function generateClarifyingQuestions(query, jobId = 'default') {
  try {
    // Load prompt from prompt manager
    const systemPrompt = await promptManager.getPrompt('claude', 'clarifying_questions');
    
    const response = await callAnthropicAPI(
      anthropic.messages.create,
      {
        model: MODEL,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Generate 5 clarifying questions for deep research on: "${query}"`
          }
        ]
      },
      { 
        cacheTtl: 86400, // Cache for 24 hours
        similarityThreshold: 0.9 // Higher similarity for questions
      }
    );

    // Extract and parse questions
    const content = response.content[0].text;
    try {
      // Try to extract JSON array
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback extraction logic
      return extractQuestionsFromText(content);
    } catch (parseError) {
      logger.error('Failed to parse questions', { 
        error: parseError.message,
        jobId
      });
      return generateDefaultQuestions(query);
    }
  } catch (error) {
    logger.error('Error generating questions', { 
      error: error.message,
      jobId
    });
    throw error;
  }
}

/**
 * Generate a response to a query with context
 * 
 * @param {string} query - The user query
 * @param {string} context - Context information
 * @returns {Promise<string>} - Generated response
 */
async function generateResponse(query, context) {
  try {
    // Load prompt from prompt manager
    const systemPrompt = await promptManager.getPrompt('claude', 'response_generation');
    
    const response = await callAnthropicAPI(
      anthropic.messages.create,
      {
        model: MODEL,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Context: ${context}\n\nQuestion: ${query}`
          }
        ]
      }
    );
    
    return response.content[0].text;
  } catch (error) {
    logger.error('Error generating response', { error: error.message });
    throw error;
  }
}

/**
 * Generate chart data based on research results
 * 
 * @param {string} researchResults - Research results text
 * @param {string} chartType - Type of chart to generate data for (e.g., 'bar', 'line', 'pie', 'van_westendorp', 'conjoint')
 * @returns {Promise<Object>} - Structured chart data
 */
async function generateChartData(researchResults, chartType) {
  try {
    // Load the appropriate prompt based on chart type
    const systemPrompt = await promptManager.getPrompt('claude', `chart_data/${chartType}`);

    const response = await callAnthropicAPI(
      anthropic.messages.create,
      {
        model: MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Generate the appropriate data structure for ${chartType} based on these research results: ${researchResults.substring(0, 8000)}`
          }
        ]
      },
      {
        skipCache: true, // Always generate fresh chart data
        skipTokenOptimization: true // Charts need precise instructions
      }
    );

    const content = response.content[0].text;
    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        logger.error('Failed to parse chart data JSON', { 
          error: parseError.message,
          chartType
        });
        throw new Error(`Failed to parse ${chartType} chart data`);
      }
    }
    
    throw new Error(`Failed to generate ${chartType} chart data`);
  } catch (error) {
    logger.error(`Error generating ${chartType} chart data`, { error: error.message });
    throw error;
  }
}

/**
 * Generate an interactive Plotly visualization configuration based on research data
 * 
 * @param {Object} data - The data to visualize
 * @param {string} type - The type of visualization (bar, line, pie, van_westendorp, conjoint, etc.)
 * @param {string} title - The title for the visualization
 * @param {string} description - Additional context or description
 * @returns {Promise<Object>} Plotly configuration and insights
 */
async function generatePlotlyVisualization(data, type, title, description) {
  try {
    // Get the appropriate system prompt for this visualization type
    const systemPrompt = await promptManager.getPrompt('claude', `visualization/plotly/${type}`);
    
    // Generate the visualization code
    const response = await callAnthropicAPI(
      anthropic.messages.create,
      {
        model: MODEL,
        max_tokens: 3000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `
Generate a Plotly.js visualization for the following data:
Title: ${title}
Description: ${description}
Type: ${type}
Data: ${JSON.stringify(data)}

Return a JSON object with the following structure:
{
  "plotlyConfig": { /* Plotly configuration object */ },
  "insights": [ /* Array of key insights about the data */ ],
  "recommendations": [ /* Optional array of recommendations based on data */ ]
}
`
          }
        ]
      },
      {
        skipCache: true, // Always generate fresh visualizations
        skipTokenOptimization: true // Need precise instructions for visualizations
      }
    );
    
    const content = response.content[0].text;
    
    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const plotlyConfig = JSON.parse(jsonMatch[0]);
        return plotlyConfig;
      } catch (parseError) {
        logger.error('Failed to parse Plotly configuration', { 
          error: parseError.message,
          type
        });
        throw new Error(`Failed to parse Plotly configuration for ${type}`);
      }
    }
    
    throw new Error(`Failed to generate Plotly visualization for ${type}`);
  } catch (error) {
    logger.error(`Error generating Plotly visualization for ${type}`, { 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Get current service status
 * 
 * @returns {Object} Service status information
 */
function getStatus() {
  return {
    service: "Claude AI",
    healthy: serviceStatus.healthy,
    model: MODEL,
    totalCalls: serviceStatus.totalCalls,
    successRate: serviceStatus.totalCalls > 0 
      ? (serviceStatus.successfulCalls / serviceStatus.totalCalls * 100).toFixed(2) + '%' 
      : 'N/A',
    averageLatency: serviceStatus.successfulCalls > 0 
      ? Math.round(serviceStatus.averageLatency) + 'ms'
      : 'N/A',
    lastSuccessful: serviceStatus.lastSuccessful,
    lastError: serviceStatus.lastError,
    circuitBreakerOpen: !circuitBreaker.isClosed('anthropic')
  };
}

// Helper functions
/**
 * Extract questions from text when JSON parsing fails
 */
function extractQuestionsFromText(text) {
  // Extract questions by line
  const lines = text.split('\n').filter(line => 
    line.trim().length > 0 && 
    (line.includes('?') || /^\d+\./.test(line))
  );
  
  return lines.slice(0, 5).map(line => 
    line.replace(/^\d+[\.\)]?\s*/, '').trim()
  );
}

/**
 * Generate default questions if extraction fails
 */
function generateDefaultQuestions(query) {
  return [
    `What specific aspects of "${query}" are you most interested in?`,
    `What is your current understanding of this topic?`,
    `Are there particular sources or perspectives you want included?`,
    `What timeframe or geographical scope should the research focus on?`,
    `How will you be using this research information?`
  ];
}

/**
 * Estimate token count from text (rough approximation)
 */
function estimateTokens(text) {
  if (!text) return 0;
  // Rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

export default {
  generateClarifyingQuestions,
  generateResponse,
  generateChartData,
  generatePlotlyVisualization,
  getStatus
};