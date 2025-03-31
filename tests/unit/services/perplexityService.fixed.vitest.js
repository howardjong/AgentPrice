/**
 * Perplexity Service Tests
 */
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';

// Mock axios directly
vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}));

// Import the mocked dependencies
import axios from 'axios';
import { PerplexityService } from '../../../server/services/perplexity';

describe('Perplexity Service', () => {
  let perplexityService;
  
  // Mock API responses
  const mockSuccessResponse = {
    data: {
      choices: [
        {
          message: {
            content: 'This is a successful response from Perplexity AI.'
          }
        }
      ],
      citations: [
        { url: 'https://example.com/1' },
        { url: 'https://example.com/2' }
      ],
      model: 'llama-3.1-sonar-small-128k-online',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 200
      }
    }
  };
  
  const mockErrorResponse = {
    response: {
      status: 429,
      data: {
        error: {
          message: 'Rate limit exceeded'
        }
      }
    }
  };
  
  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
    
    // Mock environment variables
    process.env.PERPLEXITY_API_KEY = 'test-api-key';
    
    // Set up mock implementations for axios
    axios.post.mockResolvedValue(mockSuccessResponse);
    
    // Create a new instance of the service for each test
    perplexityService = new PerplexityService({
      apiKey: 'test-api-key',
      baseModels: {
        default: 'llama-3.1-sonar-small-128k-online',
        deepResearch: 'llama-3.1-sonar-small-128k-online'
      }
    });
  });
  
  afterEach(() => {
    // Clean up
    vi.resetAllMocks();
  });
  
  describe('performDeepResearch', () => {
    it('should successfully perform deep research', async () => {
      // Execute the function
      const result = await perplexityService.performDeepResearch('What is quantum computing?');
      
      // Verify API request was made
      expect(axios.post).toHaveBeenCalled();
      
      // Get the actual call arguments
      const [url, payload, config] = axios.post.mock.calls[0];
      
      // Test URL
      expect(url).toBe('https://api.perplexity.ai/chat/completions');
      
      // Test payload
      expect(payload).toHaveProperty('model');
      expect(payload).toHaveProperty('messages');
      expect(payload.messages[0]).toEqual(expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('research assistant')
      }));
      expect(payload.messages[1]).toEqual(expect.objectContaining({
        role: 'user',
        content: expect.stringContaining('What is quantum computing?')
      }));
      expect(payload).toHaveProperty('max_tokens');
      expect(payload).toHaveProperty('temperature');
      expect(payload).toHaveProperty('search_recency_filter');
      
      // Test config headers and timeout separately
      expect(config.headers['Content-Type']).toEqual('application/json');
      expect(config.headers['Authorization']).toMatch(/^Bearer .+$/);
      expect(config.timeout).toBeGreaterThan(0);
      
      // Verify result structure
      expect(result).toEqual({
        response: expect.stringContaining('This is a successful response'),
        citations: expect.arrayContaining([
          { url: 'https://example.com/1' },
          { url: 'https://example.com/2' }
        ]),
        modelUsed: 'llama-3.1-sonar-small-128k-online'
      });
    });
    
    it('should handle deep research with context', async () => {
      // Execute with context
      await perplexityService.performDeepResearch('What is quantum computing?', {
        context: 'Focus on quantum supremacy and recent developments',
        maxCitations: 10
      });
      
      // Verify API request was made
      expect(axios.post).toHaveBeenCalled();
      
      // Get the actual call arguments
      const [url, payload, config] = axios.post.mock.calls[0];
      
      // Test URL
      expect(url).toBe('https://api.perplexity.ai/chat/completions');
      
      // Test payload for context and maxCitations
      expect(payload.messages[1].content).toContain('Focus on quantum supremacy');
      expect(payload).toHaveProperty('top_k', 10);
    });
    
    it('should handle error when API key is missing', async () => {
      // Set service as not connected
      perplexityService.isConnected = false;
      
      // Execute and verify error is thrown
      await expect(
        perplexityService.performDeepResearch('Test query')
      ).rejects.toThrow('Perplexity service is not connected');
    });
    
    it('should handle API request errors', async () => {
      // Mock an API error
      axios.post.mockRejectedValue(mockErrorResponse);
      
      // Execute and verify error is thrown
      await expect(
        perplexityService.performDeepResearch('Rate limited query')
      ).rejects.toThrow('Failed to perform deep research with Perplexity');
    });
    
    it('should handle unexpected response format', async () => {
      // Mock a malformed response
      axios.post.mockResolvedValue({
        data: {
          // Missing choices array
          someOtherField: true
        }
      });
      
      // Execute and verify error handling
      await expect(
        perplexityService.performDeepResearch('Invalid format query')
      ).rejects.toThrow();
    });
  });
});