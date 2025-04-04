/**
 * Testing a solution for the Vitest mocking issues with ESM imports
 * 
 * This file follows the approach:
 * 1. Hard code the mock values (don't reference external variables)
 * 2. Use explicit imports after mocking
 * 3. Keep tests minimalist
 */

import { describe, it, expect, vi } from 'vitest';

// Step 1: Define the CircuitBreaker mock
vi.mock('../../../utils/circuitBreaker.js', () => ({
  default: {
    execute: vi.fn().mockImplementation(fn => fn()),
    getState: vi.fn().mockReturnValue('CLOSED')
  }
}));

// Step 2: Define Claude Service mock with both default export and named exports
vi.mock('../../../services/claudeService.js', () => {
  return {
    // Default export
    default: {
      processText: vi.fn().mockResolvedValue({
        content: "Mock text response",
        usage: { total_tokens: 100 },
        model: "mock-model",
        requestId: "mock-request-id"
      }),
      
      processConversation: vi.fn().mockResolvedValue({
        content: "Mock conversation response",
        response: "Mock conversation response", 
        usage: { total_tokens: 200 },
        model: "mock-model",
        requestId: "mock-request-id"
      }),
      
      generateClarifyingQuestions: vi.fn().mockResolvedValue([
        "What industry are you in?",
        "Who is your target customer?"
      ]),
      
      processMultimodal: vi.fn().mockResolvedValue({
        content: "Mock multimodal response",
        usage: { total_tokens: 300 }
      }),
      
      generatePlotlyVisualization: vi.fn().mockResolvedValue({
        plotlyConfig: { data: [], layout: {} },
        insights: ["Mock insight"]
      }),
      
      getHealthStatus: vi.fn().mockReturnValue({
        service: 'claude',
        status: 'available',
        circuitBreakerStatus: 'CLOSED'
      }),
      
      generateChartData: vi.fn().mockResolvedValue({
        data: { x: [1,2,3], y: [10,20,30] },
        insights: ["Chart insight 1", "Chart insight 2"]
      })
    },
    
    // Named exports
    processText: vi.fn().mockResolvedValue({
      content: "Mock text response",
      usage: { total_tokens: 100 }
    }),
    
    processConversation: vi.fn().mockResolvedValue({
      content: "Mock conversation response",
      response: "Mock conversation response", 
      usage: { total_tokens: 200 }
    }),
    
    generateClarifyingQuestions: vi.fn().mockResolvedValue([
      "What industry are you in?",
      "Who is your target customer?"
    ]),
    
    processMultimodal: vi.fn().mockResolvedValue({
      content: "Mock multimodal response",
      usage: { total_tokens: 300 }
    }),
    
    generatePlotlyVisualization: vi.fn().mockResolvedValue({
      plotlyConfig: { data: [], layout: {} },
      insights: ["Mock insight"]
    }),
    
    getHealthStatus: vi.fn().mockReturnValue({
      service: 'claude',
      status: 'available'
    }),
    
    generateChartData: vi.fn().mockResolvedValue({
      data: { x: [1,2,3], y: [10,20,30] },
      insights: ["Chart insight 1", "Chart insight 2"]
    })
  };
});

// Step 3: Define Perplexity Service mock with both default export and named exports
vi.mock('../../../services/perplexityService.js', () => {
  return {
    // Default export
    default: {
      processWebQuery: vi.fn().mockResolvedValue({
        content: "Mock web query response",
        citations: [{ title: "Citation 1", url: "https://example.com" }],
        usage: { total_tokens: 150 }
      }),
      
      processConversation: vi.fn().mockResolvedValue({
        content: "Mock conversation response",
        citations: [], 
        usage: { total_tokens: 200 }
      }),
      
      performDeepResearch: vi.fn().mockResolvedValue({
        content: "Mock research results",
        sources: [{ title: "Mock Source", url: "https://example.com", snippet: "Example text" }],
        modelUsed: "mock-model"
      }),
      
      conductDeepResearch: vi.fn().mockResolvedValue({
        content: "Mock deep research results",
        sources: [{ title: "Deep Source", url: "https://example.com" }],
        modelUsed: "mock-model"
      }),
      
      getHealthStatus: vi.fn().mockReturnValue({
        service: 'perplexity',
        status: 'available',
        circuitBreakerStatus: 'CLOSED'
      })
    },
    
    // Named exports
    processWebQuery: vi.fn().mockResolvedValue({
      content: "Mock web query response",
      citations: [{ title: "Citation 1", url: "https://example.com" }],
      usage: { total_tokens: 150 }
    }),
    
    processConversation: vi.fn().mockResolvedValue({
      content: "Mock conversation response",
      citations: [], 
      usage: { total_tokens: 200 }
    }),
    
    conductDeepResearch: vi.fn().mockResolvedValue({
      content: "Mock deep research results",
      sources: [{ title: "Deep Source", url: "https://example.com" }]
    }),
    
    getHealthStatus: vi.fn().mockReturnValue({
      service: 'perplexity',
      status: 'available'
    }),
    
    SONAR_MODELS: {
      small: 'sonar-small-online',
      medium: 'sonar-medium-online',
      large: 'sonar-large-online'
    }
  };
});

// Step 4: Import the mocked services AFTER defining mocks
import claudeService from '../../../services/claudeService.js';
import perplexityService from '../../../services/perplexityService.js';

// Define test suite
describe('Minimal Test', () => {
  it('should get clarifying questions from Claude', async () => {
    const questions = await claudeService.generateClarifyingQuestions("Test query");
    expect(questions).toBeDefined();
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBe(2);
  });
  
  it('should get a response from a conversation', async () => {
    const messages = [{ role: 'user', content: 'Test message' }];
    const response = await claudeService.processConversation(messages);
    expect(response).toBeDefined();
    expect(response.content).toBe("Mock conversation response");
  });
  
  it('should get research results from Perplexity', async () => {
    const results = await perplexityService.performDeepResearch("Test query");
    expect(results).toBeDefined();
    expect(results.content).toBe("Mock research results");
    expect(results.sources).toBeDefined();
    expect(results.sources[0].title).toBe("Mock Source");
  });
});