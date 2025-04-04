/**
 * Using named imports for cleaner mocking
 * 
 * This approach uses named imports instead of default imports
 * which can make the mocking more reliable in some cases
 */

import { describe, it, expect, vi } from 'vitest';

// Step 1: Mock dependencies with inline functions
vi.mock('../../../utils/circuitBreaker.js', () => ({
  default: {
    execute: vi.fn().mockImplementation(fn => fn()),
    getState: vi.fn().mockReturnValue('CLOSED')
  }
}));

// Step 2: Mock claudeService with inline functions
vi.mock('../../../services/claudeService.js', () => {
  // Create mock functions directly inside this function
  return {
    // Default export
    default: {
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
      
      generateChartData: vi.fn().mockResolvedValue({
        data: { x: [1,2,3], y: [10,20,30] },
        insights: ["Chart insight 1", "Chart insight 2"]
      })
    },
    
    // Named exports must be duplicated exactly
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
    
    generateChartData: vi.fn().mockResolvedValue({
      data: { x: [1,2,3], y: [10,20,30] },
      insights: ["Chart insight 1", "Chart insight 2"]
    })
  };
});

// Step 3: Import with NAMED imports (note the difference)
import claudeService, { generateClarifyingQuestions, processConversation } from '../../../services/claudeService.js';

// Log what we imported to see the structure
console.log("IMPORTED DEFAULT:", Object.keys(claudeService || {}));
console.log("IMPORTED NAMED generateClarifyingQuestions:", typeof generateClarifyingQuestions);
console.log("IMPORTED NAMED processConversation:", typeof processConversation);

// Define test suite
describe('Named Imports Test', () => {
  it('should get clarifying questions from Claude', async () => {
    const questions = await generateClarifyingQuestions("Test query");
    expect(questions).toBeDefined();
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBe(2);
  });
  
  it('should get a response from a conversation', async () => {
    const messages = [{ role: 'user', content: 'Test message' }];
    const response = await processConversation(messages);
    expect(response).toBeDefined();
    expect(response.content).toBe("Mock conversation response");
  });
});