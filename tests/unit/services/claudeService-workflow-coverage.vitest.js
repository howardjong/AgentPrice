/**
 * Claude Service Workflow Coverage Tests
 * 
 * These tests aim to improve coverage for the claudeService.js implementation,
 * focusing on the functions actually used in the single-query-workflow:
 * - processText
 * - processMultimodal
 * - processConversation
 * - generatePlotlyVisualization
 * 
 * This file complements the existing claude-service-enhanced-coverage.vitest.js
 * which focuses on the newer claude.ts implementation.
 */

import { describe, beforeEach, afterEach, it, expect, vi, beforeAll } from 'vitest';
import claudeService from '../../../services/claudeService.js';

// Import mocked modules to use in tests
import anthropicSdk from '@anthropic-ai/sdk';
import costTracker from '../../../utils/costTracker.js';
import promptManager from '../../../services/promptManager.js';
import CircuitBreaker from '../../../utils/circuitBreaker.js';

// Mock dependencies
vi.mock('@anthropic-ai/sdk', () => {
  const mockMessages = {
    create: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Mock response from Claude' }],
      usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
      model: 'claude-3-7-sonnet-20250219'
    })
  };
  
  return {
    default: function Anthropic() {
      return {
        messages: mockMessages
      };
    }
  };
});

vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../utils/circuitBreaker.js', () => {
  return {
    default: function CircuitBreaker() {
      return {
        execute: vi.fn((fn) => fn()),
        getState: vi.fn().mockReturnValue('CLOSED')
      };
    }
  };
});

vi.mock('../../../utils/apiClient.js', () => {
  return {
    default: function RobustAPIClient() {
      return {
        execute: vi.fn((fn) => fn())
      };
    }
  };
});

vi.mock('../../../utils/costTracker.js', () => ({
  default: {
    trackAPIUsage: vi.fn()
  }
}));

vi.mock('../../../services/promptManager.js', () => ({
  default: {
    getPrompt: vi.fn().mockResolvedValue('Mock prompt template')
  }
}));

describe('Claude Service Workflow Coverage Tests', () => {
  // Console mocks to reduce test noise
  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset mocks after each test
    vi.clearAllMocks();
  });

  describe('processText Function', () => {
    it('should process text with Claude AI', async () => {
      // Execute the function
      const result = await claudeService.processText('Test prompt');
      
      // Verify the result structure
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('requestId');
      
      // Verify the content
      expect(result.content).toBe('Mock response from Claude');
    });
    
    it('should use custom options when provided', async () => {
      // Setup spy on anthropic client
      const anthropicClientSpy = vi.spyOn(require('@anthropic-ai/sdk').default().messages, 'create');
      
      // Custom options
      const options = {
        model: 'claude-3-7-haiku-20250219',
        maxTokens: 2000,
        temperature: 0.5
      };
      
      // Execute with custom options
      await claudeService.processText('Test prompt with options', options);
      
      // Verify options were passed to the API
      expect(anthropicClientSpy).toHaveBeenCalledWith(expect.objectContaining({
        model: options.model,
        max_tokens: options.maxTokens,
        temperature: options.temperature
      }));
    });
    
    it('should handle API errors gracefully', async () => {
      // Setup the API to throw an error
      const mockError = new Error('API Error');
      require('@anthropic-ai/sdk').default().messages.create.mockRejectedValueOnce(mockError);
      
      // Execute and expect error
      await expect(claudeService.processText('Test prompt')).rejects.toThrow('Claude processing failed');
    });
  });

  describe('processMultimodal Function', () => {
    it('should process multimodal content', async () => {
      // Setup multimodal content
      const multimodalContent = [
        { type: 'text', text: "What's in this image?" },
        { 
          type: 'image', 
          source: { 
            type: 'base64', 
            media_type: 'image/jpeg',
            data: 'base64encodedimagedatagoeshere'
          }
        }
      ];
      
      // Execute the function
      const result = await claudeService.processMultimodal(multimodalContent);
      
      // Verify the result structure
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('requestId');
    });
    
    it('should validate multimodal content is an array', async () => {
      // Try with non-array content
      await expect(claudeService.processMultimodal('not an array'))
        .rejects.toThrow('Content must be an array of content objects');
    });
    
    it('should track costs with multimodal flag', async () => {
      // Setup spy on cost tracker
      const costTrackerSpy = vi.spyOn(require('../../../utils/costTracker.js'), 'trackAPIUsage');
      
      // Setup multimodal content
      const multimodalContent = [
        { type: 'text', text: "What's in this image?" },
        { 
          type: 'image', 
          source: { 
            type: 'base64', 
            media_type: 'image/jpeg',
            data: 'base64encodedimagedatagoeshere'
          }
        }
      ];
      
      // Execute the function
      await claudeService.processMultimodal(multimodalContent);
      
      // Verify cost tracking called with isMultimodal flag
      expect(costTrackerSpy).toHaveBeenCalledWith(expect.objectContaining({
        isMultimodal: true
      }));
    });
    
    it('should handle errors in multimodal processing', async () => {
      // Setup the API to throw an error
      const mockError = new Error('Multimodal API Error');
      require('@anthropic-ai/sdk').default().messages.create.mockRejectedValueOnce(mockError);
      
      // Execute and expect error
      await expect(claudeService.processMultimodal([{ type: 'text', text: 'Test' }]))
        .rejects.toThrow('Claude multimodal processing failed');
    });
    
    it('should handle content with different types', async () => {
      // Setup multimodal content with multiple types
      const mixedContent = [
        { type: 'text', text: "What's in these images?" },
        { 
          type: 'image', 
          source: { 
            type: 'base64', 
            media_type: 'image/jpeg',
            data: 'first-image-data'
          }
        },
        { type: 'text', text: "And also this one:" },
        { 
          type: 'image', 
          source: { 
            type: 'base64', 
            media_type: 'image/png',
            data: 'second-image-data'
          }
        }
      ];
      
      // Execute the function
      const result = await claudeService.processMultimodal(mixedContent);
      
      // Verify it was processed correctly
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('requestId');
    });
  });

  describe('processConversation Function', () => {
    it('should process a conversation with Claude AI', async () => {
      // Setup conversation messages
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there! How can I help you?' },
        { role: 'user', content: 'Tell me about AI' }
      ];
      
      // Execute the function
      const result = await claudeService.processConversation(messages);
      
      // Verify the result structure
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('requestId');
    });
    
    it('should include system prompt when provided', async () => {
      // Setup spy on anthropic client
      const anthropicClientSpy = vi.spyOn(require('@anthropic-ai/sdk').default().messages, 'create');
      
      // Setup conversation with system prompt
      const messages = [{ role: 'user', content: 'Hello' }];
      const options = {
        systemPrompt: 'You are a helpful AI assistant'
      };
      
      // Execute the function
      await claudeService.processConversation(messages, options);
      
      // Verify system prompt was included
      expect(anthropicClientSpy).toHaveBeenCalledWith(expect.objectContaining({
        system: options.systemPrompt
      }));
    });
    
    it('should validate messages is an array', async () => {
      // Try with non-array messages
      await expect(claudeService.processConversation('not an array'))
        .rejects.toThrow('Messages must be an array of message objects');
    });
    
    it('should handle API errors in conversations', async () => {
      // Setup the API to throw an error
      const mockError = new Error('Conversation API Error');
      require('@anthropic-ai/sdk').default().messages.create.mockRejectedValueOnce(mockError);
      
      // Execute and expect error
      await expect(claudeService.processConversation([{ role: 'user', content: 'Hello' }]))
        .rejects.toThrow('Claude conversation processing failed');
    });
    
    it('should process different types of conversation flows', async () => {
      // Setup conversation with multiple back-and-forth exchanges
      const complexConversation = [
        { role: 'user', content: 'What is machine learning?' },
        { role: 'assistant', content: 'Machine learning is a branch of artificial intelligence...' },
        { role: 'user', content: 'Can you give an example?' },
        { role: 'assistant', content: 'Sure! A common example is image recognition...' },
        { role: 'user', content: 'Are there any risks?' }
      ];
      
      // Execute the function
      const result = await claudeService.processConversation(complexConversation);
      
      // Verify it was processed correctly
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('requestId');
    });
    
    it('should work with custom model and temperature options', async () => {
      // Setup spy on anthropic client
      const anthropicClientSpy = vi.spyOn(require('@anthropic-ai/sdk').default().messages, 'create');
      
      // Setup conversation with custom options
      const messages = [{ role: 'user', content: 'Hello' }];
      const options = {
        model: 'claude-3-7-haiku-20250219',
        temperature: 0.3,
        maxTokens: 500
      };
      
      // Execute the function
      await claudeService.processConversation(messages, options);
      
      // Verify options were passed to the API
      expect(anthropicClientSpy).toHaveBeenCalledWith(expect.objectContaining({
        model: options.model,
        temperature: options.temperature,
        max_tokens: options.maxTokens
      }));
    });
  });

  describe('generatePlotlyVisualization Function', () => {
    it('should generate Plotly visualization configuration', async () => {
      // Mock the Anthropic response with a valid JSON visualization
      require('@anthropic-ai/sdk').default().messages.create.mockResolvedValueOnce({
        content: [{ 
          type: 'text', 
          text: `\`\`\`json
{
  "plotlyConfig": {
    "data": [{"x": ["A", "B", "C"], "y": [10, 20, 30], "type": "bar"}],
    "layout": {"title": "Test Chart"},
    "config": {"responsive": true}
  },
  "insights": ["Insight 1", "Insight 2"],
  "modelUsed": "claude-3-7-sonnet-20250219"
}
\`\`\``
        }],
        model: 'claude-3-7-sonnet-20250219'
      });
      
      // Data to visualize
      const data = { values: [10, 20, 30], labels: ['A', 'B', 'C'] };
      
      // Execute the function
      const result = await claudeService.generatePlotlyVisualization(
        data, 
        'bar', 
        'Test Chart', 
        'Test Description'
      );
      
      // Verify the result structure
      expect(result).toHaveProperty('plotlyConfig');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('modelUsed');
      
      // Verify plotly config
      expect(result.plotlyConfig).toHaveProperty('data');
      expect(result.plotlyConfig).toHaveProperty('layout');
      expect(result.plotlyConfig).toHaveProperty('config');
      
      // Verify insights
      expect(result.insights).toBeInstanceOf(Array);
      expect(result.insights).toContain('Insight 1');
    });
    
    it('should extract JSON content from different code block formats', async () => {
      // Mock the Anthropic response with alternative JSON format
      require('@anthropic-ai/sdk').default().messages.create.mockResolvedValueOnce({
        content: [{ 
          type: 'text', 
          text: `Here's your visualization configuration:

\`\`\`
{
  "plotlyConfig": {
    "data": [{"x": ["A", "B", "C"], "y": [10, 20, 30], "type": "bar"}],
    "layout": {"title": "Different Format Chart"},
    "config": {"responsive": true}
  },
  "insights": ["Different format insight"],
  "modelUsed": "claude-3-7-sonnet-20250219"
}
\`\`\`

Let me know if you need anything else!`
        }],
        model: 'claude-3-7-sonnet-20250219'
      });
      
      // Data to visualize
      const data = { values: [10, 20, 30], labels: ['A', 'B', 'C'] };
      
      // Execute the function
      const result = await claudeService.generatePlotlyVisualization(
        data, 
        'bar', 
        'Different Format Chart', 
        'Testing different JSON extraction'
      );
      
      // Verify the result has the correct data
      expect(result.plotlyConfig.layout.title).toBe('Different Format Chart');
      expect(result.insights[0]).toBe('Different format insight');
    });
    
    it('should add special fields for Van Westendorp chart type', async () => {
      // Mock the Anthropic response with a partial JSON visualization (missing pricePoints)
      require('@anthropic-ai/sdk').default().messages.create.mockResolvedValueOnce({
        content: [{ 
          type: 'text', 
          text: `\`\`\`json
{
  "plotlyConfig": {
    "data": [{"x": [10, 20, 30, 40], "y": [0.1, 0.3, 0.6, 0.9], "name": "Too Expensive", "type": "scatter"}],
    "layout": {"title": "Van Westendorp Price Sensitivity Analysis"},
    "config": {"responsive": true}
  },
  "insights": ["The optimal price point appears to be around $25."]
}
\`\`\``
        }],
        model: 'claude-3-7-sonnet-20250219'
      });
      
      // Van Westendorp data
      const data = {
        pricePoints: [10, 20, 30, 40],
        tooExpensive: [0.1, 0.3, 0.6, 0.9],
        tooCheap: [0.9, 0.6, 0.3, 0.1],
        priceExpectation: [0.2, 0.5, 0.8, 0.5]
      };
      
      // Execute the function
      const result = await claudeService.generatePlotlyVisualization(
        data, 
        'van_westendorp', 
        'Price Sensitivity', 
        'Analysis of price sensitivity'
      );
      
      // Verify pricePoints is added to the result
      expect(result).toHaveProperty('pricePoints');
      expect(result.pricePoints).toHaveProperty('optimalPrice');
      expect(result.pricePoints).toHaveProperty('indifferencePrice');
      expect(result.pricePoints).toHaveProperty('pointOfMarginalExpensiveness');
      expect(result.pricePoints).toHaveProperty('pointOfMarginalCheapness');
    });
    
    it('should add special fields for Conjoint Analysis chart type', async () => {
      // Mock the Anthropic response with a partial JSON visualization (missing optimalCombination)
      require('@anthropic-ai/sdk').default().messages.create.mockResolvedValueOnce({
        content: [{ 
          type: 'text', 
          text: `\`\`\`json
{
  "plotlyConfig": {
    "data": [{"x": ["Brand A", "Brand B", "Brand C"], "y": [0.5, 0.3, 0.2], "type": "bar"}],
    "layout": {"title": "Conjoint Analysis"},
    "config": {"responsive": true}
  },
  "insights": ["Brand A has the highest utility."]
}
\`\`\``
        }],
        model: 'claude-3-7-sonnet-20250219'
      });
      
      // Conjoint analysis data
      const data = {
        attributes: [
          { name: 'Brand', levels: ['Brand A', 'Brand B', 'Brand C'] },
          { name: 'Price', levels: ['$10', '$20', '$30'] }
        ],
        utilities: [
          { attribute: 'Brand', level: 'Brand A', utility: 0.5 },
          { attribute: 'Brand', level: 'Brand B', utility: 0.3 },
          { attribute: 'Brand', level: 'Brand C', utility: 0.2 },
          { attribute: 'Price', level: '$10', utility: 0.7 },
          { attribute: 'Price', level: '$20', utility: 0.2 },
          { attribute: 'Price', level: '$30', utility: 0.1 }
        ]
      };
      
      // Execute the function
      const result = await claudeService.generatePlotlyVisualization(
        data, 
        'conjoint', 
        'Conjoint Analysis', 
        'Analysis of product preferences'
      );
      
      // Verify optimalCombination is added to the result
      expect(result).toHaveProperty('optimalCombination');
    });
    
    it('should load a specialized prompt template for the visualization type', async () => {
      // Setup spy on prompt manager
      const promptManagerSpy = vi.spyOn(require('../../../services/promptManager.js').default, 'getPrompt');
      
      // Execute the function (to trigger prompt loading)
      try {
        await claudeService.generatePlotlyVisualization(
          { values: [10, 20, 30] }, 
          'pie', 
          'Pie Chart Test', 
          'Testing prompt loading'
        );
      } catch (error) {
        // Ignore errors, we just want to check prompt loading
      }
      
      // Verify prompt was loaded for the right type
      expect(promptManagerSpy).toHaveBeenCalledWith('claude', 'visualization/plotly/pie');
    });
    
    it('should track costs with appropriate purpose tag', async () => {
      // Setup spy on cost tracker
      const costTrackerSpy = vi.spyOn(require('../../../utils/costTracker.js'), 'trackAPIUsage');
      
      // Mock a basic response
      require('@anthropic-ai/sdk').default().messages.create.mockResolvedValueOnce({
        content: [{ 
          type: 'text', 
          text: `\`\`\`json
{
  "plotlyConfig": { "data": [], "layout": {}, "config": {} },
  "insights": []
}
\`\`\``
        }],
        model: 'claude-3-7-sonnet-20250219',
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 }
      });
      
      // Execute the function
      await claudeService.generatePlotlyVisualization(
        { values: [1, 2, 3] }, 
        'bar', 
        'Cost Tracking Test', 
        'Testing cost tracking'
      );
      
      // Verify cost tracking was called with visualization purpose
      expect(costTrackerSpy).toHaveBeenCalledWith(expect.objectContaining({
        purpose: 'visualization'
      }));
    });
    
    it('should handle JSON parsing errors gracefully', async () => {
      // Mock the Anthropic response with invalid JSON
      require('@anthropic-ai/sdk').default().messages.create.mockResolvedValueOnce({
        content: [{ 
          type: 'text', 
          text: `\`\`\`json
{
  "plotlyConfig": {
    "data": [{"x": ["A", "B", "C"], "y": [10, 20, 30], "type": "bar"}],
    "layout": {"title": "Test Chart"}, this is invalid JSON
    "config": {"responsive": true}
  },
  "insights": ["Insight 1", "Insight 2"],
  "modelUsed": "claude-3-7-sonnet-20250219"
}
\`\`\``
        }],
        model: 'claude-3-7-sonnet-20250219'
      });
      
      // Data to visualize
      const data = { values: [10, 20, 30], labels: ['A', 'B', 'C'] };
      
      // Execute and expect an error
      await expect(claudeService.generatePlotlyVisualization(
        data, 
        'bar', 
        'Test Chart', 
        'Test Description'
      )).rejects.toThrow('Failed to parse visualization response');
    });
    
    it('should handle API errors in visualization generation', async () => {
      // Setup the API to throw an error
      const mockError = new Error('Visualization API Error');
      require('@anthropic-ai/sdk').default().messages.create.mockRejectedValueOnce(mockError);
      
      // Execute and expect error
      await expect(claudeService.generatePlotlyVisualization(
        { test: 'data' }, 
        'bar', 
        'Error Test', 
        'Testing error handling'
      )).rejects.toThrow('Plotly visualization generation failed');
    });
  });

  describe('getHealthStatus Function', () => {
    it('should provide service health status', () => {
      // Execute the function
      const status = claudeService.getHealthStatus();
      
      // Verify the status structure
      expect(status).toHaveProperty('service', 'claude');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('circuitBreakerStatus');
      expect(status).toHaveProperty('defaultModel');
    });
    
    it('should report unavailable status when API key is missing', () => {
      // Save original env
      const originalEnv = process.env.ANTHROPIC_API_KEY;
      
      // Remove API key
      delete process.env.ANTHROPIC_API_KEY;
      
      // Execute the function
      const status = claudeService.getHealthStatus();
      
      // Verify status shows unavailable
      expect(status.status).toBe('unavailable');
      
      // Restore env
      process.env.ANTHROPIC_API_KEY = originalEnv;
    });
    
    it('should report circuit breaker status correctly', () => {
      // Force circuit breaker to be open temporarily by mocking
      const circuitBreaker = require('../../../utils/circuitBreaker.js').default;
      const originalIsOpen = circuitBreaker.prototype.isOpen;
      
      // Mock isOpen to return true
      circuitBreaker.prototype.isOpen = vi.fn().mockReturnValue(true);
      
      // Get status with circuit breaker open
      const statusWithOpenCircuit = claudeService.getHealthStatus();
      
      // Verify circuit breaker status is reported
      expect(statusWithOpenCircuit.circuitBreakerStatus).toBe('open');
      
      // Restore original method
      circuitBreaker.prototype.isOpen = originalIsOpen;
      
      // Get status with normal circuit breaker
      const statusWithClosedCircuit = claudeService.getHealthStatus();
      
      // Verify circuit breaker status is closed
      expect(statusWithClosedCircuit.circuitBreakerStatus).toBe('closed');
    });
    
    it('should include default model in health status', () => {
      // Save original config
      const originalModel = process.env.CLAUDE_DEFAULT_MODEL;
      
      // Set a test model
      process.env.CLAUDE_DEFAULT_MODEL = 'claude-test-model';
      
      // Get status with test model
      const status = claudeService.getHealthStatus();
      
      // Verify model is reported correctly
      expect(status.defaultModel).toBe('claude-test-model');
      
      // Restore original config
      process.env.CLAUDE_DEFAULT_MODEL = originalModel;
    });
    
    it('should include request queue status if available', () => {
      // If the service has a request queue, check its status is included
      const status = claudeService.getHealthStatus();
      
      // For services with request queues, this should exist
      if ('requestQueueSize' in status) {
        expect(typeof status.requestQueueSize).toBe('number');
      }
    });
  });
});