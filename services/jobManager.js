/**
 * Job Manager
 * 
 * This service manages background jobs using Bull queues.
 * It automatically delegates to mockJobManager when in development/test mode.
 */

import Bull from 'bull';
import logger from '../utils/logger.js';
import * as mockJobManager from './mockJobManager.js';

// Check if we should use the mock job manager
const USE_MOCK_JOB_MANAGER = process.env.USE_MOCK_JOB_MANAGER === 'true' || 
                             process.env.REDIS_MODE === 'memory' || 
                             process.env.NODE_ENV === 'test';

// Log the mode we're using
if (USE_MOCK_JOB_MANAGER) {
  logger.info('Using mock job manager for Bull queues due to REDIS_MODE=memory');
} else {
  logger.info('Using real Bull job manager with Redis');
}

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
 * Create or get a Bull queue
 * @param {string} name - Queue name
 * @param {Object} options - Queue options
 * @returns {Object} - Bull queue
 */
function createQueue(name, options = {}) {
  // Use cache if we already have this queue
  if (queues.has(name)) {
    return queues.get(name);
  }
  
  // Create new queue
  const queue = new Bull(name, { ...defaultOptions, ...options });
  
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
  // If using mock job manager, delegate to it
  if (USE_MOCK_JOB_MANAGER) {
    return await mockJobManager.enqueueJob(queueName, data, options);
  }
  
  // Check for rate limiting requirement
  if (data.options && data.options.shouldRateLimit) {
    // Implement basic rate limiting for high-cost operations like deep research
    const queue = createQueue(queueName);
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
  const queue = createQueue(queueName);
  const job = await queue.add(data, options);
  
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
 * @returns {void}
 */
function registerProcessor(queueName, processorFn, options = {}) {
  // If using mock job manager, delegate to it
  if (USE_MOCK_JOB_MANAGER) {
    return mockJobManager.registerProcessor(queueName, processorFn, options);
  }
  
  // Create queue and register processor
  const queue = createQueue(queueName);
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
  const queue = createQueue(queueName);
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