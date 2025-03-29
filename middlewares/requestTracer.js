/**
 * requestTracer.js
 * 
 * Middleware that traces HTTP requests, providing unique identifiers for each request
 * and tracking performance metrics. This helps with debugging and performance optimization.
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

/**
 * Generate a unique request ID
 * @returns {string} A unique UUID for the request
 */
function generateRequestId() {
  return uuidv4();
}

/**
 * Calculate the request duration
 * @param {[number, number]} startTime - The start time from process.hrtime()
 * @returns {number} The duration in milliseconds
 */
function calculateDuration(startTime) {
  const diff = process.hrtime(startTime);
  return (diff[0] * 1000) + (diff[1] / 1000000);
}

/**
 * Middleware that adds request tracing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requestTracer(req, res, next) {
  // Generate a unique ID for this request
  const requestId = generateRequestId();
  req.requestId = requestId;
  
  // Store the start time
  const startTime = process.hrtime();
  
  // Log the request
  logger.info(`[${requestId}] ${req.method} ${req.path}`, {
    component: 'requestTracer'
  });
  
  // Log detailed request information at debug level
  logger.debug(`[${requestId}] Request details:`, {
    component: 'requestTracer',
    meta: {
      method: req.method,
      path: req.path,
      query: req.query,
      headers: req.headers,
      ip: req.ip
    }
  });
  
  // Track the response
  const originalEnd = res.end;
  
  res.end = function(...args) {
    // Calculate the duration
    const duration = calculateDuration(startTime);
    
    // Log the response
    logger.info(`[${requestId}] ${req.method} ${req.path} ${res.statusCode} ${duration.toFixed(2)}ms`, {
      component: 'requestTracer'
    });
    
    // Return the modified response
    return originalEnd.apply(this, args);
  };
  
  // Add the requestId to the response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Continue to the next middleware
  next();
}

export default requestTracer;