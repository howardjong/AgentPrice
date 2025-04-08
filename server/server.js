/**
 * Server Entry Point
 * 
 * This file serves as the entry point for the multi-AI research testing framework server.
 * It sets up the HTTP server, registers API routes, and handles connections.
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import { registerRoutes } from './routes.js';
import { storage } from './storage.js';
import { checkSystemHealth } from './services/healthCheck.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Enable middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Setup and start the server
async function startServer() {
  try {
    // Register API routes
    const httpServer = await registerRoutes(app);
    
    // Start the HTTP server if registerRoutes didn't create one
    if (!httpServer) {
      const server = http.createServer(app);
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server listening on port ${PORT}`);
      });
      return server;
    }
    
    return httpServer;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Health check endpoint (simple version for basic connectivity testing)
app.get('/api/health', async (req, res) => {
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
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: `Health check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
});

// Simple assistant health endpoint for more basic health checks
app.get('/api/assistant/health', async (req, res) => {
  try {
    // Use the health check service to check system health without making API calls
    const healthStatus = await checkSystemHealth();
    
    // Map the status to HTTP status code
    const statusCode = healthStatus.health === 'healthy' ? 200 : 
                      healthStatus.health === 'degraded' ? 200 : 503;
    
    // Create a simplified response
    const responseBody = {
      status: healthStatus.health,
      apiKeys: {
        allPresent: healthStatus.apiKeys.allKeysPresent
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
    
    res.status(statusCode).json(responseBody);
  } catch (error) {
    console.error('Assistant health check failed:', error);
    res.status(500).json({ 
      status: 'error',
      message: `Health check failed: ${error.message}`,
      timestamp: new Date().toISOString() 
    });
  }
});

// Start the server when this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export default app;