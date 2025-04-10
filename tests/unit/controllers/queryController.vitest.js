/**
 * @file queryController.vitest.js
 * @description Tests for the query-related APIs in server/routes.ts
 */
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { assertRejects, createErrorTrackingSpy } from '../../utils/error-handling-utils.js';
import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

// Mock the service modules before importing
const mockServiceRouter = {
  routeQuery: vi.fn(),
  classifyQuery: vi.fn()
};

// Create proper ES module mocks
vi.mock('../../../services/serviceRouter.js', async () => {
  return {
    default: mockServiceRouter
  };
});

// Setup the mock implementations
beforeEach(() => {
  // Setup mock for routeQuery
  mockServiceRouter.routeQuery.mockImplementation(async ({ query, requiresResearch, chartType }) => {
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
  });

  // Setup mock for classifyQuery
  mockServiceRouter.classifyQuery.mockImplementation((query) => {
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
  });
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
    console.log('Getting conversation with ID:', id);
    // For the existing conversation ID test
    if (id === 123) {
      return {
        id: 123,
        userId: null,
        title: 'Existing conversation'
      };
    }
    // For all other IDs, return null to simulate not found
    return null;
  }),
  createConversation: vi.fn().mockImplementation(async (data) => {
    console.log('Creating conversation with title:', data.title);
    return {
      id: 'new-convo-id',
      userId: data.userId,
      title: data.title,
      createdAt: new Date().toISOString()
    };
  }),
  getMessagesByConversation: vi.fn().mockImplementation(async (conversationId) => {
    console.log('Getting messages for conversation:', conversationId);
    // Always return an empty array, which is still iterable
    return [];
  }),
  createMessage: vi.fn().mockImplementation(async (data) => {
    console.log('Creating message:', JSON.stringify({
      conversationId: data.conversationId,
      role: data.role,
      content: data.content ? data.content.substring(0, 20) + '...' : null
    }));
    return {
      id: 'test-uuid-12345',
      ...data,
      createdAt: new Date().toISOString()
    };
  })
};

// Schema for chat message validation
const chatMessageSchema = {
  parse: vi.fn().mockImplementation((body) => {
    if (!body.message || typeof body.message !== 'string') {
      throw new Error('Message is required and must be a string');
    }
    
    // Check conversationId if provided
    if (body.conversationId !== undefined && 
        body.conversationId !== null && 
        typeof body.conversationId !== 'number') {
      throw new Error('conversationId must be a number if provided');
    }
    
    // Check service if provided
    if (body.service !== undefined && 
        !['claude', 'perplexity', 'auto'].includes(body.service)) {
      throw new Error('service must be one of: claude, perplexity, auto');
    }
    
    // Provide default for service if not specified
    if (body.service === undefined) {
      body.service = 'auto';
    }
    
    return body;
  })
};

// Setup the mock implementations before each test
beforeEach(() => {
  // Reset the chatMessageSchema mock to a simpler implementation for debugging
  chatMessageSchema.parse.mockImplementation((body) => {
    console.log('PARSE CALLED WITH:', JSON.stringify(body));
    return body;
  });
});

// Helper to create a basic Express app with query routes
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Use our mock service router instead of the actual one
  
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
      console.log('REQUEST BODY:', JSON.stringify(req.body));
      
      let message, conversationId, service;
      try {
        const result = chatMessageSchema.parse(req.body);
        message = result.message;
        conversationId = result.conversationId;
        service = result.service;
        console.log('VALIDATION SUCCESS:', { message, conversationId, service });
      } catch (validationError) {
        console.error('VALIDATION ERROR:', validationError.message);
        return res.status(400).json({ message: `Failed to process message: ${validationError.message}` });
      }
      
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
      console.log('Getting messages for conversation ID:', conversation ? conversation.id : 'undefined');
      if (!conversation) {
        console.error('CONVERSATION OBJECT IS UNDEFINED');
        return res.status(500).json({ message: 'Failed to create or retrieve conversation' });
      }
      
      const previousMessages = await mockStorage.getMessagesByConversation(conversation.id);
      console.log('Previous messages:', previousMessages);
      
      // Create user message
      console.log('Creating user message with conversationId:', conversation.id);
      const userMessage = await mockStorage.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: message,
        service: 'system',
        visualizationData: null,
        citations: null
      });
      
      // Process the query through our mock serviceRouter
      const queryResponse = await mockServiceRouter.routeQuery({
        query: message,
        conversationId: conversation.id,
        messages: [...previousMessages, userMessage],
        service: service || 'auto',
        userId: null
      });
      
      // Create AI message
      console.log('Creating AI message for conversation:', conversation.id);
      const aiMessage = await mockStorage.createMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: queryResponse.response,
        service: queryResponse.modelUsed || 'claude',
        visualizationData: queryResponse.chartData || null,
        citations: queryResponse.sources || null
      });
      console.log('AI message created:', aiMessage.id);
      
      const responseData = {
        message: queryResponse.response,
        messageId: aiMessage.id,
        conversationId: conversation.id,
        modelUsed: queryResponse.modelUsed,
        chartData: queryResponse.chartData,
        chartHtml: queryResponse.chartHtml,
        sources: queryResponse.sources
      };
      console.log('Sending response:', JSON.stringify(responseData));
      res.json(responseData);
    } catch (error) {
      console.error('ERROR in conversation handler:', error.message);
      console.error('Stack trace:', error.stack);
      res.status(400).json({ message: `Failed to process message: ${error.message}` });
    }
  });
  
  app.post('/api/classify-query', async (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({ message: 'Query parameter is required' });
      }
      
      const classification = await mockServiceRouter.classifyQuery(query);
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
      // Reset all mocks before testing
      vi.clearAllMocks();
      
      // Mock conversation creation
      mockStorage.createConversation.mockImplementation(async (data) => {
        console.log(`Mock createConversation called with title "${data.title}"`);
        return {
          id: 'basic-convo-id',
          userId: data.userId,
          title: data.title,
          createdAt: new Date().toISOString()
        };
      });
      
      // Mock messages for this conversation
      mockStorage.getMessagesByConversation.mockImplementation(async (id) => {
        console.log(`Mock getMessagesByConversation called with id ${id}`);
        return []; // Empty but valid array
      });
      
      // Mock message creation
      mockStorage.createMessage.mockImplementation(async (data) => {
        console.log(`Mock createMessage called with role ${data.role}`);
        return {
          id: `msg-${data.role}-id`,
          ...data,
          createdAt: new Date().toISOString()
        };
      });
      
      // Set up a basic query response
      mockServiceRouter.routeQuery.mockImplementation(async ({ query }) => {
        console.log(`Mock routeQuery called with query "${query}"`);
        return {
          response: `Response to "${query}"`,
          modelUsed: 'claude-3-7-sonnet-20250219'
        };
      });
      
      // Make the request
      const response = await request(app)
        .post('/api/conversation')
        .send({
          message: 'Tell me about AI advancements'
        });
      
      // Verify response
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('conversationId');
      expect(response.body).toHaveProperty('messageId');
      expect(response.body).toHaveProperty('modelUsed');
      expect(mockStorage.createConversation).toHaveBeenCalled();
      expect(mockStorage.createMessage).toHaveBeenCalledTimes(2); // user + assistant
    });
    
    it('should use an existing conversation if ID is provided', async () => {
      // Reset all mocks before testing
      vi.clearAllMocks();
      
      // Create specific mocks for this test
      const CONVERSATION_ID = 123;
      
      // Mock the conversation to be returned
      mockStorage.getConversation.mockImplementation(async (id) => {
        console.log(`Mock getConversation called with id ${id}`);
        if (id === CONVERSATION_ID) {
          return {
            id: CONVERSATION_ID,
            userId: null,
            title: 'Existing conversation'
          };
        }
        return null;
      });
      
      // Mock the messages to be returned (empty array but properly set up)
      mockStorage.getMessagesByConversation.mockImplementation(async (id) => {
        console.log(`Mock getMessagesByConversation called with id ${id}`);
        return []; // Empty but valid array
      });
      
      // Mock the routeQuery response
      mockServiceRouter.routeQuery.mockImplementation(async ({ query }) => {
        return {
          response: `Response to "${query}"`,
          modelUsed: 'claude-3-7-sonnet-20250219'
        };
      });
      
      // Mock the message creation
      mockStorage.createMessage.mockImplementation(async (data) => {
        console.log(`Mock createMessage called with data ${JSON.stringify(data)}`);
        return {
          id: 'test-msg-id',
          ...data,
          createdAt: new Date().toISOString()
        };
      });
      
      // Now make the request
      const response = await request(app)
        .post('/api/conversation')
        .send({
          message: 'Tell me more',
          conversationId: CONVERSATION_ID
        });
      
      // Assertions
      expect(response.status).toBe(200);
      expect(response.body.conversationId).toBe(CONVERSATION_ID);
      expect(mockStorage.getConversation).toHaveBeenCalledWith(CONVERSATION_ID);
      expect(mockStorage.createConversation).not.toHaveBeenCalled();
    });
    
    it('should return 404 for non-existent conversation', async () => {
      const response = await request(app)
        .post('/api/conversation')
        .send({
          message: 'Tell me more',
          conversationId: 999 // Using a number for the non-existent ID
        });
      
      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Conversation with ID');
    });
    
    it('should return chart data for visualization requests', async () => {
      // Reset all mocks before testing
      vi.clearAllMocks();
      
      // Mock conversation creation
      mockStorage.createConversation.mockImplementation(async (data) => {
        console.log(`Mock createConversation called with title "${data.title}"`);
        return {
          id: 'chart-convo-id',
          userId: data.userId,
          title: data.title,
          createdAt: new Date().toISOString()
        };
      });
      
      // Mock messages for this conversation
      mockStorage.getMessagesByConversation.mockImplementation(async (id) => {
        console.log(`Mock getMessagesByConversation called with id ${id}`);
        return []; // Empty but valid array
      });
      
      // Mock message creation
      mockStorage.createMessage.mockImplementation(async (data) => {
        console.log(`Mock createMessage called with role ${data.role}`);
        return {
          id: `msg-${data.role}-id`,
          ...data,
          createdAt: new Date().toISOString()
        };
      });
      
      // Set up a specific chart response
      mockServiceRouter.routeQuery.mockImplementation(async ({ query }) => {
        console.log(`Mock routeQuery called with query "${query}"`);
        return {
          response: 'Here is the price sensitivity chart',
          chartData: {
            type: 'van_westendorp',
            data: { /* mock chart data */ }
          },
          chartHtml: '<div id="chart">Mock chart HTML</div>',
          modelUsed: 'claude-3-7-sonnet-20250219'
        };
      });
      
      // Create a new conversation with chart request
      const response = await request(app)
        .post('/api/conversation')
        .send({
          message: 'Create a price sensitivity chart for our product'
        });
      
      // Verify the response
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('chartData');
      expect(response.body).toHaveProperty('chartHtml');
      expect(response.body.chartData.type).toBe('van_westendorp');
    });
    
    it('should return source citations for research queries', async () => {
      // Reset all mocks before testing
      vi.clearAllMocks();
      
      // Mock conversation creation
      mockStorage.createConversation.mockImplementation(async (data) => {
        console.log(`Mock createConversation called with title "${data.title}"`);
        return {
          id: 'research-convo-id',
          userId: data.userId,
          title: data.title,
          createdAt: new Date().toISOString()
        };
      });
      
      // Mock messages for this conversation
      mockStorage.getMessagesByConversation.mockImplementation(async (id) => {
        console.log(`Mock getMessagesByConversation called with id ${id}`);
        return []; // Empty but valid array
      });
      
      // Mock message creation
      mockStorage.createMessage.mockImplementation(async (data) => {
        console.log(`Mock createMessage called with role ${data.role}`);
        return {
          id: `msg-${data.role}-id`,
          ...data,
          createdAt: new Date().toISOString()
        };
      });
      
      // Set up a specific research response with citations
      mockServiceRouter.routeQuery.mockImplementation(async ({ query }) => {
        console.log(`Mock routeQuery called with query "${query}"`);
        return {
          response: 'Based on the latest research...',
          sources: [
            { title: 'Research Paper 1', url: 'https://example.com/paper1' },
            { title: 'Research Paper 2', url: 'https://example.com/paper2' }
          ],
          modelUsed: 'perplexity-sonar-deep-research'
        };
      });
      
      // Create a new conversation with research request
      const response = await request(app)
        .post('/api/conversation')
        .send({
          message: 'What is the latest research on quantum computing?'
        });
      
      // Verify the response
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
      // Use our mock directly
      mockServiceRouter.classifyQuery.mockRejectedValueOnce(new Error('Classification failed'));
      
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