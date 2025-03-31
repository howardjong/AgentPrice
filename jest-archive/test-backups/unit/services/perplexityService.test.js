/**
 * Perplexity Service Tests
 */
import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';

// Create mock objects first
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

const mockRequest = jest.fn();
const mockExecuteRequest = jest.fn(async (serviceKey, requestFn) => requestFn());
const mockPromptManager = {
  getPrompt: jest.fn().mockResolvedValue('Test prompt template'),
  formatPrompt: jest.fn((_template, { query }) => `Formatted prompt for: ${query}`)
};

// Then set up mocks
jest.mock('../../../utils/logger.js', () => {
  return {
    __esModule: true,
    default: mockLogger
  };
});

jest.mock('../../../utils/apiClient.js', () => {
  return {
    __esModule: true,
    RobustAPIClient: jest.fn().mockImplementation(() => ({
      request: mockRequest
    }))
  };
});

jest.mock('../../../utils/monitoring.js', () => {
  return {
    __esModule: true,
    CircuitBreaker: jest.fn().mockImplementation(() => ({
      executeRequest: mockExecuteRequest
    }))
  };
});

jest.mock('../../../services/promptManager.js', () => {
  return {
    __esModule: true,
    default: mockPromptManager
  };
});

// Define the variable that will hold the imported module
let perplexityService;

describe('PerplexityService', () => {
  beforeAll(async () => {
    const perplexityModule = await import('../../../services/perplexityService');
    perplexityService = perplexityModule.default;
    
    // For testing purposes, manually set the API key and connected state
    perplexityService.apiKey = 'test-api-key';
    perplexityService.isConnected = true;
    perplexityService.model = 'test-model';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('performResearch', () => {
    it('should correctly use the actual model from API response', async () => {
      // Mock API response
      const mockResponseData = {
        data: {
          model: 'sonar-pro-actual', // This is the actual model returned by API
          choices: [
            {
              message: {
                content: 'This is a test response from Perplexity'
              }
            }
          ],
          citations: ['https://example.com/citation1'],
          usage: {
            total_tokens: 100
          }
        }
      };
      
      // Setup mock implementation
      mockRequest.mockResolvedValueOnce(mockResponseData);
      
      // Execute the function
      const result = await perplexityService.performResearch([
        { role: 'user', content: 'Test query' }
      ]);
      
      // Verify the result
      expect(result.modelUsed).toBe('sonar-pro-actual');
      expect(result.response).toContain('[Using Perplexity AI - Model: sonar-pro-actual]');
    });

    it('should fall back to requested model if API response does not include model', async () => {
      // Mock API response without model field
      const mockResponseData = {
        data: {
          choices: [
            {
              message: {
                content: 'This is a test response from Perplexity'
              }
            }
          ],
          citations: ['https://example.com/citation1'],
          usage: {
            total_tokens: 100
          }
        }
      };
      
      // Setup mock implementation
      mockRequest.mockResolvedValueOnce(mockResponseData);
      
      // Execute the function
      const result = await perplexityService.performResearch([
        { role: 'user', content: 'Test query' }
      ]);
      
      // Verify the result
      expect(result.modelUsed).toBe('test-model');
      expect(result.response).toContain('[Using Perplexity AI - Model: test-model]');
    });
  });

  describe('performDeepResearch', () => {
    it('should correctly use the actual model from API response for deep research', async () => {
      // Mock API response
      const mockResponseData = {
        data: {
          model: 'sonar-pro-actual', // This is the actual model returned by API
          choices: [
            {
              message: {
                content: 'This is a deep research response from Perplexity'
              }
            }
          ],
          citations: ['https://example.com/citation1', 'https://example.com/citation2'],
          usage: {
            total_tokens: 200
          }
        }
      };
      
      // Setup mock implementation
      mockRequest.mockResolvedValueOnce(mockResponseData);
      
      // Execute the function
      const result = await perplexityService.performDeepResearch('Test deep research query', 'test-job-id');
      
      // Verify the result
      expect(result.modelUsed).toBe('sonar-pro-actual');
      expect(result.content).toContain('[Using Perplexity AI - Model: sonar-pro-actual]');
    });
  });
});