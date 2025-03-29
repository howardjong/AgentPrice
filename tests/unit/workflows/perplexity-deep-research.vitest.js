/**
 * Focused test for Perplexity's performDeepResearch method
 * This test specifically supports the test-single-query-workflow.js use case
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { traceTest } from '../../utils/test-helpers.js';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Mock logger before other imports
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock monitoring
vi.mock('../../../utils/monitoring.js', () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    executeRequest: vi.fn().mockImplementation((serviceKey, fn) => fn())
  }))
}));

// Mock modules that might cause circular dependencies
vi.mock('../../../utils/disableLlmCalls.js', () => ({
  areLlmCallsDisabled: vi.fn().mockReturnValue(false)
}));

vi.mock('../../../utils/tokenOptimizer.js', () => ({
  default: {
    optimizeMessages: vi.fn().mockImplementation((messages) => ({
      messages: messages,
      tokenSavings: 0,
      optimizations: []
    }))
  }
}));

vi.mock('../../../utils/enhancedCache.js', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true)
  }
}));

vi.mock('../../../utils/contentChunker.js', () => ({
  default: {
    splitContent: vi.fn().mockImplementation((content) => [{ content }])
  }
}));

vi.mock('../../../utils/batchProcessor.js', () => ({
  default: {
    processBatch: vi.fn().mockImplementation(async (items, processFunc) => {
      const results = [];
      for (const item of items) {
        results.push(await processFunc(item));
      }
      return results;
    })
  }
}));

vi.mock('../../../utils/rateLimiter.js', () => ({
  default: {
    isRateLimited: vi.fn().mockReturnValue(false),
    recordApiCall: vi.fn(),
    getRateLimitStatus: vi.fn().mockReturnValue({
      isLimited: false,
      requestsRemaining: 10
    })
  }
}));

// Import after mocks
import perplexityService from '../../../services/perplexityService.js';
import logger from '../../../utils/logger.js';

describe('Perplexity Deep Research (Workflow Support)', () => {
  traceTest('Perplexity Deep Research Workflow');
  
  let mock;
  let originalEnv;
  
  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Setup mock API key
    process.env.PERPLEXITY_API_KEY = 'test-api-key';
    
    // Setup axios mock
    mock = new MockAdapter(axios);
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Use real timers to avoid issues with axios-mock-adapter
    vi.useRealTimers();
  });
  
  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
    
    // Reset mock
    mock.restore();
    
    // Clear all mocks
    vi.clearAllMocks();
  });
  
  /**
   * Test helpers
   */
  function mockPerplexityDeepResearchResponse(model = 'sonar-deep-research') {
    return {
      id: 'chatcmpl-123abc',
      model,
      object: 'chat.completion',
      created: 1724369245,
      citations: [
        'https://example.com/specialty-coffee-pricing',
        'https://example.com/bay-area-coffee-market',
        'https://example.com/pricing-strategies'
      ],
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Based on my research, specialty coffee in the Bay Area typically follows these pricing tiers:\n\n- Standard specialty: $4.50-$5.50\n- Premium specialty: $5.50-$7.50\n- Ultra-premium specialty: $7.50-$12.00\n\nFor your chemistry-infused coffee concept, the Van Westendorp analysis indicates:\n- Too cheap: below $5.50\n- Good value: $6.50-$8.00\n- Premium but acceptable: $8.00-$9.50\n- Too expensive: above $10.00'
          }
        }
      ],
      usage: {
        prompt_tokens: 420,
        completion_tokens: 150,
        total_tokens: 570
      }
    };
  }
  
  /**
   * Test cases
   */
  it('should correctly initialize perplexityService with proper model configuration', () => {
    // Verify the service has the expected models configured
    expect(perplexityService).toBeDefined();
    expect(perplexityService.models).toBeDefined();
    expect(perplexityService.models.basic).toBe('sonar');
    expect(perplexityService.models.deepResearch).toBe('sonar-deep-research');
  });
  
  it('should perform deep research with the correct default model', async () => {
    // Setup a successful API response
    mock.onPost('https://api.perplexity.ai/chat/completions').reply(200, mockPerplexityDeepResearchResponse());
    
    // Execute the deep research
    const query = 'Research specialty coffee pricing in Bay Area';
    const result = await perplexityService.performDeepResearch(query);
    
    // Verify the model used
    expect(result.modelUsed).toBe('sonar-deep-research');
    
    // Verify API call was made with correct parameters
    const requestConfig = mock.history.post[0];
    expect(requestConfig.url).toBe('https://api.perplexity.ai/chat/completions');
    expect(JSON.parse(requestConfig.data).model).toBe('sonar-deep-research');
    
    // Verify the result structure matches what the workflow expects
    expect(result.content).toContain('specialty coffee in the Bay Area');
    expect(result.sources).toHaveLength(3);
    expect(result.query).toBe(query);
    expect(result.timestamp).toBeDefined();
  });
  
  it('should apply the proper search context mode for deep research', async () => {
    // Setup a successful API response
    mock.onPost('https://api.perplexity.ai/chat/completions').reply(200, mockPerplexityDeepResearchResponse());
    
    // Execute the deep research
    const query = 'Research specialty coffee pricing in Bay Area';
    await perplexityService.performDeepResearch(query);
    
    // Verify API call was made with correct search context mode
    const requestConfig = mock.history.post[0];
    const requestData = JSON.parse(requestConfig.data);
    expect(requestData.search_context_mode).toBe('high');
  });
  
  it('should include relevant sources in the deep research results', async () => {
    // Setup a successful API response
    mock.onPost('https://api.perplexity.ai/chat/completions').reply(200, mockPerplexityDeepResearchResponse());
    
    // Execute the deep research
    const query = 'Research specialty coffee pricing in Bay Area';
    const result = await perplexityService.performDeepResearch(query);
    
    // Verify sources are included
    expect(result.sources).toContain('https://example.com/specialty-coffee-pricing');
    expect(result.sources).toContain('https://example.com/bay-area-coffee-market');
    expect(result.sources).toContain('https://example.com/pricing-strategies');
  });
  
  it('should handle additional context provided to the deep research query', async () => {
    // Setup a successful API response
    mock.onPost('https://api.perplexity.ai/chat/completions').reply(200, mockPerplexityDeepResearchResponse());
    
    // Execute the deep research with additional context
    const query = 'Research specialty coffee pricing in Bay Area';
    const context = 'We use advanced chemistry lab techniques to infuse coffees with unique natural flavors.';
    const result = await perplexityService.performDeepResearch(query, { context });
    
    // Verify API call incorporated the context
    const requestConfig = mock.history.post[0];
    const requestData = JSON.parse(requestConfig.data);
    const userMessage = requestData.messages.find(m => m.role === 'user');
    
    expect(userMessage.content).toContain(query);
    expect(userMessage.content).toContain(context);
  });
  
  it('should handle API errors gracefully during deep research', async () => {
    // Setup an error response
    mock.onPost('https://api.perplexity.ai/chat/completions').reply(500, { error: 'Server error' });
    
    // Execute and verify error handling
    const query = 'Research specialty coffee pricing in Bay Area';
    await expect(perplexityService.performDeepResearch(query)).rejects.toThrow();
    
    // Verify error was logged
    expect(logger.error).toHaveBeenCalled();
  });
  
  it('should handle rate limiting during deep research', async () => {
    // First call: rate limited
    mock.onPost('https://api.perplexity.ai/chat/completions').replyOnce(429, { error: 'Rate limited' }, {
      'retry-after': '1'
    });
    
    // Second call: success
    mock.onPost('https://api.perplexity.ai/chat/completions').reply(200, mockPerplexityDeepResearchResponse());
    
    // Execute deep research
    const query = 'Research specialty coffee pricing in Bay Area';
    const result = await perplexityService.performDeepResearch(query);
    
    // Verify successful result after rate limit
    expect(result.modelUsed).toBe('sonar-deep-research');
    
    // Verify rate limit was logged
    expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/rate limit/i), expect.any(Object));
  });
  
  it('should include a job ID when provided', async () => {
    // Setup a successful API response
    mock.onPost('https://api.perplexity.ai/chat/completions').reply(200, mockPerplexityDeepResearchResponse());
    
    // Execute the deep research with a job ID
    const query = 'Research specialty coffee pricing in Bay Area';
    const jobId = 'test-job-123';
    const result = await perplexityService.performDeepResearch(query, { jobId });
    
    // Verify job ID is included in result
    expect(result.jobId).toBe(jobId);
  });
  
  it('should support the test-single-query-workflow pattern', async () => {
    // Setup a successful API response
    mock.onPost('https://api.perplexity.ai/chat/completions').reply(200, mockPerplexityDeepResearchResponse());
    
    // Execute deep research in the same pattern as test-single-query-workflow.js
    const optimizedQuery = 'Comprehensive analysis of specialty coffee pricing in the Bay Area market';
    const researchJobId = 'workflow-test-123';
    
    const researchResults = await perplexityService.performDeepResearch(optimizedQuery, {
      jobId: researchJobId
    });
    
    // Verify result structure matches what the workflow expects
    expect(researchResults).toHaveProperty('content');
    expect(researchResults).toHaveProperty('sources');
    expect(researchResults).toHaveProperty('modelUsed', 'sonar-deep-research');
    expect(researchResults).toHaveProperty('timestamp');
    expect(researchResults).toHaveProperty('jobId', researchJobId);
    
    // These properties are used by the workflow to save research results
    expect(researchResults.content).toContain('specialty coffee');
    expect(researchResults.sources).toHaveLength(3);
  });
});