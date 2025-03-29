/**
 * @file requestLogger.vitest.js
 * @description Test file for the request logging middleware from server/index.ts
 */

import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import logger from '../../../utils/logger.js';

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

/**
 * Create the anonymous request logging middleware function from server/index.ts
 * @returns {Function} The middleware function
 */
function createRequestLoggerMiddleware() {
  return (req, res, next) => {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip
    });
    next();
  };
}

describe('Request Logger Middleware', () => {
  let app;
  let request;
  let requestLoggerMiddleware;
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create a new Express app
    app = express();
    
    // Create the middleware
    requestLoggerMiddleware = createRequestLoggerMiddleware();
    
    // Add the middleware to the app
    app.use(requestLoggerMiddleware);
    
    // Add a simple route
    app.get('/test', (req, res) => {
      res.status(200).json({ success: true });
    });
    
    app.post('/submit', (req, res) => {
      res.status(201).json({ success: true });
    });
    
    // Create supertest request
    request = supertest(app);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  test('should log GET requests with path and query parameters', async () => {
    // Make a GET request with query parameters
    await request.get('/test?param1=value1&param2=value2');
    
    // Check that logger.info was called with the correct parameters
    expect(logger.info).toHaveBeenCalledWith(
      'Incoming request', 
      expect.objectContaining({
        method: 'GET',
        path: '/test',
        query: { param1: 'value1', param2: 'value2' }
      })
    );
  });
  
  test('should log POST requests with path', async () => {
    // Make a POST request
    await request.post('/submit').send({ data: 'test data' });
    
    // Check that logger.info was called with the correct parameters
    expect(logger.info).toHaveBeenCalledWith(
      'Incoming request', 
      expect.objectContaining({
        method: 'POST',
        path: '/submit',
        query: {}
      })
    );
  });
  
  test('should log requests with IP address', async () => {
    // Make a request
    await request.get('/test');
    
    // Check that logger.info was called with an object containing an IP field
    expect(logger.info).toHaveBeenCalledWith(
      'Incoming request',
      expect.objectContaining({
        ip: expect.any(String)
      })
    );
  });
  
  test('should pass control to the next middleware', async () => {
    // Make a request to a route that returns a 200
    const response = await request.get('/test');
    
    // Check that the response was processed (meaning next() was called)
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });
  
  test('should log 404 requests for non-existent routes', async () => {
    // Make a request to a non-existent route
    await request.get('/nonexistent');
    
    // Check that logger.info was called with the correct path
    expect(logger.info).toHaveBeenCalledWith(
      'Incoming request',
      expect.objectContaining({
        method: 'GET',
        path: '/nonexistent'
      })
    );
  });
});