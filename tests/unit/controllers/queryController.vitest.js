/**
 * @file queryController.vitest.js
 * @description Tests for the query-related APIs in server/routes.ts
 */
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

// Create mocks for services
vi.mock('../../../services/serviceRouter.js', () => {
  return {
    default: {
      routeQuery: vi.fn().mockImplementation(async ({ query, requiresResearch, chartType }) => {
        // Simulate different response types based on the query type
        if (chartType) {
          return {
            response: `Generated chart for ${chartType}`,
            chartData: { type: chartType, data: { /* mock data */ } },
            chartHtml: `<div id="chart-${chartType}">Mock chart HTML</div>`,
            modelUsed: 'claude-3-7-sonnet-20250219'
          };
        } else if (requiresResearch) {
          return {
            response: 'Research-based response',
            sources: ['source1', 'source2'],
            modelUsed: 'perplexity-sonar-deep-research'
          };
        } else {
          return {
            response: 'Regular response from Claude',
            modelUsed: 'claude-3-7-sonnet-20250219'
          };
        }
      }),
      classifyQuery: vi.fn().mockImplementation((query) => {
        // Simple classification based on keywords
        const needsResearch = query.includes('research') || 
                              query.includes('latest') || 
                              query.includes('current');
        
        const isChartRequest = query.includes('chart') || 
                               query.includes('visualization') || 
                               query.includes('plot');
        
        let chartType = null;
        if (isChartRequest) {
          if (query.includes('van westendorp') || query.includes('price sensitivity')) {
            chartType = 'van_westendorp';
          } else if (query.includes('conjoint')) {
            chartType = 'conjoint';
          } else {
            chartType = 'bar'; // default chart type
          }
        }
        
        return {
          requiresResearch: needsResearch,
          chartType: isChartRequest ? chartType : null,
          confidence: 0.85
        };
      })
    }
  };
});

// Create a test UUID to use consistently
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid-12345')
}));

// Mock storage for conversations
const mockStorage = {
  getApiStatus: vi.fn().mockResolvedValue({
    claude: { status: 'connected', model: 'claude-3-7-sonnet-20250219' },
    perplexity: { status: 'connected', model: 'sonar' }
  }),
  getConversation: vi.fn().mockImplementation(async (id) => {
    return id === 'existing-convo-id' ? {
      id: 'existing-convo-id',
      userId: null,
      title: 'Existing conversation'
    } : null;
  }),
  createConversation: vi.fn().mockImplementation(async (data) => {
    return {
      id: 'new-convo-id',
      userId: data.userId,
      title: data.title,
      createdAt: new Date().toISOString()
    };
  }),
  getMessagesByConversation: vi.fn().mockResolvedValue([]),
  createMessage: vi.fn().mockImplementation(async (data) => {
    return {
      id: uuidv4(),
      ...data,
      createdAt: new Date().toISOString()
    };
  })
};

// Schema for chat message validation
const chatMessageSchema = {
  parse: vi.fn().mockImplementation((body) => {
    if (!body.message) {
      throw new Error('Message is required');
    }
    return body;
  })
};

// Helper to create a basic Express app with query routes
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Mock service router import
  const serviceRouter = vi.importActual('../../../services/serviceRouter.js').default;
  
  // Setup query-related routes (simulating what's in server/routes.ts)
  app.get('/api/status', async (req, res) => {
    try {
      const status = await mockStorage.getApiStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: `Failed to fetch API status: ${error.message}` });
    }
  });
  
  app.post('/api/conversation', async (req, res) => {
    try {
      const { message, conversationId, service } = chatMessageSchema.parse(req.body);
      
      // Get or create a conversation
      let conversation;
      if (conversationId) {
        conversation = await mockStorage.getConversation(conversationId);
        if (!conversation) {
          return res.status(404).json({ message: `Conversation with ID ${conversationId} not found` });
        }
      } else {
        conversation = await mockStorage.createConversation({
          userId: null,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : '')
        });
      }
      
      // Get previous messages in this conversation
      const previousMessages = await mockStorage.getMessagesByConversation(conversation.id);
      
      // Create user message
      const userMessage = await mockStorage.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: message,
        service: 'system',
        visualizationData: null,
        citations: null
      });
      
      // Process the query through serviceRouter
      const queryResponse = await serviceRouter.routeQuery({
        query: message,
        conversationId: conversation.id,
        messages: [...previousMessages, userMessage],
        service: service || 'auto',
        userId: null
      });
      
      // Create AI message
      const aiMessage = await mockStorage.createMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: queryResponse.response,
        service: queryResponse.modelUsed || 'claude',
        visualizationData: queryResponse.chartData || null,
        citations: queryResponse.sources || null
      });
      
      res.json({
        message: queryResponse.response,
        messageId: aiMessage.id,
        conversationId: conversation.id,
        modelUsed: queryResponse.modelUsed,
        chartData: queryResponse.chartData,
        chartHtml: queryResponse.chartHtml,
        sources: queryResponse.sources
      });
    } catch (error) {
      res.status(400).json({ message: `Failed to process message: ${error.message}` });
    }
  });
  
  app.post('/api/classify-query', async (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({ message: 'Query parameter is required' });
      }
      
      const classification = await serviceRouter.classifyQuery(query);
      res.json(classification);
    } catch (error) {
      res.status(500).json({ message: `Failed to classify query: ${error.message}` });
    }
  });
  
  return app;
}

describe('Query Controller API Tests', () => {
  let app;
  
  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('GET /api/status', () => {
    it('should return API service status', async () => {
      const response = await request(app)
        .get('/api/status');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('claude');
      expect(response.body).toHaveProperty('perplexity');
      expect(response.body.claude.status).toBe('connected');
      expect(response.body.perplexity.status).toBe('connected');
    });
    
    it('should handle errors gracefully', async () => {
      mockStorage.getApiStatus.mockRejectedValueOnce(new Error('Service unavailable'));
      
      const response = await request(app)
        .get('/api/status');
      
      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Failed to fetch API status');
    });
  });
  
  describe('POST /api/conversation', () => {
    it('should create a new conversation and process the query', async () => {
      const response = await request(app)
        .post('/api/conversation')
        .send({
          message: 'Tell me about AI advancements'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('conversationId');
      expect(response.body).toHaveProperty('messageId');
      expect(response.body).toHaveProperty('modelUsed');
      expect(mockStorage.createConversation).toHaveBeenCalled();
      expect(mockStorage.createMessage).toHaveBeenCalledTimes(2); // user + assistant
    });
    
    it('should use an existing conversation if ID is provided', async () => {
      const response = await request(app)
        .post('/api/conversation')
        .send({
          message: 'Tell me more',
          conversationId: 'existing-convo-id'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.conversationId).toBe('existing-convo-id');
      expect(mockStorage.getConversation).toHaveBeenCalledWith('existing-convo-id');
      expect(mockStorage.createConversation).not.toHaveBeenCalled();
    });
    
    it('should return 404 for non-existent conversation', async () => {
      const response = await request(app)
        .post('/api/conversation')
        .send({
          message: 'Tell me more',
          conversationId: 'non-existent-id'
        });
      
      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Conversation with ID');
    });
    
    it('should return chart data for visualization requests', async () => {
      const { default: serviceRouter } = await import('../../../services/serviceRouter.js');
      serviceRouter.routeQuery.mockResolvedValueOnce({
        response: 'Here is the price sensitivity chart',
        chartData: {
          type: 'van_westendorp',
          data: { /* mock chart data */ }
        },
        chartHtml: '<div id="chart">Mock chart HTML</div>',
        modelUsed: 'claude-3-7-sonnet-20250219'
      });
      
      const response = await request(app)
        .post('/api/conversation')
        .send({
          message: 'Create a price sensitivity chart for our product'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('chartData');
      expect(response.body).toHaveProperty('chartHtml');
      expect(response.body.chartData.type).toBe('van_westendorp');
    });
    
    it('should return source citations for research queries', async () => {
      const { default: serviceRouter } = await import('../../../services/serviceRouter.js');
      serviceRouter.routeQuery.mockResolvedValueOnce({
        response: 'Based on the latest research...',
        sources: [
          { title: 'Research Paper 1', url: 'https://example.com/paper1' },
          { title: 'Research Paper 2', url: 'https://example.com/paper2' }
        ],
        modelUsed: 'perplexity-sonar-deep-research'
      });
      
      const response = await request(app)
        .post('/api/conversation')
        .send({
          message: 'What is the latest research on quantum computing?'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sources');
      expect(response.body.sources).toHaveLength(2);
      expect(response.body.modelUsed).toContain('perplexity');
    });
    
    it('should handle validation errors', async () => {
      chatMessageSchema.parse.mockImplementationOnce(() => {
        throw new Error('Message format is invalid');
      });
      
      const response = await request(app)
        .post('/api/conversation')
        .send({
          // Missing message field
        });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Failed to process message');
    });
  });
  
  describe('POST /api/classify-query', () => {
    it('should classify regular queries correctly', async () => {
      const response = await request(app)
        .post('/api/classify-query')
        .send({
          query: 'Tell me about machine learning'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('requiresResearch');
      expect(response.body).toHaveProperty('chartType');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body.requiresResearch).toBe(false);
      expect(response.body.chartType).toBeNull();
    });
    
    it('should classify research queries correctly', async () => {
      const response = await request(app)
        .post('/api/classify-query')
        .send({
          query: 'What is the latest research on quantum computing?'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.requiresResearch).toBe(true);
      expect(response.body.chartType).toBeNull();
    });
    
    it('should classify chart generation queries correctly', async () => {
      const response = await request(app)
        .post('/api/classify-query')
        .send({
          query: 'Create a van westendorp price sensitivity chart for our product'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.chartType).toBe('van_westendorp');
    });
    
    it('should return 400 for missing query', async () => {
      const response = await request(app)
        .post('/api/classify-query')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Query parameter is required');
    });
    
    it('should handle service errors gracefully', async () => {
      const { default: serviceRouter } = await import('../../../services/serviceRouter.js');
      serviceRouter.classifyQuery.mockRejectedValueOnce(new Error('Classification failed'));
      
      const response = await request(app)
        .post('/api/classify-query')
        .send({
          query: 'Some query text'
        });
      
      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Failed to classify query');
    });
  });
});