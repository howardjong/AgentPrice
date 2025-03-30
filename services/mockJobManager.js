/**
 * Mock Job Manager
 * 
 * Provides a memory-based implementation of the job manager interface
 * for testing and development without requiring Redis.
 */

import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// In-memory storage for mock jobs
const mockJobs = new Map();
const mockQueues = new Map();
const mockProcessors = new Map();

/**
 * Create a mock queue
 * @param {string} name - Queue name
 * @param {Object} options - Queue options
 * @returns {Object} - Mock queue object
 */
function createMockQueue(name, options = {}) {
  logger.info(`Creating mock queue: ${name}`);
  
  // Create the queue if it doesn't exist
  if (!mockQueues.has(name)) {
    mockQueues.set(name, {
      name,
      options,
      jobs: new Map(),
      processors: []
    });
  }
  
  return mockQueues.get(name);
}

/**
 * Enqueue a job in the mock job manager
 * @param {string} queueName - Name of the queue
 * @param {Object} data - Job data
 * @param {Object} options - Job options
 * @returns {Promise<string>} - Job ID
 */
async function enqueueJob(queueName, data, options = {}) {
  // Create queue if it doesn't exist
  const queue = createMockQueue(queueName);
  
  // Create a unique job ID
  const jobId = options.jobId || `mock-${queueName}-${uuidv4().substring(0, 8)}`;
  
  // Create the job
  const job = {
    id: jobId,
    data,
    options,
    queue: queueName,
    timestamp: Date.now(),
    status: 'waiting',
    progress: 0,
    result: null,
    error: null,
    processedOn: null,
    finishedOn: null,
    attempts: 0,
    updateProgress: async (progress) => {
      job.progress = progress;
      return job;
    }
  };
  
  // Store the job
  mockJobs.set(jobId, job);
  queue.jobs.set(jobId, job);
  
  // Process the job asynchronously if there are registered processors
  setTimeout(async () => {
    await processMockJob(queueName, jobId);
  }, options.delay || 10); // Short delay to simulate async processing
  
  return jobId;
}

/**
 * Process a mock job with registered processors
 * @param {string} queueName - Queue name
 * @param {string} jobId - Job ID
 * @returns {Promise<void>}
 */
async function processMockJob(queueName, jobId) {
  // Get the job
  const job = mockJobs.get(jobId);
  if (!job) {
    logger.warn(`Job ${jobId} not found for processing`);
    return;
  }
  
  // Get the processor for this queue
  const processor = mockProcessors.get(queueName);
  if (!processor) {
    logger.info(`No processor registered for queue ${queueName}, job ${jobId} remains in waiting state`);
    return;
  }
  
  try {
    // Update job status
    job.status = 'active';
    job.processedOn = Date.now();
    job.attempts += 1;
    
    // Process the job
    logger.info(`Processing mock job ${jobId} in queue ${queueName}`);
    const result = await processor(job);
    
    // Update job on success
    job.status = 'completed';
    job.finishedOn = Date.now();
    job.result = result;
    job.progress = 100;
    
    // Call success handler if provided
    if (job.options.successHandler) {
      try {
        await job.options.successHandler(job);
      } catch (handlerError) {
        logger.warn(`Error in success handler for job ${jobId}`, {
          error: handlerError.message
        });
      }
    }
  } catch (error) {
    // Update job on failure
    job.status = 'failed';
    job.finishedOn = Date.now();
    job.error = {
      message: error.message,
      stack: error.stack
    };
    
    logger.error(`Error processing mock job ${jobId}`, {
      error: error.message,
      queue: queueName
    });
    
    // Call error handler if provided
    if (job.options.errorHandler) {
      try {
        await job.options.errorHandler(job, error);
      } catch (handlerError) {
        logger.warn(`Error in error handler for job ${jobId}`, {
          error: handlerError.message
        });
      }
    }
  }
}

/**
 * Get the status of a job
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} - Job status
 */
async function getJobStatus(jobId) {
  const job = mockJobs.get(jobId);
  
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }
  
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    result: job.result,
    error: job.error ? job.error.message : null,
    queueName: job.queue,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    attempts: job.attempts
  };
}

/**
 * Register a processor function for a queue
 * @param {string} queueName - Queue name
 * @param {Function} processorFn - Processor function
 * @param {Object} options - Processor options
 * @returns {void}
 */
function registerProcessor(queueName, processorFn, options = {}) {
  // Create queue if it doesn't exist
  createMockQueue(queueName);
  
  // Register the processor
  mockProcessors.set(queueName, processorFn);
  
  const concurrency = options.concurrency || 1;
  logger.info(`Registered processor for queue ${queueName} with concurrency ${concurrency}`);
  
  // Process any waiting jobs in this queue
  processWaitingJobs(queueName);
}

/**
 * Process waiting jobs in a queue
 * @param {string} queueName - Queue name
 */
function processWaitingJobs(queueName) {
  const queue = mockQueues.get(queueName);
  if (!queue) return;
  
  // Find all waiting jobs for this queue
  for (const [jobId, job] of queue.jobs.entries()) {
    if (job.status === 'waiting') {
      processMockJob(queueName, jobId);
    }
  }
}

/**
 * Get job counts for a queue
 * @param {string} queueName - Queue name
 * @returns {Promise<Object>} - Job counts by status
 */
async function getJobCounts(queueName) {
  const queue = mockQueues.get(queueName);
  
  if (!queue) {
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    };
  }
  
  // Count jobs by status
  const counts = {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0
  };
  
  for (const job of queue.jobs.values()) {
    if (counts[job.status] !== undefined) {
      counts[job.status]++;
    }
  }
  
  return counts;
}

/**
 * Clear all mock data (for testing)
 */
function clearAllMocks() {
  mockJobs.clear();
  mockQueues.clear();
  mockProcessors.clear();
  logger.info('Cleared all mock job manager data');
}

export {
  enqueueJob,
  getJobStatus,
  registerProcessor,
  getJobCounts,
  clearAllMocks
};