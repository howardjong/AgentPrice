/**
 * Logger Module
 * 
 * Simple logging utility for consistent log formatting across the application.
 */

// Simple logger implementation
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  warn: (message) => console.warn(`[WARN] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`),
  debug: (message) => console.debug(`[DEBUG] ${message}`)
};

export default logger;