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
  app.get('/api/test-visualization/van-westendrop', async (req: Request, res: Response) => {
    let hasResponded = false;
    
    // Add a timeout handler
    const timeoutId = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true;
        res.status(202).send(`
          <html>
            <head>
              <title>Van Westendorp Visualization - Processing</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
              <meta http-equiv="refresh" content="5;url=/api/test-visualization/van-westendrop">
              <style>
                body { 
                  font-family: Arial, sans-serif; 
                  margin: 0 auto; 
                  padding: 15px; 
                  max-width: 600px;
                  text-align: center;
                }
                h1 { 
                  color: #2c3e50; 
                  font-size: 1.4rem;
                }
                .loading {
                  display: inline-block;
                  width: 50px;
                  height: 50px;
                  border: 3px solid rgba(0,0,0,.3);
                  border-radius: 50%;
                  border-top-color: #2c3e50;
                  animation: spin 1s ease-in-out infinite;
                }
                @keyframes spin {
                  to { transform: rotate(360deg); }
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
              </style>
            </head>
            <body>
              <h1>Generating Van Westendorp Visualization</h1>
              <p>This may take up to 90 seconds. The page will automatically refresh.</p>
              <div class="loading"></div>
              <p>Please wait...</p>
              <a href="/" class="back-link">&laquo; Back to Dashboard</a>
            </body>
          </html>
        `);
      }
    }, 2000); // Show loading page after 2 seconds

    try {
      // Create a basic SVG for van Westendorp price sensitivity analysis without using Claude API
      // This avoids hitting the rate limit
      const svg = `
        <svg width="600" height="400" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
          <style>
            .axis { stroke: #333; stroke-width: 1; }
            .grid { stroke: #ccc; stroke-width: 0.5; stroke-dasharray: 5,5; }
            .label { font-family: Arial; font-size: 12px; fill: #333; }
            .title { font-family: Arial; font-size: 16px; font-weight: bold; fill: #333; text-anchor: middle; }
            .line { stroke-width: 2; fill: none; }
            .too-expensive { stroke: #e74c3c; }
            .expensive-but-reasonable { stroke: #f39c12; }
            .good-value { stroke: #2ecc71; }
            .too-cheap { stroke: #3498db; }
            .legend-item { font-family: Arial; font-size: 12px; }
          </style>
          
          <!-- Title -->
          <text x="300" y="30" class="title">Van Westendorp Price Sensitivity Analysis</text>
          
          <!-- Axes -->
          <line x1="50" y1="350" x2="550" y2="350" class="axis" />
          <line x1="50" y1="50" x2="50" y2="350" class="axis" />
          
          <!-- X-axis labels -->
          <text x="300" y="380" class="label" text-anchor="middle">Price ($)</text>
          <text x="50" y="370" class="label" text-anchor="middle">10</text>
          <text x="150" y="370" class="label" text-anchor="middle">30</text>
          <text x="250" y="370" class="label" text-anchor="middle">50</text>
          <text x="350" y="370" class="label" text-anchor="middle">70</text>
          <text x="450" y="370" class="label" text-anchor="middle">90</text>
          <text x="550" y="370" class="label" text-anchor="middle">110</text>
          
          <!-- Y-axis labels -->
          <text x="30" y="200" class="label" text-anchor="middle" transform="rotate(-90,30,200)">Cumulative Percentage (%)</text>
          <text x="40" y="350" class="label" text-anchor="end">0</text>
          <text x="40" y="300" class="label" text-anchor="end">20</text>
          <text x="40" y="250" class="label" text-anchor="end">40</text>
          <text x="40" y="200" class="label" text-anchor="end">60</text>
          <text x="40" y="150" class="label" text-anchor="end">80</text>
          <text x="40" y="100" class="label" text-anchor="end">100</text>
          
          <!-- Grid lines -->
          <line x1="50" y1="300" x2="550" y2="300" class="grid" />
          <line x1="50" y1="250" x2="550" y2="250" class="grid" />
          <line x1="50" y1="200" x2="550" y2="200" class="grid" />
          <line x1="50" y1="150" x2="550" y2="150" class="grid" />
          <line x1="50" y1="100" x2="550" y2="100" class="grid" />
          <line x1="150" y1="50" x2="150" y2="350" class="grid" />
          <line x1="250" y1="50" x2="250" y2="350" class="grid" />
          <line x1="350" y1="50" x2="350" y2="350" class="grid" />
          <line x1="450" y1="50" x2="450" y2="350" class="grid" />
          
          <!-- Lines -->
          <polyline points="50,345 150,280 250,200 350,150 450,110 550,100" class="line too-expensive" />
          <polyline points="50,349 150,335 250,250 350,180 450,140 550,120" class="line expensive-but-reasonable" />
          <polyline points="50,100 150,140 250,200 350,250 450,330 550,349" class="line good-value" />
          <polyline points="50,120 150,150 250,200 350,250 450,290 550,348" class="line too-cheap" />
          
          <!-- Intersections -->
          <circle cx="250" cy="200" r="5" fill="#333" />
          <circle cx="350" cy="250" r="5" fill="#333" />
          
          <!-- Legend -->
          <rect x="400" y="60" width="15" height="3" class="too-expensive" />
          <text x="420" y="63" class="legend-item">Too Expensive</text>
          
          <rect x="400" y="80" width="15" height="3" class="expensive-but-reasonable" />
          <text x="420" y="83" class="legend-item">Expensive but Reasonable</text>
          
          <rect x="400" y="100" width="15" height="3" class="good-value" />
          <text x="420" y="103" class="legend-item">Good Value</text>
          
          <rect x="400" y="120" width="15" height="3" class="too-cheap" />
          <text x="420" y="123" class="legend-item">Too Cheap</text>
        </svg>
      `;

      // Build a static result to avoid using the API
      const result = {
        svg,
        title: 'Van Westendorp Price Sensitivity Analysis',
        description: 'Sample price sensitivity data for product pricing analysis',
        visualizationType: 'van_westendorp',
        modelUsed: 'Static SVG (Claude API rate limited)'
      };

      // Clear the timeout since we have a result
      clearTimeout(timeoutId);

      if (!hasResponded) {
        hasResponded = true;
        res.send(`
          <html>
            <head>
              <title>Van Westendorp Visualization</title>
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
                .note {
                  margin-top: 15px;
                  padding: 8px;
                  background: #fff8e1;
                  border: 1px solid #ffd54f;
                  border-radius: 5px;
                  font-size: 0.85rem;
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
              <div class="note">
                <p><strong>Note:</strong> This is a static demonstration visualization. The Claude API is currently rate-limited, 
                so we're showing a pre-generated SVG instead of a dynamically created one.</p>
              </div>
              <div class="model-info">
                <p><strong>Visualization Type:</strong> ${result.visualizationType}</p>
                <p><strong>Source:</strong> ${result.modelUsed}</p>
              </div>
              <a href="/" class="back-link">&laquo; Back to Dashboard</a>
            </body>
          </html>
        `);
      }
    } catch (error) {
      // Clear the timeout since we're sending an error
      clearTimeout(timeoutId);
      
      console.error('Error generating test visualization:', error);
      
      if (!hasResponded) {
        hasResponded = true;
        res.status(500).send(`
          <html>
            <head>
              <title>Error - Van Westendorp Visualization</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
              <style>
                body { 
                  font-family: Arial, sans-serif; 
                  margin: 0 auto; 
                  padding: 15px; 
                  max-width: 600px;
                }
                h1 { 
                  color: #e74c3c; 
                  font-size: 1.4rem;
                }
                .error-box {
                  background: #fee;
                  border: 1px solid #e74c3c;
                  border-radius: 5px;
                  padding: 10px;
                  margin: 15px 0;
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
              </style>
            </head>
            <body>
              <h1>Error Generating Visualization</h1>
              <div class="error-box">
                <p>${error.message || 'Unknown error occurred'}</p>
              </div>
              <p>Please try again later or contact support if the issue persists.</p>
              <a href="/" class="back-link">&laquo; Back to Dashboard</a>
            </body>
          </html>
        `);
      }
    }
  });
  
  // Conjoint analysis visualization endpoint
  app.get('/api/test-visualization/conjoint', async (req: Request, res: Response) => {
    let hasResponded = false;
    
    // Add a timeout handler
    const timeoutId = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true;
        res.status(202).send(`
          <html>
            <head>
              <title>Conjoint Analysis Visualization - Processing</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
              <meta http-equiv="refresh" content="5;url=/api/test-visualization/conjoint">
              <style>
                body { 
                  font-family: Arial, sans-serif; 
                  margin: 0 auto; 
                  padding: 15px; 
                  max-width: 600px;
                  text-align: center;
                }
                h1 { 
                  color: #2c3e50; 
                  font-size: 1.4rem;
                }
                .loading {
                  display: inline-block;
                  width: 50px;
                  height: 50px;
                  border: 3px solid rgba(0,0,0,.3);
                  border-radius: 50%;
                  border-top-color: #2c3e50;
                  animation: spin 1s ease-in-out infinite;
                }
                @keyframes spin {
                  to { transform: rotate(360deg); }
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
              </style>
            </head>
            <body>
              <h1>Generating Conjoint Analysis Visualization</h1>
              <p>This may take up to 90 seconds. The page will automatically refresh.</p>
              <div class="loading"></div>
              <p>Please wait...</p>
              <a href="/" class="back-link">&laquo; Back to Dashboard</a>
            </body>
          </html>
        `);
      }
    }, 2000); // Show loading page after 2 seconds

    try {
      // Create a basic SVG for conjoint analysis without using Claude API
      // This avoids hitting the rate limit
      const svg = `
        <svg width="600" height="550" viewBox="0 0 600 550" xmlns="http://www.w3.org/2000/svg">
          <style>
            .title { font-family: Arial; font-size: 18px; font-weight: bold; text-anchor: middle; }
            .subtitle { font-family: Arial; font-size: 14px; fill: #666; text-anchor: middle; }
            .axis { font-family: Arial; font-size: 12px; fill: #333; }
            .bar { fill-opacity: 0.8; }
            .bar-price { fill: #3498db; }
            .bar-storage { fill: #2ecc71; }
            .bar-battery { fill: #f39c12; }
            .bar-camera { fill: #9b59b6; }
            .bar-label { font-family: Arial; font-size: 11px; fill: white; text-anchor: middle; }
            .legend-item { font-family: Arial; font-size: 12px; }
            .importance-label { font-family: Arial; font-size: 14px; font-weight: bold; text-anchor: middle; }
            .grid { stroke: #e0e0e0; stroke-width: 1; }
          </style>
          
          <!-- Title and Subtitle -->
          <text x="300" y="30" class="title">Conjoint Analysis of Product Features</text>
          <text x="300" y="50" class="subtitle">Attribute Importance and Level Utilities</text>
          
          <!-- Importance Chart -->
          <text x="300" y="80" class="importance-label">Attribute Importance (%)</text>
          
          <!-- Bars for Importance -->
          <rect x="50" y="100" width="500" height="1" class="grid" />
          <rect x="50" y="140" width="500" height="1" class="grid" />
          <rect x="50" y="180" width="500" height="1" class="grid" />
          
          <rect x="100" y="100" width="400" height="30" class="bar bar-price" />
          <rect x="100" y="140" width="250" height="30" class="bar bar-storage" />
          <rect x="100" y="180" width="200" height="30" class="bar bar-battery" />
          <rect x="100" y="220" width="150" height="30" class="bar bar-camera" />
          
          <text x="80" y="115" class="axis" text-anchor="end">Price</text>
          <text x="80" y="155" class="axis" text-anchor="end">Storage</text>
          <text x="80" y="195" class="axis" text-anchor="end">Battery</text>
          <text x="80" y="235" class="axis" text-anchor="end">Camera</text>
          
          <text x="300" y="120" class="bar-label">40%</text>
          <text x="225" y="160" class="bar-label">25%</text>
          <text x="200" y="200" class="bar-label">20%</text>
          <text x="175" y="240" class="bar-label">15%</text>
          
          <!-- Utility Chart -->
          <text x="300" y="290" class="importance-label">Level Utilities</text>
          
          <!-- Horizontal line for zero utility -->
          <line x1="50" y1="400" x2="550" y2="400" stroke="#333" stroke-width="2" />
          
          <!-- Y-axis labels -->
          <text x="50" y="310" class="axis" text-anchor="end">1.0</text>
          <text x="50" y="350" class="axis" text-anchor="end">0.5</text>
          <text x="50" y="400" class="axis" text-anchor="end">0.0</text>
          <text x="50" y="450" class="axis" text-anchor="end">-0.5</text>
          <text x="50" y="500" class="axis" text-anchor="end">-1.0</text>
          
          <!-- Price levels -->
          <rect x="70" y="320" width="30" height="80" class="bar bar-price" />
          <rect x="110" y="360" width="30" height="40" class="bar bar-price" />
          <rect x="150" y="400" width="30" height="50" class="bar bar-price" rx="2" ry="2" />
          <rect x="190" y="400" width="30" height="90" class="bar bar-price" rx="2" ry="2" />
          
          <text x="85" y="315" class="axis" font-size="10" text-anchor="middle">$49.99</text>
          <text x="125" y="355" class="axis" font-size="10" text-anchor="middle">$99.99</text>
          <text x="165" y="505" class="axis" font-size="10" text-anchor="middle">$149.99</text>
          <text x="205" y="505" class="axis" font-size="10" text-anchor="middle">$199.99</text>
          
          <!-- Storage levels -->
          <rect x="250" y="400" width="30" height="60" class="bar bar-storage" rx="2" ry="2" />
          <rect x="290" y="380" width="30" height="20" class="bar bar-storage" />
          <rect x="330" y="350" width="30" height="50" class="bar bar-storage" />
          <rect x="370" y="320" width="30" height="80" class="bar bar-storage" />
          
          <text x="265" y="505" class="axis" font-size="10" text-anchor="middle">128GB</text>
          <text x="305" y="375" class="axis" font-size="10" text-anchor="middle">256GB</text>
          <text x="345" y="345" class="axis" font-size="10" text-anchor="middle">512GB</text>
          <text x="385" y="315" class="axis" font-size="10" text-anchor="middle">1TB</text>
          
          <!-- Battery levels -->
          <rect x="430" y="400" width="30" height="70" class="bar bar-battery" rx="2" ry="2" />
          <rect x="470" y="390" width="30" height="10" class="bar bar-battery" />
          <rect x="510" y="340" width="30" height="60" class="bar bar-battery" />
          <rect x="550" y="310" width="30" height="90" class="bar bar-battery" />
          
          <text x="445" y="505" class="axis" font-size="10" text-anchor="middle">8h</text>
          <text x="485" y="385" class="axis" font-size="10" text-anchor="middle">12h</text>
          <text x="525" y="335" class="axis" font-size="10" text-anchor="middle">18h</text>
          <text x="565" y="305" class="axis" font-size="10" text-anchor="middle">24h</text>
          
          <!-- Legend -->
          <rect x="100" y="520" width="15" height="15" class="bar bar-price" />
          <text x="120" y="532" class="legend-item">Price</text>
          
          <rect x="200" y="520" width="15" height="15" class="bar bar-storage" />
          <text x="220" y="532" class="legend-item">Storage</text>
          
          <rect x="300" y="520" width="15" height="15" class="bar bar-battery" />
          <text x="320" y="532" class="legend-item">Battery Life</text>
          
          <rect x="400" y="520" width="15" height="15" class="bar bar-camera" />
          <text x="420" y="532" class="legend-item">Camera</text>
        </svg>
      `;

      // Build a static result to avoid using the API
      const result = {
        svg,
        title: 'Conjoint Analysis of Product Features',
        description: 'Analysis of consumer preferences for different product features and levels',
        visualizationType: 'conjoint',
        modelUsed: 'Static SVG (Claude API rate limited)'
      };

      // Clear the timeout since we have a result
      clearTimeout(timeoutId);

      if (!hasResponded) {
        hasResponded = true;
        res.send(`
          <html>
            <head>
              <title>Conjoint Analysis Visualization</title>
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
                .note {
                  margin-top: 15px;
                  padding: 8px;
                  background: #fff8e1;
                  border: 1px solid #ffd54f;
                  border-radius: 5px;
                  font-size: 0.85rem;
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
              <div class="note">
                <p><strong>Note:</strong> This is a static demonstration visualization. The Claude API is currently rate-limited, 
                so we're showing a pre-generated SVG instead of a dynamically created one.</p>
              </div>
              <div class="model-info">
                <p><strong>Visualization Type:</strong> ${result.visualizationType}</p>
                <p><strong>Source:</strong> ${result.modelUsed}</p>
              </div>
              <a href="/" class="back-link">&laquo; Back to Dashboard</a>
            </body>
          </html>
        `);
      }
    } catch (error) {
      // Clear the timeout since we're sending an error
      clearTimeout(timeoutId);
      
      console.error('Error generating test visualization:', error);
      
      if (!hasResponded) {
        hasResponded = true;
        res.status(500).send(`
          <html>
            <head>
              <title>Error - Conjoint Analysis Visualization</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
              <style>
                body { 
                  font-family: Arial, sans-serif; 
                  margin: 0 auto; 
                  padding: 15px; 
                  max-width: 600px;
                }
                h1 { 
                  color: #e74c3c; 
                  font-size: 1.4rem;
                }
                .error-box {
                  background: #fee;
                  border: 1px solid #e74c3c;
                  border-radius: 5px;
                  padding: 10px;
                  margin: 15px 0;
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
              </style>
            </head>
            <body>
              <h1>Error Generating Visualization</h1>
              <div class="error-box">
                <p>${error.message || 'Unknown error occurred'}</p>
              </div>
              <p>Please try again later or contact support if the issue persists.</p>
              <a href="/" class="back-link">&laquo; Back to Dashboard</a>
            </body>
          </html>
        `);
      }
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