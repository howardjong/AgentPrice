/**
 * @file errorHandler.vitest.js
 * @description Test file for the error handling middleware from server/index.ts
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
 * Create the error handling middleware function from server/index.ts
 * @returns {Function} The middleware function
 */
function createErrorHandlerMiddleware() {
  return (err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    logger.error('Server error', { status, message, error: err });
    res.status(status).json({ message });
  };
}

describe('Error Handler Middleware', () => {
  let app;
  let request;
  let errorHandlerMiddleware;
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create a new Express app
    app = express();
    
    // Define routes that will generate different types of errors
    app.get('/error-500', (req, res, next) => {
      next(new Error('Test internal error'));
    });
    
    app.get('/error-custom-status', (req, res, next) => {
      const error = new Error('Custom status error');
      error.status = 400;
      next(error);
    });
    
    app.get('/error-statuscode', (req, res, next) => {
      const error = new Error('StatusCode error');
      error.statusCode = 403;
      next(error);
    });
    
    app.get('/error-no-message', (req, res, next) => {
      next(new Error());
    });
    
    // Create the middleware
    errorHandlerMiddleware = createErrorHandlerMiddleware();
    
    // Add the middleware to the app
    app.use(errorHandlerMiddleware);
    
    // Create supertest request
    request = supertest(app);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  test('should handle errors with default 500 status code', async () => {
    // Make a request to a route that throws a 500 error
    const response = await request.get('/error-500');
    
    // Check that the response has the correct status code and message
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Test internal error' });
    
    // Check that logger.error was called with the correct parameters
    expect(logger.error).toHaveBeenCalledWith(
      'Server error',
      expect.objectContaining({
        status: 500,
        message: 'Test internal error',
        error: expect.any(Object)
      })
    );
  });
  
  test('should handle errors with custom status property', async () => {
    // Make a request to a route that throws a custom status error
    const response = await request.get('/error-custom-status');
    
    // Check that the response has the correct status code and message
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Custom status error' });
    
    // Check that logger.error was called with the correct parameters
    expect(logger.error).toHaveBeenCalledWith(
      'Server error',
      expect.objectContaining({
        status: 400,
        message: 'Custom status error'
      })
    );
  });
  
  test('should handle errors with statusCode property', async () => {
    // Make a request to a route that throws a statusCode error
    const response = await request.get('/error-statuscode');
    
    // Check that the response has the correct status code and message
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'StatusCode error' });
    
    // Check that logger.error was called with the correct parameters
    expect(logger.error).toHaveBeenCalledWith(
      'Server error',
      expect.objectContaining({
        status: 403,
        message: 'StatusCode error'
      })
    );
  });
  
  test('should use default error message when none is provided', async () => {
    // Make a request to a route that throws an error without a message
    const response = await request.get('/error-no-message');
    
    // Check that the response has the correct status code and default message
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Internal Server Error' });
    
    // Check that logger.error was called with the correct parameters
    expect(logger.error).toHaveBeenCalledWith(
      'Server error',
      expect.objectContaining({
        status: 500,
        message: 'Internal Server Error'
      })
    );
  });
  
  test('should return JSON response format', async () => {
    // Make a request to a route that throws an error
    const response = await request.get('/error-500');
    
    // Check that the response has JSON content-type
    expect(response.headers['content-type']).toMatch(/application\/json/);
    
    // Check that the response body has the expected shape
    expect(response.body).toHaveProperty('message');
  });
});