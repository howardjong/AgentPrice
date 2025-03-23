
import Bull from 'bull';
import logger from '../utils/logger.js';
import { performance } from 'perf_hooks';
import redisClient from './redisService.js';
import mockJobManager from './mockJobManager.js';

// Flag to indicate if we're using the mock job manager
const USE_MOCK_JOB_MANAGER = process.env.REDIS_MODE === 'memory';

class JobManager {
  constructor() {
    this.queues = {};
    this.monitorInterval = null;
    
    if (USE_MOCK_JOB_MANAGER) {
      logger.info('Using mock job manager for Bull queues due to REDIS_MODE=memory');
    }
  }
  
  createQueue(name, options = {}) {
    // If using mock job manager, delegate to it
    if (USE_MOCK_JOB_MANAGER) {
      return mockJobManager.createQueue(name, options);
    }
    
    if (this.queues[name]) {
      return this.queues[name];
    }
    
    const defaultOptions = {
      redis: process.env.REDIS_URL || 'redis://localhost:6379',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: 100,
        removeOnFail: 100
      }
    };
    
    const queue = new Bull(name, { ...defaultOptions, ...options });
    
    queue.on('error', (error) => {
      logger.error(`Queue ${name} error`, { error: error.message });
    });
    
    queue.on('stalled', (job) => {
      logger.warn(`Job ${job.id} in queue ${name} stalled`, { jobId: job.id });
    });
    
    queue.on('completed', (job, result) => {
      const processingTime = job.finishedOn - job.processedOn;
      logger.info(`Job ${job.id} in queue ${name} completed`, { 
        jobId: job.id, 
        duration: processingTime,
        attempts: job.attemptsMade
      });
    });
    
    queue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} in queue ${name} failed`, { 
        jobId: job.id, 
        error: error.message,
        attempts: job.attemptsMade
      });
    });
    
    this.queues[name] = queue;
    return queue;
  }
  
  async enqueueJob(queueName, data, options = {}) {
    // If using mock job manager, delegate to it
    if (USE_MOCK_JOB_MANAGER) {
      return mockJobManager.enqueueJob(queueName, data, options);
    }
    
    const queue = this.createQueue(queueName);
    logger.debug(`Enqueueing job in ${queueName}`, { data });
    
    const job = await queue.add(data, options);
    return job.id;
  }
  
  async getJobStatus(queueName, jobId) {
    // If using mock job manager, delegate to it
    if (USE_MOCK_JOB_MANAGER) {
      return mockJobManager.getJobStatus(queueName, jobId);
    }
    
    const queue = this.createQueue(queueName);
    const job = await queue.getJob(jobId);
    
    if (!job) {
      return { status: 'not_found' };
    }
    
    const status = await job.getState();
    const progress = job._progress || 0;
    
    return { 
      id: job.id,
      status, 
      progress, 
      attempts: job.attemptsMade,
      data: job.data,
      createdAt: job.timestamp,
      processingTime: job.finishedOn ? job.finishedOn - job.processedOn : null,
      waitTime: job.processedOn ? job.processedOn - job.timestamp : null
    };
  }
  
  registerProcessor(queueName, processor, concurrency = 1) {
    // If using mock job manager, delegate to it
    if (USE_MOCK_JOB_MANAGER) {
      return mockJobManager.registerProcessor(queueName, processor, concurrency);
    }
    
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
    // If using mock job manager, delegate to it
    if (USE_MOCK_JOB_MANAGER) {
      return mockJobManager.startMonitoring();
    }
    
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
    // If using mock job manager, delegate to it
    if (USE_MOCK_JOB_MANAGER) {
      return mockJobManager.stop();
    }
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    return Promise.all(Object.values(this.queues).map(queue => queue.close()));
  }
}

const jobManager = new JobManager();
export default jobManager;
