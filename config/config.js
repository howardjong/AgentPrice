/**
 * Main configuration file for the application
 */

const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 5000,
    host: '0.0.0.0',
  },
  
  // API keys
  apis: {
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-7-sonnet-20250219', // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
      maxTokens: 4096,
    },
    perplexity: {
      apiKey: process.env.PERPLEXITY_API_KEY,
      model: 'sonar',
      maxTokens: 4096,
    },
  },
  
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
  },
  
  // Bull queue configuration
  queue: {
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: true,
      removeOnFail: false,
    },
  },
  
  // Logging configuration
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'development' ? 'dev' : 'combined',
  },
};

export default config;