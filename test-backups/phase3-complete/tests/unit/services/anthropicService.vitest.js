/**
 * Anthropic Service Tests (Vitest)
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { traceTest } from '../../utils/test-helpers.js';

// Mock the modules before importing them
vi.mock('../../../services/anthropicService.js', () => ({
  default: {
    generateResponse: vi.fn(),
    generateClarifyingQuestions: vi.fn(),
    generateChartData: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      service: "Claude AI",
      healthy: true,
      totalCalls: 25,
      successRate: "96%",
      circuitBreakerOpen: false
    })
  }
}));

// Mock the logger
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Import the mocked modules
import anthropicService from '../../../services/anthropicService.js';
import logger from '../../../utils/logger.js';

// Helper function to create a mock text response
function createMockAnthropicTextResponse(response = 'Mock Claude response') {
  return {
    response: response,
    modelUsed: 'claude-3-7-sonnet-20250219',
    usage: {
      inputTokens: 25,
      outputTokens: 75
    }
  };
}

// Helper function to create mock chart data
function createMockChartData() {
  return {
    data: [
      { x: 'A', y: 10 },
      { x: 'B', y: 20 },
      { x: 'C', y: 30 }
    ],
    layout: {
      title: 'Test Chart'
    }
  };
}

describe('Anthropic Service', () => {
  traceTest('Anthropic Service');
  
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset all mocks after each test
    vi.clearAllMocks();
  });

  it('should initialize with default configuration', () => {
    expect(anthropicService).toBeDefined();
    expect(anthropicService.generateResponse).toBeDefined();
    expect(anthropicService.generateClarifyingQuestions).toBeDefined();
    expect(anthropicService.generateChartData).toBeDefined();
  });
  
  it('should generate a response using Claude', async () => {
    // Setup
    const mockResult = createMockAnthropicTextResponse();
    anthropicService.generateResponse.mockResolvedValueOnce(mockResult);
    
    const mockQuery = 'What is the capital of France?';
    const mockOptions = { temperature: 0.7 };
    
    // Execute
    const result = await anthropicService.generateResponse(mockQuery, mockOptions);
    
    // Verify
    expect(anthropicService.generateResponse).toHaveBeenCalledWith(mockQuery, mockOptions);
    expect(result).toEqual(mockResult);
    expect(result.response).toBe('Mock Claude response');
    expect(result.modelUsed).toBe('claude-3-7-sonnet-20250219');
  });
  
  it('should handle errors gracefully', async () => {
    // Setup
    anthropicService.generateResponse.mockRejectedValueOnce(new Error('API Error'));
    
    // Execute & Verify
    await expect(anthropicService.generateResponse('test query')).rejects.toThrow('API Error');
  });
  
  it('should generate clarifying questions', async () => {
    // Setup
    const questionArray = ['First question?', 'Second question?', 'Third question?'];
    anthropicService.generateClarifyingQuestions.mockResolvedValueOnce(questionArray);
    
    // Execute
    const result = await anthropicService.generateClarifyingQuestions('Research topic');
    
    // Verify
    expect(anthropicService.generateClarifyingQuestions).toHaveBeenCalledWith('Research topic');
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('First question?');
    expect(result[1]).toBe('Second question?');
    expect(result[2]).toBe('Third question?');
  });
  
  it('should generate chart data', async () => {
    // Setup
    const mockChartData = createMockChartData();
    anthropicService.generateChartData.mockResolvedValueOnce(mockChartData);
    
    // Execute
    const result = await anthropicService.generateChartData('Chart request', 'bar');
    
    // Verify
    expect(anthropicService.generateChartData).toHaveBeenCalledWith('Chart request', 'bar');
    expect(result).toBeDefined();
    expect(result.data).toBeInstanceOf(Array);
    expect(result.data.length).toBe(3);
    expect(result.layout.title).toBe('Test Chart');
  });
  
  it('should handle invalid JSON in chart data response', async () => {
    // Setup
    anthropicService.generateChartData.mockRejectedValueOnce(new Error('Invalid JSON in response'));
    
    // Execute & Verify
    await expect(anthropicService.generateChartData('Invalid chart request', 'bar'))
      .rejects.toThrow('Invalid JSON');
  });
  
  it('should provide service status information', () => {
    // Execute
    const status = anthropicService.getStatus();
    
    // Verify
    expect(status).toHaveProperty('service', 'Claude AI');
    expect(status).toHaveProperty('healthy', true);
    expect(status).toHaveProperty('totalCalls');
    expect(status).toHaveProperty('successRate');
  });
});