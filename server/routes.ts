import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { claudeService } from "./services/claude";
import { perplexityService } from "./services/perplexity";
import { serviceRouter } from "./services/router";
import { 
  chatMessageSchema, 
  visualizeSchema,
  insertMessageSchema 
} from "@shared/schema";
import { initializeAllMockResearch } from '../services/initializeMockResearch.js';
import { v4 as uuidv4 } from 'uuid';

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize services
  const claudeStatus = claudeService.getStatus();
  const perplexityStatus = perplexityService.getStatus();

  // Update storage with initial service status
  await storage.updateServiceStatus('claude', claudeStatus);
  await storage.updateServiceStatus('perplexity', perplexityStatus);

  // API Status Endpoint
  app.get('/api/status', async (req: Request, res: Response) => {
    try {
      const status = await storage.getApiStatus();
      res.json(status);
    } catch (error) {
      console.error('Error fetching API status:', error);
      res.status(500).json({ message: `Failed to fetch API status: ${error.message}` });
    }
  });

  // Conversation Endpoint - uses Claude or auto-detects
  app.post('/api/conversation', async (req: Request, res: Response) => {
    try {
      const { message, conversationId, service } = chatMessageSchema.parse(req.body);

      // Get or create a conversation
      let conversation;
      if (conversationId) {
        conversation = await storage.getConversation(conversationId);
        if (!conversation) {
          return res.status(404).json({ message: `Conversation with ID ${conversationId} not found` });
        }
      } else {
        conversation = await storage.createConversation({
          userId: null,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : '')
        });
      }

      // Get previous messages in this conversation
      const previousMessages = await storage.getMessagesByConversation(conversation.id);

      // Create user message
      const userMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: message,
        service: 'system',
        visualizationData: null,
        citations: null
      });

      // Format messages for Claude
      const messageHistory = [
        ...previousMessages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ];

      // Process the conversation
      const result = await claudeService.processConversation(messageHistory);

      // Save the assistant message
      const assistantMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: result.response,
        service: 'claude',
        visualizationData: result.visualizationData,
        citations: null
      });

      res.json({
        message: assistantMessage,
        conversation,
        visualizationData: result.visualizationData
      });
    } catch (error) {
      console.error('Error processing conversation:', error);
      res.status(500).json({ message: `Failed to process conversation: ${error.message}` });
    }
  });

  // Research Endpoint - uses Perplexity
  app.post('/api/research', async (req: Request, res: Response) => {
    try {
      const { message, conversationId } = chatMessageSchema.parse(req.body);

      // Get or create a conversation
      let conversation;
      if (conversationId) {
        conversation = await storage.getConversation(conversationId);
        if (!conversation) {
          return res.status(404).json({ message: `Conversation with ID ${conversationId} not found` });
        }
      } else {
        conversation = await storage.createConversation({
          userId: null,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : '')
        });
      }

      // Get previous messages in this conversation
      const previousMessages = await storage.getMessagesByConversation(conversation.id);

      // Create user message
      const userMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: message,
        service: 'system',
        visualizationData: null,
        citations: null
      });

      // Format messages for Perplexity
      const messageHistory = [
        ...previousMessages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ];

      // Perform research
      const result = await perplexityService.performResearch(messageHistory);

      // Save the assistant message
      const assistantMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: result.response,
        service: 'perplexity',
        visualizationData: null,
        citations: result.citations
      });

      res.json({
        message: assistantMessage,
        conversation,
        citations: result.citations
      });
    } catch (error) {
      console.error('Error performing research:', error);
      res.status(500).json({ message: `Failed to perform research: ${error.message}` });
    }
  });

  // Chat Endpoint - Auto-routes between Claude and Perplexity
  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const { message, conversationId, service } = chatMessageSchema.parse(req.body);

      // Get or create a conversation
      let conversation;
      if (conversationId) {
        conversation = await storage.getConversation(conversationId);
        if (!conversation) {
          return res.status(404).json({ message: `Conversation with ID ${conversationId} not found` });
        }
      } else {
        conversation = await storage.createConversation({
          userId: null,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : '')
        });
      }

      // Get previous messages in this conversation
      const previousMessages = await storage.getMessagesByConversation(conversation.id);

      // Create user message
      const userMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: message,
        service: 'system',
        visualizationData: null,
        citations: null
      });

      // Format messages for service router
      const messageHistory = [
        ...previousMessages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ];

      // Route the message to appropriate service
      const result = await serviceRouter.routeMessage(messageHistory, service);

      // Save the assistant message
      const assistantMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: result.response,
        service: result.service,
        visualizationData: result.visualizationData || null,
        citations: result.citations || null
      });

      res.json({
        message: assistantMessage,
        conversation,
        service: result.service,
        visualizationData: result.visualizationData,
        citations: result.citations
      });
    } catch (error) {
      console.error('Error processing chat message:', error);
      res.status(500).json({ message: `Failed to process chat message: ${error.message}` });
    }
  });

  // Visualization Endpoint
  app.post('/api/visualize', async (req: Request, res: Response) => {
    try {
      const { data, type, title, description } = visualizeSchema.parse(req.body);

      // Generate visualization using Claude
      const result = await claudeService.generateVisualization(data, type, title, description);

      res.json({
        svg: result.svg,
        visualizationType: result.visualizationType,
        title: result.title,
        description: result.description,
        modelUsed: result.modelUsed
      });
    } catch (error) {
      console.error('Error generating visualization:', error);
      res.status(500).json({ message: `Failed to generate visualization: ${error.message}` });
    }
  });
  
  // Test Visualization endpoints
  
  // Van Westendorp visualization endpoint
  app.get('/api/test-visualization/van-westendorp', async (req: Request, res: Response) => {
    try {
      // Sample data for van westendorp price sensitivity analysis
      const data = {
        prices: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        tooExpensive: [5, 15, 30, 50, 70, 85, 90, 95, 98, 99],
        expensiveButReasonable: [1, 5, 15, 30, 50, 65, 75, 85, 90, 95],
        goodValue: [99, 95, 80, 60, 40, 25, 15, 10, 5, 1],
        tooCheap: [95, 80, 60, 40, 20, 10, 5, 3, 2, 1]
      };

      // Generate visualization using Claude
      const result = await claudeService.generateVisualization(
        data, 
        'van_westendorp', 
        'Van Westendorp Price Sensitivity Analysis', 
        'Sample price sensitivity data for product pricing analysis'
      );

      res.send(`
        <html>
          <head>
            <title>Van Westendorp Visualization Test</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 0 auto; 
                padding: 12px; 
                max-width: 100%;
              }
              h1 { 
                color: #2c3e50; 
                font-size: 1.4rem;
                margin-bottom: 8px;
              }
              p {
                font-size: 0.9rem;
                line-height: 1.4;
                margin: 8px 0;
              }
              .visualization { 
                border: 1px solid #ddd; 
                padding: 10px; 
                border-radius: 5px;
                overflow-x: auto;
                margin: 10px 0;
              }
              svg {
                max-width: 100%;
                height: auto;
              }
              .model-info { 
                margin-top: 15px; 
                padding: 8px; 
                background: #f8f9fa; 
                border-radius: 5px;
                font-size: 0.85rem;
              }
              .back-link {
                display: inline-block;
                margin-top: 15px;
                background: #f0f0f0;
                padding: 8px 15px;
                border-radius: 4px;
                text-decoration: none;
                color: #333;
                font-weight: bold;
              }
              @media (min-width: 768px) {
                body {
                  max-width: 900px;
                  padding: 20px;
                }
                h1 {
                  font-size: 1.8rem;
                }
                p {
                  font-size: 1rem;
                }
              }
            </style>
          </head>
          <body>
            <h1>${result.title}</h1>
            <p>${result.description}</p>
            <div class="visualization">
              ${result.svg}
            </div>
            <div class="model-info">
              <p><strong>Visualization Type:</strong> ${result.visualizationType}</p>
              <p><strong>Model Used:</strong> ${result.modelUsed}</p>
            </div>
            <a href="/" class="back-link">&laquo; Back to Dashboard</a>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Error generating test visualization:', error);
      res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
    }
  });
  
  // Conjoint analysis visualization endpoint
  app.get('/api/test-visualization/conjoint', async (req: Request, res: Response) => {
    try {
      // Sample data for conjoint analysis
      const data = {
        attributes: [
          {
            name: "Price",
            importance: 40,
            levels: [
              { name: "$49.99", utility: 0.8 },
              { name: "$99.99", utility: 0.4 },
              { name: "$149.99", utility: -0.5 },
              { name: "$199.99", utility: -0.9 }
            ]
          },
          {
            name: "Storage",
            importance: 25,
            levels: [
              { name: "128GB", utility: -0.6 },
              { name: "256GB", utility: 0.2 },
              { name: "512GB", utility: 0.5 },
              { name: "1TB", utility: 0.8 }
            ]
          },
          {
            name: "Battery Life",
            importance: 20,
            levels: [
              { name: "8 hours", utility: -0.7 },
              { name: "12 hours", utility: 0.1 },
              { name: "18 hours", utility: 0.6 },
              { name: "24 hours", utility: 0.9 }
            ]
          },
          {
            name: "Camera",
            importance: 15,
            levels: [
              { name: "12MP", utility: -0.4 },
              { name: "24MP", utility: 0.3 },
              { name: "48MP", utility: 0.7 }
            ]
          }
        ]
      };

      // Generate visualization using Claude
      const result = await claudeService.generateVisualization(
        data, 
        'conjoint', 
        'Conjoint Analysis of Product Features', 
        'Analysis of consumer preferences for different product features and levels'
      );

      res.send(`
        <html>
          <head>
            <title>Conjoint Analysis Visualization Test</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 0 auto; 
                padding: 12px; 
                max-width: 100%;
              }
              h1 { 
                color: #2c3e50; 
                font-size: 1.4rem;
                margin-bottom: 8px;
              }
              p {
                font-size: 0.9rem;
                line-height: 1.4;
                margin: 8px 0;
              }
              .visualization { 
                border: 1px solid #ddd; 
                padding: 10px; 
                border-radius: 5px;
                overflow-x: auto;
                margin: 10px 0;
              }
              svg {
                max-width: 100%;
                height: auto;
              }
              .model-info { 
                margin-top: 15px; 
                padding: 8px; 
                background: #f8f9fa; 
                border-radius: 5px;
                font-size: 0.85rem;
              }
              .back-link {
                display: inline-block;
                margin-top: 15px;
                background: #f0f0f0;
                padding: 8px 15px;
                border-radius: 4px;
                text-decoration: none;
                color: #333;
                font-weight: bold;
              }
              @media (min-width: 768px) {
                body {
                  max-width: 900px;
                  padding: 20px;
                }
                h1 {
                  font-size: 1.8rem;
                }
                p {
                  font-size: 1rem;
                }
              }
            </style>
          </head>
          <body>
            <h1>${result.title}</h1>
            <p>${result.description}</p>
            <div class="visualization">
              ${result.svg}
            </div>
            <div class="model-info">
              <p><strong>Visualization Type:</strong> ${result.visualizationType}</p>
              <p><strong>Model Used:</strong> ${result.modelUsed}</p>
            </div>
            <a href="/" class="back-link">&laquo; Back to Dashboard</a>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Error generating test visualization:', error);
      res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
    }
  });

  // Mock Research Initialization Endpoint (for testing/development only)
  app.post('/api/mock-init', async (req: Request, res: Response) => {
    // This endpoint should only be available in development mode
    if (process.env.NODE_ENV !== 'development' && process.env.ALLOW_MOCK_INIT !== 'true') {
      return res.status(403).json({ message: 'This endpoint is only available in development mode' });
    }

    try {
      console.log('Initializing mock research data...');
      const result = await initializeAllMockResearch();
      
      res.json({
        message: 'Mock research data initialized successfully',
        data: {
          totalJobs: result.total,
          productQuestions: result.productQuestions.length,
          researchTopics: result.researchTopics.length
        }
      });
    } catch (error: any) {
      console.error('Error initializing mock research data:', error);
      res.status(500).json({ message: `Failed to initialize mock research: ${error.message}` });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}