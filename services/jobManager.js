/**
 * Job Manager
 * 
 * This service manages background jobs using Bull queues.
 * It automatically delegates to mockJobManager when in development/test mode.
 */

import Bull from 'bull';
import logger from '../utils/logger.js';
import * as mockJobManager from './mockJobManager.js';

// We'll import the redis service dynamically later to get the current mode
// This avoids circular dependencies and ensures we're using the same mode across the application
let redisMode;
let USE_MOCK_JOB_MANAGER;
const nodeEnv = process.env.NODE_ENV;

// Function to properly initialize job manager settings
// This will be called before any other operations to ensure consistency with redisService
async function initJobManagerSettings() {
  // Import redisService dynamically to get the current mode
  try {
    const redisService = await import('./redisService.js');
    
    // Get Redis mode from the service to ensure consistency
    // Use the static getter to access the current redis mode
    if (redisService.default && redisService.RedisClient) {
      redisMode = redisService.RedisClient.redisMode;
      logger.info(`JobManager: Got Redis mode from RedisClient.redisMode: ${redisMode}`);
    } else if (redisService.default) {
      redisMode = redisService.default.redisMode;
      logger.info(`JobManager: Got Redis mode from redisService.default.redisMode: ${redisMode}`);
    } else {
      redisMode = process.env.REDIS_MODE || 'memory';
      logger.info(`JobManager: Using environment REDIS_MODE: ${redisMode}`);
    }
  } catch (error) {
    logger.error(`Error importing redisService: ${error.message}`);
    redisMode = process.env.REDIS_MODE || 'memory';
    logger.info(`JobManager: Fallback to environment REDIS_MODE: ${redisMode}`);
  }
  
  // Now handle USE_MOCK_JOB_MANAGER setting
  const useMockJobManager = process.env.USE_MOCK_JOB_MANAGER;
  
  // First, explicitly check the USE_MOCK_JOB_MANAGER env variable value
  if (useMockJobManager === 'true' || useMockJobManager === 'false') {
    // If USE_MOCK_JOB_MANAGER is explicitly set, respect that setting
    USE_MOCK_JOB_MANAGER = useMockJobManager === 'true';
    logger.info(`JobManager: Using explicit USE_MOCK_JOB_MANAGER=${USE_MOCK_JOB_MANAGER}`);
  } else {
    // Otherwise fall back to checking environment and Redis mode
    USE_MOCK_JOB_MANAGER = 
      nodeEnv === 'test' ||
      redisMode === 'memory' ||
      !redisMode; // If REDIS_MODE is not specified, default to mock
    logger.info(`JobManager: Determined USE_MOCK_JOB_MANAGER=${USE_MOCK_JOB_MANAGER} based on environment`);
  }
  
  // Log final settings
  logger.info(`JobManager initialized with: REDIS_MODE=${redisMode}, USE_MOCK_JOB_MANAGER=${USE_MOCK_JOB_MANAGER}, NODE_ENV=${nodeEnv}`);
}

// Initialize settings immediately, but don't wait for it
// The settings will be ready by the time any queue operations are performed
initJobManagerSettings();

// We'll need to check mode after initialization
// The createQueue and other functions will wait for initialization through getRedisUrl()

// Cache for Bull queues
const queues = new Map();

// Default options for Bull queues
const defaultOptions = {
  // Redis connection is pulled from REDIS_URL environment variable automatically
  // If using Replit, this is likely provided for you
  removeOnComplete: 100, // Keep completed jobs for tracking
  removeOnFail: 200,     // Keep failed jobs longer for debugging
  attempts: 3,           // Retry failed jobs
  backoff: {
    type: 'exponential',
    delay: 1000          // Initial delay between retries
  }
};

/**
 * Get Redis URL from environment or import from redisService for Redis Memory Server
 */
async function getRedisUrl() {
  // If we're using the memory Redis mode, we should get the URL from redisService
  // to ensure we're connecting to the Redis Memory Server
  if (redisMode === 'memory') {
    try {
      // Import our Redis service dynamically
      const redisService = await import('./redisService.js');
      
      // Check if redisService has a method to get the Redis URL
      if (redisService.default && redisService.default.getRedisUrl) {
        logger.info('Getting Redis URL from redisService (Memory Server)');
        return await redisService.default.getRedisUrl();
      }
    } catch (error) {
      logger.error(`Error importing redisService: ${error.message}`);
    }
  }
  
  // For 'real' mode, we need to get the URL from the redisService which runs Redis Memory Server
  if (redisMode === 'real') {
    try {
      const redisService = await import('./redisService.js');
      if (redisService.default && redisService.default.getRedisUrl) {
        logger.info('Getting Redis URL from redisService (Redis Memory Server)');
        return await redisService.default.getRedisUrl();
      }
    } catch (error) {
      logger.error(`Error importing redisService: ${error.message}`);
    }
  }
  
  // Fallback to environment variable or default
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  logger.info(`Using Redis URL from environment: ${redisUrl}`);
  return redisUrl;
}

/**
 * Create or get a Bull queue
 * @param {string} name - Queue name
 * @param {Object} options - Queue options
 * @returns {Object} - Bull queue
 */
async function createQueue(name, options = {}) {
  // Use cache if we already have this queue
  if (queues.has(name)) {
    return queues.get(name);
  }
  
  // Get Redis URL (potentially from Redis Memory Server)
  const redisUrl = await getRedisUrl();
  logger.info(`Using Redis URL for Bull queue ${name}: ${redisUrl}`);
  
  // Create new queue with specific Redis connection
  const queue = new Bull(name, redisUrl, { ...defaultOptions, ...options });
  
  // Set up event handlers
  queue.on('error', (error) => {
    logger.error(`Queue ${name} error`, { error: error.message });
  });
  
  queue.on('failed', (job, error) => {
    logger.error(`Job ${job.id} in queue ${name} failed`, { 
      error: error.message,
      attempts: job.attemptsMade
    });
  });
  
  queue.on('completed', (job) => {
    logger.info(`Job ${job.id} in queue ${name} completed`);
  });
  
  // Store in cache
  queues.set(name, queue);
  return queue;
}

/**
 * Enqueue a job
 * @param {string} queueName - Queue name
 * @param {Object} data - Job data
 * @param {Object} options - Job options
 * @returns {Promise<string>} - Job ID
 */
async function enqueueJob(queueName, data, options = {}) {
  // Log the current mode for debugging
  logger.info(`enqueueJob: Using mode REDIS_MODE=${redisMode}, USE_MOCK_JOB_MANAGER=${USE_MOCK_JOB_MANAGER}`);
  
  // If using mock job manager, delegate to it
  if (USE_MOCK_JOB_MANAGER) {
    logger.info(`Delegating job to mock job manager for queue: ${queueName}`);
    return await mockJobManager.enqueueJob(queueName, data, options);
  } else {
    logger.info(`Using real Bull job manager for queue: ${queueName}`);
  }
  
  // Check for rate limiting requirement
  if (data.options && data.options.shouldRateLimit) {
    // Implement basic rate limiting for high-cost operations like deep research
    const queue = await createQueue(queueName);
    const counts = await queue.getJobCounts();
    
    if (counts.active > 0) {
      // If a job is already active, add a delay based on waiting jobs
      const waitingCount = counts.waiting || 0;
      const delay = Math.max(5000 * (waitingCount + 1), 5000); // At least 5 seconds delay
      
      logger.info(`Rate limiting ${queueName} job`, { 
        delay,
        activeJobs: counts.active,
        waitingJobs: counts.waiting
      });
      
      options.delay = delay;
    }
  }
  
  // Create queue and add job
  const queue = await createQueue(queueName);
  const job = await queue.add(data, options);
  
  logger.info(`Job added to ${queueName} queue with ID: ${job.id}`);
  return job.id;
}

/**
 * Get the status of a job
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} - Job status
 */
async function getJobStatus(jobId) {
  // If using mock job manager, delegate to it
  if (USE_MOCK_JOB_MANAGER) {
    return await mockJobManager.getJobStatus(jobId);
  }
  
  // Find the job in one of our queues
  for (const queue of queues.values()) {
    try {
      const job = await queue.getJob(jobId);
      
      if (job) {
        // Get job state
        const state = await job.getState();
        let result = null;
        let error = null;
        
        // If job is completed, get the returned data
        if (state === 'completed') {
          const jobResult = await job.finished();
          result = jobResult;
        } else if (state === 'failed') {
          error = job.failedReason;
        }
        
        // Return job status
        return {
          id: job.id,
          status: state,
          progress: job._progress,
          result,
          error,
          queueName: queue.name,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          attempts: job.attemptsMade
        };
      }
    } catch (error) {
      // Skip this queue if job not found
    }
  }
  
  throw new Error(`Job ${jobId} not found`);
}

/**
 * Register a processor function for a queue
 * @param {string} queueName - Queue name
 * @param {Function} processorFn - Processor function
 * @param {Object} options - Processor options
 * @returns {Promise<void>}
 */
async function registerProcessor(queueName, processorFn, options = {}) {
  // If using mock job manager, delegate to it
  if (USE_MOCK_JOB_MANAGER) {
    return mockJobManager.registerProcessor(queueName, processorFn, options);
  }
  
  // Create queue and register processor
  const queue = await createQueue(queueName);
  const concurrency = options.concurrency || 1;
  
  queue.process(concurrency, processorFn);
  
  logger.info(`Registered processor for queue ${queueName} with concurrency ${concurrency}`);
}

/**
 * Get job counts for a queue
 * @param {string} queueName - Queue name
 * @returns {Promise<Object>} - Job counts by status
 */
async function getJobCounts(queueName) {
  // If using mock job manager, delegate to it
  if (USE_MOCK_JOB_MANAGER) {
    return await mockJobManager.getJobCounts(queueName);
  }
  
  // Get queue
  const queue = await createQueue(queueName);
  return await queue.getJobCounts();
}

/**
 * Close all queue connections
 * @returns {Promise<void>}
 */
async function close() {
  // Close all queues
  for (const queue of queues.values()) {
    await queue.close();
  }
  
  queues.clear();
  logger.info('All job queues closed');
}

export {
  enqueueJob,
  getJobStatus,
  registerProcessor,
  getJobCounts,
  close
};