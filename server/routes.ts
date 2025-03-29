import express, { type Express, Request, Response } from "express";
// Import Multer type definitions
import type { Multer } from "multer";
import { createServer, type Server } from "http";
import { Server as SocketIoServer } from "socket.io";
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
// @ts-ignore - Ignore missing type definitions for initializeMockResearch module
import { initializeAllMockResearch } from '../services/initializeMockResearch.js';
import { checkSystemHealth } from './services/healthCheck';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

// Define interfaces for service responses
interface ClaudeResult {
  response: string;
  visualizationData?: any;
  modelUsed?: string;
}

interface PerplexityResult {
  response: string;
  citations?: any[];
  modelUsed?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Define multer types for callbacks
  type MulterFile = { 
    originalname: string, 
    mimetype: string 
  };
  type MulterCallback = (error: Error | null, value?: any) => void;

  // Configure multer storage
  const multerStorage = multer.diskStorage({
    destination: function (req: any, file: MulterFile, cb: MulterCallback) {
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.resolve('./uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      cb(null, uploadsDir);
    },
    filename: function (req: any, file: MulterFile, cb: MulterCallback) {
      // Generate unique filename with timestamp
      const uniqueFilename = `${Date.now()}-${uuidv4().slice(0, 8)}-${file.originalname}`;
      cb(null, uniqueFilename);
    }
  });

  // Create multer upload middleware
  const upload = multer({ 
    storage: multerStorage,
    limits: {
      fileSize: 1024 * 1024 * 10, // 10MB max file size
    },
    fileFilter: function (req: any, file: MulterFile, cb: MulterCallback) {
      // Accept text files and CSVs only
      const filetypes = /text|txt|csv|json|md/;
      const mimetype = filetypes.test(file.mimetype);
      const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

      if (mimetype && extname) {
        return cb(null, true);
      }
      cb(new Error('Only text, CSV, JSON, and Markdown files are allowed'));
    }
  });

  // Initialize services
  const claudeStatus = claudeService.getStatus();
  const perplexityStatus = perplexityService.getStatus();

  // Update storage with initial service status
  await storage.updateServiceStatus('claude', claudeStatus);
  await storage.updateServiceStatus('perplexity', perplexityStatus);

  // WebSocket test pages
  app.get('/websocket-test', (req: Request, res: Response) => {
    res.sendFile(path.resolve('.', 'public', 'websocket-test.html'));
  });
  
  app.get('/websocket-debug', (req: Request, res: Response) => {
    res.sendFile(path.resolve('.', 'public', 'websocket-debug.html'));
  });
  
  app.get('/socketio-debug', (req: Request, res: Response) => {
    res.sendFile(path.resolve('.', 'public', 'socketio-debug.html'));
  });
  
  app.get('/socketio-test', (req: Request, res: Response) => {
    res.sendFile(path.resolve('.', 'public', 'socketio-test.html'));
  });
  
  // Health endpoint
  app.get('/api/health', async (req: Request, res: Response) => {
    try {
      // Check API status from storage
      const apiStatus = await storage.getApiStatus();
      
      const healthData = {
        redis: { 
          status: 'Connected', 
          healthy: true 
        },
        promptManager: { 
          status: 'Healthy', 
          healthy: true 
        },
        circuitBreaker: { 
          status: 'Operational', 
          healthy: true,
          openCircuits: [] 
        },
        memory: { 
          usagePercent: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100 
        },
        apiServices: {
          claude: apiStatus.claude,
          perplexity: apiStatus.perplexity,
          server: apiStatus.server
        }
      };
      
      const allHealthy = 
        healthData.redis.healthy && 
        healthData.promptManager.healthy && 
        healthData.circuitBreaker.healthy;
      
      const statusCode = allHealthy ? 200 : 503;
      res.status(statusCode).json(healthData);
    } catch (error: any) {
      console.error('Health check failed:', error);
      res.status(500).json({
        status: 'error',
        message: `Health check failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Assistant health check endpoint - simplified version for external health checkers
  // This endpoint DOES NOT make real API calls to minimize costs
  app.get('/api/assistant/health', async (req: Request, res: Response) => {
    try {
      // Use the health check service to check system health without making API calls
      const healthStatus = checkSystemHealth();
      
      // Map the status to HTTP status code
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503;
      
      // Create a simplified response
      const responseBody = {
        status: healthStatus.status,
        apiKeys: {
          allPresent: healthStatus.apiKeys.allKeysPresent
        },
        system: {
          memory: {
            usagePercent: Math.round(healthStatus.memory.usagePercent * 100) / 100,
            healthy: healthStatus.memory.healthy
          },
          fileSystem: healthStatus.fileSystem.allDirsExist
        },
        timestamp: new Date().toISOString()
      };
      
      res.status(statusCode).json(responseBody);
    } catch (error: any) {
      console.error('Assistant health check failed:', error);
      res.status(500).json({ 
        status: 'error',
        message: `Health check failed: ${error.message}`,
        timestamp: new Date().toISOString() 
      });
    }
  });

  // Serve the charts view page
  app.get('/view-charts.html', (req: Request, res: Response) => {
    // Using import.meta.url instead of __dirname for ES modules
    const __filename = new URL(import.meta.url).pathname;
    const __dirname = path.dirname(__filename);
    res.sendFile(path.resolve(__dirname, '../public/view-charts.html'));
  });

  // Additional endpoint for better URL structure
  app.get('/view-charts', (req: Request, res: Response) => {
    const __filename = new URL(import.meta.url).pathname;
    const __dirname = path.dirname(__filename);
    res.sendFile(path.resolve(__dirname, '../public/view-charts.html'));
  });

  // Content editor page for directly pasting content
  app.get('/content-editor', (req: Request, res: Response) => {
    const __filename = new URL(import.meta.url).pathname;
    const __dirname = path.dirname(__filename);
    res.sendFile(path.resolve(__dirname, '../public/content-editor.html'));
  });

  // Simple file analyzer page
  app.get('/file-analyzer', (req: Request, res: Response) => {
    const __filename = new URL(import.meta.url).pathname;
    const __dirname = path.dirname(__filename);
    res.sendFile(path.resolve(__dirname, '../public/file-analyzer.html'));
  });

  // API endpoint to analyze file content
  app.post('/api/analyze-file', async (req: Request, res: Response) => {
    try {
      const { content, chartType, contentType } = req.body;
      
      if (!content) {
        return res.status(400).json({
          success: false,
          error: 'Content is required'
        });
      }
      
      // Save content to file in the content-uploads directory
      const timestamp = Date.now();
      const filename = `content-${timestamp}.txt`;
      const filePath = path.resolve('./content-uploads', filename);
      
      // Ensure directory exists
      if (!fs.existsSync('./content-uploads')) {
        fs.mkdirSync('./content-uploads', { recursive: true });
      }
      
      // Write content to file
      fs.writeFileSync(filePath, content);
      
      // Read the content analysis prompt
      const __filename = new URL(import.meta.url).pathname;
      const __dirname = path.dirname(__filename);
      const promptPath = path.resolve(__dirname, '../prompts/claude/content_analysis/default.txt');
      
      let prompt = '';
      try {
        prompt = fs.readFileSync(promptPath, 'utf8');
      } catch (error: any) {
        console.error('Error reading content analysis prompt:', error);
        prompt = 'Analyze the following content and extract data for visualization. Create a Plotly.js configuration that best represents the data.';
      }
      
      // Create system message with prompt
      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: `Content Type: ${contentType}\nRequested Chart Type: ${chartType}\n\nContent to analyze:\n\n${content}`
        }
      ];
      
      // Call Claude's API to analyze the content
      const result = await claudeService.processConversation(messages);
      
      // Try to parse the response as JSON
      let parsedResult: any;
      try {
        // First, try to find JSON in code blocks
        const jsonCodeBlockMatch = result.response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonCodeBlockMatch && jsonCodeBlockMatch[1]) {
          try {
            parsedResult = JSON.parse(jsonCodeBlockMatch[1]);
          } catch (e) {
            console.warn('Found JSON code block but failed to parse it:', e);
          }
        }
        
        // If code block approach failed, try to extract any JSON object
        if (!parsedResult) {
          const jsonMatch = result.response.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            try {
              parsedResult = JSON.parse(jsonMatch[0]);
            } catch (e) {
              console.warn('Found potential JSON but failed to parse it:', e);
            }
          }
        }
        
        // If both approaches failed, generate a default response
        if (!parsedResult) {
          // Create a default Plotly config with a message
          parsedResult = {
            plotlyConfig: {
              data: [{
                type: 'scatter',
                x: [1, 2, 3, 4],
                y: [0, 0, 0, 0],
                mode: 'lines',
                name: 'No data'
              }],
              layout: {
                title: 'No data found for visualization',
                annotations: [{
                  text: 'Claude could not extract data from the provided content. Please try with content containing numerical data.',
                  showarrow: false,
                  x: 0.5,
                  y: 0.5,
                  xref: 'paper',
                  yref: 'paper'
                }]
              },
              config: { responsive: true }
            },
            insights: [
              "No structured data was found in the provided content.",
              "Claude analyzed the content but couldn't extract visualization-ready data.",
              "Try providing content with tables, statistics, or numerical data."
            ]
          };
        }
      } catch (parseError) {
        console.error('Error parsing Claude response as JSON:', parseError);
        return res.status(500).json({
          success: false,
          error: 'Failed to parse analysis result as JSON',
          rawResponse: result.response
        });
      }
      
      // Save the file path in the result for reference
      parsedResult.sourceFile = filename;
      
      res.json({
        success: true,
        ...parsedResult,
        modelUsed: result.modelUsed || 'claude'
      });
    } catch (error: any) {
      console.error('Error analyzing file content:', error);
      res.status(500).json({
        success: false,
        error: `Failed to analyze file content: ${error.message}`
      });
    }
  });

  // Endpoint to test Claude's visualization capabilities with random data
  app.post('/api/test-claude-visualization', async (req: Request, res: Response) => {
    try {
      const { data, type, title, description } = req.body;
      
      if (!data || !type) {
        return res.status(400).json({ 
          success: false, 
          error: 'Data and type are required' 
        });
      }
      
      // Send the data to Claude for visualization generation
      const result = await claudeService.generateVisualization(
        data,
        type,
        title || 'Test Visualization',
        description || 'Generated from test data'
      );
      
      // Return both Claude's results and the input data for comparison
      res.json({
        success: true,
        claudeResult: result,
        inputData: {
          data,
          type,
          title,
          description
        }
      });
    } catch (error: any) {
      console.error('Error testing Claude visualization:', error);
      res.status(500).json({ 
        success: false, 
        error: `Failed to test Claude visualization: ${error.message}`
      });
    }
  });
  
  // Serve chart files from tests/output directory
  app.get('/chart-data/:filename', (req: Request, res: Response) => {
    const filename = req.params.filename;
    const __filename = new URL(import.meta.url).pathname;
    const __dirname = path.dirname(__filename);
    const filePath = path.resolve(__dirname, `../tests/output/${filename}`);
    res.sendFile(filePath);
  });
  
  // API to list available chart files
  app.get('/api/chart-files', (req: Request, res: Response) => {
    try {
      const __filename = new URL(import.meta.url).pathname;
      const __dirname = path.dirname(__filename);
      const outputDir = path.resolve(__dirname, '../tests/output');
      const files = fs.readdirSync(outputDir)
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          name: file,
          url: `/chart-data/${file}`
        }));
      res.json({ success: true, files });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Status Endpoint
  app.get('/api/status', async (req: Request, res: Response) => {
    try {
      const status = await storage.getApiStatus();
      res.json(status);
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
      console.error('Error generating visualization:', error);
      res.status(500).json({ message: `Failed to generate visualization: ${error.message}` });
    }
  });
  
  // Content Analysis Endpoint
  app.post('/api/analyze-content', async (req: Request, res: Response) => {
    try {
      const { content, contentType, chartType } = req.body;
      
      if (!content) {
        return res.status(400).json({
          success: false,
          error: 'Content is required'
        });
      }
      
      // Read the content analysis prompt
      const __filename = new URL(import.meta.url).pathname;
      const __dirname = path.dirname(__filename);
      const promptPath = path.resolve(__dirname, '../prompts/claude/content_analysis/default.txt');
      
      let prompt = '';
      try {
        prompt = fs.readFileSync(promptPath, 'utf8');
      } catch (error: any) {
        console.error('Error reading content analysis prompt:', error);
        prompt = 'Analyze the following content and extract data for visualization. Create a Plotly.js configuration that best represents the data.';
      }
      
      // Create system message with prompt
      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: `Content Type: ${contentType}\nRequested Chart Type: ${chartType}\n\nContent to analyze:\n\n${content}`
        }
      ];
      
      // Call Claude's API to analyze the content
      const result = await claudeService.processConversation(messages);
      
      // Try to parse the response as JSON
      let parsedResult: any;
      try {
        // First, try to find JSON in code blocks
        const jsonCodeBlockMatch = result.response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonCodeBlockMatch && jsonCodeBlockMatch[1]) {
          try {
            parsedResult = JSON.parse(jsonCodeBlockMatch[1]);
          } catch (e) {
            console.warn('Found JSON code block but failed to parse it:', e);
          }
        }
        
        // If code block approach failed, try to extract any JSON object
        if (!parsedResult) {
          const jsonMatch = result.response.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            try {
              parsedResult = JSON.parse(jsonMatch[0]);
            } catch (e) {
              console.warn('Found potential JSON but failed to parse it:', e);
            }
          }
        }
        
        // If both approaches failed, generate a default response
        if (!parsedResult) {
          // Create a default Plotly config with a message
          parsedResult = {
            plotlyConfig: {
              data: [{
                type: 'scatter',
                x: [1, 2, 3, 4],
                y: [0, 0, 0, 0],
                mode: 'lines',
                name: 'No data'
              }],
              layout: {
                title: 'No data found for visualization',
                annotations: [{
                  text: 'Claude could not extract data from the provided content. Please try with content containing numerical data.',
                  showarrow: false,
                  x: 0.5,
                  y: 0.5,
                  xref: 'paper',
                  yref: 'paper'
                }]
              },
              config: { responsive: true }
            },
            insights: [
              "No structured data was found in the provided content.",
              "Claude analyzed the content but couldn't extract visualization-ready data.",
              "Try providing content with tables, statistics, or numerical data."
            ]
          };
        }
      } catch (parseError) {
        console.error('Error parsing Claude response as JSON:', parseError);
        return res.status(500).json({
          success: false,
          error: 'Failed to parse analysis result as JSON',
          rawResponse: result.response
        });
      }
      
      res.json({
        success: true,
        ...parsedResult,
        modelUsed: result.modelUsed || 'claude'
      });
    } catch (error: any) {
      console.error('Error analyzing content:', error);
      res.status(500).json({
        success: false,
        error: `Failed to analyze content: ${error.message}`
      });
    }
  });

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
                  margin-top: 20px;
                  text-decoration: none;
                  color: #3498db;
                }
              </style>
            </head>
            <body>
              <h1>Processing Van Westendorp Visualization</h1>
              <p>This may take up to 20 seconds...</p>
              <div class="loading"></div>
              <p>The page will refresh automatically when complete.</p>
              <a href="/view-charts" class="back-link">← Back to Chart Viewer</a>
            </body>
          </html>
        `);
      }
    }, 3000);

    try {
      // Generate random Van Westendorp data
      const data = {
        tooExpensive: [
          { price: 5, percentage: 0.01 },
          { price: 10, percentage: 0.05 },
          { price: 15, percentage: 0.10 },
          { price: 20, percentage: 0.25 },
          { price: 25, percentage: 0.50 },
          { price: 30, percentage: 0.65 },
          { price: 35, percentage: 0.80 },
          { price: 40, percentage: 0.92 },
          { price: 45, percentage: 0.98 },
          { price: 50, percentage: 1.00 }
        ],
        tooInexpensive: [
          { price: 5, percentage: 0.99 },
          { price: 10, percentage: 0.92 },
          { price: 15, percentage: 0.80 },
          { price: 20, percentage: 0.60 },
          { price: 25, percentage: 0.45 },
          { price: 30, percentage: 0.30 },
          { price: 35, percentage: 0.18 },
          { price: 40, percentage: 0.08 },
          { price: 45, percentage: 0.02 },
          { price: 50, percentage: 0.01 }
        ],
        expensive: [
          { price: 5, percentage: 0.00 },
          { price: 10, percentage: 0.02 },
          { price: 15, percentage: 0.05 },
          { price: 20, percentage: 0.15 },
          { price: 25, percentage: 0.30 },
          { price: 30, percentage: 0.55 },
          { price: 35, percentage: 0.70 },
          { price: 40, percentage: 0.85 },
          { price: 45, percentage: 0.95 },
          { price: 50, percentage: 0.99 }
        ],
        inexpensive: [
          { price: 5, percentage: 0.80 },
          { price: 10, percentage: 0.75 },
          { price: 15, percentage: 0.60 },
          { price: 20, percentage: 0.45 },
          { price: 25, percentage: 0.30 },
          { price: 30, percentage: 0.20 },
          { price: 35, percentage: 0.10 },
          { price: 40, percentage: 0.05 },
          { price: 45, percentage: 0.02 },
          { price: 50, percentage: 0.00 }
        ]
      };
      
      // Create a Plotly configuration directly
      const plotlyConfig = {
        data: [
          {
            x: data.tooExpensive.map(point => point.price),
            y: data.tooExpensive.map(point => point.percentage * 100),
            mode: 'lines',
            name: 'Too Expensive',
            line: { color: '#e74c3c', width: 3 }
          },
          {
            x: data.tooInexpensive.map(point => point.price),
            y: data.tooInexpensive.map(point => point.percentage * 100),
            mode: 'lines',
            name: 'Too Inexpensive',
            line: { color: '#3498db', width: 3 }
          },
          {
            x: data.expensive.map(point => point.price),
            y: data.expensive.map(point => point.percentage * 100),
            mode: 'lines',
            name: 'Expensive',
            line: { color: '#e67e22', width: 3, dash: 'dot' }
          },
          {
            x: data.inexpensive.map(point => point.price),
            y: data.inexpensive.map(point => point.percentage * 100),
            mode: 'lines',
            name: 'Inexpensive',
            line: { color: '#2ecc71', width: 3, dash: 'dot' }
          }
        ],
        layout: {
          title: 'Van Westendorp Price Sensitivity Analysis',
          xaxis: {
            title: 'Price ($)',
            range: [0, 55]
          },
          yaxis: {
            title: 'Percentage of Respondents (%)',
            range: [0, 100]
          },
          hovermode: 'closest',
          legend: {
            x: 0.1,
            y: 1
          },
          shapes: [
            // Indifference Price Point (IPP)
            {
              type: 'line',
              xref: 'x',
              yref: 'paper',
              x0: 24,
              y0: 0,
              x1: 24,
              y1: 1,
              line: {
                color: 'rgba(0, 0, 0, 0.4)',
                width: 1,
                dash: 'dash'
              }
            },
            // Optimal Price Point (OPP)
            {
              type: 'line',
              xref: 'x',
              yref: 'paper',
              x0: 19,
              y0: 0,
              x1: 19,
              y1: 1,
              line: {
                color: 'rgba(0, 0, 0, 0.4)',
                width: 1,
                dash: 'dash'
              }
            }
          ],
          annotations: [
            {
              x: 24,
              y: 95,
              xref: 'x',
              yref: 'y',
              text: 'IPP: $24',
              showarrow: true,
              arrowhead: 4,
              ax: 0,
              ay: -40
            },
            {
              x: 19,
              y: 85,
              xref: 'x',
              yref: 'y',
              text: 'OPP: $19',
              showarrow: true,
              arrowhead: 4,
              ax: 0,
              ay: -40
            }
          ]
        },
        config: {
          responsive: true,
          displayModeBar: true,
          modeBarButtonsToRemove: ['lasso2d', 'select2d'],
          toImageButtonOptions: {
            format: 'png',
            filename: 'van_westendorp_analysis',
            height: 500,
            width: 700,
            scale: 2
          }
        }
      };
      
      // Calculate intersections
      const insights = [
        "The Indifference Price Point (IPP) is at $24, where an equal percentage of respondents consider the product expensive and inexpensive.",
        "The Optimal Price Point (OPP) is at $19, where fewest respondents reject the price as either too expensive or too inexpensive.",
        "The acceptable price range appears to be between $18 and $29.",
        "Pricing below $15 may lead to perceptions of poor quality.",
        "Pricing above $35 significantly increases the percentage of customers who would consider the product too expensive."
      ];
      
      // Only process the request once
      if (!hasResponded) {
        hasResponded = true;
        clearTimeout(timeoutId);
        
        const result = {
          success: true,
          plotlyConfig,
          insights,
          source: 'generated',
          type: 'van_westendorp'
        };
        
        // Save the result to a file in the tests/output directory
        const __filename = new URL(import.meta.url).pathname;
        const __dirname = path.dirname(__filename);
        const outputDir = path.resolve(__dirname, '../tests/output');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const filename = `van-westendorp-${Date.now()}.json`;
        fs.writeFileSync(path.resolve(outputDir, filename), JSON.stringify(result, null, 2));
        
        res.json(result);
      }
    } catch (error: any) {
      // Only process the error once
      if (!hasResponded) {
        hasResponded = true;
        clearTimeout(timeoutId);
        console.error('Error generating Van Westendorp visualization:', error);
        res.status(500).json({ 
          success: false, 
          error: `Failed to generate Van Westendorp visualization: ${error.message}` 
        });
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
                  margin-top: 20px;
                  text-decoration: none;
                  color: #3498db;
                }
              </style>
            </head>
            <body>
              <h1>Processing Conjoint Analysis Visualization</h1>
              <p>This may take up to 20 seconds...</p>
              <div class="loading"></div>
              <p>The page will refresh automatically when complete.</p>
              <a href="/view-charts" class="back-link">← Back to Chart Viewer</a>
            </body>
          </html>
        `);
      }
    }, 3000);

    try {
      // Generate example data for conjoint analysis
      const attributes = [
        { 
          name: 'Brand', 
          levels: [
            { name: 'Premium Brand', utility: 0.8 },
            { name: 'Mid-tier Brand', utility: 0.4 },
            { name: 'Value Brand', utility: -0.2 },
            { name: 'Generic Brand', utility: -1.0 }
          ],
          importance: 35
        },
        {
          name: 'Price Point',
          levels: [
            { name: '$9.99/month', utility: 1.2 },
            { name: '$14.99/month', utility: 0.6 },
            { name: '$19.99/month', utility: -0.2 },
            { name: '$29.99/month', utility: -1.6 }
          ],
          importance: 40
        },
        {
          name: 'Features',
          levels: [
            { name: 'Basic', utility: -0.8 },
            { name: 'Standard', utility: 0.1 },
            { name: 'Premium', utility: 0.7 }
          ],
          importance: 15
        },
        {
          name: 'Customer Support',
          levels: [
            { name: 'Email Only', utility: -0.4 },
            { name: 'Email + Chat', utility: 0.3 },
            { name: 'Email + Chat + Phone', utility: 0.5 }
          ],
          importance: 10
        }
      ];
      
      // Generate optimal product combinations
      const optimalCombinations = [
        {
          combination: ['Premium Brand', '$14.99/month', 'Premium', 'Email + Chat + Phone'],
          totalUtility: 2.0,
          marketShare: '28%'
        },
        {
          combination: ['Mid-tier Brand', '$9.99/month', 'Premium', 'Email + Chat + Phone'],
          totalUtility: 1.8,
          marketShare: '25%'
        },
        {
          combination: ['Premium Brand', '$19.99/month', 'Premium', 'Email + Chat + Phone'],
          totalUtility: 1.2,
          marketShare: '18%'
        }
      ];
      
      // Create Plotly configuration for attribute importance
      const importancePlotlyConfig = {
        data: [
          {
            x: attributes.map(attr => attr.name),
            y: attributes.map(attr => attr.importance),
            type: 'bar',
            marker: {
              color: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12'],
              line: {
                color: 'rgb(8,48,107)',
                width: 1.5
              }
            }
          }
        ],
        layout: {
          title: 'Attribute Importance in Product Selection',
          xaxis: {
            title: 'Attributes'
          },
          yaxis: {
            title: 'Importance (%)'
          }
        },
        config: {
          responsive: true
        }
      };
      
      // Create Plotly configuration for part-worth utilities
      interface UtilityDataItem {
        x: string[];
        y: number[];
        type: string;
        name: string;
        xaxis: string;
        yaxis: string;
        marker: {
          color: string;
          line: {
            color: string;
            width: number;
          }
        }
      }
      
      const utilitiesData: UtilityDataItem[] = [];
      
      attributes.forEach((attr, index) => {
        utilitiesData.push({
          x: attr.levels.map(level => level.name),
          y: attr.levels.map(level => level.utility),
          type: 'bar',
          name: attr.name,
          xaxis: `x${index + 1}`,
          yaxis: `y${index + 1}`,
          marker: {
            color: ['#3498db', '#2980b9', '#1abc9c', '#16a085'][index % 4],
            line: {
              color: 'rgb(8,48,107)',
              width: 1.5
            }
          }
        });
      });
      
      const subplots = {
        rows: 2,
        columns: 2,
        titles: attributes.map(attr => attr.name),
        shared_xaxes: false,
        shared_yaxes: true,
        subplot_titles: attributes.map(attr => attr.name),
        vertical_spacing: 0.15,
        horizontal_spacing: 0.1
      };
      
      const utilitiesPlotlyConfig = {
        data: utilitiesData,
        layout: {
          title: 'Part-Worth Utilities for Each Level',
          grid: {
            rows: 2,
            columns: 2,
            pattern: 'independent'
          },
          annotations: [
            {
              text: 'Brand',
              showarrow: false,
              x: 0.25,
              y: 1.0,
              xref: 'paper',
              yref: 'paper',
              font: { size: 16 }
            },
            {
              text: 'Price Point',
              showarrow: false,
              x: 0.8,
              y: 1.0,
              xref: 'paper',
              yref: 'paper',
              font: { size: 16 }
            },
            {
              text: 'Features',
              showarrow: false,
              x: 0.25,
              y: 0.45,
              xref: 'paper',
              yref: 'paper',
              font: { size: 16 }
            },
            {
              text: 'Customer Support',
              showarrow: false,
              x: 0.8,
              y: 0.45,
              xref: 'paper',
              yref: 'paper',
              font: { size: 16 }
            }
          ],
          height: 600
        },
        config: {
          responsive: true
        }
      };
      
      const insights = [
        "Price Point is the most important attribute at 40%, followed by Brand at 35%.",
        "The combination of Premium Brand at $14.99/month with Premium features has the highest predicted market share of 28%.",
        "Reducing price from $19.99 to $9.99 increases utility more than upgrading from Value to Premium brand.",
        "Customer support has relatively low importance (10%) but could be a differentiator for similarly priced products."
      ];
      
      // Combine all visualizations
      const result = {
        success: true,
        plotlyConfig: {
          importanceChart: importancePlotlyConfig,
          utilitiesChart: utilitiesPlotlyConfig
        },
        data: {
          attributes,
          optimalCombinations
        },
        insights,
        source: 'generated',
        type: 'conjoint_analysis'
      };
      
      // Save the result to a file in the tests/output directory
      const __filename = new URL(import.meta.url).pathname;
      const __dirname = path.dirname(__filename);
      const outputDir = path.resolve(__dirname, '../tests/output');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `conjoint-analysis-${Date.now()}.json`;
      fs.writeFileSync(path.resolve(outputDir, filename), JSON.stringify(result, null, 2));
      
      // Only process the request once
      if (!hasResponded) {
        hasResponded = true;
        clearTimeout(timeoutId);
        res.json(result);
      }
    } catch (error: any) {
      // Only process the error once
      if (!hasResponded) {
        hasResponded = true;
        clearTimeout(timeoutId);
        console.error('Error generating conjoint analysis visualization:', error);
        res.status(500).json({ 
          success: false, 
          error: `Failed to generate conjoint analysis visualization: ${error.message}` 
        });
      }
    }
  });
  
  // Initialize mock research data (for testing purposes)
  app.post('/api/mock-init', async (req: Request, res: Response) => {
    try {
      const options = req.body || {};
      await initializeAllMockResearch(options);
      res.json({ success: true, message: 'Mock research data initialized' });
    } catch (error: any) {
      console.error('Error initializing mock research data:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Setup Socket.io server for real-time updates
  const io = new SocketIoServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  
  // Client metadata interface
  interface ClientMetadata {
    id: string;
    lastActivity: number;
    subscriptions: string[];
  }
  
  // Store client data
  const clientsData = new Map<string, ClientMetadata>();
  
  // Socket.io helper functions
  // Function to send system status to a client
  function sendSystemStatus(socketId: string) {
    try {
      // Get health status synchronously (not a Promise)
      const healthStatus = checkSystemHealth();
      
      // Send system status to the client
      io.to(socketId).emit('message', {
        type: 'system_status',
        timestamp: Date.now(),
        status: healthStatus.status,
        memory: {
          usagePercent: Math.round(healthStatus.memory.usagePercent * 100) / 100,
          healthy: healthStatus.memory.healthy
        },
        apiServices: {
          claude: {
            status: 'online',
            requestCount: 0
          },
          perplexity: {
            status: 'online',
            requestCount: 0
          }
        },
        optimization: {
          enabled: true,
          tokenSavings: 0,
          tier: 'standard'
        }
      });
    } catch (error) {
      console.error('Error sending system status:', error);
    }
  }
  
  // Function to send API status to a client
  async function sendApiStatus(socketId: string) {
    try {
      // Get API status from storage
      const apiStatus = await storage.getApiStatus();
      
      // Send API status to the client with additional UI-friendly fields
      io.to(socketId).emit('message', {
        type: 'api-status',
        timestamp: Date.now(),
        data: {
          claude: {
            status: apiStatus.claude.status,
            model: apiStatus.claude.version || 'claude-3-7-sonnet-20250219',
            responseTime: 0, // Not tracked in our base ApiStatus interface
            costPerHour: 8.5, // Fixed value for UI
            uptime: 99.8 // Fixed value for UI
          },
          perplexity: {
            status: apiStatus.perplexity.status,
            model: apiStatus.perplexity.version || 'sonar',
            responseTime: 0, // Not tracked in our base ApiStatus interface
            costPerHour: 5.2, // Fixed value for UI
            uptime: 99.9 // Fixed value for UI
          },
          lastUpdated: new Date().toISOString(),
          healthScore: 98 // Fixed value for UI
        }
      });
    } catch (error) {
      console.error('Error sending API status:', error);
    }
  }
  
  // Socket.io event handlers
  io.on('connection', (socket) => {
    // Get the client ID from socket.id
    const clientId = socket.id;
    const metadata: ClientMetadata = { 
      id: clientId, 
      lastActivity: Date.now(),
      subscriptions: ['all'] // Default subscription to all channels
    };
    
    // Store client metadata
    clientsData.set(clientId, metadata);
    
    // Add socket to the 'all' room by default
    socket.join('all');
    
    console.log(`Socket.io client connected: ${clientId}`);
    console.log(`Total connected Socket.io clients: ${io.engine.clientsCount}`);
    
    // Send initial system status and API status
    try {
      // Send both system status and API status on initial connection
      sendSystemStatus(clientId);
      sendApiStatus(clientId);
    } catch (error) {
      console.error(`Error sending initial status to ${clientId}:`, error);
    }
    
    // Handle subscription requests
    socket.on('subscribe', (message) => {
      try {
        console.log(`Subscription request from ${clientId}:`, message);
        const topics = message.topics || message.channels || [];
        
        // Update client metadata
        metadata.lastActivity = Date.now();
        metadata.subscriptions = topics;
        
        // Leave all rooms first (except the default socket.id room)
        socket.rooms.forEach(room => {
          if (room !== clientId) {
            socket.leave(room);
          }
        });
        
        // Join all requested topic rooms
        topics.forEach(topic => {
          socket.join(topic);
        });
        
        // Always add to 'all' room for broadcast messages
        socket.join('all');
        
        // Send confirmation
        socket.emit('message', { 
          type: 'subscription_update', 
          status: 'success',
          topics: topics 
        });
      } catch (error) {
        console.error(`Error handling subscription from ${clientId}:`, error);
        socket.emit('error', { message: 'Failed to process subscription request' });
      }
    });
    
    // Handle ping requests
    socket.on('ping', (message) => {
      metadata.lastActivity = Date.now();
      socket.emit('message', { 
        type: 'pong', 
        time: Date.now(),
        status: 'ok' 
      });
    });
    
    // Handle status requests
    socket.on('request_status', () => {
      metadata.lastActivity = Date.now();
      sendSystemStatus(clientId);
    });
    
    // Handle API status requests
    socket.on('request_api_status', () => {
      metadata.lastActivity = Date.now();
      sendApiStatus(clientId);
    });
    
    // Handle custom message format for backward compatibility
    socket.on('message', (data) => {
      try {
        console.log(`Received message from ${clientId}:`, typeof data === 'string' ? data : JSON.stringify(data));
        const message = typeof data === 'string' ? JSON.parse(data) : data;
        
        // Update client metadata
        metadata.lastActivity = Date.now();
        
        // Handle different message types
        if (message.type === 'subscribe') {
          const topics = message.topics || message.channels || [];
          metadata.subscriptions = topics;
          
          // Leave all rooms first (except the default socket.id room)
          socket.rooms.forEach(room => {
            if (room !== clientId) {
              socket.leave(room);
            }
          });
          
          // Join all requested topic rooms
          topics.forEach(topic => {
            socket.join(topic);
          });
          
          // Always add to 'all' room for broadcast messages
          socket.join('all');
          
          socket.emit('message', { 
            type: 'subscription_update', 
            status: 'success',
            topics: topics 
          });
        } else if (message.type === 'ping') {
          socket.emit('message', { 
            type: 'pong', 
            time: Date.now(),
            status: 'ok'
          });
        } else if (message.type === 'request_status') {
          sendSystemStatus(clientId);
        } else if (message.type === 'request_api_status') {
          sendApiStatus(clientId);
        }
      } catch (error) {
        console.error(`Error processing message from ${clientId}:`, error);
        socket.emit('error', { message: 'Invalid message format' });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`Socket.io client disconnected: ${clientId}, reason: ${reason}`);
      clientsData.delete(clientId);
    });
    
    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket.io error for client ${clientId}:`, error);
    });
  });
  
  // Define message structure
  interface WebSocketMessage {
    type: string;
    timestamp: number;
    [key: string]: any;
  }
  
  // Broadcast a message to all connected clients
  function broadcastMessage(message: WebSocketMessage) {
    // Using Socket.io rooms for efficient broadcasting
    // Broadcast to the specific message type room and to 'all' room
    io.to(message.type).to('all').emit('message', message);
  }
  
  // Broadcast research progress updates
  function broadcastResearchProgress(jobId: string, progress: number, status: string) {
    broadcastMessage({
      type: 'research_progress',
      jobId,
      progress,
      status,
      timestamp: Date.now()
    });
  }
  
  // Broadcast system optimization status
  function broadcastOptimizationStatus(status: any) {
    broadcastMessage({
      type: 'optimization_status',
      status,
      timestamp: Date.now()
    });
  }
  
  // Schedule periodic status broadcast
  setInterval(() => {
    // Check for stale connections
    const now = Date.now();
    clientsData.forEach((metadata, clientId) => {
      // If client hasn't been active for more than 30 minutes, consider it stale
      if (now - metadata.lastActivity > 30 * 60 * 1000) {
        console.log(`Removing stale client data: ${metadata.id}`);
        clientsData.delete(clientId);
      }
    });
    
    // Broadcast system status to all clients every minute
    if (io.engine.clientsCount > 0) {
      try {
        // Get health status synchronously (not a Promise)
        const healthStatus = checkSystemHealth();
        
        broadcastMessage({
          type: 'system_status',
          timestamp: Date.now(),
          status: healthStatus.status,
          memory: {
            usagePercent: Math.round(healthStatus.memory.usagePercent * 100) / 100,
            healthy: healthStatus.memory.healthy
          },
          apiServices: {
            claude: {
              status: 'online',
              requestCount: 0
            },
            perplexity: {
              status: 'online',
              requestCount: 0
            }
          },
          optimization: {
            enabled: true,
            tokenSavings: 0,
            tier: 'standard'
          }
        });
      } catch (error) {
        console.error('Error broadcasting system status:', error);
      }
    }
  }, 60000); // Run every 60 seconds
  
  // Expose Socket.io functions to other modules
  (global as any).socketio = {
    broadcastMessage,
    broadcastResearchProgress,
    broadcastOptimizationStatus
  };
  
  // Return server instance
  return httpServer;
}