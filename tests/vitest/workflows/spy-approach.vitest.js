/**
 * Using Complete Module Mocking for Services
 * 
 * This approach directly replaces the claudeService module with a complete mock
 * It's the simplest and most direct approach when working with complex services
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Define the complete mock of claudeService module
// Note: vi.mock is hoisted to the top of the file, so we can't use variables defined outside this block
vi.mock('../../../services/claudeService.js', () => {
  // Define mock data directly inside the factory function
  const mockQuestionsArray = [
    "What industry are you in?",
    "Who is your target customer?"
  ];
  
  const mockResponse = {
    content: "Mock conversation response",
    response: "Mock conversation response", 
    usage: { total_tokens: 200 }
  };
  
  // Setup all the functions we need to mock
  const generateClarifyingQuestionsMock = vi.fn().mockResolvedValue(mockQuestionsArray);
  const processConversationMock = vi.fn().mockResolvedValue(mockResponse);
  
  // Mock functions for both default and named exports
  return {
    // Default export is the service object
    default: {
      generateClarifyingQuestions: generateClarifyingQuestionsMock,
      processConversation: processConversationMock,
      // Add other functions as needed
      processText: vi.fn().mockResolvedValue({
        content: "Mock text response",
        usage: { total_tokens: 100 }
      })
    },
    
    // Named exports
    generateClarifyingQuestions: generateClarifyingQuestionsMock,
    processConversation: processConversationMock
  };
});

// No need to mock dependencies since we're mocking the entire claudeService module

// Import the now-mocked module - everything will come from our mock above
import claudeService, { 
  generateClarifyingQuestions, 
  processConversation 
} from '../../../services/claudeService.js';

// Define test suite
describe('Complete Module Mock Test', () => {
  it('should get clarifying questions using the named export', async () => {
    // Call the named export function (which is now our mock)
    const questions = await generateClarifyingQuestions("Test query");
    
    // Verify the result matches our mock data
    expect(questions).toBeDefined();
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBe(2);
    expect(questions[0]).toBe("What industry are you in?");
  });
  
  it('should get a response from a conversation using the named export', async () => {
    // Call the named export function (which is now our mock)
    const messages = [{ role: 'user', content: 'Test message' }];
    const response = await processConversation(messages);
    
    // Verify the result matches our mock data
    expect(response).toBeDefined();
    expect(response.content).toBe("Mock conversation response");
  });
  
  it('should get clarifying questions using the service object', async () => {
    // Call the function on the service object (which is now our mock)
    const questions = await claudeService.generateClarifyingQuestions("Test query");
    
    // Verify the result matches our mock data
    expect(questions).toBeDefined();
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBe(2);
  });
});