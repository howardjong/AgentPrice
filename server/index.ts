// Add global unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at server level', { 
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : 'No stack trace available'
  });
  // Not terminating the process, just logging for now
});



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

// Force use of in-memory store for Redis operations and job queue
process.env.REDIS_MODE = 'memory';
process.env.USE_MOCK_JOB_MANAGER = 'true';

const app = express();
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

// Initialize required services
async function initializeServices() {
  try {
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

  const port = process.env.PORT || 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
    keepAliveTimeout: 65000,
    headersTimeout: 66000,
  }, async () => {
    logger.info(`Server running on port ${port}`);

    // Skip automatic initialization of mock data to avoid API calls
    // User can manually initialize data if needed via API endpoint
    logger.info("Skipping automatic mock research data initialization to avoid unwanted API calls");
    logger.info("To initialize mock data manually, use the /api/mock-init endpoint when needed");
  });
})();

export default app;