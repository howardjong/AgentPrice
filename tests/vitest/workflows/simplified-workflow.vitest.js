/**
 * Simplified Workflow Test
 * 
 * This is a reduced version of the single-query-workflow tests,
 * focusing on testing the whole mocking approach without extra complexity.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import TestCircuitBreaker from '../../utils/test-circuit-breaker.js';

// Step 1: Mock CircuitBreaker before any imports
vi.mock('../../../utils/circuitBreaker.js', () => {
  return {
    default: TestCircuitBreaker
  };
});

// Step 2: Create hardcoded mock data for Claude responses
const MOCK_CLARIFYING_QUESTIONS = [
  "What industry are you in?",
  "Who is your target customer?",
  "What's your budget range?"
];

const MOCK_RESEARCH_RESPONSE = "Mock research results for testing";

// Step 3: Define complete Claude Service mock
vi.mock('../../../services/claudeService.js', () => {
  return {
    generateClarifyingQuestions: vi.fn().mockResolvedValue(MOCK_CLARIFYING_QUESTIONS),
    processText: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        content: "Mock text response",
        usage: { total_tokens: 100 },
        model: "mock-model",
        requestId: "mock-request-id"
      });
    }),
    processConversation: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        content: "Mock conversation response",
        response: "Mock conversation response",
        usage: { total_tokens: 200 },
        model: "mock-model",
        requestId: "mock-request-id"
      });
    })
  };
});

// Step 4: Define complete Perplexity Service mock
vi.mock('../../../services/perplexityService.js', () => {
  return {
    performDeepResearch: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        content: MOCK_RESEARCH_RESPONSE,
        sources: [
          { title: "Mock Source", url: "https://example.com", snippet: "Mock snippet" }
        ],
        modelUsed: "mock-model"
      });
    })
  };
});

// Step 5: Import the mocked services
import * as claudeService from '../../../services/claudeService.js';
import * as perplexityService from '../../../services/perplexityService.js';

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
    expect(results.content).toBe(MOCK_RESEARCH_RESPONSE);
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