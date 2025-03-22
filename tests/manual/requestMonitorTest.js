import express from 'express';
import http from 'http';
import axios from 'axios';
import requestTracer from '../../middlewares/requestTracer.js';
import logger from '../../utils/logger.js';

async function testRequestMonitor() {
  logger.info('Starting request monitor test');
  
  // Create a simple test server with request tracer middleware
  const app = express();
  app.use(requestTracer);
  
  // Test endpoint with artificial delay to test slow request logging
  app.get('/test-fast', (req, res) => {
    res.json({ status: 'ok', message: 'Fast response' });
  });
  
  app.get('/test-slow', (req, res) => {
    // Simulate slow response
    setTimeout(() => {
      res.json({ status: 'ok', message: 'Slow response' });
    }, 1500); // Will trigger the slow request warning
  });
  
  // Start test server on random port
  const server = http.createServer(app);
  
  try {
    await new Promise((resolve, reject) => {
      server.listen(0, 'localhost', () => resolve());
      server.on('error', reject);
    });
    
    const port = server.address().port;
    logger.info(`Test server started on port ${port}`);
    
    // Make test requests
    logger.info('Making fast request');
    await axios.get(`http://localhost:${port}/test-fast`);
    
    logger.info('Making slow request');
    await axios.get(`http://localhost:${port}/test-slow`);
    
    logger.info('Request monitor test completed');
  } catch (error) {
    logger.error('Request monitor test failed', { error: error.message });
  } finally {
    // Shutdown server
    server.close();
  }
}

testRequestMonitor();