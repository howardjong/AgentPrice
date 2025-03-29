/**
 * API Mocking Utilities
 * 
 * This module provides utilities for mocking HTTP requests to external APIs
 * using Nock. It simplifies setting up test fixtures for Perplexity and
 * Claude API responses, supporting various scenarios like success, errors,
 * and timeouts.
 */

import nock from 'nock';
import path from 'path';
import fs from 'fs/promises';

// API endpoints
const PERPLEXITY_API_URL = 'https://api.perplexity.ai';
const ANTHROPIC_API_URL = 'https://api.anthropic.com';

// Default response templates
const DEFAULT_PERPLEXITY_RESPONSE = {
  id: 'mock-perplexity-id',
  model: 'llama-3.1-sonar-small-128k-online',
  object: 'chat.completion',
  created: Math.floor(Date.now() / 1000),
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: 'This is a mocked response from Perplexity API.'
      }
    }
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30
  }
};

const DEFAULT_CLAUDE_RESPONSE = {
  id: 'msg_mock',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: 'This is a mocked response from Claude API.'
    }
  ],
  model: 'claude-3-7-sonnet-20250219',
  stop_reason: 'end_turn',
  usage: {
    input_tokens: 10,
    output_tokens: 20
  }
};

/**
 * Mock a Perplexity API request
 * @param {Object} options - Configuration options
 * @param {Object} options.response - Custom response object (optional)
 * @param {Number} options.statusCode - Response status code (default: 200)
 * @param {Boolean} options.persist - Whether the mock should persist for multiple requests (default: false)
 * @param {Number} options.delay - Delay in ms before responding (optional)
 * @param {Object} options.requestMatcher - Function to match specific requests (optional)
 * @returns {Object} The configured nock instance
 */
export function mockPerplexityAPI(options = {}) {
  const {
    response = DEFAULT_PERPLEXITY_RESPONSE,
    statusCode = 200,
    persist = false,
    delay = 0,
    requestMatcher = null
  } = options;

  let mockScope = nock(PERPLEXITY_API_URL)
    .post('/chat/completions', requestMatcher || (() => true));

  // Add delay if specified
  if (delay > 0) {
    mockScope = mockScope.delay(delay);
  }

  // Configure response
  mockScope = mockScope.reply(statusCode, response);

  // Make the mock persist if needed
  if (persist) {
    mockScope.persist();
  }

  return mockScope;
}

/**
 * Mock a Claude API request
 * @param {Object} options - Configuration options
 * @param {Object} options.response - Custom response object (optional)
 * @param {Number} options.statusCode - Response status code (default: 200)
 * @param {Boolean} options.persist - Whether the mock should persist for multiple requests (default: false)
 * @param {Number} options.delay - Delay in ms before responding (optional)
 * @param {Object} options.requestMatcher - Function to match specific requests (optional)
 * @returns {Object} The configured nock instance
 */
export function mockClaudeAPI(options = {}) {
  const {
    response = DEFAULT_CLAUDE_RESPONSE,
    statusCode = 200,
    persist = false,
    delay = 0,
    requestMatcher = null
  } = options;

  let mockScope = nock(ANTHROPIC_API_URL)
    .post('/v1/messages', requestMatcher || (() => true));

  // Add delay if specified
  if (delay > 0) {
    mockScope = mockScope.delay(delay);
  }

  // Configure response
  mockScope = mockScope.reply(statusCode, response);

  // Make the mock persist if needed
  if (persist) {
    mockScope.persist();
  }

  return mockScope;
}

/**
 * Mock a failed API request (network error)
 * @param {String} apiUrl - The API URL to mock
 * @param {String} path - The API path
 * @param {Object} options - Configuration options
 * @param {String} options.errorMessage - Error message (default: 'Network error')
 * @param {Boolean} options.persist - Whether the mock should persist (default: false)
 * @returns {Object} The configured nock instance
 */
export function mockNetworkError(apiUrl, apiPath, options = {}) {
  const {
    errorMessage = 'Network error',
    persist = false
  } = options;

  let mockScope = nock(apiUrl)
    .post(apiPath)
    .replyWithError(errorMessage);

  if (persist) {
    mockScope.persist();
  }

  return mockScope;
}

/**
 * Mock a timeout for API request
 * @param {String} apiUrl - The API URL to mock
 * @param {String} path - The API path
 * @param {Object} options - Configuration options
 * @param {Number} options.delayMs - Delay in milliseconds (default: 30000)
 * @param {Boolean} options.persist - Whether the mock should persist (default: false)
 * @returns {Object} The configured nock instance
 */
export function mockTimeout(apiUrl, apiPath, options = {}) {
  const {
    delayMs = 30000,
    persist = false
  } = options;

  let mockScope = nock(apiUrl)
    .post(apiPath)
    .delayConnection(delayMs)
    .reply(408); // Request Timeout

  if (persist) {
    mockScope.persist();
  }

  return mockScope;
}

/**
 * Mock a rate limit error response
 * @param {String} apiType - 'perplexity' or 'claude'
 * @param {Object} options - Configuration options
 * @param {Number} options.retryAfter - Seconds to retry after (default: 60)
 * @param {Boolean} options.persist - Whether the mock should persist (default: false)
 * @returns {Object} The configured nock instance
 */
export function mockRateLimitError(apiType, options = {}) {
  const {
    retryAfter = 60,
    persist = false
  } = options;

  const apiUrl = apiType === 'perplexity' ? PERPLEXITY_API_URL : ANTHROPIC_API_URL;
  const apiPath = apiType === 'perplexity' ? '/chat/completions' : '/v1/messages';

  const errorResponse = {
    error: {
      type: 'rate_limit_error',
      message: 'Rate limit exceeded. Please retry after some time.'
    }
  };

  let mockScope = nock(apiUrl)
    .post(apiPath)
    .reply(429, errorResponse, {
      'Retry-After': retryAfter.toString()
    });

  if (persist) {
    mockScope.persist();
  }

  return mockScope;
}

/**
 * Load a fixture from the fixtures directory
 * @param {String} fixturePath - Path to the fixture file
 * @returns {Promise<Object>} The fixture data
 */
export async function loadFixture(fixturePath) {
  try {
    const fullPath = path.join(process.cwd(), 'tests', 'fixtures', fixturePath);
    const fileContent = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Failed to load fixture from ${fixturePath}:`, error);
    throw error;
  }
}

/**
 * Create API mocks from fixture files
 * @param {String} apiType - 'perplexity' or 'claude'
 * @param {String} fixturePath - Path to the fixture file
 * @param {Object} options - Additional options for the mock
 * @returns {Promise<Object>} The configured nock instance
 */
export async function mockFromFixture(apiType, fixturePath, options = {}) {
  const fixture = await loadFixture(fixturePath);
  
  if (apiType === 'perplexity') {
    return mockPerplexityAPI({
      response: fixture,
      ...options
    });
  } else if (apiType === 'claude') {
    return mockClaudeAPI({
      response: fixture,
      ...options
    });
  } else {
    throw new Error(`Unknown API type: ${apiType}`);
  }
}

/**
 * Clean up all active nock interceptors
 */
export function cleanupMocks() {
  nock.cleanAll();
}

export default {
  mockPerplexityAPI,
  mockClaudeAPI,
  mockNetworkError,
  mockTimeout,
  mockRateLimitError,
  loadFixture,
  mockFromFixture,
  cleanupMocks,
  PERPLEXITY_API_URL,
  ANTHROPIC_API_URL
};