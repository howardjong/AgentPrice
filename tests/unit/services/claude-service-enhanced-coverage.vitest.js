/**
 * Claude Service Enhanced Coverage Tests
 * 
 * These tests aim to improve coverage for the Claude service by focusing on:
 * - Model extraction and identification
 * - Specialized visualization types
 * - Content block handling
 * - Error handling and edge cases
 * - SVG validation and processing
 */
import { describe, beforeEach, afterEach, it, expect, vi, beforeAll } from 'vitest';
import { ClaudeService } from '../../../server/services/claude';

describe('ClaudeService Enhanced Coverage', () => {
  let claudeService;
  const mockApiKey = 'mock-api-key';
  const mockModel = 'claude-3-7-sonnet-20250219';
  
  // Console mocks to reduce test noise
  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create a fresh instance for each test
    claudeService = new ClaudeService(mockApiKey, mockModel);
    
    // Mock the client directly after instantiation
    claudeService.client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          id: 'msg_mock_id',
          content: [
            {
              type: 'text',
              text: 'This is a mock response from Claude.'
            }
          ]
        })
      }
    };
    
    // Force the connected state
    claudeService.isConnected = true;
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialization error handling', () => {
    it('should handle errors during initialization', () => {
      // Mock the Anthropic constructor to throw an error
      const originalAnthropicModule = require('@anthropic-ai/sdk');
      const mockAnthropicConstructor = vi.fn().mockImplementation(() => {
        throw new Error('Failed to initialize client');
      });
      
      // Replace the original module with our mock
      vi.mock('@anthropic-ai/sdk', () => ({
        default: mockAnthropicConstructor
      }));
      
      // Create a new service instance which should catch the error
      const service = new ClaudeService(mockApiKey, mockModel);
      
      // Verify the service is marked as disconnected
      expect(service.isConnected).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize Claude service'),
        expect.any(Error)
      );
      
      // Restore the original module
      vi.unmock('@anthropic-ai/sdk');
    });
  });

  describe('Model Extraction and Identification', () => {
    it('should extract model information from SVG comments', async () => {
      // Mock SVG with model comment
      const svgWithModel = '<svg width="400" height="300"><!-- Test SVG Content --></svg><!-- model: claude-3-5-sonnet-20250117 -->';
      
      // Setup mock with this SVG response
      claudeService.client.messages.create.mockResolvedValueOnce({
        id: 'msg_mock_id',
        content: [
          {
            type: 'text',
            text: svgWithModel
          }
        ]
      });
      
      // Execute
      const result = await claudeService.generateVisualization({}, 'bar');
      
      // Verify model extraction
      expect(result.modelUsed).toBe('claude-3-5-sonnet-20250117');
      // Verify model comment is removed
      expect(result.svg).not.toContain('<!-- model:');
    });
    
    it('should handle severe model mismatch', async () => {
      // Mock SVG with a completely different model
      const svgWithDifferentModel = '<svg width="400" height="300"><!-- Test SVG Content --></svg><!-- model: claude-2-100k -->';
      
      // Setup mock with this SVG response
      claudeService.client.messages.create.mockResolvedValueOnce({
        id: 'msg_mock_id',
        content: [
          {
            type: 'text',
            text: svgWithDifferentModel
          }
        ]
      });
      
      // Execute
      const result = await claudeService.generateVisualization({}, 'bar');
      
      // Verify model extraction
      expect(result.modelUsed).toBe('claude-2-100k');
      
      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Serious model mismatch'),
        expect.any(Object)
      );
      
      // Verify warning comment was added to SVG
      expect(result.svg).toContain('⚠️ SERIOUS MODEL MISMATCH');
    });
    
    it('should handle minor model version mismatch', async () => {
      // Mock SVG with a minor model version difference
      const svgWithVersionDiff = '<svg width="400" height="300"><!-- Test SVG Content --></svg><!-- model: claude-3-7-sonnet-20250101 -->';
      
      // Setup mock with this SVG response
      claudeService.client.messages.create.mockResolvedValueOnce({
        id: 'msg_mock_id',
        content: [
          {
            type: 'text',
            text: svgWithVersionDiff
          }
        ]
      });
      
      // Execute
      const result = await claudeService.generateVisualization({}, 'bar');
      
      // Verify model extraction
      expect(result.modelUsed).toBe('claude-3-7-sonnet-20250101');
      
      // Verify info was logged
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Model version mismatch'),
        expect.any(Object)
      );
      
      // Verify subtle comment was added to SVG
      expect(result.svg).toContain('Note: Using Claude claude-3-7-sonnet');
    });
  });

  describe('Specialized Visualization Types', () => {
    it('should use special prompt for Van Westendorp price sensitivity visualization', async () => {
      // Mock data for the visualization
      const testData = {
        pricePoints: [10, 20, 30, 40, 50],
        responses: {
          tooExpensive: [0, 10, 30, 70, 90],
          expensiveButReasonable: [5, 30, 60, 40, 10],
          goodValue: [90, 70, 30, 15, 5],
          tooCheap: [80, 50, 20, 5, 0]
        }
      };
      
      // Execute with Van Westendorp type
      await claudeService.generateVisualization(testData, 'van_westendorp');
      
      // Get request payload
      const requestPayload = claudeService.client.messages.create.mock.calls[0][0];
      
      // Extract the prompt from messages
      const prompt = requestPayload.messages[0].content;
      
      // Verify Van Westendorp specific content
      expect(prompt).toContain('Van Westendorp Price Sensitivity');
      expect(prompt).toContain('Too Expensive (Red Line)');
      expect(prompt).toContain('Optimal Price Point (OPP)');
    });
    
    it('should use special prompt for Conjoint Analysis visualization', async () => {
      // Mock data for the visualization
      const testData = {
        attributes: [
          { name: 'Brand', levels: ['Brand A', 'Brand B', 'Brand C'] },
          { name: 'Price', levels: ['$10', '$20', '$30'] },
          { name: 'Features', levels: ['Basic', 'Standard', 'Premium'] }
        ],
        utilities: [
          { attribute: 'Brand', level: 'Brand A', utility: 0.5 },
          { attribute: 'Brand', level: 'Brand B', utility: 0.3 },
          { attribute: 'Brand', level: 'Brand C', utility: 0.2 },
          { attribute: 'Price', level: '$10', utility: 0.7 },
          { attribute: 'Price', level: '$20', utility: 0.2 },
          { attribute: 'Price', level: '$30', utility: 0.1 },
          { attribute: 'Features', level: 'Basic', utility: 0.1 },
          { attribute: 'Features', level: 'Standard', utility: 0.3 },
          { attribute: 'Features', level: 'Premium', utility: 0.6 }
        ]
      };
      
      // Execute with Conjoint type
      await claudeService.generateVisualization(testData, 'conjoint');
      
      // Get request payload
      const requestPayload = claudeService.client.messages.create.mock.calls[0][0];
      
      // Extract the prompt from messages
      const prompt = requestPayload.messages[0].content;
      
      // Verify Conjoint specific content
      expect(prompt).toContain('Conjoint Analysis visualization');
      expect(prompt).toContain('relative importance or utility scores');
      expect(prompt).toContain('attributes by importance');
    });
  });

  describe('Content Block Handling', () => {
    it('should handle empty content arrays gracefully', async () => {
      // Mock response with empty content array
      claudeService.client.messages.create.mockResolvedValueOnce({
        id: 'msg_mock_id',
        content: [] // Empty content array
      });
      
      // Execute and verify exception is thrown
      await expect(claudeService.processConversation([{ role: 'user', content: 'test' }]))
        .rejects.toThrow();
    });
    
    it('should handle non-text content blocks', async () => {
      // Mock response with a non-text content block
      claudeService.client.messages.create.mockResolvedValueOnce({
        id: 'msg_mock_id',
        content: [
          {
            type: 'image', // Not a text block
            source: { 
              type: 'base64', 
              media_type: 'image/png', 
              data: 'base64data' 
            }
          }
        ]
      });
      
      // Execute and verify exception is thrown
      await expect(claudeService.processConversation([{ role: 'user', content: 'test' }]))
        .rejects.toThrow();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle rate limit errors appropriately', async () => {
      // Mock a rate limit error with retry header
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;
      rateLimitError.headers = {
        'retry-after': '5'
      };
      
      claudeService.client.messages.create.mockRejectedValueOnce(rateLimitError);
      
      // Execute and verify the error handling
      await expect(claudeService.processConversation([{ role: 'user', content: 'test' }]))
        .rejects.toThrow(/failed to process conversation/i);
      
      // Verify appropriate logging
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing conversation with Claude'),
        expect.anything()
      );
    });
    
    it('should handle network timeouts', async () => {
      // Mock a timeout error
      const timeoutError = new Error('Request timed out');
      timeoutError.code = 'ETIMEDOUT';
      
      claudeService.client.messages.create.mockRejectedValueOnce(timeoutError);
      
      // Execute and verify the error handling
      await expect(claudeService.processConversation([{ role: 'user', content: 'test' }]))
        .rejects.toThrow(/failed to process conversation/i);
      
      // Verify appropriate logging
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing conversation with Claude'),
        expect.anything()
      );
    });
    
    it('should handle authentication errors', async () => {
      // Mock an authentication error
      const authError = new Error('Invalid API key');
      authError.status = 401;
      
      claudeService.client.messages.create.mockRejectedValueOnce(authError);
      
      // Execute and verify the error handling
      await expect(claudeService.processConversation([{ role: 'user', content: 'test' }]))
        .rejects.toThrow(/failed to process conversation/i);
      
      // Verify appropriate logging
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing conversation with Claude'),
        expect.anything()
      );
    });
  });

  describe('SVG Validation and Processing', () => {
    it('should detect and reject malformed SVG content', async () => {
      // Mock response with broken SVG (missing closing tag)
      claudeService.client.messages.create.mockResolvedValueOnce({
        id: 'msg_mock_id',
        content: [{ 
          type: 'text',
          text: '<svg width="400" height="300"><rect x="10" y="10" width="50" height="50">' 
        }]
      });
      
      // Execute and verify exception
      await expect(claudeService.generateVisualization({}, 'bar'))
        .rejects.toThrow('Claude did not generate valid SVG visualization');
    });
    
    it('should handle SVG with minimal valid content', async () => {
      // Mock response with minimal valid SVG
      const minimalValidSVG = '<svg></svg>';
      claudeService.client.messages.create.mockResolvedValueOnce({
        id: 'msg_mock_id',
        content: [{ 
          type: 'text',
          text: minimalValidSVG
        }]
      });
      
      // Execute and verify result
      const result = await claudeService.generateVisualization({}, 'bar');
      
      // Should accept minimal valid SVG
      expect(result.svg).toBe(minimalValidSVG);
    });
    
    it('should handle SVG with text before and after', async () => {
      // Mock response with text before and after SVG
      claudeService.client.messages.create.mockResolvedValueOnce({
        id: 'msg_mock_id',
        content: [{ 
          type: 'text',
          text: 'Here is your visualization:\n\n<svg width="400" height="300"></svg>\n\nIs this what you wanted?'
        }]
      });
      
      // Execute and verify exception (since not pure SVG)
      await expect(claudeService.generateVisualization({}, 'bar'))
        .rejects.toThrow('Claude did not generate valid SVG visualization');
    });
  });

  describe('JSON visualization data processing', () => {
    it('should extract and parse JSON visualization data', async () => {
      // Mock response with JSON data
      const responseWithJson = 'Here is the visualization data:\n\n```json\n{"chartType":"bar","data":{"labels":["A","B","C"],"values":[10,20,30]}}\n```\n\nIs this what you needed?';
      
      claudeService.client.messages.create.mockResolvedValueOnce({
        id: 'msg_mock_id',
        content: [{ 
          type: 'text',
          text: responseWithJson
        }]
      });
      
      // Execute
      const result = await claudeService.processConversation([{ role: 'user', content: 'test' }]);
      
      // Verify JSON data extraction
      expect(result.visualizationData).toEqual({
        chartType: 'bar',
        data: {
          labels: ['A', 'B', 'C'],
          values: [10, 20, 30]
        }
      });
      
      // Verify JSON block was removed from response
      expect(result.response).not.toContain('```json');
      expect(result.response).toContain('Here is the visualization data:');
      expect(result.response).toContain('Is this what you needed?');
    });
    
    it('should handle invalid JSON in code blocks', async () => {
      // Mock response with invalid JSON
      const responseWithInvalidJson = 'Here is the visualization data:\n\n```json\n{"chartType":"bar",malformed:json}\n```';
      
      claudeService.client.messages.create.mockResolvedValueOnce({
        id: 'msg_mock_id',
        content: [{ 
          type: 'text',
          text: responseWithInvalidJson
        }]
      });
      
      // Execute
      const result = await claudeService.processConversation([{ role: 'user', content: 'test' }]);
      
      // Verify error handling (should not extract JSON)
      expect(result.visualizationData).toBe(null);
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse visualization data'),
        expect.any(Error)
      );
      
      // Verify original response is preserved
      expect(result.response).toBe(responseWithInvalidJson);
    });
  });
});