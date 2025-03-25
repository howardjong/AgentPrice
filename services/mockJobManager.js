/**
 * Mock Job Manager
 * 
 * This is a simple in-memory implementation of a job queue system
 * that doesn't require Redis. It's intended for development and testing.
 */

import logger from '../utils/logger.js';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

class MockQueue extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.jobs = new Map();
    this.processors = [];
    this.jobStates = new Map();  // Stores the state of each job
    this.jobProgress = new Map(); // Stores the progress of each job
    this.processingJobs = new Set();
  }

  async add(data, options = {}) {
    const id = options.jobId || uuidv4();
    const job = {
      id,
      data,
      timestamp: Date.now(),
      attemptsMade: 0,
      options,
      _progress: 0,
      priority: options.priority || 0, // Add priority to the job
      updateProgress: (percent) => {
        job._progress = percent;
        this.jobProgress.set(id, percent);
        this.emit('progress', job, percent);
      }
    };

    this.jobs.set(id, job);
    this.jobStates.set(id, 'waiting');

    logger.debug(`Added job ${id} to mock queue ${this.name}`);

    // Schedule job for processing
    setImmediate(() => this.processNextJob());

    return job;
  }

  async getJob(id) {
    return this.jobs.get(id);
  }

  process(concurrency, processor) {
    if (typeof concurrency === 'function') {
      processor = concurrency;
      concurrency = 1;
    }

    this.processors.push({ processor, concurrency });

    // Start processing jobs
    setImmediate(() => this.processNextJob());

    return this;
  }

  async processNextJob() {
    // Check if we have processors
    if (this.processors.length === 0) return;

    // Get the next waiting job
    let nextJobId = null;
    let highestPriority = Infinity;

    for (const [id, state] of this.jobStates.entries()) {
      const job = this.jobs.get(id);
      if (state === 'waiting' && !this.processingJobs.has(id) && job.priority < highestPriority) {
        nextJobId = id;
        highestPriority = job.priority;
      }
    }


    if (nextJobId === null) return;

    // Get the job
    const job = this.jobs.get(nextJobId);
    if (!job) return;

    // Mark job as active
    this.jobStates.set(nextJobId, 'active');
    this.processingJobs.add(nextJobId);
    job.processedOn = Date.now();

    // Get a processor
    const { processor } = this.processors[0];

    try {
      // Process the job
      this.emit('active', job);

      const done = (error, result) => {
        this.processingJobs.delete(nextJobId);

        if (error) {
          job.attemptsMade++;
          job.failedReason = error.message;

          if (job.attemptsMade < (job.options.attempts || 3)) {
            // Retry the job
            this.jobStates.set(nextJobId, 'waiting');
            logger.warn(`Job ${nextJobId} in mock queue ${this.name} failed, retrying (${job.attemptsMade}/${job.options.attempts || 3})`, {
              error: error.message
            });

            // Add delay before retry
            setTimeout(() => this.processNextJob(), 1000 * job.attemptsMade);
          } else {
            // Mark job as failed
            this.jobStates.set(nextJobId, 'failed');
            job.finishedOn = Date.now();
            this.emit('failed', job, error);
            logger.error(`Job ${nextJobId} in mock queue ${this.name} failed permanently`, {
              error: error.message,
              attempts: job.attemptsMade
            });
          }
        } else {
          // Mark job as completed
          this.jobStates.set(nextJobId, 'completed');
          job.returnvalue = result;
          job.finishedOn = Date.now();
          this.emit('completed', job, result);
          logger.info(`Job ${nextJobId} in mock queue ${this.name} completed`, {
            duration: job.finishedOn - job.processedOn
          });
        }

        // Process next job
        setImmediate(() => this.processNextJob());
      };

      const result = processor(job, done);

      // If processor returns a promise, handle it
      if (result instanceof Promise) {
        result.then(
          result => done(null, result),
          error => done(error)
        );
      }
    } catch (error) {
      // Handle synchronous errors
      this.processingJobs.delete(nextJobId);
      job.attemptsMade++;
      job.failedReason = error.message;
      this.jobStates.set(nextJobId, 'failed');
      job.finishedOn = Date.now();
      this.emit('failed', job, error);

      logger.error(`Job ${nextJobId} in mock queue ${this.name} failed with uncaught error`, {
        error: error.message
      });

      // Process next job
      setImmediate(() => this.processNextJob());
    }
  }

  async getJobCounts() {
    const counts = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    };

    for (const state of this.jobStates.values()) {
      counts[state] = (counts[state] || 0) + 1;
    }

    return counts;
  }

  async getState() {
    return Array.from(this.jobStates.values());
  }

  async close() {
    this.processors = [];
    return Promise.resolve();
  }
}

class MockJobManager {
  constructor() {
    this.queues = {};
    this.monitorInterval = null;
  }

  createQueue(name, options = {}) {
    if (this.queues[name]) {
      return this.queues[name];
    }

    logger.info(`Creating mock queue: ${name}`);
    const queue = new MockQueue(name);
    this.queues[name] = queue;
    return queue;
  }

  async enqueueJob(queueName, data, options = {}) {
    const queue = this.createQueue(queueName);
    logger.debug(`Enqueueing job in ${queueName}`, { data });

    const job = await queue.add(data, options);
    return job.id;
  }

  async getJobStatus(queueName, jobId) {
    const queue = this.createQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState?.() || queue.jobStates.get(jobId) || 'unknown';
    const progress = job._progress || queue.jobProgress.get(jobId) || 0;

    return { 
      id: job.id,
      status: state, 
      progress, 
      attempts: job.attemptsMade,
      data: job.data,
      createdAt: job.timestamp,
      processingTime: job.finishedOn ? job.finishedOn - job.processedOn : null,
      waitTime: job.processedOn ? job.processedOn - job.timestamp : null
    };
  }

  registerProcessor(queueName, processor, concurrency = 1) {
    const queue = this.createQueue(queueName);

    queue.process(concurrency, async (job, done) => {
      try {
        logger.info(`Processing job ${job.id} in queue ${queueName}`, { jobId: job.id });
        const start = performance.now();

        job.progress = function(percent) {
          job.updateProgress(percent);
        };

        const result = await processor(job);
        const duration = performance.now() - start;

        logger.info(`Job ${job.id} processing completed in ${duration.toFixed(0)}ms`, { 
          jobId: job.id,
          duration: duration.toFixed(0)
        });

        done(null, result);
      } catch (error) {
        logger.error(`Error processing job ${job.id} in queue ${queueName}`, { 
          jobId: job.id, 
          error: error.message,
          stack: error.stack
        });
        done(error);
      }
    });

    logger.info(`Registered processor for queue ${queueName} with concurrency ${concurrency}`);
    return queue;
  }

  startMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.monitorInterval = setInterval(async () => {
      try {
        for (const [queueName, queue] of Object.entries(this.queues)) {
          const counts = await queue.getJobCounts();
          logger.debug(`Queue ${queueName} status`, { counts });

          if (counts.waiting > 100) {
            logger.warn(`Large backlog in queue ${queueName}`, { waiting: counts.waiting });
          }

          if (counts.failed > 10) {
            logger.warn(`High failure rate in queue ${queueName}`, { failed: counts.failed });
          }
        }
      } catch (error) {
        logger.error('Error in queue monitoring', { error: error.message });
      }
    }, 60000);
  }

  stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    return Promise.all(Object.values(this.queues).map(queue => queue.close()));
  }
}

// Create and export a singleton instance
const mockJobManager = new MockJobManager();
export default mockJobManager;