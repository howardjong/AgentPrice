import express, { type Express, Request, Response } from "express";
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
import path from 'path';
import fs from 'fs';
import multer from 'multer';

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer storage
  const multerStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.resolve('./uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
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
    fileFilter: function (req, file, cb) {
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
    } catch (error) {
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
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

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
      } catch (error) {
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
      let parsedResult;
      try {
        // Extract JSON from the response
        const jsonMatch = result.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
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
    } catch (error) {
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
                  margin-top: 15px;
                  background: #f0f0f0;
                  padding: 8px 15px;
                  border-radius: 4px;

// Two-stage research endpoint - first gets clarifying questions, then performs research with answers
app.post('/api/two-stage-research', async (req: Request, res: Response) => {
  try {
    const { query, options = {} } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Check if this is stage 1 (get questions) or stage 2 (perform research with answers)
    if (!req.body.stage || req.body.stage === 1) {
      // Stage 1: Generate clarifying questions
      const questions = await claudeService.generateClarifyingQuestions(query);
      return res.json({
        success: true,
        questions,
        stage: 1
      });
    } else {
      // Stage 2: Perform research with answers
      const { answers = {} } = req.body;
      
      // Start research with the provided answers
      const research = await initiateResearch(query, {
        ...options,
        clarificationAnswers: answers,
        generateClarifyingQuestions: true
      });
      
      return res.json({
        success: true,
        research,
        stage: 2
      });
    }
  } catch (error) {
    console.error('Error in two-stage research:', error);
    res.status(500).json({ error: error.message });
  }
});

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
      // Create sample data for Van Westendorp visualization
      const sampleData = [
        { price: 10, tooExpensive: 5, expensiveButWorth: 10, goodValue: 80, tooCheap: 90 },
        { price: 30, tooExpensive: 20, expensiveButWorth: 35, goodValue: 60, tooCheap: 50 },
        { price: 50, tooExpensive: 50, expensiveButWorth: 50, goodValue: 50, tooCheap: 20 },
        { price: 70, tooExpensive: 70, expensiveButWorth: 65, goodValue: 25, tooCheap: 15 },
        { price: 90, tooExpensive: 90, expensiveButWorth: 80, goodValue: 10, tooCheap: 5 },
        { price: 110, tooExpensive: 95, expensiveButWorth: 90, goodValue: 5, tooCheap: 2 }
      ];

      // Create traces for Plotly.js
      const tooExpensiveTrace = {
        x: sampleData.map(d => d.price),
        y: sampleData.map(d => d.tooExpensive),
        mode: 'lines+markers',
        name: 'Too Expensive',
        line: {
          color: '#e74c3c',
          width: 3
        },
        marker: {
          size: 8
        }
      };

      const expensiveButWorthTrace = {
        x: sampleData.map(d => d.price),
        y: sampleData.map(d => d.expensiveButWorth),
        mode: 'lines+markers',
        name: 'Expensive But Worth It',
        line: {
          color: '#f39c12',
          width: 3
        },
        marker: {
          size: 8
        }
      };

      const goodValueTrace = {
        x: sampleData.map(d => d.price),
        y: sampleData.map(d => d.goodValue),
        mode: 'lines+markers',
        name: 'Good Value',
        line: {
          color: '#2ecc71',
          width: 3
        },
        marker: {
          size: 8
        }
      };

      const tooCheapTrace = {
        x: sampleData.map(d => d.price),
        y: sampleData.map(d => d.tooCheap),
        mode: 'lines+markers',
        name: 'Too Cheap',
        line: {
          color: '#3498db',
          width: 3
        },
        marker: {
          size: 8
        }
      };

      // Find the intersection points (approximate using the nearest data points)
      const optimalPricePoint = sampleData.find(d => Math.abs(d.goodValue - d.tooExpensive) < 5);
      const indifferencePricePoint = sampleData.find(d => Math.abs(d.tooCheap - d.expensiveButWorth) < 5);

      // Create intersection annotations
      const annotations = [];
      
      if (optimalPricePoint) {
        annotations.push({
          x: optimalPricePoint.price,
          y: optimalPricePoint.goodValue,
          text: 'Optimal Price Point',
          showarrow: true,
          arrowhead: 2,
          arrowsize: 1,
          arrowwidth: 2,
          ax: 40,
          ay: -40
        });
      }

      if (indifferencePricePoint) {
        annotations.push({
          x: indifferencePricePoint.price,
          y: indifferencePricePoint.tooCheap,
          text: 'Indifference Price Point',
          showarrow: true,
          arrowhead: 2,
          arrowsize: 1,
          arrowwidth: 2,
          ax: -40,
          ay: -40
        });
      }

      // Create the result with interactive chart
      const result = {
        title: 'Van Westendorp Price Sensitivity Analysis',
        description: 'Sample price sensitivity data for product pricing analysis',
        visualizationType: 'van_westendorp',
        modelUsed: 'Interactive Plotly.js',
        traces: JSON.stringify([tooExpensiveTrace, expensiveButWorthTrace, goodValueTrace, tooCheapTrace]),
        annotations: JSON.stringify(annotations)
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
                  max-width: 800px;
                }
                .chart-container {
                  margin: 15px 0;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
                  border-radius: 5px;
                  background: white;
                  overflow: hidden;
                  height: 450px;
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
                }
              </style>
            </head>
            <body>
              <h1>${result.title}</h1>
              <p>${result.description}</p>
              
              <div class="visualization-container">
                <div class="chart-container">
                  <div id="price-sensitivity-chart" style="height: 100%;"></div>
                </div>
                
                <div class="interpretation">
                  <h3>How to interpret this chart:</h3>
                  <ul>
                    <li><strong>Too Expensive</strong>: Percentage of customers who think the price is too high.</li>
                    <li><strong>Expensive But Worth It</strong>: Percentage who think it's expensive but justified.</li>
                    <li><strong>Good Value</strong>: Percentage who think the price is a good value.</li>
                    <li><strong>Too Cheap</strong>: Percentage who think the price is suspiciously low.</li>
                    <li><strong>Optimal Price Point</strong>: The intersection of "Too Expensive" and "Good Value" curves.</li>
                    <li><strong>Indifference Price Point</strong>: The intersection of "Too Cheap" and "Expensive But Worth It" curves.</li>
                  </ul>
                </div>
                
                <div class="model-info">
                  <p><strong>Visualization Type:</strong> ${result.visualizationType}</p>
                  <p><strong>Source:</strong> ${result.modelUsed}</p>
                </div>
              </div>
              
              <a href="/" class="back-link">&laquo; Back to Dashboard</a>
              
              <script>
                // Render the chart
                const traces = ${result.traces};
                const annotations = ${result.annotations};
                
                const layout = {
                  title: 'Van Westendorp Price Sensitivity Analysis',
                  xaxis: {
                    title: 'Price ($)',
                    tickmode: 'array',
                    tickvals: [10, 30, 50, 70, 90, 110]
                  },
                  yaxis: {
                    title: 'Percentage of Customers (%)',
                    range: [0, 100]
                  },
                  legend: {
                    orientation: 'h',
                    y: -0.2
                  },
                  annotations: annotations,
                  hovermode: 'closest',
                  margin: {
                    l: 50,
                    r: 30,
                    b: 100,
                    t: 50,
                    pad: 4
                  }
                };
                
                Plotly.newPlot('price-sensitivity-chart', traces, layout, {responsive: true});
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

  // Serve files from tests/output directory for chart JSON data
  // Using import.meta.url instead of __dirname for ES modules
  const __filename = new URL(import.meta.url).pathname;
  const __dirname = path.dirname(__filename);
  app.use('/tests/output', express.static(path.resolve(__dirname, '../tests/output')));
  
  // Serve static files from public directory
  app.use(express.static(path.resolve(__dirname, '../public')));
  
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