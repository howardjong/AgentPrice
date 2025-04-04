/**
 * Demonstrates a solution for mocking modules with mixed export patterns
 * (both default and named exports) in Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// IMPORTANT: Mock declarations must come before imports due to hoisting
// Create mock implementations outside the vi.mock callback
const mockProcessText = vi.fn();
const mockGenerateQuestions = vi.fn();

// Mock the entire module
vi.mock('../../services/claudeService', () => {
  // Return an object with both default export and named exports
  return {
    default: {
      processText: mockProcessText
    },
    generateClarifyingQuestions: mockGenerateQuestions
  };
});

// Import the module AFTER mocking
import claudeService, { generateClarifyingQuestions } from '../../services/claudeService';

// Test suite
describe('Mixed Export Pattern Module Mocking', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Set up default mock implementations
    mockProcessText.mockResolvedValue({
      content: 'Mocked content response',
      usage: { total_tokens: 42 }
    });
    
    mockGenerateQuestions.mockResolvedValue([
      'Question 1?',
      'Question 2?'
    ]);
  });
  
  afterEach(() => {
    // Clean up after each test
    vi.restoreAllMocks();
  });
  
  it('should correctly mock the default export', async () => {
    // Arrange & Act
    const result = await claudeService.processText('Test prompt');
    
    // Assert
    expect(mockProcessText).toHaveBeenCalledWith('Test prompt');
    expect(result).toEqual({
      content: 'Mocked content response',
      usage: { total_tokens: 42 }
    });
  });
  
  it('should correctly mock named exports', async () => {
    // Arrange & Act
    const result = await generateClarifyingQuestions('How to improve performance?');
    
    // Assert
    expect(mockGenerateQuestions).toHaveBeenCalledWith('How to improve performance?');
    expect(result).toEqual(['Question 1?', 'Question 2?']);
  });
  
  it('should allow changing mock implementation for specific tests', async () => {
    // Arrange - Change mock implementation for this test only
    mockProcessText.mockResolvedValueOnce({
      content: 'Custom response for this test',
      usage: { total_tokens: 100 }
    });
    
    // Act
    const result = await claudeService.processText('Custom prompt');
    
    // Assert
    expect(result.content).toBe('Custom response for this test');
    expect(result.usage.total_tokens).toBe(100);
  });
  
  it('should handle errors correctly', async () => {
    // Arrange - Make the mock reject with an error
    mockGenerateQuestions.mockRejectedValueOnce(new Error('API error'));
    
    // Act & Assert
    await expect(generateClarifyingQuestions('Error test'))
      .rejects.toThrow('API error');
  });
});

/**
 * Additional Test Suite for a more complex workflow scenario
 */
describe('Workflow with Multiple Service Interactions', () => {
  // Define workflow under test
  async function runQueryWorkflow(query) {
    try {
      // Step 1: Generate clarifying questions
      const questions = await generateClarifyingQuestions(query);
      
      // Step 2: Process the query with context
      const context = `Original query: ${query}\nClarifying questions: ${questions.join(', ')}`;
      const response = await claudeService.processText(context);
      
      return {
        success: true,
        questions,
        response: response.content,
        metrics: {
          tokenUsage: response.usage.total_tokens
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Set up default mock implementations
    mockProcessText.mockResolvedValue({
      content: 'Workflow response',
      usage: { total_tokens: 150 }
    });
    
    mockGenerateQuestions.mockResolvedValue([
      'What are your specific goals?',
      'What challenges have you encountered?'
    ]);
  });
  
  it('should execute the complete workflow successfully', async () => {
    // Act
    const result = await runQueryWorkflow('How can I optimize my application?');
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.questions).toHaveLength(2);
    expect(result.response).toBe('Workflow response');
    expect(result.metrics.tokenUsage).toBe(150);
    
    // Verify service interactions
    expect(mockGenerateQuestions).toHaveBeenCalledWith('How can I optimize my application?');
    expect(mockProcessText).toHaveBeenCalledWith(expect.stringContaining('Original query'));
  });
  
  it('should handle failures in the workflow', async () => {
    // Arrange - Make the first service call fail
    mockGenerateQuestions.mockRejectedValueOnce(new Error('Service unavailable'));
    
    // Act
    const result = await runQueryWorkflow('Test query');
    
    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe('Service unavailable');
    
    // Verify the second service was never called due to early failure
    expect(mockProcessText).not.toHaveBeenCalled();
  });
});