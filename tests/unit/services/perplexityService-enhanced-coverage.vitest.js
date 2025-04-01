/**
 * Perplexity Service Enhanced Coverage Tests
 * 
 * These tests expand the coverage of the Perplexity service by focusing on:
 * - Rate limiting handling and retry mechanisms
 * - Error path handling
 * - Edge cases and response format variations
 * - Model selection and fallback behaviors
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

describe('Perplexity Service Enhanced Coverage', () => {
  let perplexityService;
  let consoleSpy;
  
  // Mock API responses for various scenarios
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
  
  const mockRateLimitResponse = {
    response: {
      status: 429,
      headers: {
        'retry-after': '2'
      },
      data: {
        error: {
          message: 'Rate limit exceeded'
        }
      }
    }
  };
  
  const mockAuthError = {
    response: {
      status: 401,
      data: {
        error: {
          message: 'Invalid API key'
        }
      }
    }
  };
  
  const mockServerError = {
    response: {
      status: 500,
      data: {
        error: {
          message: 'Internal server error'
        }
      }
    }
  };
  
  const mockMalformedResponse = {
    data: {
      // Missing the expected structure
      unexpected: true
    }
  };
  
  // Set up and tear down for each test
  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
    
    // Mock Date.now for deterministic timing tests
    vi.spyOn(Date, 'now').mockImplementation(() => 1000);
    
    // Spy on console methods
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {})
    };
    
    // Mock environment variables
    process.env.PERPLEXITY_API_KEY = 'test-api-key';
    
    // Set up default mock implementation for axios
    axios.post.mockResolvedValue(mockSuccessResponse);
    
    // Create a new instance of the service for each test
    perplexityService = new PerplexityService('test-api-key', 'sonar');
  });
  
  afterEach(() => {
    // Clean up
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle malformed response objects with no choices', async () => {
      // Mock a response with missing choices array
      axios.post.mockResolvedValue({
        data: {}
      });
      
      // Execute and expect error
      await expect(
        perplexityService.performResearch([{ role: 'user', content: 'Test query' }])
      ).rejects.toThrow();
      
      // Should log the error
      expect(consoleSpy.error).toHaveBeenCalled();
    });
    
    it('should handle unexpected error formats', async () => {
      // Test with different error formats
      const errorCases = [
        // String error
        'Network error',
        // Number error
        404,
        // Empty object
        {},
        // Null
        null,
        // Deeply nested error
        { 
          request: { 
            socket: { 
              error: { 
                message: 'Socket error' 
              } 
            } 
          } 
        }
      ];
      
      for (const errorCase of errorCases) {
        // Reset error logs
        consoleSpy.error.mockClear();
        
        // Mock the error
        axios.post.mockRejectedValueOnce(errorCase);
        
        // Execute and verify error is handled
        await expect(
          perplexityService.performResearch([{ role: 'user', content: 'Test query' }])
        ).rejects.toThrow();
        
        // Should log the error
        expect(consoleSpy.error).toHaveBeenCalled();
      }
    });
    
    it('should handle network timeouts', async () => {
      // Mock a timeout error
      const timeoutError = new Error('timeout of 180000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      axios.post.mockRejectedValue(timeoutError);
      
      // Execute and verify error is thrown with timeout message
      await expect(
        perplexityService.performDeepResearch('Timeout query')
      ).rejects.toThrow(/timeout/i);
    });
  });
  
  describe('Model Selection and Fallback', () => {
    it('should fallback to requested model if response model is missing', async () => {
      // Mock a response with missing model info
      axios.post.mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: 'Response without model info'
              }
            }
          ],
          citations: [],
          // No model field
          usage: {
            prompt_tokens: 100,
            completion_tokens: 200
          }
        }
      });
      
      // Request with explicit model
      const result = await perplexityService.performResearch([
        { role: 'user', content: 'Model test query' }
      ]);
      
      // Should use the requested model as fallback
      expect(result.modelUsed).toBe('sonar');
      
      // Response should include model info
      expect(result.response).toContain('[Using Perplexity AI - Model: sonar]');
    });
    
    it('should handle legacy model mapping correctly', async () => {
      // Create instance with a legacy model name
      const legacyService = new PerplexityService('test-api-key', 'llama-3.1-sonar-huge-128k-online');
      
      // Verify service status shows the mapped model name
      expect(legacyService.getStatus().version).toBe('llama-3.1-sonar-huge-128k-online');
      
      // Perform research
      await legacyService.performResearch([{ role: 'user', content: 'Legacy model test' }]);
      
      // Get request payload
      const payload = axios.post.mock.calls[0][1];
      
      // Should use the legacy model in the request
      expect(payload.model).toBe('llama-3.1-sonar-huge-128k-online');
    });
    
    it('should use deep research model for performDeepResearch', async () => {
      // Execute deep research
      await perplexityService.performDeepResearch('Deep research test');
      
      // Get request payload
      const payload = axios.post.mock.calls[0][1];
      
      // Should use the deep research model
      expect(payload.model).toBe('sonar-deep-research');
    });
  });
  
  describe('Message Format Validation', () => {
    it('should handle empty messages array', async () => {
      // Execute with empty messages array - this would normally throw an error
      // but we're testing the robustness of the service
      await expect(
        perplexityService.performResearch([])
      ).rejects.toThrow();
    });
    
    it('should fix message sequence with multiple assistant messages', async () => {
      // Create message sequence with assistant messages in wrong places
      const messages = [
        { role: 'assistant', content: 'I should not be first' },
        { role: 'user', content: 'First user message' },
        { role: 'assistant', content: 'First assistant response' },
        { role: 'assistant', content: 'Second assistant message without user prompt' },
        { role: 'assistant', content: 'Third assistant message without user prompt' }
      ];
      
      // Execute research
      await perplexityService.performResearch(messages);
      
      // Get request payload
      const payload = axios.post.mock.calls[0][1];
      const sentMessages = payload.messages;
      
      // Should have fixed the sequence:
      // 1. Start with system message (added automatically)
      // 2. Only include user-assistant alternation
      // 3. End with user message
      expect(sentMessages[0].role).toBe('system');
      
      // Warning should be logged
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Last message must be from user')
      );
    });
    
    it('should handle messages with only system role', async () => {
      // Create message with only system role
      const messages = [
        { role: 'system', content: 'I am the system message' }
      ];
      
      // Mock the validateMessages method to see how it processes the messages
      const validateMessagesSpy = vi.spyOn(perplexityService, 'validateMessages');
      
      // Execute research - this might not throw as the service might add a default user message
      await perplexityService.performResearch(messages);
      
      // Verify validateMessages was called
      expect(validateMessagesSpy).toHaveBeenCalled();
      
      // Check the payload sent to API
      const payload = axios.post.mock.calls[0][1];
      
      // Verify the message structure
      expect(payload.messages.length).toBeGreaterThanOrEqual(1);
      
      // Should have logged something about the message format
      expect(consoleSpy.log.mock.calls.some(call => 
        call.join(' ').includes('Perplexity received query')
      )).toBe(true);
    });
    
    it('should replace system message in conversation', async () => {
      // Create message with user's custom system message
      const messages = [
        { role: 'system', content: 'Custom system message' },
        { role: 'user', content: 'User query' }
      ];
      
      // Execute research
      await perplexityService.performResearch(messages);
      
      // Get request payload
      const payload = axios.post.mock.calls[0][1];
      
      // Should replace with standard system message (not use the user's)
      expect(payload.messages[0].role).toBe('system');
      expect(payload.messages[0].content).toContain('You are a research assistant with real-time internet access');
      expect(payload.messages[0].content).not.toBe('Custom system message');
    });
  });
  
  describe('API Error Handling and Retries', () => {
    it('should handle different HTTP error codes appropriately', async () => {
      const errorCases = [
        { status: 400, message: 'Bad request' },
        { status: 401, message: 'Unauthorized' },
        { status: 403, message: 'Forbidden' },
        { status: 404, message: 'Not found' },
        { status: 429, message: 'Rate limit exceeded' },
        { status: 500, message: 'Internal server error' },
        { status: 502, message: 'Bad gateway' },
        { status: 503, message: 'Service unavailable' }
      ];
      
      for (const errorCase of errorCases) {
        // Reset logs
        consoleSpy.error.mockClear();
        
        // Mock the error
        axios.post.mockRejectedValueOnce({
          response: {
            status: errorCase.status,
            data: {
              error: {
                message: errorCase.message
              }
            }
          }
        });
        
        // Execute and verify error is handled
        await expect(
          perplexityService.performResearch([{ role: 'user', content: 'Error test' }])
        ).rejects.toThrow();
        
        // Should log the error
        expect(consoleSpy.error).toHaveBeenCalled();
      }
    });
    
    it('should extract and use the correct error message in different formats', async () => {
      // Test different error response formats
      const errorFormats = [
        // Standard format
        {
          response: {
            status: 400,
            data: {
              error: {
                message: 'Standard error format'
              }
            }
          }
        },
        // Message at top level
        {
          response: {
            status: 400,
            data: {
              message: 'Top level message'
            }
          }
        },
        // Plain text error
        {
          response: {
            status: 400,
            data: 'Plain text error'
          }
        },
        // Code and message format
        {
          response: {
            status: 400,
            data: {
              code: 'INVALID_ARGUMENT',
              message: 'Code and message format'
            }
          }
        }
      ];
      
      for (const errorFormat of errorFormats) {
        // Reset logs
        consoleSpy.error.mockClear();
        
        // Mock the error
        axios.post.mockRejectedValueOnce(errorFormat);
        
        // Execute and verify error is thrown
        await expect(
          perplexityService.performResearch([{ role: 'user', content: 'Error format test' }])
        ).rejects.toThrow(/Failed to perform research/);
        
        // Should log the error
        expect(consoleSpy.error).toHaveBeenCalled();
      }
    });
  });
  
  describe('Deep Research Options', () => {
    it('should apply maxCitations parameter correctly', async () => {
      // Execute with custom maxCitations
      await perplexityService.performDeepResearch('Citation test', { maxCitations: 25 });
      
      // Get request payload
      const payload = axios.post.mock.calls[0][1];
      
      // Should use the custom maxCitations value
      expect(payload.top_k).toBe(25);
    });
    
    it('should handle empty context option', async () => {
      // Execute with empty context
      await perplexityService.performDeepResearch('Empty context test', { context: '' });
      
      // Get request payload
      const payload = axios.post.mock.calls[0][1];
      const userMessage = payload.messages.find(m => m.role === 'user');
      
      // Should not include context prefix
      expect(userMessage.content).not.toContain('With that context in mind');
      expect(userMessage.content).toContain('Please conduct deep, comprehensive research');
    });
    
    it('should handle long timeout for deep research', async () => {
      // Execute deep research
      await perplexityService.performDeepResearch('Timeout test');
      
      // Get request config
      const config = axios.post.mock.calls[0][2];
      
      // Should have a long timeout
      expect(config.timeout).toBe(180000); // 3 minutes
    });
  });

  describe('Response Processing', () => {
    it('should add model information to the response', async () => {
      // Mock response with model info
      axios.post.mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: 'Plain response without model info'
              }
            }
          ],
          model: 'sonar-pro',
          citations: []
        }
      });
      
      // Execute research
      const result = await perplexityService.performResearch([
        { role: 'user', content: 'Model info test' }
      ]);
      
      // Should add model info at the beginning
      expect(result.response).toMatch(/^\[Using Perplexity AI - Model: sonar-pro\]/);
    });
    
    it('should handle response with no citations', async () => {
      // Mock response with no citations
      axios.post.mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: 'Response with no citations'
              }
            }
          ],
          model: 'sonar',
          // No citations field
        }
      });
      
      // Execute research
      const result = await perplexityService.performResearch([
        { role: 'user', content: 'No citations test' }
      ]);
      
      // Should have empty citations array
      expect(result.citations).toEqual([]);
      
      // Should log warning about no citations
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('No citations returned')
      );
    });
    
    it('should identify and extract model name from response', async () => {
      // Test model name extraction with various formats
      const modelNameVariations = [
        { response: 'sonar', expected: 'sonar' },
        { response: 'sonar-pro', expected: 'sonar-pro' },
        { response: 'llama-3.1-sonar-small-128k-online', expected: 'llama-3.1-sonar-small-128k-online' },
        { response: 'sonar-deep-research', expected: 'sonar-deep-research' }
      ];
      
      for (const variation of modelNameVariations) {
        // Mock response with this model
        axios.post.mockResolvedValueOnce({
          data: {
            choices: [
              {
                message: {
                  content: 'Model test response'
                }
              }
            ],
            model: variation.response,
            citations: []
          }
        });
        
        // Execute research
        const result = await perplexityService.performResearch([
          { role: 'user', content: 'Model test' }
        ]);
        
        // Should extract model name correctly
        expect(result.modelUsed).toBe(variation.response);
        
        // Response should include correct model info
        expect(result.response).toContain(`[Using Perplexity AI - Model: ${variation.response}]`);
      }
    });
  });
});