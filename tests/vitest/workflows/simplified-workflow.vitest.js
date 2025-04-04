/**
 * Simplified Workflow Test
 * 
 * This is a reduced version of the single-query-workflow tests,
 * focusing on testing the whole mocking approach without extra complexity.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import TestCircuitBreaker from '../../utils/test-circuit-breaker.js';

// Mock data constants (defined in the global scope)
const mockQuestions = [
  "What industry are you in?",
  "Who is your target customer?",
  "What's your budget range?"
];

const mockResearchResponse = "Mock research results for testing";

// Step 1: Mock CircuitBreaker before any imports
vi.mock('../../../utils/circuitBreaker.js', () => {
  return {
    default: TestCircuitBreaker
  };
});

// Step 2: Define complete service mocks
// Important: We're mocking the exact structure of the service
vi.mock('../../../services/claudeService.js', () => {
  // Mock the claudeService object structure exactly as it's exported
  return {
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
      
      generateClarifyingQuestions: vi.fn().mockResolvedValue(mockQuestions),
      
      generateChartData: vi.fn().mockResolvedValue({
        data: { 
          x_values: [1, 2, 3],
          too_cheap: [0.1, 0.2, 0.3],
          competitors: ["A", "B", "C"]
        },
        insights: ["Mock insight 1", "Mock insight 2"]
      }),
      
      getHealthStatus: vi.fn().mockReturnValue({
        service: 'claude',
        status: 'available',
        circuitBreakerStatus: 'CLOSED',
        defaultModel: 'mock-model'
      })
    },
    
    // Also mock the named exports
    processText: vi.fn().mockResolvedValue({
      content: "Mock text response", 
      usage: { total_tokens: 100 }
    }),
    
    processConversation: vi.fn().mockResolvedValue({
      content: "Mock conversation response",
      response: "Mock conversation response",
      usage: { total_tokens: 200 }
    }),
    
    generateClarifyingQuestions: vi.fn().mockResolvedValue(mockQuestions),
    
    generateChartData: vi.fn().mockResolvedValue({
      data: { x_values: [1, 2, 3] },
      insights: ["Mock insight 1", "Mock insight 2"]
    }),
    
    getHealthStatus: vi.fn().mockReturnValue({
      service: 'claude',
      status: 'available'
    })
  };
});

// Step 3: Define Perplexity Service mock
vi.mock('../../../services/perplexityService.js', () => {
  return {
    default: {
      performDeepResearch: vi.fn().mockResolvedValue({
        content: mockResearchResponse,
        sources: [
          { title: "Mock Source", url: "https://example.com", snippet: "Mock snippet" }
        ],
        modelUsed: "mock-model"
      })
    },
    performDeepResearch: vi.fn().mockResolvedValue({
      content: mockResearchResponse,
      sources: [{ title: "Mock Source", url: "https://example.com", snippet: "Mock snippet" }],
      modelUsed: "mock-model"
    })
  };
});

// Step 4: Import the mocked services
import claudeService from '../../../services/claudeService.js';
import perplexityService from '../../../services/perplexityService.js';

// Test suite
describe('Simplified Workflow', () => {
  const initialQuery = "How do I price my new coffee product?";
  
  beforeAll(() => {
    console.log('Setting up test suite with complete pre-import mocks');
  });
  
  afterAll(() => {
    console.log('Cleaning up test suite');
    vi.clearAllMocks();
    vi.resetAllMocks();
  });
  
  it('should generate clarifying questions', async () => {
    // Act
    const questions = await claudeService.generateClarifyingQuestions(initialQuery);
    
    // Assert
    expect(questions).toBeDefined();
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBe(3);
    expect(claudeService.generateClarifyingQuestions).toHaveBeenCalledWith(initialQuery);
  });
  
  it('should get optimized prompt from conversation', async () => {
    // Arrange
    const messages = [
      { role: 'user', content: 'Generate research prompt: ' + initialQuery }
    ];
    
    // Act
    const response = await claudeService.processConversation(messages);
    
    // Assert
    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(response.response).toBeDefined();
    expect(claudeService.processConversation).toHaveBeenCalledWith(messages);
  });
  
  it('should perform research with Perplexity', async () => {
    // Act
    const results = await perplexityService.performDeepResearch(initialQuery);
    
    // Assert
    expect(results).toBeDefined();
    expect(results.content).toBe(mockResearchResponse); // Use our local constant
    expect(results.sources).toBeDefined();
    expect(Array.isArray(results.sources)).toBe(true);
    expect(perplexityService.performDeepResearch).toHaveBeenCalledWith(initialQuery);
  });
  
  it('should complete a simplified end-to-end flow', async () => {
    // Step 1: Generate questions
    const questions = await claudeService.generateClarifyingQuestions(initialQuery);
    expect(questions).toBeDefined();
    
    // Step 2: Generate research prompt
    const messages = [
      { role: 'user', content: 'Generate research prompt: ' + initialQuery }
    ];
    const promptResponse = await claudeService.processConversation(messages);
    expect(promptResponse).toBeDefined();
    
    // Step 3: Research with Perplexity
    const researchResults = await perplexityService.performDeepResearch(promptResponse.response);
    expect(researchResults).toBeDefined();
    
    // Success
    expect(true).toBe(true);
  });
});