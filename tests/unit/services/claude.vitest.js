/**
 * Claude Service Unit Tests
 * Tests the Claude AI service component with mocked API responses
 */
import { describe, beforeEach, afterEach, it, expect, vi, beforeAll } from 'vitest';
import { ClaudeService } from '../../../server/services/claude';

// Direct mock of the ClaudeService's client property to test functionality
describe('ClaudeService', () => {
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
              text: 'This is a mock response from Claude. Your question was about something interesting.'
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
  
  describe('initialization', () => {
    it('should initialize with provided API key and model', () => {
      const status = claudeService.getStatus();
      expect(status).toEqual({
        service: 'Claude API',
        status: 'connected',
        lastUsed: null,
        version: mockModel,
        error: undefined
      });
    });
    
    it('should handle missing API key', () => {
      const serviceWithoutKey = new ClaudeService('', mockModel);
      const status = serviceWithoutKey.getStatus();
      
      expect(status.status).toBe('disconnected');
      expect(status.error).toBe('API key not configured');
    });
  });
  
  describe('processConversation', () => {
    it('should process a conversation and return a response', async () => {
      const messages = [
        { role: 'user', content: 'Hello, how are you?' }
      ];
      
      // Set up the mock response
      claudeService.client.messages.create.mockResolvedValueOnce({
        id: 'msg_mock_id',
        content: [
          {
            type: 'text',
            text: 'This is a mock response from Claude. Your question was about greetings.'
          }
        ]
      });
      
      const response = await claudeService.processConversation(messages);
      
      // Verify Anthropic SDK was called with correct parameters
      expect(claudeService.client.messages.create).toHaveBeenCalledWith({
        model: mockModel,
        max_tokens: 1024,
        messages: expect.any(Array),
        system: expect.any(String)
      });
      
      expect(response).toEqual({
        response: 'This is a mock response from Claude. Your question was about greetings.',
        visualizationData: null,
        modelUsed: mockModel
      });
    });
    
    it('should extract visualization data from JSON if present', async () => {
      // Set up the mock response with JSON data
      claudeService.client.messages.create.mockResolvedValueOnce({
        id: 'msg_mock_id',
        content: [
          {
            type: 'text',
            text: 'Here is the visualization you requested:\n\n```json\n{"chartType":"bar","data":{"labels":["A","B","C"],"values":[10,20,30]}}\n```\n\nIs there anything else you need?'
          }
        ]
      });
      
      const messages = [
        { role: 'user', content: 'Generate a bar chart showing A=10, B=20, C=30' }
      ];
      
      const response = await claudeService.processConversation(messages);
      
      expect(response.visualizationData).toEqual({
        chartType: 'bar',
        data: {
          labels: ['A', 'B', 'C'],
          values: [10, 20, 30]
        }
      });
      
      // The JSON code block should be removed from the response
      expect(response.response).not.toContain('```json');
      expect(response.response).not.toContain('chartType');
    });
    
    it('should throw an error when the service is not connected', async () => {
      // Create a disconnected service
      const disconnectedService = new ClaudeService('', mockModel);
      disconnectedService.isConnected = false;
      
      const messages = [
        { role: 'user', content: 'Hello, how are you?' }
      ];
      
      await expect(disconnectedService.processConversation(messages))
        .rejects.toThrow('Claude service is not connected');
    });
    
    it('should handle API errors gracefully', async () => {
      // Mock an API error
      claudeService.client.messages.create.mockRejectedValueOnce(
        new Error('API rate limit exceeded')
      );
      
      const messages = [
        { role: 'user', content: 'Hello, how are you?' }
      ];
      
      await expect(claudeService.processConversation(messages))
        .rejects.toThrow('Failed to process conversation with Claude');
    });
  });
  
  describe('generateVisualization', () => {
    it('should generate an SVG visualization', async () => {
      // Set up mock data
      const data = { labels: ['A', 'B', 'C'], values: [10, 20, 30] };
      const type = 'bar';
      const title = 'Test Chart';
      
      // Set up the mock response with SVG data
      const svgContent = '<svg width="400" height="300"><!-- Test SVG Content --></svg>';
      claudeService.client.messages.create.mockResolvedValueOnce({
        id: 'msg_mock_id',
        content: [
          {
            type: 'text',
            text: svgContent
          }
        ]
      });
      
      const result = await claudeService.generateVisualization(data, type, title);
      
      // Verify the API was called with correct parameters
      expect(claudeService.client.messages.create).toHaveBeenCalledWith({
        model: mockModel,
        max_tokens: 4000,
        messages: expect.any(Array),
        system: expect.any(String)
      });
      
      // Verify the response structure
      expect(result).toEqual({
        svg: svgContent,
        visualizationType: type,
        title,
        description: '',
        modelUsed: mockModel,
        rawData: data
      });
    });
    
    it('should throw an error if SVG generation fails', async () => {
      // Mock an invalid SVG response
      claudeService.client.messages.create.mockResolvedValueOnce({
        id: 'msg_mock_id',
        content: [
          {
            type: 'text',
            text: 'I cannot generate this visualization due to data format issues.'
          }
        ]
      });
      
      await expect(claudeService.generateVisualization({}, 'pie'))
        .rejects.toThrow('Claude did not generate valid SVG visualization');
    });
    
    it('should handle service disconnection', async () => {
      // Create a disconnected service
      const disconnectedService = new ClaudeService('', mockModel);
      disconnectedService.isConnected = false;
      
      await expect(disconnectedService.generateVisualization({}, 'bar'))
        .rejects.toThrow('Claude service is not connected');
    });
  });
});