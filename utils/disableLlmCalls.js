
/**
 * LLM API Call Disabling Utility
 * 
 * This utility helps control whether LLM API calls are made,
 * supporting cost reduction during development and testing.
 */

import logger from './logger.js';

// Environment variable that controls API calls
const API_DISABLE_ENV_VAR = 'DISABLE_LLM_API_CALLS';
const API_CALLS_DISABLED = process.env[API_DISABLE_ENV_VAR] === 'true' || 
                          process.env.NODE_ENV === 'test' ||
                          process.env.INIT_MOCK_DATA === 'true' ||
                          process.env.npm_lifecycle_script?.includes('dev:no-api');

/**
 * Check if LLM API calls are disabled
 * @returns {boolean} True if LLM API calls should be disabled
 */
export function isLlmApiDisabled() {
  return API_CALLS_DISABLED;
}

/**
 * Determines if a real API call should be made or if a cached/mocked response should be used
 * @param {string} service - Service name (e.g., 'perplexity', 'claude')
 * @param {string} cacheKey - Cache key for the request
 * @returns {boolean} True if a real API call should be skipped
 */
export function shouldSkipApiCall(service, cacheKey) {
  if (isLlmApiDisabled()) {
    logger.info(`Skipping API call to ${service} (API calls disabled)`, { 
      service,
      cacheKey,
      reason: 'api_calls_disabled'
    });
    return true;
  }
  
  return false;
}

/**
 * Get a mock response when API calls are disabled
 * @param {string} service - Service name (e.g., 'perplexity', 'claude')
 * @param {string} prompt - The prompt that would be sent
 * @returns {Object} A mock response
 */
export function getMockResponse(service, prompt) {
  logger.info(`Generating mock response for ${service}`, { service });
  
  const mockResponses = {
    perplexity: {
      text: "This is a mock response from Perplexity API to save costs during development.",
      sources: [
        { title: "Mock Source 1", url: "https://example.com/mock1" },
        { title: "Mock Source 2", url: "https://example.com/mock2" }
      ]
    },
    claude: {
      text: "This is a mock response from Claude API to save costs during development.",
      model: "claude-3-haiku-20240307"
    },
    default: {
      text: "This is a mock response to save costs during development."
    }
  };
  
  return mockResponses[service] || mockResponses.default;
}

export default {
  isLlmApiDisabled,
  shouldSkipApiCall,
  getMockResponse
};
