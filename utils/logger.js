import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Define log format
const logFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const traceId = meta.traceId || 'no-trace';
  delete meta.traceId;
  
  // Format the meta object to only include valuable information
  const metaString = Object.keys(meta).length 
    ? JSON.stringify(meta)
    : '';
  
  return `${timestamp} [${traceId}] ${level}: ${message} ${metaString}`;
});

// Create the logger
const logger = winston.createLogger({
  levels: logLevels,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: [
    // Write to console with colors
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        logFormat
      ),
    }),
    // Write all logs to combined.log
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'combined.log') 
    }),
    // Write error logs to error.log
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'error.log'), 
      level: 'error' 
    }),
  ],
});

// Simple wrapper to add context from CLS namespaces
const addTraceIdFormatWrap = (logger) => {
  // Wrap all the logging methods to add traceId from CLS namespace if available
  const originalLogMethods = {};
  
  // Save original methods
  Object.keys(logLevels).forEach((level) => {
    originalLogMethods[level] = logger[level];
  });
  
  // Override methods
  Object.keys(logLevels).forEach((level) => {
    logger[level] = function (message, meta = {}) {
      let traceId = 'no-trace';
      
      // Try to get traceId from any running HTTP request
      try {
        const req = global.currentRequest;
        if (req && req.traceId) {
          traceId = req.traceId;
        }
      } catch (error) {
        // Ignore errors, we'll use no-trace
      }
      
      // Add traceId to meta
      const metaWithTrace = {
        ...meta,
        traceId
      };
      
      // Call original method
      return originalLogMethods[level](message, metaWithTrace);
    };
  });
  
  return logger;
};

// Apply traceId wrapper
addTraceIdFormatWrap(logger);

export default logger;