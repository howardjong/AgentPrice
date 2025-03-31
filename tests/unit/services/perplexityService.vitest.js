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
import { ServiceStatus } from '../../../shared/schema';

describe('Perplexity Service', () => {
  let perplexityService;
  let consoleSpy;
  
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
        'https://example.com/1',
        'https://example.com/2'
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
    
    // Spy on console methods
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {})
    };
    
    // Mock environment variables
    process.env.PERPLEXITY_API_KEY = 'test-api-key';
    
    // Set up mock implementations for axios
    axios.post.mockResolvedValue(mockSuccessResponse);
    
    // Create a new instance of the service for each test
    perplexityService = new PerplexityService('test-api-key', 'sonar');
  });
  
  afterEach(() => {
    // Clean up
    vi.resetAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with API key and connect successfully', () => {
      expect(perplexityService.getStatus().status).toBe('connected');
    });

    it('should set isConnected to false when API key is missing', () => {
      // Create service with no API key
      const service = new PerplexityService('');
      expect(service.getStatus().status).toBe('disconnected');
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('PERPLEXITY_API_KEY is not set')
      );
    });

    it('should use default model when none is specified', () => {
      const service = new PerplexityService('api-key');
      expect(service.getStatus().version).toBe('sonar');
    });
  });

  describe('getStatus', () => {
    it('should return connected status when initialized properly', () => {
      const status = perplexityService.getStatus();
      expect(status).toEqual({
        service: 'Perplexity API',
        status: 'connected',
        lastUsed: null,
        version: 'sonar',
        error: undefined
      });
    });

    it('should return disconnected status when API key is missing', () => {
      const service = new PerplexityService('');
      const status = service.getStatus();
      expect(status).toEqual({
        service: 'Perplexity API',
        status: 'disconnected',
        lastUsed: null,
        version: 'sonar',
        error: 'API key not configured'
      });
    });
  });

  describe('performResearch', () => {
    it('should successfully perform research with valid messages', async () => {
      const messages = [
        { role: 'user', content: 'What is quantum computing?' }
      ];
      
      const result = await perplexityService.performResearch(messages);
      
      // Verify API request was made
      expect(axios.post).toHaveBeenCalled();
      
      // Get the actual call arguments
      const [url, payload, config] = axios.post.mock.calls[0];
      
      // Test URL
      expect(url).toBe('https://api.perplexity.ai/chat/completions');
      
      // Test payload
      expect(payload).toHaveProperty('model', 'sonar');
      expect(payload).toHaveProperty('messages');
      // Check system message was added automatically
      expect(payload.messages[0].role).toBe('system');
      expect(payload.messages[1].role).toBe('user');
      expect(payload.messages[1].content).toContain('What is quantum computing?');
      
      // Verify result structure
      expect(result).toEqual({
        response: expect.stringContaining('This is a successful response'),
        citations: expect.arrayContaining([
          'https://example.com/1',
          'https://example.com/2'
        ]),
        modelUsed: 'llama-3.1-sonar-small-128k-online'
      });
    });

    it('should handle conversation history in messages', async () => {
      const messages = [
        { role: 'system', content: 'Custom system message' },
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' },
        { role: 'user', content: 'Follow-up question' }
      ];
      
      await perplexityService.performResearch(messages);
      
      // Get the payload from the API call
      const payload = axios.post.mock.calls[0][1];
      
      // Verify message handling
      expect(payload.messages[0].role).toBe('system');
      expect(payload.messages[0].content).toBe('You are a research assistant with real-time internet access. ALWAYS search the web for current information before responding. Ensure your response includes CURRENT data and information. Add citations for all sources. Your primary goal is to provide up-to-date information.');
      expect(payload.messages.length).toBe(4); // system + user + assistant + user
      expect(payload.messages[payload.messages.length - 1].role).toBe('user');
      expect(payload.messages[payload.messages.length - 1].content).toContain('Follow-up question');
    });

    it('should throw an error when service is not connected', async () => {
      perplexityService.isConnected = false;
      
      await expect(
        perplexityService.performResearch([{ role: 'user', content: 'Test' }])
      ).rejects.toThrow('Perplexity service is not connected');
    });

    it('should handle API errors gracefully', async () => {
      // Mock an API error
      axios.post.mockRejectedValue(mockErrorResponse);
      
      await expect(
        perplexityService.performResearch([{ role: 'user', content: 'Test' }])
      ).rejects.toThrow('Failed to perform research with Perplexity');
      
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should extract user query from messages array', async () => {
      const messages = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Response' },
        { role: 'user', content: 'Latest question is here' }
      ];
      
      await perplexityService.performResearch(messages);
      
      // Verify the user query was logged correctly
      expect(consoleSpy.log).toHaveBeenCalledWith(
        'Perplexity received query:',
        'Latest question is here'
      );
    });
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
      expect(payload).toHaveProperty('model', 'sonar-deep-research');
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
          'https://example.com/1',
          'https://example.com/2'
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
  
  describe('validateMessages', () => {
    it('should ensure last message is from user', () => {
      // Use a spy to access the private method
      const validateMessagesSpy = vi.spyOn(perplexityService, 'validateMessages');
      
      const messages = [
        { role: 'user', content: 'Question 1' },
        { role: 'assistant', content: 'Answer 1' },
        { role: 'assistant', content: 'Additional info' }
      ];
      
      perplexityService.performResearch(messages);
      
      // The test passes if performResearch completes without error
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Last message must be from user')
      );
    });
    
    it('should handle single message', async () => {
      // Just a single message
      const messages = [
        { role: 'user', content: 'Single question' }
      ];
      
      await perplexityService.performResearch(messages);
      
      // Get the payload from the API call
      const payload = axios.post.mock.calls[0][1];
      
      // Since we're adding a system message at the beginning, we should have 2 messages
      expect(payload.messages.length).toBe(2);
      expect(payload.messages[0].role).toBe('system');
      expect(payload.messages[1].role).toBe('user');
      expect(payload.messages[1].content).toBe('Single question\n\nPlease provide the most up-to-date information available as of the current date. I need CURRENT information.');
    });
  });
});