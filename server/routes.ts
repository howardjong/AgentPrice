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
              <meta http-equiv="refresh" content="5;url=/api/test-visualization/van-westendorp">
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
      // Use sample data to create an interactive Plotly.js visualization
      const sampleData = [
        {
          name: 'Price',
          importance: 35,
          levels: [
            { name: '$499', partWorth: 3.5 },
            { name: '$699', partWorth: 1.2 },
            { name: '$899', partWorth: -0.8 },
            { name: '$1099', partWorth: -4.5 }
          ]
        },
        {
          name: 'Storage',
          importance: 25,
          levels: [
            { name: '128GB', partWorth: -2.1 },
            { name: '256GB', partWorth: 0.2 },
            { name: '512GB', partWorth: 2.5 },
            { name: '1TB', partWorth: 3.8 }
          ]
        },
        {
          name: 'Battery Life',
          importance: 20,
          levels: [
            { name: '8 hours', partWorth: -2.8 },
            { name: '10 hours', partWorth: -0.5 },
            { name: '12 hours', partWorth: 1.2 },
            { name: '15 hours', partWorth: 3.0 }
          ]
        },
        {
          name: 'Camera',
          importance: 15,
          levels: [
            { name: '12MP', partWorth: -1.5 },
            { name: '16MP', partWorth: 0.5 },
            { name: '20MP', partWorth: 1.8 },
            { name: '24MP', partWorth: 2.5 }
          ]
        }
      ];

      // Prepare data for the importance chart
      const importanceChartData = {
        x: sampleData.map(d => d.name),
        y: sampleData.map(d => d.importance),
        type: 'bar',
        marker: {
          color: ['#3498db', '#2ecc71', '#f39c12', '#9b59b6'],
          opacity: 0.8
        }
      };

      // Prepare data for the part-worth utility chart
      const partWorthTraces = sampleData.map((attribute, index) => {
        const colors = ['#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
        return {
          x: attribute.levels.map(level => level.name),
          y: attribute.levels.map(level => level.partWorth),
          name: attribute.name,
          type: 'bar',
          marker: {
            color: colors[index % colors.length]
          }
        };
      });

      // Create the result with interactive charts
      const result = {
        title: 'Conjoint Analysis of Product Features',
        description: 'Analysis of consumer preferences for different product features and levels',
        visualizationType: 'conjoint_analysis',
        modelUsed: 'Interactive Plotly.js',
        importanceChartData: JSON.stringify(importanceChartData),
        partWorthTraces: JSON.stringify(partWorthTraces)
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
              <script src="https://cdn.plot.ly/plotly-2.29.1.min.js"></script>
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
                  text-align: center;
                }
                p {
                  font-size: 0.9rem;
                  line-height: 1.4;
                  margin: 8px 0;
                  text-align: center;
                }
                .visualization-container { 
                  margin: 20px auto;
                  max-width: 1200px;
                }
                .chart-container {
                  margin: 15px 0;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
                  border-radius: 5px;
                  background: white;
                  overflow: hidden;
                }
                .model-info { 
                  margin: 15px auto; 
                  padding: 10px; 
                  background: #f8f9fa; 
                  border-radius: 5px;
                  font-size: 0.85rem;
                  max-width: 600px;
                }
                .back-link {
                  display: block;
                  margin: 15px auto;
                  background: #f0f0f0;
                  padding: 8px 15px;
                  border-radius: 4px;
                  text-decoration: none;
                  color: #333;
                  font-weight: bold;
                  text-align: center;
                  max-width: 150px;
                }
                .interpretation {
                  margin: 15px auto;
                  padding: 10px;
                  background: #f0f7ff;
                  border-radius: 5px;
                  font-size: 0.9rem;
                  max-width: 600px;
                }
                .interpretation h3 {
                  margin-top: 0;
                  font-size: 1rem;
                }
                .interpretation ul {
                  padding-left: 20px;
                  margin: 8px 0;
                }
                @media (min-width: 768px) {
                  body {
                    padding: 20px;
                  }
                  h1 {
                    font-size: 1.8rem;
                  }
                  p {
                    font-size: 1rem;
                  }
                  .grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                  }
                }
              </style>
            </head>
            <body>
              <h1>${result.title}</h1>
              <p>${result.description}</p>
              
              <div class="visualization-container">
                <div class="grid">
                  <div class="chart-container">
                    <div id="importance-chart" style="height: 300px;"></div>
                  </div>
                  <div class="chart-container">
                    <div id="partworth-chart" style="height: 300px;"></div>
                  </div>
                </div>
                
                <div class="interpretation">
                  <h3>How to interpret these charts:</h3>
                  <ul>
                    <li><strong>Feature Importance</strong>: Shows the relative importance of each feature in customer decision-making.</li>
                    <li><strong>Part-Worth Utilities</strong>: Indicates how much value customers place on specific feature levels. Higher values mean customers prefer that option more.</li>
                  </ul>
                </div>
                
                <div class="model-info">
                  <p><strong>Visualization Type:</strong> ${result.visualizationType}</p>
                  <p><strong>Source:</strong> ${result.modelUsed}</p>
                </div>
              </div>
              
              <a href="/" class="back-link">&laquo; Back to Dashboard</a>
              
              <script>
                // Render the importance chart
                const importanceData = [${result.importanceChartData}];
                const importanceLayout = {
                  title: 'Feature Importance',
                  xaxis: {
                    title: 'Features'
                  },
                  yaxis: {
                    title: 'Importance (%)',
                    range: [0, 50]
                  },
                  margin: {
                    l: 50,
                    r: 30,
                    b: 60,
                    t: 50,
                    pad: 4
                  }
                };
                
                Plotly.newPlot('importance-chart', importanceData, importanceLayout, {responsive: true});
                
                // Render the part-worth utilities chart
                const partWorthTraces = ${result.partWorthTraces};
                const partWorthLayout = {
                  title: 'Part-Worth Utilities by Feature Level',
                  barmode: 'group',
                  xaxis: {
                    title: 'Feature Levels',
                    tickangle: -30
                  },
                  yaxis: {
                    title: 'Part-Worth Utility'
                  },
                  legend: {
                    orientation: 'h',
                    y: -0.2
                  },
                  margin: {
                    l: 50,
                    r: 30,
                    b: 100,
                    t: 50,
                    pad: 4
                  }
                };
                
                Plotly.newPlot('partworth-chart', partWorthTraces, partWorthLayout, {responsive: true});
              </script>
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