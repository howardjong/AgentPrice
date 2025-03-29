/**
 * MockJobManager
 * 
 * This utility provides a complete mock implementation of the JobManager service
 * for testing asynchronous job-based workflows without actual job execution.
 * It simulates job creation, state transitions, and completion events.
 * 
 * Features:
 * - Mock implementation of all JobManager methods
 * - Control over job state transitions
 * - Support for testing job events and callbacks
 * - Ability to simulate long-running jobs
 */

// Job states
export const JOB_STATES = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELAYED: 'delayed'
};

/**
 * MockJobManager class
 */
export class MockJobManager {
  constructor(options = {}) {
    this.jobs = new Map();
    this.jobCounter = 1;
    this.eventHandlers = {
      completed: new Set(),
      failed: new Set(),
      progress: new Set(),
      stalled: new Set(),
      removed: new Set()
    };
    this.defaultDelay = options.defaultDelay || 0;
    this.processingDelay = options.processingDelay || 100;
    this.autoProcess = options.autoProcess !== false;
    this.failureRate = options.failureRate || 0;
    this.verbose = options.verbose || false;
    this.completedJobs = [];
    this.failedJobs = [];
  }

  /**
   * Log if verbose is enabled
   * @param {String} message - Message to log
   * @param {Object} data - Optional data to log
   */
  log(message, data = null) {
    if (this.verbose) {
      console.log(`[MockJobManager] ${message}`, data ? data : '');
    }
  }

  /**
   * Create a new job
   * @param {String} name - Job name
   * @param {Object} data - Job data
   * @param {Object} options - Job options
   * @returns {Object} The created job
   */
  createJob(name, data, options = {}) {
    const jobId = `job:${this.jobCounter++}`;
    const job = {
      id: jobId,
      name,
      data: { ...data },
      opts: { ...options },
      timestamp: Date.now(),
      state: options.delay ? JOB_STATES.DELAYED : JOB_STATES.PENDING,
      progress: 0,
      result: null,
      error: null,
      delay: options.delay || this.defaultDelay,
      attempts: 0,
      maxAttempts: options.attempts || 1,
      finishedOn: null,
      processedOn: null
    };

    this.jobs.set(jobId, job);
    this.log(`Created job: ${name}`, { jobId, data });

    // Auto-process the job if enabled
    if (this.autoProcess && !options.delay) {
      setTimeout(() => this.processJob(jobId), this.processingDelay);
    } else if (options.delay) {
      setTimeout(() => {
        job.state = JOB_STATES.PENDING;
        this.log(`Job delay expired: ${name}`, { jobId });
        if (this.autoProcess && options.autoProcess !== false) {
          this.processJob(jobId);
        }
      }, options.delay);
    }

    return {
      id: jobId,
      // Mock the job methods
      update: (newData) => this.updateJob(jobId, newData),
      setProgress: (progress) => this.setJobProgress(jobId, progress),
      remove: () => this.removeJob(jobId),
      retry: () => this.retryJob(jobId),
      finished: () => this.jobFinished(jobId),
      isCompleted: () => this.isJobCompleted(jobId),
      isFailed: () => this.isJobFailed(jobId),
      moveToCompleted: () => this.completeJob(jobId),
      moveToFailed: (err) => this.failJob(jobId, err)
    };
  }

  /**
   * Process a job
   * @param {String} jobId - Job ID
   */
  async processJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.log(`Cannot process job: Job ${jobId} not found`);
      return;
    }

    if (job.state !== JOB_STATES.PENDING) {
      this.log(`Cannot process job: Job ${jobId} is not pending`);
      return;
    }

    job.state = JOB_STATES.ACTIVE;
    job.processedOn = Date.now();
    job.attempts += 1;
    this.log(`Processing job: ${job.name}`, { jobId });

    // Simulate progress updates - first update should happen immediately for better testability
    let progress = 20;
    this.setJobProgress(jobId, progress);
    
    const progressInterval = setInterval(() => {
      progress += 20;
      if (progress <= 100) {
        this.setJobProgress(jobId, progress);
      } else {
        clearInterval(progressInterval);
      }
    }, this.processingDelay / 5);

    // Simulate completion or failure
    setTimeout(() => {
      clearInterval(progressInterval);
      
      // Decide if job should fail based on failure rate
      if (Math.random() < this.failureRate) {
        const error = new Error('Simulated job failure');
        this.failJob(jobId, error);
      } else {
        // Complete the job with a sample result
        const result = {
          status: 'success',
          timeStamp: Date.now(),
          jobName: job.name,
          data: job.data
        };
        this.completeJob(jobId, result);
      }
    }, this.processingDelay);
  }

  /**
   * Update job data
   * @param {String} jobId - Job ID
   * @param {Object} newData - New job data
   */
  updateJob(jobId, newData) {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.log(`Cannot update job: Job ${jobId} not found`);
      return false;
    }

    job.data = { ...job.data, ...newData };
    this.log(`Updated job: ${job.name}`, { jobId, newData });
    return true;
  }

  /**
   * Set job progress
   * @param {String} jobId - Job ID
   * @param {Number} progress - Progress value (0-100)
   */
  setJobProgress(jobId, progress) {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.log(`Cannot set progress: Job ${jobId} not found`);
      return false;
    }

    job.progress = Math.min(100, Math.max(0, progress));
    this.log(`Job progress: ${job.name}`, { jobId, progress: job.progress });

    // Trigger progress event
    this.eventHandlers.progress.forEach(handler => {
      try {
        handler(job);
      } catch (error) {
        console.error('Error in progress event handler:', error);
      }
    });

    return true;
  }

  /**
   * Complete a job
   * @param {String} jobId - Job ID
   * @param {Object} result - Job result data
   */
  completeJob(jobId, result = {}) {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.log(`Cannot complete job: Job ${jobId} not found`);
      return false;
    }

    job.state = JOB_STATES.COMPLETED;
    job.result = result;
    job.finishedOn = Date.now();
    job.progress = 100;
    this.completedJobs.push(job);
    this.log(`Completed job: ${job.name}`, { jobId, result });

    // Trigger completed event
    this.eventHandlers.completed.forEach(handler => {
      try {
        handler(job);
      } catch (error) {
        console.error('Error in completed event handler:', error);
      }
    });

    return true;
  }

  /**
   * Fail a job
   * @param {String} jobId - Job ID
   * @param {Error} error - Error that caused the failure
   */
  failJob(jobId, error) {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.log(`Cannot fail job: Job ${jobId} not found`);
      return false;
    }

    job.state = JOB_STATES.FAILED;
    job.error = error || new Error('Job failed');
    job.finishedOn = Date.now();
    this.failedJobs.push(job);
    this.log(`Failed job: ${job.name}`, { jobId, error: job.error.message });

    // Trigger failed event
    this.eventHandlers.failed.forEach(handler => {
      try {
        handler(job, job.error);
      } catch (error) {
        console.error('Error in failed event handler:', error);
      }
    });

    // Auto-retry if attempts remain
    if (job.attempts < job.maxAttempts) {
      this.log(`Scheduling retry for job: ${job.name}`, { 
        jobId, 
        attempt: job.attempts, 
        maxAttempts: job.maxAttempts 
      });
      
      setTimeout(() => {
        job.state = JOB_STATES.PENDING;
        this.processJob(jobId);
      }, 100);
    }

    return true;
  }

  /**
   * Remove a job
   * @param {String} jobId - Job ID
   */
  removeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.log(`Cannot remove job: Job ${jobId} not found`);
      return false;
    }

    this.jobs.delete(jobId);
    this.log(`Removed job: ${job.name}`, { jobId });

    // Trigger removed event
    this.eventHandlers.removed.forEach(handler => {
      try {
        handler(job);
      } catch (error) {
        console.error('Error in removed event handler:', error);
      }
    });

    return true;
  }

  /**
   * Retry a job
   * @param {String} jobId - Job ID
   */
  retryJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.log(`Cannot retry job: Job ${jobId} not found`);
      return false;
    }

    if (job.state !== JOB_STATES.FAILED) {
      this.log(`Cannot retry job: Job ${jobId} is not failed`);
      return false;
    }

    job.state = JOB_STATES.PENDING;
    this.log(`Retrying job: ${job.name}`, { jobId });

    if (this.autoProcess) {
      setTimeout(() => this.processJob(jobId), this.processingDelay);
    }

    return true;
  }

  /**
   * Check if a job is completed
   * @param {String} jobId - Job ID
   * @returns {Boolean} Whether the job is completed
   */
  isJobCompleted(jobId) {
    const job = this.jobs.get(jobId);
    return job && job.state === JOB_STATES.COMPLETED;
  }

  /**
   * Check if a job is failed
   * @param {String} jobId - Job ID
   * @returns {Boolean} Whether the job is failed
   */
  isJobFailed(jobId) {
    const job = this.jobs.get(jobId);
    return job && job.state === JOB_STATES.FAILED;
  }

  /**
   * Wait until a job is finished (completed or failed)
   * @param {String} jobId - Job ID
   * @param {Number} timeout - Maximum wait time in ms
   * @returns {Promise<Object>} The finished job
   */
  jobFinished(jobId, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const job = this.jobs.get(jobId);
      if (!job) {
        reject(new Error(`Job ${jobId} not found`));
        return;
      }

      if (job.state === JOB_STATES.COMPLETED) {
        resolve(job);
        return;
      }

      if (job.state === JOB_STATES.FAILED) {
        reject(job.error || new Error('Job failed'));
        return;
      }

      const timeoutId = setTimeout(() => {
        completedHandler && this.eventHandlers.completed.delete(completedHandler);
        failedHandler && this.eventHandlers.failed.delete(failedHandler);
        reject(new Error(`Timeout waiting for job ${jobId} to finish`));
      }, timeout);

      const completedHandler = (finishedJob) => {
        if (finishedJob.id === jobId) {
          clearTimeout(timeoutId);
          this.eventHandlers.completed.delete(completedHandler);
          this.eventHandlers.failed.delete(failedHandler);
          resolve(finishedJob);
        }
      };

      const failedHandler = (finishedJob, error) => {
        if (finishedJob.id === jobId) {
          clearTimeout(timeoutId);
          this.eventHandlers.completed.delete(completedHandler);
          this.eventHandlers.failed.delete(failedHandler);
          reject(error || new Error('Job failed'));
        }
      };

      this.eventHandlers.completed.add(completedHandler);
      this.eventHandlers.failed.add(failedHandler);
    });
  }

  /**
   * Register event handlers
   * @param {String} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = new Set();
    }
    this.eventHandlers[event].add(handler);
    return this;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.jobs.clear();
    this.completedJobs = [];
    this.failedJobs = [];
    
    // Clear all event handlers
    Object.keys(this.eventHandlers).forEach(event => {
      this.eventHandlers[event].clear();
    });
    
    this.log('Cleaned up MockJobManager');
  }

  /**
   * Get all jobs
   * @returns {Array} Array of all jobs
   */
  getAllJobs() {
    return Array.from(this.jobs.values());
  }

  /**
   * Get a job by ID
   * @param {String} jobId - Job ID
   * @returns {Object} The job
   */
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  /**
   * Get completed jobs
   * @returns {Array} Array of completed jobs
   */
  getCompletedJobs() {
    return this.completedJobs;
  }

  /**
   * Get failed jobs
   * @returns {Array} Array of failed jobs
   */
  getFailedJobs() {
    return this.failedJobs;
  }
}

export default MockJobManager;