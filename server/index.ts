// Add global unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at server level', { 
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : 'No stack trace available'
  });
  // Not terminating the process, just logging for now
});

// Enable garbage collection hints if available
try {
  // Check if node was started with --expose-gc
  if (typeof global.gc !== 'function') {
    logger.warn('Garbage collection unavailable - start with --expose-gc for better memory management');
  } else {
    logger.info('Garbage collection available and enabled');
  }
} catch (e) {
  logger.warn('Unable to check garbage collection status');
}



// Load environment variables first
import '../config/env.js';

import express from 'express';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import logger from '../utils/logger.js';
import requestTracer from '../middlewares/requestTracer.js';
import { initializeAllMockResearch } from '../services/initializeMockResearch.js';
import redisClient from '../services/redisService.js';
import { checkApiKeys } from '../config/env.js';
import promptManager from '../services/promptManager.js';
// Add CORS middleware for Socket.io support
import cors from 'express';

// Force use of in-memory store for Redis operations and job queue
process.env.REDIS_MODE = 'memory';
process.env.USE_MOCK_JOB_MANAGER = 'true';

const app = express();

// Enhanced CORS setup for WebSocket compatibility
app.use((req, res, next) => {
  // Allow requests from any origin
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  
  // Allow all necessary methods
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // Extend allowed headers for Socket.IO
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  
  // Allow credentials
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Set max age for preflight requests
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());
app.use(requestTracer);
app.use(express.urlencoded({ extended: false }));

// Add request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import resource manager and component loader for memory optimization
import resourceManager from '../utils/resourceManager.js';
import componentLoader from '../utils/componentLoader.js';

// Initialize required services with resource optimization
async function initializeServices() {
  try {
    // Configure component loader for lazy loading
    componentLoader.configure({
      lazyLoad: true, 
      preloadCritical: true,
      enableCache: true,
      unloadThreshold: 900000 // 15 minutes
    });
    
    // Start resource management with more aggressive settings
    resourceManager.start();
    logger.info('Resource manager started');
    
    // Check API keys without making API calls
    const apiStatus = checkApiKeys();
    logger.info('API key status checked', apiStatus);

    if (!apiStatus.anthropicAvailable || !apiStatus.perplexityAvailable) {
      logger.warn('Some API keys are missing. This may affect functionality.');
    }

    // Only connect to Redis and initialize prompt manager
    // No API calls to external LLMs
    logger.info('Initializing Redis client');
    await redisClient.connect();
    logger.info('Redis client initialized successfully');

    // Initialize prompt manager without making API calls
    logger.info('Initializing prompt manager');
    await promptManager.initialize();
    logger.info('Prompt manager initialized successfully');
    
    // Disable automatic initialization of mock research data
    logger.info('Skipping mock research data initialization to avoid API calls');
    
    // Log initial resource usage
    const resources = resourceManager.getResourceUsage();
    logger.info('Initial resource usage', resources);
  } catch (error: any) {
    logger.error('Error initializing services', { error: error.message });
  }
}

(async () => {
  // Initialize services before starting the server
  await initializeServices();

  const server = await registerRoutes(app);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    logger.error('Server error', { status, message, error: err });
    res.status(status).json({ message });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use the specified port only - required for Replit workflow
  const port = parseInt(process.env.PORT || "5000", 10);
  
  // Start the server on the specified port
  try {
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
      keepAliveTimeout: 65000,
      headersTimeout: 66000,
    })
    .on('listening', () => {
      logger.info(`Server running on port ${port}`);
      
      // Skip automatic initialization of mock data to avoid API calls
      // User can manually initialize data if needed via API endpoint
      logger.info("Skipping automatic mock research data initialization to avoid unwanted API calls");
      logger.info("To initialize mock data manually, use the /api/mock-init endpoint when needed");
    })
    .on('error', (err) => {
      logger.error(`Failed to start server: ${err.message}`);
      process.exit(1);
    });
  } catch (error) {
    logger.error(`Error starting server: ${error.message}`);
    process.exit(1);
  }
})();

export default app;