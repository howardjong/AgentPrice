/**
 * Environment Configuration
 * 
 * Loads environment variables from .env file for development
 * or from Replit secrets for production.
 */

import 'dotenv/config';

// Environment constants
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const IS_DEV = NODE_ENV === 'development';
const IS_TEST = NODE_ENV === 'test';

// Database defaults
const DEFAULT_DB_URL = 'postgresql://postgres:postgres@localhost:5432/mlrs_dev';
const TEST_DB_URL = 'postgresql://postgres:postgres@localhost:5432/mlrs_test';

// Export all environment variables with defaults
export const env = {
  // Node environment
  NODE_ENV,
  IS_PROD,
  IS_DEV,
  IS_TEST,
  
  // Server settings
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  
  // Database settings
  DATABASE_URL: IS_TEST
    ? process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || TEST_DB_URL
    : process.env.DATABASE_URL || DEFAULT_DB_URL,
    
  // Storage type
  STORAGE_TYPE: process.env.STORAGE_TYPE || (IS_PROD ? 'postgres' : 'memory'),
  
  // Log settings
  LOG_LEVEL: process.env.LOG_LEVEL || (IS_PROD ? 'info' : 'debug'),
  
  // Test settings
  TEST_TIMEOUT: process.env.TEST_TIMEOUT ? parseInt(process.env.TEST_TIMEOUT) : 5000,
  
  // Authentication (for future implementation)
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_not_for_production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  // API Keys
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || '',
};

/**
 * Check if required API keys are available
 * This function doesn't make API calls, just checks if keys are present
 */
export function checkApiKeys() {
  return {
    anthropicAvailable: !!env.ANTHROPIC_API_KEY,
    perplexityAvailable: !!env.PERPLEXITY_API_KEY,
    allKeysAvailable: !!env.ANTHROPIC_API_KEY && !!env.PERPLEXITY_API_KEY
  };
}

export default env;