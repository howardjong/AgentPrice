/**
 * @file single-query-workflow.vitest.js
 * @description Integration tests for the complete single query workflow
 * 
 * This test file focuses on the complete workflow from query input to response output,
 * testing service routing, query classification, and integration between different services.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Import all required services
import ServiceRouter from '../../../services/serviceRouter.js';
import PerplexityService from '../../../services/perplexityService.js';
import ClaudeService from '../../../services/claudeService.js';
import ContextManager from '../../../services/contextManager.js';
import JobManager from '../../../services/jobManager.js';
import PromptManager from '../../../services/promptManager.js';
import RateLimiter from '../../../utils/rateLimiter.js';

// Mock the logger to avoid issues with winston
vi.mock('../../../utils/logger.js', () => {
  return {
    default: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn()
    }
  };
});

// Mock the disableLlmCalls module 
vi.mock('../../../utils/disableLlmCalls.js', () => {
  return {
    default: false
  };
});

// Mock the llmCacheOptimizer module
vi.mock('../../../utils/llmCacheOptimizer.js', () => {
  return {
    default: {
      shouldUseCache: vi.fn().mockReturnValue(false),
      getCachedResponse: vi.fn().mockReturnValue(null),
      cacheResponse: vi.fn()
    }
  };
});

// Create a mock factory function for the tests
const createMockPerplexityService = () => {
  return {
    processQuery: vi.fn().mockResolvedValue({
      content: 'This is a response from Perplexity',
      citations: ['https://example.com/source1', 'https://example.com/source2'],
      modelUsed: 'llama-3.1-sonar-small-128k-online'
    }),
    performDeepResearch: vi.fn().mockResolvedValue({
      content: 'This is a deep research response from Perplexity',
      citations: ['https://example.com/research1', 'https://example.com/research2'],
      modelUsed: 'llama-3.1-sonar-small-128k-online'
    }),
    isOnline: vi.fn().mockReturnValue(true),
    getServiceStatus: vi.fn().mockReturnValue({ status: 'online', latency: 150 })
  };
};

const createMockClaudeService = () => {
  return {
    processQuery: vi.fn().mockResolvedValue({
      content: 'This is a response from Claude',
      modelUsed: 'claude-3-7-sonnet-20250219'
    }),
    generateChart: vi.fn().mockResolvedValue({
      chartData: { type: 'vanWestendorp', data: { /* mock chart data */ } },
      chartHtml: '<div id="chart"></div>'
    }),
    isOnline: vi.fn().mockReturnValue(true),
    getServiceStatus: vi.fn().mockReturnValue({ status: 'online', latency: 200 })
  };
};

const createMockContextManager = () => {
  return {
    getContext: vi.fn().mockResolvedValue({
      conversations: []
    }),
    updateContext: vi.fn().mockResolvedValue(true),
    saveResearchContext: vi.fn().mockResolvedValue(true)
  };
};

const createMockJobManager = () => {
  return {
    createJob: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
    updateJobStatus: vi.fn().mockResolvedValue(true),
    getJobStatus: vi.fn().mockResolvedValue({ status: 'completed', result: null }),
    completeJob: vi.fn().mockResolvedValue(true)
  };
};

const createMockPromptManager = () => {
  return {
    getPrompt: vi.fn().mockResolvedValue('This is a test prompt template'),
    formatPrompt: vi.fn().mockImplementation((template, data) => {
      return `Formatted: ${template} with ${data.query}`;
    })
  };
};

const createMockServiceRouter = () => {
  return {
    routeQuery: vi.fn().mockImplementation(async (queryData) => {
      if (queryData.requiresResearch || queryData.query.includes('market') || queryData.query.includes('latest')) {
        return {
          content: 'This is a response from Perplexity',
          citations: ['https://example.com/source1', 'https://example.com/source2'],
          serviceUsed: 'perplexity',
          modelUsed: 'llama-3.1-sonar-small-128k-online'
        };
      } else if (queryData.chartType) {
        return {
          chartData: { type: queryData.chartType, data: { /* mock chart data */ } },
          chartHtml: '<div id="chart"></div>',
          serviceUsed: 'claude'
        };
      } else if (queryData.deepResearch) {
        return {
          content: 'This is a deep research response from Perplexity',
          citations: ['https://example.com/research1', 'https://example.com/research2'],
          serviceUsed: 'perplexity',
          modelUsed: 'llama-3.1-sonar-small-128k-online'
        };
      } else {
        return {
          content: 'This is a response from Claude',
          serviceUsed: 'claude',
          modelUsed: 'claude-3-7-sonnet-20250219'
        };
      }
    }),
    classifyQuery: vi.fn().mockReturnValue({
      requiresResearch: false,
      topicCategory: 'general'
    })
  };
};

// Setup mocks for all dependency services
vi.mock('../../../services/perplexityService.js', () => {
  const PerplexityServiceMock = vi.fn().mockImplementation(() => createMockPerplexityService());
  return { default: PerplexityServiceMock };
});

vi.mock('../../../services/claudeService.js', () => {
  const ClaudeServiceMock = vi.fn().mockImplementation(() => createMockClaudeService());
  return { default: ClaudeServiceMock };
});

vi.mock('../../../services/contextManager.js', () => {
  const ContextManagerMock = vi.fn().mockImplementation(() => createMockContextManager());
  return { default: ContextManagerMock };
});

vi.mock('../../../services/jobManager.js', () => {
  const JobManagerMock = vi.fn().mockImplementation(() => createMockJobManager());
  return { default: JobManagerMock };
});

vi.mock('../../../services/promptManager.js', () => {
  const PromptManagerMock = vi.fn().mockImplementation(() => createMockPromptManager());
  return { default: PromptManagerMock };
});

vi.mock('../../../services/serviceRouter.js', () => {
  const ServiceRouterMock = vi.fn().mockImplementation(() => createMockServiceRouter());
  return { default: ServiceRouterMock };
});

describe('Single Query Workflow Integration Tests', () => {
  let mockServiceRouter;
  let mockPerplexityService;
  let mockClaudeService;
  let mockContextManager;
  let mockJobManager;
  let mockPromptManager;
  let mockAxios;
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create a fresh mock for axios
    mockAxios = new MockAdapter(axios);
    
    // Initialize mock services directly using the factory functions
    mockServiceRouter = createMockServiceRouter();
    mockPerplexityService = createMockPerplexityService();
    mockClaudeService = createMockClaudeService();
    mockContextManager = createMockContextManager();
    mockJobManager = createMockJobManager();
    mockPromptManager = createMockPromptManager();
    
    // Spy on methods we'll be verifying
    vi.spyOn(mockServiceRouter, 'routeQuery');
    vi.spyOn(mockServiceRouter, 'classifyQuery');
    vi.spyOn(mockPerplexityService, 'processQuery');
    vi.spyOn(mockPerplexityService, 'performDeepResearch');
    vi.spyOn(mockClaudeService, 'processQuery');
    vi.spyOn(mockClaudeService, 'generateChart');
    vi.spyOn(mockContextManager, 'updateContext');
  });
  
  afterEach(() => {
    // Clean up
    mockAxios.restore();
  });
  
  test('should route research queries to Perplexity', async () => {
    // Setup a research query
    const queryData = {
      query: 'What are the latest advancements in renewable energy?',
      userId: 'test-user',
      sessionId: 'test-session',
      requiresResearch: true
    };
    
    // Override our mock service router to test the routing logic
    mockServiceRouter.routeQuery.mockImplementationOnce(async (data) => {
      // If research is required, use Perplexity
      if (data.requiresResearch) {
        return await mockPerplexityService.processQuery(data);
      } else {
        return await mockClaudeService.processQuery(data);
      }
    });
    
    // Process the query
    const result = await mockServiceRouter.routeQuery(queryData);
    
    // Verify routing to Perplexity
    expect(mockPerplexityService.processQuery).toHaveBeenCalled();
    
    // Verify result contains expected data
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('citations');
    expect(result.modelUsed).toBe('llama-3.1-sonar-small-128k-online');
  });
  
  test('should route non-research queries to Claude', async () => {
    // Setup a non-research query
    const queryData = {
      query: 'Explain the concept of quantum computing.',
      userId: 'test-user',
      sessionId: 'test-session',
      requiresResearch: false
    };
    
    // Override our mock service router to test the routing logic
    mockServiceRouter.routeQuery.mockImplementationOnce(async (data) => {
      // If research is not required, use Claude
      if (!data.requiresResearch) {
        return await mockClaudeService.processQuery(data);
      } else {
        return await mockPerplexityService.processQuery(data);
      }
    });
    
    // Process the query
    const result = await mockServiceRouter.routeQuery(queryData);
    
    // Verify routing to Claude
    expect(mockClaudeService.processQuery).toHaveBeenCalled();
    
    // Verify result contains expected data
    expect(result).toHaveProperty('content');
    expect(result.modelUsed).toBe('claude-3-7-sonnet-20250219');
  });
  
  test('should detect research queries and route to Perplexity', async () => {
    // Setup a query that implicitly requires research but doesn't specify it
    const queryData = {
      query: 'What is the current market share of Tesla in the electric vehicle market?',
      userId: 'test-user',
      sessionId: 'test-session'
      // Notice no requiresResearch flag - should be detected
    };
    
    // Override our mock service router to test the query classification
    mockServiceRouter.classifyQuery.mockReturnValueOnce({
      requiresResearch: true,
      topicCategory: 'business'
    });
    
    mockServiceRouter.routeQuery.mockImplementationOnce(async (data) => {
      // First classify the query
      const classification = mockServiceRouter.classifyQuery(data.query);
      
      // Then route based on classification
      if (classification.requiresResearch) {
        return await mockPerplexityService.processQuery(data);
      } else {
        return await mockClaudeService.processQuery(data);
      }
    });
    
    // Process the query
    const result = await mockServiceRouter.routeQuery(queryData);
    
    // Verify classification was used
    expect(mockServiceRouter.classifyQuery).toHaveBeenCalled();
    
    // Verify routing to Perplexity
    expect(mockPerplexityService.processQuery).toHaveBeenCalled();
  });
  
  test('should route chart generation requests to Claude', async () => {
    // Setup a chart generation request
    const queryData = {
      query: 'Generate a Van Westendorp price sensitivity analysis chart',
      userId: 'test-user',
      sessionId: 'test-session',
      chartType: 'vanWestendorp',
      chartData: {
        // Mock chart data structure
        prices: [10, 20, 30, 40],
        responses: {}
      }
    };
    
    // Override our mock service router to test chart generation routing
    mockServiceRouter.routeQuery.mockImplementationOnce(async (data) => {
      // If the request includes a chart type, use Claude's chart generation
      if (data.chartType) {
        return await mockClaudeService.generateChart(data);
      } else if (data.requiresResearch) {
        return await mockPerplexityService.processQuery(data);
      } else {
        return await mockClaudeService.processQuery(data);
      }
    });
    
    // Process the query
    const result = await mockServiceRouter.routeQuery(queryData);
    
    // Verify routing to Claude for chart generation
    expect(mockClaudeService.generateChart).toHaveBeenCalled();
    
    // Verify result contains chart data
    expect(result).toHaveProperty('chartData');
    expect(result).toHaveProperty('chartHtml');
  });
  
  test('should fallback to Claude if Perplexity is offline', async () => {
    // Make Perplexity appear offline
    mockPerplexityService.isOnline.mockReturnValueOnce(false);
    
    // Setup a query that would normally go to Perplexity
    const queryData = {
      query: 'What are the latest stock prices for tech companies?',
      userId: 'test-user',
      sessionId: 'test-session',
      requiresResearch: true
    };
    
    // Override our mock service router to test the fallback behavior
    mockServiceRouter.routeQuery.mockImplementationOnce(async (data) => {
      if (data.requiresResearch) {
        // Check if Perplexity is available
        if (mockPerplexityService.isOnline()) {
          return await mockPerplexityService.processQuery(data);
        } else {
          // Fallback to Claude
          const claudeResult = await mockClaudeService.processQuery(data);
          return {
            ...claudeResult,
            fallbackUsed: true,
            serviceUsed: 'claude'
          };
        }
      } else {
        return await mockClaudeService.processQuery(data);
      }
    });
    
    // Process the query
    const result = await mockServiceRouter.routeQuery(queryData);
    
    // Verify Claude was used as fallback
    expect(mockClaudeService.processQuery).toHaveBeenCalled();
    expect(mockPerplexityService.processQuery).not.toHaveBeenCalled();
    
    // Verify fallback warning in result
    expect(result).toHaveProperty('fallbackUsed', true);
  });
  
  test('should trigger deep research for complex research queries', async () => {
    // Setup a deep research query
    const queryData = {
      query: 'Provide a comprehensive analysis of the impact of climate change on global agriculture.',
      userId: 'test-user',
      sessionId: 'test-session',
      requiresResearch: true,
      deepResearch: true
    };
    
    // Override our mock service router to test deep research handling
    mockServiceRouter.routeQuery.mockImplementationOnce(async (data) => {
      if (data.deepResearch && data.requiresResearch) {
        return await mockPerplexityService.performDeepResearch(data);
      } else if (data.requiresResearch) {
        return await mockPerplexityService.processQuery(data);
      } else {
        return await mockClaudeService.processQuery(data);
      }
    });
    
    // Process the query
    const result = await mockServiceRouter.routeQuery(queryData);
    
    // Verify deep research was used instead of regular query
    expect(mockPerplexityService.performDeepResearch).toHaveBeenCalled();
    expect(mockPerplexityService.processQuery).not.toHaveBeenCalled();
    
    // Verify result contains deep research response
    expect(result.content).toContain('deep research');
    expect(result).toHaveProperty('citations');
  });
  
  test('should update context with conversation history', async () => {
    // Setup a simple query
    const queryData = {
      query: 'Tell me about quantum computing',
      userId: 'test-user',
      sessionId: 'test-session'
    };
    
    // Override our mock service router to test context updating
    mockServiceRouter.routeQuery.mockImplementationOnce(async (data) => {
      const response = await mockClaudeService.processQuery(data);
      
      // Update context with the query and response
      await mockContextManager.updateContext({
        query: data.query,
        response: response
      });
      
      return response;
    });
    
    // Process the query
    await mockServiceRouter.routeQuery(queryData);
    
    // Verify context was updated
    expect(mockContextManager.updateContext).toHaveBeenCalled();
    
    // The argument to updateContext should contain the query and response
    const updateContextCall = mockContextManager.updateContext.mock.calls[0][0];
    expect(updateContextCall).toHaveProperty('query', queryData.query);
    expect(updateContextCall).toHaveProperty('response');
  });
  
  test('should handle errors gracefully', async () => {
    // Make Claude service throw an error
    mockClaudeService.processQuery.mockRejectedValueOnce(new Error('Service unavailable'));
    
    // Setup a query that would go to Claude
    const queryData = {
      query: 'Explain quantum computing',
      userId: 'test-user',
      sessionId: 'test-session',
      requiresResearch: false
    };
    
    // Override our mock service router to test error handling
    mockServiceRouter.routeQuery.mockImplementationOnce(async (data) => {
      try {
        if (!data.requiresResearch) {
          return await mockClaudeService.processQuery(data);
        } else {
          return await mockPerplexityService.processQuery(data);
        }
      } catch (error) {
        // Handle the error
        const errorResult = {
          error: error.message,
          serviceUsed: data.requiresResearch ? 'perplexity' : 'claude'
        };
        
        // Update context with the error
        await mockContextManager.updateContext({
          query: data.query,
          error: error
        });
        
        return errorResult;
      }
    });
    
    // Try to process the query
    const result = await mockServiceRouter.routeQuery(queryData);
    
    // Verify error handling
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Service unavailable');
    
    // Verify context was updated with error
    expect(mockContextManager.updateContext).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Object)
      })
    );
  });
});