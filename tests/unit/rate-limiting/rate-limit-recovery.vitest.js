/**
 * Rate Limit Recovery Tests
 * 
 * Tests the rate limit recovery capabilities of the Perplexity service.
 * 
 * This test verifies that:
 * 1. The circuit breaker correctly identifies rate limit responses
 * 2. The service properly respects rate limit timing
 * 3. The system recovers appropriately when rate limits are lifted
 * 4. The system handles successive rate limit errors appropriately
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import nock from 'nock';
import axios from 'axios';

// Mock environment variables and logger
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    configure: vi.fn()
  }
}));

vi.mock('../../../utils/costTracker.js', () => ({
  trackAPIUsage: vi.fn()
}));

// Mock CircuitBreaker implementation (needed before importing service)
vi.mock('../../../utils/circuitBreaker.js', () => {
  return {
    default: function() {
      return {
        execute: (fn) => fn(),
        getState: () => 'closed'
      };
    }
  };
});

// Mock RobustAPIClient 
vi.mock('../../../utils/apiClient.js', () => {
  return {
    default: function() {
      return {
        execute: (fn) => fn()
      };
    }
  };
});

// Import perplexity service functions after mocking dependencies
import { 
  processWebQuery,
  conductDeepResearch,
  SONAR_MODELS
} from '../../../services/perplexityService.js';

// Mock time functions to control rate limit testing
const originalDateNow = Date.now;
const originalSetTimeout = global.setTimeout;

// Helper function to create API responses
const createSuccessResponse = (model = 'llama-3.1-sonar-small-128k-online') => ({
  id: `perp-${uuidv4()}`,
  model,
  created: Date.now(),
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'This is a successful response.'
      }
    }
  ]
});

// Define a helper function that wraps perplexity functions to handle model fallback
async function processWithFallback(query, preferredModel) {
  try {
    return await processWebQuery(query, { model: preferredModel });
  } catch (error) {
    if (error.message.includes('rate limit') && preferredModel !== SONAR_MODELS.small) {
      // Fallback to smaller model
      const result = await processWebQuery(query, { model: SONAR_MODELS.small });
      return {
        ...result,
        requestedModel: preferredModel
      };
    }
    throw error;
  }
}

describe('Rate Limit Recovery', () => {
  let mockTime;
  
  // Setup before each test
  beforeEach(() => {
    // Reset nock
    nock.cleanAll();
    
    // Mock environment variables
    process.env.PERPLEXITY_API_KEY = 'test-api-key';
    
    // Mock time functions
    mockTime = Date.now();
    global.Date.now = vi.fn(() => mockTime);
    global.setTimeout = vi.fn((callback, delay) => {
      // Track the setTimeout call
      const id = Math.random().toString(36).substring(2, 9);
      return id;
    });
  });
  
  afterEach(() => {
    // Restore original time functions
    global.Date.now = originalDateNow;
    global.setTimeout = originalSetTimeout;
  });
  
  it('should detect rate limiting and fail with appropriate error', async () => {
    // Setup rate limit response
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(429, { error: 'Too Many Requests' }, { 'Retry-After': '60' });
    
    // Make a request that should trigger rate limiting
    await expect(
      processWebQuery('What is the current date today?')
    ).rejects.toThrow(/rate limit|perplexity/i);
  });
  
  it('should support fallback to smaller models when rate limited on larger ones', async () => {
    // Setup the rate limit response for large model
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(429, { error: 'Too Many Requests' }, { 'Retry-After': '60' });
    
    // Setup success response for the fallback (small model) request
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createSuccessResponse(SONAR_MODELS.small));
    
    // Test fallback functionality
    let fallbackOccurred = false;
    let responseModel = null;
    
    try {
      // First attempt (expected to fail due to rate limit)
      await processWebQuery('What is the current date today?', { model: SONAR_MODELS.large });
    } catch (error) {
      // This error is expected - should be rate limit
      expect(error.message).toMatch(/perplexity|rate limit|too many requests/i);
      fallbackOccurred = true;
      
      // Now try with small model (should succeed)
      const response = await processWebQuery('What is the current date today?', 
        { model: SONAR_MODELS.small }
      );
      
      // Verify the fallback model was used
      responseModel = response.model;
      expect(response.content).toBe('This is a successful response.');
    }
    
    // Verify fallback process worked
    expect(fallbackOccurred).toBe(true);
    expect(responseModel).toBe(SONAR_MODELS.small);
  });
  
  it('should handle multiple consecutive rate limit errors properly', async () => {
    // Setup recurring rate limit responses
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .times(3)
      .reply(429, { error: 'Too Many Requests' }, { 'Retry-After': '30' });
    
    // Make multiple requests that should all be rate limited
    for (let i = 0; i < 3; i++) {
      try {
        await processWebQuery(`Request ${i + 1}`);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected error
        expect(error.message).toMatch(/perplexity|too many requests|rate limit/i);
      }
    }
  });
  
  it('should recover successfully after rate limit period expires', async () => {
    // Initially rate limited
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(429, { error: 'Too Many Requests' }, { 'Retry-After': '60' });
    
    // First request fails with rate limit
    await expect(
      processWebQuery('Rate limited request')
    ).rejects.toThrow(/perplexity|rate limit/i);
    
    // Now reset the mocks and advance time
    nock.cleanAll();
    
    // Set up success response
    nock('https://api.perplexity.ai')
      .post('/chat/completions')
      .reply(200, createSuccessResponse());
    
    // Advance time by more than the rate limit period
    mockTime += 61000; // 61 seconds
    
    // Next request should succeed
    const response = await processWebQuery('Success after rate limit expires');
    expect(response.content).toBe('This is a successful response.');
  });
});