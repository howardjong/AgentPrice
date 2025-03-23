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
        response: result.response,
        visualizationData: result.visualizationData
      });
    } catch (error) {
      console.error('Error generating visualization:', error);
      res.status(500).json({ message: `Failed to generate visualization: ${error.message}` });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}