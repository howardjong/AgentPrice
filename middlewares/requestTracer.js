import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

// Use CommonJS require for compatibility with both ES modules and CommonJS
let cls;
try {
  cls = require('cls-hooked');
} catch (err) {
  // If cls-hooked isn't available, create a mock implementation
  cls = {
    createNamespace: () => ({
      run: (fn) => fn(),
      set: () => {}
    }),
    getNamespace: () => null
  };
}

// Create namespace
const namespace = cls.createNamespace('research-system');

const requestTracer = (req, res, next) => {
  // Create or use existing trace ID
  const traceId = req.headers['x-trace-id'] || uuidv4();
  
  // Set trace ID on request for easy access
  req.traceId = traceId;
  
  // Add trace ID to response headers
  res.setHeader('x-trace-id', traceId);
  
  // Set trace ID in CLS namespace
  namespace.run(() => {
    namespace.set('traceId', traceId);
    
    // Log request start
    const startTime = Date.now();
    logger.info(`Request started: ${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent']
    });
    
    // Log request completion
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      // Log basic request information
      logger.info(`Request completed: ${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
      
      // Log warning for slow requests
      if (duration > 1000) {
        logger.warn(`Slow request: ${req.method} ${req.path}`, {
          method: req.method,
          path: req.path,
          duration: `${duration}ms`
        });
      }
    });
    
    next();
  });
};

export default requestTracer;