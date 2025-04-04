/**
 * Direct Module Mock Approach
 * 
 * This test shows the most direct and reliable way to mock modules with both default and named exports
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Step 1: Mock claudeService before importing it
vi.mock('../../../services/claudeService.js', () => {
  return {
    default: {
      generateClarifyingQuestions: vi.fn().mockResolvedValue([
        "What industry are you in?",
        "Who is your target customer?"
      ]),
      processConversation: vi.fn().mockResolvedValue({
        content: "Mock conversation response",
        response: "Mock conversation response",
        usage: { total_tokens: 200 }
      })
    },
    
    // Named exports must match exactly what's imported
    generateClarifyingQuestions: vi.fn().mockResolvedValue([
      "What industry are you in?",
      "Who is your target customer?"
    ]),
    
    processConversation: vi.fn().mockResolvedValue({
      content: "Mock conversation response",
      response: "Mock conversation response", 
      usage: { total_tokens: 200 }
    })
  };
});

// Step 2: AFTER mocking, import the module
import claudeService, { 
  generateClarifyingQuestions, 
  processConversation 
} from '../../../services/claudeService.js';

// Step 3: Define the tests
describe('Direct Mock Test', () => {
  it('named export - generateClarifyingQuestions should return mock data', async () => {
    const result = await generateClarifyingQuestions("test prompt");
    expect(result).toEqual([
      "What industry are you in?",
      "Who is your target customer?"
    ]);
  });
  
  it('named export - processConversation should return mock data', async () => {
    const result = await processConversation([{ role: 'user', content: 'test' }]);
    expect(result).toEqual({
      content: "Mock conversation response",
      response: "Mock conversation response",
      usage: { total_tokens: 200 }
    });
  });
  
  it('default export - generateClarifyingQuestions should return mock data', async () => {
    const result = await claudeService.generateClarifyingQuestions("test prompt");
    expect(result).toEqual([
      "What industry are you in?",
      "Who is your target customer?"
    ]);
  });
  
  it('default export - processConversation should return mock data', async () => {
    const result = await claudeService.processConversation([{ role: 'user', content: 'test' }]);
    expect(result).toEqual({
      content: "Mock conversation response",
      response: "Mock conversation response",
      usage: { total_tokens: 200 }
    });
  });
});