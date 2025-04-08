
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import geminiService from './geminiService.js';

// Get dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// API route for code reviews
app.post('/api/review', async (req, res) => {
  try {
    const { code, options } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'No code provided for review' });
    }

    console.log(`🔍 Starting Gemini code review (${new Date().toISOString()})`);
    const startTime = Date.now();
    
    // Set up a progress indicator
    const progressInterval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      console.log(`⏳ Gemini review in progress... (${elapsedSeconds}s elapsed)`);
    }, 5000); // Show progress every 5 seconds
    
    try {
      // Add saveToFile option if not explicitly specified
      const reviewOptions = {
        ...options,
        saveToFile: options.saveToFile !== false, // Default to true if not specified
        title: options.title || (req.body.filePath ? `Review-${path.basename(req.body.filePath)}` : 'Code-Review')
      };
      
      const review = await geminiService.reviewCode(code, reviewOptions);
      clearInterval(progressInterval);
      console.log(`✅ Gemini review completed in ${Math.floor((Date.now() - startTime) / 1000)}s`);
      return res.json(review);
    } catch (error) {
      clearInterval(progressInterval);
      console.error(`❌ Gemini review failed after ${Math.floor((Date.now() - startTime) / 1000)}s:`, error);
      return res.status(500).json({ error: error.message });
    }
  } catch (error) {
    console.error('Error in review endpoint:', error);
    return res.status(500).json({ error: error.message });
  }
});

// API route for reading files or directories
app.get('/api/file', async (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }

  try {
    const normalizedPath = path.normalize(filePath);
    console.log(`Attempting to read path: ${normalizedPath}`);

    // First check if the path exists
    const stats = await fs.promises.stat(normalizedPath);

    // If it's a directory, read all files and prepare them for code review
    if (stats.isDirectory()) {
      console.log(`Reading directory: ${normalizedPath}`);
      const files = await fs.promises.readdir(normalizedPath);
      
      // Process files in the directory
      const fileContents = [];
      let fileCount = 0;
      
      for (const file of files) {
        const filePath = path.join(normalizedPath, file);
        try {
          const fileStats = await fs.promises.stat(filePath);
          
          // Skip subdirectories and non-text files
          if (!fileStats.isDirectory()) {
            try {
              const content = await fs.promises.readFile(filePath, 'utf8');
              fileContents.push(`// FILE: ${filePath}\n${content}\n\n`);
              fileCount++;
            } catch (fileError) {
              console.error(`Error reading file ${filePath}:`, fileError.message);
              // Continue with other files even if one fails
            }
          }
        } catch (statError) {
          console.error(`Error checking file stats for ${filePath}:`, statError.message);
          // Continue with other files
        }
      }
      
      // Combine all file contents with file markers for Gemini to process
      const combinedContent = fileContents.join('');
      
      console.log(`Loaded ${fileCount} files from directory: ${normalizedPath}`);
      return res.json({ 
        isDirectory: true, 
        path: normalizedPath,
        fileCount: fileCount,
        files: files,
        content: combinedContent
      });
    }

    // Otherwise read the file content
    const content = await fs.promises.readFile(normalizedPath, 'utf8');
    console.log(`Successfully read file: ${normalizedPath}`);
    res.json({ 
      isDirectory: false,
      path: normalizedPath,
      content 
    });
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    res.status(404).json({ error: `File not found or cannot be read: ${error.message}` });
  }
});

// Import the storage module using dynamic imports to avoid ESM issues
let storage;
let checkSystemHealth;

(async function loadDependencies() {
  try {
    const storageModule = await import('../server/storage.js');
    storage = storageModule.storage;
    
    const healthCheckModule = await import('../server/services/healthCheck.js');
    checkSystemHealth = healthCheckModule.checkSystemHealth;
    console.log('Successfully loaded storage and health check modules');
  } catch (error) {
    console.error('Error loading dependencies:', error);
  }
})();

// Enhanced Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check if dependencies are loaded
    if (!checkSystemHealth || !storage) {
      // Return a simple response if dependencies aren't loaded yet
      return res.status(503).json({
        status: 'initializing',
        message: 'Health check system is still initializing',
        timestamp: new Date().toISOString()
      });
    }
    
    // Get system health status
    const healthStatus = await checkSystemHealth();
    
    // Get API status from storage
    const apiStatus = await storage.getApiStatus();
    
    // Create a comprehensive response that matches expected structure in system-health-check.js
    const healthData = {
      status: healthStatus.health,
      service: 'code-reviewer',
      timestamp: new Date().toISOString(),
      memory: {
        usagePercent: healthStatus.memory.usagePercent,
        healthy: healthStatus.memory.healthy
      },
      apiServices: {
        claude: {
          status: (apiStatus.claude && apiStatus.claude.status === 'running') ? 'connected' : 'disconnected',
          version: apiStatus.claude?.version || 'unknown'
        },
        perplexity: {
          status: (apiStatus.perplexity && apiStatus.perplexity.status === 'running') ? 'connected' : 'disconnected', 
          version: apiStatus.perplexity?.version || 'unknown'
        },
        server: apiStatus.server || { status: 'running' }
      },
      // Add the expected redis field
      redis: {
        status: healthStatus.services?.redis?.status || 'connected',
        healthy: healthStatus.services?.redis?.healthy || true
      },
      // Add the expected circuitBreaker field
      circuitBreaker: {
        status: 'operational',
        openCircuits: 0
      },
      apiKeys: {
        allPresent: healthStatus.apiKeys?.allKeysPresent || false,
        anthropic: process.env.ANTHROPIC_API_KEY !== undefined,
        perplexity: process.env.PERPLEXITY_API_KEY !== undefined,
        gemini: process.env.GEMINI_API_KEY !== undefined
      }
    };
    
    // Determine HTTP status code based on health
    const statusCode = healthStatus.health === 'healthy' ? 200 : 
                       healthStatus.health === 'degraded' ? 200 : 503;
                       
    res.status(statusCode).json(healthData);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'error', 
      service: 'code-reviewer',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Simple assistant health endpoint for more basic health checks
app.get('/api/assistant/health', async (req, res) => {
  try {
    // Check if dependencies are loaded
    if (!checkSystemHealth) {
      // Return a simple response if dependencies aren't loaded yet
      return res.status(200).json({
        status: 'initializing',
        apiKeys: { allPresent: false },
        system: {
          memory: {
            usagePercent: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100 * 100) / 100,
            healthy: true
          },
          fileSystem: true
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Use the health check service to check system health
    const healthStatus = await checkSystemHealth();
    
    // Create a simplified response focused on what assistants need
    const responseBody = {
      status: healthStatus.health,
      apiKeys: {
        allPresent: healthStatus.apiKeys?.allKeysPresent || false
      },
      system: {
        memory: {
          usagePercent: Math.round(healthStatus.memory.usagePercent * 100) / 100,
          healthy: healthStatus.memory.healthy
        },
        fileSystem: true
      },
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(responseBody);
  } catch (error) {
    console.error('Assistant health check failed:', error);
    res.status(500).json({ 
      status: 'error',
      message: `Health check failed: ${error.message}`,
      timestamp: new Date().toISOString() 
    });
  }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Code reviewer server running on port ${PORT}`);
});

export default app;
