/**
 * Perplexity Service Tests
 */
import { jest } from '@jest/globals';

// Import the mocked dependencies
import { logger } from '../../../utils/logger.js';
import { RobustAPIClient } from '../../../utils/apiClient.js';
import { CircuitBreaker } from '../../../utils/monitoring.js';
import promptManager from '../../../services/promptManager.js';

// Set up mocks
jest.mock('../../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock API client
const mockRequest = jest.fn();
jest.mock('../../../utils/apiClient.js', () => ({
  RobustAPIClient: jest.fn().mockImplementation(() => ({
    request: mockRequest
  }))
}));

// Mock circuit breaker
const mockExecuteRequest = jest.fn(async (serviceKey, requestFn) => requestFn());
jest.mock('../../../utils/monitoring.js', () => ({
  CircuitBreaker: jest.fn().mockImplementation(() => ({
    executeRequest: mockExecuteRequest
  }))
}));

// Mock prompt manager
jest.mock('../../../services/promptManager.js', () => ({
  default: {
    getPrompt: jest.fn().mockResolvedValue('Test prompt template'),
    formatPrompt: jest.fn((_template, { query }) => `Formatted prompt for: ${query}`)
  }
}));

// Dynamic import of the perplexityService module
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
      apiClient.request.mockResolvedValueOnce(mockResponseData);
      
      // Execute the function
      const result = await perplexityService.performDeepResearch('Test deep research query', 'test-job-id');
      
      // Verify the result
      expect(result.modelUsed).toBe('sonar-pro-actual');
      expect(result.content).toContain('[Using Perplexity AI - Model: sonar-pro-actual]');
    });
  });
});