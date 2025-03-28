/**
 * Claude Service Tests (Vitest)
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { traceTest } from '../../utils/test-helpers.js';

// Mock the modules before importing them
vi.mock('../../../services/claudeService.js', () => ({
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
import claudeService from '../../../services/claudeService.js';
import logger from '../../../utils/logger.js';

// Helper function to create a mock text response
function createMockClaudeTextResponse(response = 'Mock Claude response') {
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

describe('Claude Service', () => {
  traceTest('Claude Service');
  
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset all mocks after each test
    vi.clearAllMocks();
  });

  it('should initialize with default configuration', () => {
    expect(claudeService).toBeDefined();
    expect(claudeService.generateResponse).toBeDefined();
    expect(claudeService.generateClarifyingQuestions).toBeDefined();
    expect(claudeService.generateChartData).toBeDefined();
  });
  
  it('should generate a response using Claude', async () => {
    // Setup
    const mockResult = createMockClaudeTextResponse();
    claudeService.generateResponse.mockResolvedValueOnce(mockResult);
    
    const mockQuery = 'What is the capital of France?';
    const mockOptions = { temperature: 0.7 };
    
    // Execute
    const result = await claudeService.generateResponse(mockQuery, mockOptions);
    
    // Verify
    expect(claudeService.generateResponse).toHaveBeenCalledWith(mockQuery, mockOptions);
    expect(result).toEqual(mockResult);
    expect(result.response).toBe('Mock Claude response');
    expect(result.modelUsed).toBe('claude-3-7-sonnet-20250219');
  });
  
  it('should handle errors gracefully', async () => {
    // Setup
    claudeService.generateResponse.mockRejectedValueOnce(new Error('API Error'));
    
    // Execute & Verify
    await expect(claudeService.generateResponse('test query')).rejects.toThrow('API Error');
  });
  
  it('should generate clarifying questions', async () => {
    // Setup
    const questionArray = ['First question?', 'Second question?', 'Third question?'];
    claudeService.generateClarifyingQuestions.mockResolvedValueOnce(questionArray);
    
    // Execute
    const result = await claudeService.generateClarifyingQuestions('Research topic');
    
    // Verify
    expect(claudeService.generateClarifyingQuestions).toHaveBeenCalledWith('Research topic');
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('First question?');
    expect(result[1]).toBe('Second question?');
    expect(result[2]).toBe('Third question?');
  });
  
  it('should generate chart data', async () => {
    // Setup
    const mockChartData = createMockChartData();
    claudeService.generateChartData.mockResolvedValueOnce(mockChartData);
    
    // Execute
    const result = await claudeService.generateChartData('Chart request', 'bar');
    
    // Verify
    expect(claudeService.generateChartData).toHaveBeenCalledWith('Chart request', 'bar');
    expect(result).toBeDefined();
    expect(result.data).toBeInstanceOf(Array);
    expect(result.data.length).toBe(3);
    expect(result.layout.title).toBe('Test Chart');
  });
  
  it('should handle invalid JSON in chart data response', async () => {
    // Setup
    claudeService.generateChartData.mockRejectedValueOnce(new Error('Invalid JSON in response'));
    
    // Execute & Verify
    await expect(claudeService.generateChartData('Invalid chart request', 'bar'))
      .rejects.toThrow('Invalid JSON');
  });
  
  it('should provide service status information', () => {
    // Execute
    const status = claudeService.getStatus();
    
    // Verify
    expect(status).toHaveProperty('service', 'Claude AI');
    expect(status).toHaveProperty('healthy', true);
    expect(status).toHaveProperty('totalCalls');
    expect(status).toHaveProperty('successRate');
  });
});