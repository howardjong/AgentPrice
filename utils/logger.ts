import { createLogger, format, transports } from 'winston';

/**
 * Custom Logger Configuration
 * 
 * This logger uses Winston to provide consistent logging throughout the application.
 * It supports different log levels and formats for development and production environments.
 */

const { combine, timestamp, printf, colorize } = format;

// Create a custom format for the logs
const customFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let metaStr = '';
  if (Object.keys(metadata).length > 0) {
    metaStr = JSON.stringify(metadata, null, 2);
  }
  return `${timestamp} [${level}]: ${message} ${metaStr}`;
});

// Define the log file paths
const errorLogPath = './error.log';
const combinedLogPath = './combined.log';

// Create the logger instance
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp(),
    customFormat
  ),
  transports: [
    // Write errors to error.log
    new transports.File({ 
      filename: errorLogPath, 
      level: 'error' 
    }),
    // Write all logs to combined.log
    new transports.File({ 
      filename: combinedLogPath 
    }),
  ],
  exceptionHandlers: [
    new transports.File({ filename: errorLogPath })
  ],
  rejectionHandlers: [
    new transports.File({ filename: errorLogPath })
  ]
});

// Add console logging for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: combine(
        colorize(),
        timestamp(),
        customFormat
      ),
    })
  );
}

export default logger;