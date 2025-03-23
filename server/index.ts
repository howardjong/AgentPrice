
import express from 'express';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import logger from '../utils/logger.js';
import requestTracer from '../middlewares/requestTracer.js';
import { initializeAllMockResearch } from '../services/initializeMockResearch.js';
import redisClient from '../services/redisService.js';

// Force use of in-memory store for Redis operations
process.env.REDIS_MODE = 'memory';

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
    logger.info('Initializing Redis client');
    await redisClient.connect();
    logger.info('Redis client initialized successfully');
  } catch (error: any) {
    logger.error('Error initializing Redis client', { error: error.message });
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
    
    // Initialize mock research data if in development mode or if INIT_MOCK_DATA env variable is set
    if (app.get("env") === "development" || process.env.INIT_MOCK_DATA === "true") {
      try {
        logger.info("Starting mock research data initialization");
        const result = await initializeAllMockResearch();
        logger.info("Mock research data initialized successfully", { 
          totalJobs: result.total,
          productQuestions: result.productQuestions.length,
          researchTopics: result.researchTopics.length
        });
      } catch (error: any) {
        logger.error("Failed to initialize mock research data", { error: error.message });
      }
    }
  });
})();

export default app;
