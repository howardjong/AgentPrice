/**
 * logger.js
 * 
 * A simple logging utility that provides standardized logging across the application.
 * This logger handles different log levels and formats log entries consistently.
 */

// Log levels with numeric values for comparison
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Current log level - can be set via environment variable or configuration
let currentLogLevel = process.env.LOG_LEVEL ? 
  LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO :
  LOG_LEVELS.INFO;

/**
 * Format a log message with timestamp, level, and optional component
 * @param {string} level - The log level (ERROR, WARN, INFO, DEBUG)
 * @param {string} message - The log message
 * @param {string} [component] - Optional component name
 * @returns {string} - Formatted log message
 */
function formatLogMessage(level, message, component) {
  const timestamp = new Date().toISOString();
  const componentStr = component ? `[${component}] ` : '';
  return `${timestamp} ${level.padEnd(5)} ${componentStr}${message}`;
}

/**
 * Log a message if the current log level permits
 * @param {string} level - The log level (ERROR, WARN, INFO, DEBUG)
 * @param {string} message - The log message
 * @param {Object} [options] - Additional options
 * @param {string} [options.component] - Component name
 * @param {Error} [options.error] - Error object to include in the log
 */
function log(level, message, options = {}) {
  const logLevelValue = LOG_LEVELS[level];
  
  // Only log if the current level includes this level
  if (logLevelValue <= currentLogLevel) {
    const formattedMessage = formatLogMessage(level, message, options.component);
    
    // Output to the appropriate console method
    if (level === 'ERROR') {
      console.error(formattedMessage);
      
      // If an error object was provided, log its details
      if (options.error) {
        console.error(options.error);
      }
    } else if (level === 'WARN') {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  }
}

/**
 * Set the current log level
 * @param {string} level - The log level (ERROR, WARN, INFO, DEBUG)
 */
function setLogLevel(level) {
  if (LOG_LEVELS[level] !== undefined) {
    currentLogLevel = LOG_LEVELS[level];
    info(`Log level set to ${level}`);
  } else {
    warn(`Invalid log level: ${level}. Using INFO instead.`);
    currentLogLevel = LOG_LEVELS.INFO;
  }
}

/**
 * Log an error message
 * @param {string} message - The error message
 * @param {Object} [options] - Additional options
 */
function error(message, options = {}) {
  log('ERROR', message, options);
}

/**
 * Log a warning message
 * @param {string} message - The warning message
 * @param {Object} [options] - Additional options
 */
function warn(message, options = {}) {
  log('WARN', message, options);
}

/**
 * Log an info message
 * @param {string} message - The info message
 * @param {Object} [options] - Additional options
 */
function info(message, options = {}) {
  log('INFO', message, options);
}

/**
 * Log a debug message
 * @param {string} message - The debug message
 * @param {Object} [options] - Additional options
 */
function debug(message, options = {}) {
  log('DEBUG', message, options);
}

// Export the logger functions
export default {
  error,
  warn,
  info,
  debug,
  setLogLevel
};