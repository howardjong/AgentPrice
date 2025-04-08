
/**
 * Simple logger module
 */

const logger = {
  info: (...args) => console.info('[INFO]', ...args),
  debug: (...args) => console.debug('[DEBUG]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

export default logger;
