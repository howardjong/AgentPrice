/**
 * Logger Utility
 * 
 * This module provides a centralized logging utility with different log levels
 * and structured logging capabilities.
 */

import winston from 'winston';

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'cyan',
  debug: 'white'
};

// Configure Winston format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create the logger instance
const logger = winston.createLogger({
  levels: logLevels,
  format,
  defaultMeta: { service: 'multi-llm-service' },
  transports: [
    // Write errors to error.log
    new winston.transports.File({ 
      filename: 'error.log', 
      level: 'error' 
    }),
    // Write all logs to combined.log
    new winston.transports.File({ 
      filename: 'combined.log' 
    })
  ]
});

// Add console transport if not in production
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.printf(info => {
        const { timestamp, level, message, ...rest } = info;
        // Format log message for console
        return `${timestamp} [${level}]: ${message} ${
          Object.keys(rest).length ? JSON.stringify(rest, null, 2) : ''
        }`;
      })
    )
  }));
}

/**
 * Configure logger settings
 * @param {Object} options - Logger configuration options
 */
logger.configure = (options = {}) => {
  const { level, silent } = options;
  
  if (level) {
    logger.level = level;
  }
  
  if (typeof silent === 'boolean') {
    logger.silent = silent;
  }
};

export default logger;