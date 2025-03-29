/**
 * Mock Job Manager for Testing
 * 
 * This module provides a comprehensive mock implementation of the job manager
 * for testing long-running jobs and asynchronous workflows without requiring
 * a real Bull queue or Redis instance.
 */

import { vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Create a job object with standard structure matching Bull job format
 * 
 * @param {Object} jobData - Job data and configuration
 * @param {string} jobData.id - Job ID (optional, will be generated if not provided)
 * @param {string} jobData.name - Job name/type
 * @param {Object} jobData.data - Job payload data
 * @param {string} jobData.status - Job status (waiting, active, completed, failed)
 * @param {number} jobData.progress - Job progress (0-100)
 * @returns {Object} Mock job object
 */
const createMockJob = (jobData = {}) => {
  const defaults = {
    id: `job-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: 'mock-job',
    data: {},
    status: 'waiting',
    progress: 0,
    attempts: 0,
    timestamp: Date.now(),
    processedOn: null,
    finishedOn: null,
    returnvalue: null,
    failedReason: null,
    stacktrace: null
  };

  const job = { ...defaults, ...jobData };
  return job;
};

/**
 * Create a mock Job Manager that simulates Bull queue functionality
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.initialJobs - Map of initial jobs to populate the queue
 * @param {boolean} options.autoProcess - Automatically process jobs when added
 * @param {number} options.processingTime - Simulated processing time (ms)
 * @param {Function} options.defaultProcessor - Default job processor function
 * @returns {Object} Mock job manager interface
 */
export function createMockJobManager(options = {}) {
  const {
    initialJobs = {},
    autoProcess = true,
    processingTime = 100,
    defaultProcessor = null
  } = options;

  // Internal state
  const jobs = new Map(Object.entries(initialJobs));
  const processors = new Map();
  const eventEmitter = new EventEmitter();
  const jobQueues = new Map();

  // Create a mock queue for a specific queue name
  const createQueue = (queueName) => {
    if (jobQueues.has(queueName)) {
      return jobQueues.get(queueName);
    }

    const queue = {
      // Queue methods
      add: vi.fn().mockImplementation((jobName, data, options = {}) => {
        const jobId = options.jobId || `${queueName}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const job = createMockJob({
          id: jobId,
          name: jobName,
          data,
          status: 'waiting',
          progress: 0,
          timestamp: Date.now()
        });

        jobs.set(jobId, job);
        eventEmitter.emit('added', { jobId, queueName });

        if (autoProcess && processors.has(queueName)) {
          // Simulate asynchronous job processing
          setTimeout(() => {
            processJob(jobId, queueName);
          }, processingTime);
        }

        return Promise.resolve(job);
      }),

      process: vi.fn().mockImplementation((concurrency, processFn) => {
        const actualProcessFn = typeof concurrency === 'function' ? concurrency : processFn;
        processors.set(queueName, actualProcessFn);
        return queue;
      }),

      getJob: vi.fn().mockImplementation((jobId) => {
        return Promise.resolve(jobs.get(jobId) || null);
      }),

      getJobs: vi.fn().mockImplementation((types = ['waiting', 'active', 'completed', 'failed']) => {
        const filteredJobs = Array.from(jobs.values()).filter(job => 
          types.includes(job.status) && job.name === queueName
        );
        return Promise.resolve(filteredJobs);
      }),

      on: vi.fn().mockImplementation((event, handler) => {
        eventEmitter.on(event, handler);
        return queue;
      }),

      // Mock Bull Queue events
      emit: (event, data) => {
        eventEmitter.emit(event, data);
      }
    };

    jobQueues.set(queueName, queue);
    return queue;
  };

  // Process a job with the registered processor
  const processJob = async (jobId, queueName) => {
    const job = jobs.get(jobId);
    if (!job) return null;

    // Update job status
    job.status = 'active';
    job.processedOn = Date.now();
    eventEmitter.emit('active', { jobId, queueName });

    // Get the processor function
    const processor = processors.get(queueName) || defaultProcessor;
    if (!processor) {
      job.status = 'failed';
      job.failedReason = 'No processor registered';
      eventEmitter.emit('failed', { jobId, queueName, reason: job.failedReason });
      return job;
    }

    try {
      // Call the processor with a job object that has progress tracking
      const jobWithProgress = {
        ...job,
        progress: vi.fn().mockImplementation((value) => {
          job.progress = value;
          eventEmitter.emit('progress', { jobId, queueName, progress: value });
          return Promise.resolve();
        })
      };

      const result = await processor(jobWithProgress);
      
      // Update job with results
      job.status = 'completed';
      job.finishedOn = Date.now();
      job.returnvalue = result;
      job.progress = 100;
      
      eventEmitter.emit('completed', { jobId, queueName, result });
      return job;
    } catch (error) {
      job.status = 'failed';
      job.failedReason = error.message;
      job.stacktrace = error.stack ? [error.stack] : [];
      job.finishedOn = Date.now();
      
      eventEmitter.emit('failed', { jobId, queueName, error });
      return job;
    }
  };

  // Create the mock JobManager API
  return {
    // Internal testing utilities
    _jobs: jobs,
    _processors: processors,
    _queues: jobQueues,
    _eventEmitter: eventEmitter,

    // Bull Queue API
    createQueue: vi.fn().mockImplementation(createQueue),
    
    // Job Manager API
    enqueueJob: vi.fn().mockImplementation((queueName, jobName, data, options = {}) => {
      const queue = createQueue(queueName);
      return queue.add(jobName, data, options).then(job => job.id);
    }),

    getJobStatus: vi.fn().mockImplementation(async (jobId) => {
      const job = jobs.get(jobId);
      if (!job) return null;
      
      return {
        id: job.id,
        status: job.status,
        progress: job.progress,
        data: job.data,
        result: job.returnvalue,
        error: job.failedReason,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
        attempts: job.attempts,
        stacktrace: job.stacktrace
      };
    }),

    getJobsByStatus: vi.fn().mockImplementation(async (queueName, status) => {
      return Array.from(jobs.values()).filter(job => 
        job.status === status && job.name === queueName
      );
    }),

    registerProcessor: vi.fn().mockImplementation((queueName, processFn, concurrency = 1) => {
      const queue = createQueue(queueName);
      queue.process(concurrency, processFn);
      return true;
    }),

    completeJob: vi.fn().mockImplementation(async (jobId, result) => {
      const job = jobs.get(jobId);
      if (!job) return false;
      
      job.status = 'completed';
      job.progress = 100;
      job.finishedOn = Date.now();
      job.returnvalue = result;
      
      eventEmitter.emit('completed', { jobId, queueName: job.name, result });
      return true;
    }),

    failJob: vi.fn().mockImplementation(async (jobId, reason) => {
      const job = jobs.get(jobId);
      if (!job) return false;
      
      job.status = 'failed';
      job.failedReason = reason;
      job.finishedOn = Date.now();
      
      eventEmitter.emit('failed', { jobId, queueName: job.name, reason });
      return true;
    }),

    updateJobProgress: vi.fn().mockImplementation(async (jobId, progress) => {
      const job = jobs.get(jobId);
      if (!job) return false;
      
      job.progress = progress;
      eventEmitter.emit('progress', { jobId, queueName: job.name, progress });
      return true;
    }),

    removeJob: vi.fn().mockImplementation(async (jobId) => {
      return jobs.delete(jobId);
    }),

    getActiveJobs: vi.fn().mockImplementation(async (queueName) => {
      return Array.from(jobs.values()).filter(job => 
        job.status === 'active' && job.name === queueName
      );
    }),

    // Test helper methods for simulating job behavior
    simulateJobProgress: vi.fn().mockImplementation(async (jobId, steps = 5, stepTime = 100) => {
      const job = jobs.get(jobId);
      if (!job) return false;
      
      job.status = 'active';
      job.processedOn = Date.now();
      eventEmitter.emit('active', { jobId, queueName: job.name });
      
      for (let i = 0; i < steps; i++) {
        await new Promise(resolve => setTimeout(resolve, stepTime));
        const progress = Math.floor((i + 1) / steps * 100);
        job.progress = progress;
        eventEmitter.emit('progress', { jobId, queueName: job.name, progress });
      }
      
      return true;
    }),

    simulateJobCompletion: vi.fn().mockImplementation(async (jobId, result, delay = 0) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      return this.completeJob(jobId, result);
    }),

    simulateJobFailure: vi.fn().mockImplementation(async (jobId, reason, delay = 0) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      return this.failJob(jobId, reason);
    }),

    // Clean up method for after tests
    reset: () => {
      jobs.clear();
      processors.clear();
      jobQueues.clear();
      eventEmitter.removeAllListeners();
    }
  };
}

/**
 * Create a simple mock job manager with minimal functionality
 * Useful for basic tests where full job simulation is not required
 */
export function createSimpleMockJobManager() {
  const jobs = new Map();
  
  return {
    enqueueJob: vi.fn().mockImplementation((queueName, jobName, data) => {
      const jobId = `job-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      jobs.set(jobId, {
        id: jobId,
        queueName,
        name: jobName,
        data,
        status: 'waiting',
        progress: 0,
        createdAt: new Date()
      });
      return Promise.resolve(jobId);
    }),
    
    getJobStatus: vi.fn().mockImplementation((jobId) => {
      const job = jobs.get(jobId);
      if (!job) return Promise.resolve(null);
      return Promise.resolve(job);
    }),
    
    completeJob: vi.fn().mockImplementation((jobId, result) => {
      const job = jobs.get(jobId);
      if (!job) return Promise.resolve(false);
      
      job.status = 'completed';
      job.progress = 100;
      job.result = result;
      job.finishedAt = new Date();
      
      return Promise.resolve(true);
    }),
    
    updateJobProgress: vi.fn().mockImplementation((jobId, progress) => {
      const job = jobs.get(jobId);
      if (!job) return Promise.resolve(false);
      
      job.progress = progress;
      return Promise.resolve(true);
    }),
    
    reset: () => {
      jobs.clear();
    }
  };
}

export default {
  createMockJobManager,
  createSimpleMockJobManager
};