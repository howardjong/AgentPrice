/**
 * Job Manager Comprehensive Unit Tests
 * 
 * This test suite provides comprehensive tests for the Job Manager service,
 * focusing on both real and mock implementations while ensuring proper isolation
 * between tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setTimeout } from 'timers/promises';
import logger from '../../../utils/logger.js';

// Store original environment variables
const originalEnv = { ...process.env };

// Mock dependencies
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock the jobManager module
vi.mock('../../../services/jobManager.js', async () => {
  // Import the actual module implementation
  const originalModule = await vi.importActual('../../../services/jobManager.js');
  
  // Create mock functions for the internal methods
  const mockCreateQueue = vi.fn().mockImplementation((name, options = {}) => {
    // Create a mock queue
    const mockQueue = {
      name,
      options,
      add: vi.fn().mockImplementation((data, options = {}) => {
        const jobId = `job-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        return Promise.resolve({ id: jobId });
      }),
      getJob: vi.fn(),
      process: vi.fn(),
      on: vi.fn().mockReturnThis(),
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 10,
        failed: 1
      }),
      close: vi.fn().mockResolvedValue()
    };
    
    // Return the mock queue
    return mockQueue;
  });
  
  // Return a modified version of the original module
  return {
    ...originalModule,
    // Add the internal createQueue function for testing
    createQueue: mockCreateQueue,
    // Expose a mock queues Map for testing
    queues: {}
  };
});

// Import jobManager after mocking
import * as jobManager from '../../../services/jobManager.js';
import * as mockJobManager from '../../../services/mockJobManager.js';

// Mock both real and mock job manager modules
// Note: vi.mock must be called before importing the module
vi.mock('../../../services/mockJobManager.js', () => ({
  enqueueJob: vi.fn().mockImplementation((queueName, data, options = {}) => {
    return Promise.resolve(`mock-job-${queueName}-${Date.now()}`);
  }),
  getJobStatus: vi.fn().mockImplementation((queueName, jobId) => {
    if (jobId === 'not-found-job') {
      return Promise.resolve({
        id: jobId,
        status: 'not_found'
      });
    }
    
    if (jobId === 'failed-job') {
      return Promise.resolve({
        id: jobId,
        status: 'failed',
        error: 'Test failure reason',
        attempts: 3,
        progress: 50
      });
    }
    
    return Promise.resolve({
      id: jobId,
      status: 'completed',
      result: { result: 'test-result' },
      progress: 100,
      attempts: 1
    });
  }),
  registerProcessor: vi.fn(),
  getJobCounts: vi.fn().mockResolvedValue({
    waiting: 3,
    active: 1,
    completed: 15,
    failed: 2,
    delayed: 0
  }),
  clearAllMocks: vi.fn()
}));

// Custom mock for Bull queues (used by the real job manager)
vi.mock('bull', () => {
  return {
    default: vi.fn().mockImplementation((name, options) => {
      const mockQueue = {
        name,
        options,
        add: vi.fn().mockImplementation((data, options = {}) => {
          const jobId = `job-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          return Promise.resolve({ 
            id: jobId,
            data,
            opts: options
          });
        }),
        getJob: vi.fn().mockImplementation((id) => {
          if (id === 'not-found-job') {
            return Promise.resolve(null);
          }
          
          if (id === 'failed-job') {
            return Promise.resolve({
              id,
              data: { test: 'data' },
              getState: vi.fn().mockResolvedValue('failed'),
              _progress: 50,
              attemptsMade: 3,
              timestamp: Date.now() - 3000,
              processedOn: Date.now() - 2000,
              finishedOn: Date.now() - 1000,
              failedReason: 'Test failure reason'
            });
          }
          
          return Promise.resolve({
            id,
            data: { test: 'data' },
            getState: vi.fn().mockResolvedValue('completed'),
            _progress: 100,
            attemptsMade: 1,
            timestamp: Date.now() - 3000,
            processedOn: Date.now() - 2000,
            finishedOn: Date.now() - 1000,
            finished: vi.fn().mockResolvedValue({ result: 'test-result' })
          });
        }),
        process: vi.fn().mockImplementation((concurrency, fn) => {
          if (typeof concurrency === 'function') {
            fn = concurrency;
            concurrency = 1;
          }
          mockQueue.processorFn = fn;
          return mockQueue;
        }),
        on: vi.fn().mockReturnThis(),
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 5,
          active: 2,
          completed: 10,
          failed: 1,
          delayed: 0
        }),
        close: vi.fn().mockResolvedValue()
      };
      
      return mockQueue;
    })
  };
});

describe('JobManager', () => {
  let mockPerformance;
  
  beforeAll(() => {
    // Set up performance.now mock
    mockPerformance = {
      now: vi.fn().mockReturnValue(1000)
    };
    // Mock the performance API
    vi.stubGlobal('performance', mockPerformance);
  });
  
  afterAll(() => {
    // Restore any global mocks
    vi.unstubAllGlobals();
  });
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Reset performance.now to return consistent values
    mockPerformance.now.mockReturnValue(1000);
    
    // Restore environment variables
    process.env = { ...originalEnv };
  });
  
  afterEach(async () => {
    // Cleanup after each test
    try {
      await jobManager.close();
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Clear any job manager state
    if (jobManager.queues && typeof jobManager.queues === 'object') {
      Object.keys(jobManager.queues).forEach(key => {
        delete jobManager.queues[key];
      });
    }
    
    // Restore environment
    process.env = { ...originalEnv };
  });
  
  describe('Mock Job Manager Tests', () => {
    // Tests with mock job manager enabled
    beforeEach(() => {
      // Force mock mode
      process.env.USE_MOCK_JOB_MANAGER = 'true';
      process.env.REDIS_MODE = 'memory';
      process.env.NODE_ENV = 'test';
      
      // Clear mockJobManager state
      mockJobManager.clearAllMocks();
    });
    
    it('should use mockJobManager when in mock mode', async () => {
      // Ensure we're in mock mode
      expect(process.env.USE_MOCK_JOB_MANAGER).toBe('true');
      
      // Enqueue a job
      const queueName = 'test-queue';
      const jobData = { test: 'data' };
      const jobId = await jobManager.enqueueJob(queueName, jobData);
      
      // Verify mockJobManager.enqueueJob was called
      expect(mockJobManager.enqueueJob).toHaveBeenCalledWith(
        queueName, 
        jobData,
        expect.any(Object)
      );
      
      // Verify job ID has the expected format
      expect(jobId).toMatch(/^mock-job-test-queue-\d+$/);
    });
    
    it('should get job status from mockJobManager when in mock mode', async () => {
      // Get job status for a completed job
      const queueName = 'test-queue';
      const jobId = 'test-job-123';
      const status = await jobManager.getJobStatus(queueName, jobId);
      
      // Verify mockJobManager.getJobStatus was called
      expect(mockJobManager.getJobStatus).toHaveBeenCalledWith(
        queueName, 
        jobId
      );
      
      // Verify status has the expected properties
      expect(status).toHaveProperty('id', jobId);
      expect(status).toHaveProperty('status', 'completed');
      expect(status).toHaveProperty('result');
      expect(status).toHaveProperty('progress', 100);
    });
    
    it('should handle not found jobs correctly in mock mode', async () => {
      // Get job status for a non-existent job
      const queueName = 'test-queue';
      const jobId = 'not-found-job';
      const status = await jobManager.getJobStatus(queueName, jobId);
      
      // Verify status has the expected properties
      expect(status).toHaveProperty('id', jobId);
      expect(status).toHaveProperty('status', 'not_found');
    });
    
    it('should handle failed jobs correctly in mock mode', async () => {
      // Get job status for a failed job
      const queueName = 'test-queue';
      const jobId = 'failed-job';
      const status = await jobManager.getJobStatus(queueName, jobId);
      
      // Verify status has the expected properties
      expect(status).toHaveProperty('id', jobId);
      expect(status).toHaveProperty('status', 'failed');
      expect(status).toHaveProperty('error', 'Test failure reason');
      expect(status).toHaveProperty('attempts', 3);
    });
    
    it('should register a processor with mockJobManager when in mock mode', async () => {
      // Create a processor function
      const queueName = 'test-queue';
      const processor = vi.fn();
      const options = { concurrency: 2 };
      
      // Register the processor
      jobManager.registerProcessor(queueName, processor, options);
      
      // Verify mockJobManager.registerProcessor was called
      expect(mockJobManager.registerProcessor).toHaveBeenCalledWith(
        queueName, 
        processor,
        options
      );
    });
    
    it('should get job counts from mockJobManager when in mock mode', async () => {
      // Get job counts
      const queueName = 'test-queue';
      const counts = await jobManager.getJobCounts(queueName);
      
      // Verify mockJobManager.getJobCounts was called
      expect(mockJobManager.getJobCounts).toHaveBeenCalledWith(queueName);
      
      // Verify counts has the expected properties
      expect(counts).toHaveProperty('waiting', 3);
      expect(counts).toHaveProperty('active', 1);
      expect(counts).toHaveProperty('completed', 15);
      expect(counts).toHaveProperty('failed', 2);
    });
    
    it('should apply rate limiting for jobs with shouldRateLimit option', async () => {
      // Enqueue a job with rate limiting
      const queueName = 'rate-limited-queue';
      const jobData = { options: { shouldRateLimit: true } };
      
      // Mock getJobCounts to simulate active jobs
      mockJobManager.getJobCounts.mockResolvedValueOnce({
        waiting: 5,
        active: 3,
        completed: 10,
        failed: 1
      });
      
      // Enqueue the job
      const jobId = await jobManager.enqueueJob(queueName, jobData);
      
      // Verify mockJobManager.enqueueJob was called with options including delay
      expect(mockJobManager.enqueueJob).toHaveBeenCalledWith(
        queueName,
        jobData,
        expect.objectContaining({
          delay: expect.any(Number)
        })
      );
      
      // Verify job ID was returned
      expect(jobId).toBeTruthy();
    });
  });
  
  describe('Real Job Manager Tests', () => {
    // Tests with real job manager
    beforeEach(() => {
      // Force real mode
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Clear any queues that might have been created
      if (jobManager.queues) {
        Object.keys(jobManager.queues).forEach(key => {
          delete jobManager.queues[key];
        });
      }
    });
    
    it('should create a Bull queue when in real mode', () => {
      // Create a queue
      const queueName = 'test-bull-queue';
      const options = { removeOnComplete: 50 };
      const queue = jobManager.createQueue(queueName, options);
      
      // Verify queue has the expected properties
      expect(queue).toBeDefined();
      expect(queue).toHaveProperty('name', queueName);
      expect(queue).toHaveProperty('options');
      expect(queue.add).toBeTypeOf('function');
      expect(queue.process).toBeTypeOf('function');
      
      // Verify event handlers were registered
      expect(queue.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(queue.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(queue.on).toHaveBeenCalledWith('completed', expect.any(Function));
    });
    
    it('should return the same queue when creating with the same name', () => {
      // Create queues with the same name
      const queueName = 'reused-queue';
      const queue1 = jobManager.createQueue(queueName);
      const queue2 = jobManager.createQueue(queueName);
      
      // Verify they are the same instance
      expect(queue1).toBe(queue2);
      
      // Verify on was only called once for the first creation
      expect(queue1.on).toHaveBeenCalledTimes(3); // 3 events: error, failed, completed
    });
    
    it('should add a job to a Bull queue when in real mode', async () => {
      // Enqueue a job
      const queueName = 'job-queue';
      const jobData = { test: 'data' };
      const jobId = await jobManager.enqueueJob(queueName, jobData);
      
      // Verify job ID was returned
      expect(jobId).toBeTruthy();
      
      // Verify the queue was created
      expect(jobManager.queues).toBeDefined();
      expect(jobManager.queues[queueName]).toBeDefined();
      
      // Verify add was called on the queue
      expect(jobManager.queues[queueName].add).toHaveBeenCalledWith(
        jobData,
        expect.any(Object)
      );
    });
    
    it('should apply rate limiting for deep research jobs in real mode', async () => {
      // Mock a queue with active jobs
      const queueName = 'deep-research-queue';
      const queue = jobManager.createQueue(queueName);
      
      // Mock getJobCounts to simulate active jobs
      queue.getJobCounts.mockResolvedValueOnce({
        waiting: 3,
        active: 2,
        completed: 10,
        failed: 1
      });
      
      // Enqueue a job with rate limiting option
      const jobData = { options: { shouldRateLimit: true } };
      const jobId = await jobManager.enqueueJob(queueName, jobData);
      
      // Verify add was called with delay option
      expect(queue.add).toHaveBeenCalledWith(
        jobData,
        expect.objectContaining({
          delay: expect.any(Number)
        })
      );
      
      // Verify job ID was returned
      expect(jobId).toBeTruthy();
      
      // Verify logger.info was called about rate limiting
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Rate limiting'),
        expect.objectContaining({
          delay: expect.any(Number)
        })
      );
    });
    
    it('should get job status from Bull queue when in real mode', async () => {
      // Create a queue and add a job
      const queueName = 'status-queue';
      const queue = jobManager.createQueue(queueName);
      
      // Get job status
      const jobId = 'test-job-456';
      const status = await jobManager.getJobStatus(queueName, jobId);
      
      // Verify getJob was called on the queue
      expect(queue.getJob).toHaveBeenCalledWith(jobId);
      
      // Verify status has the expected properties
      expect(status).toHaveProperty('id', jobId);
      expect(status).toHaveProperty('status', 'completed');
      expect(status).toHaveProperty('result');
      expect(status).toHaveProperty('progress');
      
      // Verify the job.getState was called to determine status
      const job = await queue.getJob(jobId);
      expect(job.getState).toHaveBeenCalled();
    });
    
    it('should handle not found jobs correctly in real mode', async () => {
      // Create a queue
      const queueName = 'not-found-queue';
      jobManager.createQueue(queueName);
      
      // Get job status for a non-existent job
      const jobId = 'not-found-job';
      const status = await jobManager.getJobStatus(queueName, jobId);
      
      // Verify status indicates not found
      expect(status).toHaveProperty('status', 'not_found');
    });
    
    it('should handle failed jobs correctly in real mode', async () => {
      // Create a queue
      const queueName = 'failed-job-queue';
      jobManager.createQueue(queueName);
      
      // Get job status for a failed job
      const jobId = 'failed-job';
      const status = await jobManager.getJobStatus(queueName, jobId);
      
      // Verify status has the expected properties
      expect(status).toHaveProperty('id', jobId);
      expect(status).toHaveProperty('status', 'failed');
      expect(status).toHaveProperty('error', 'Test failure reason');
    });
    
    it('should register a processor for a Bull queue when in real mode', () => {
      // Create a processor function
      const queueName = 'processor-queue';
      const processor = vi.fn().mockResolvedValue({ result: 'processed' });
      const concurrency = 3;
      
      // Register the processor
      jobManager.registerProcessor(queueName, processor, concurrency);
      
      // Verify the queue was created
      expect(jobManager.queues).toBeDefined();
      expect(jobManager.queues[queueName]).toBeDefined();
      
      // Verify process was called on the queue
      expect(jobManager.queues[queueName].process).toHaveBeenCalledWith(
        concurrency,
        expect.any(Function)
      );
      
      // Verify logger.info was called
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Registered processor for queue ${queueName}`),
        expect.anything()
      );
    });
    
    it('should handle processor execution correctly', async () => {
      // Create a processor function
      const queueName = 'execution-queue';
      const processResult = { result: 'test-result' };
      const processor = vi.fn().mockResolvedValue(processResult);
      
      // Register the processor
      jobManager.registerProcessor(queueName, processor);
      
      // Extract the processor wrapper function
      const queue = jobManager.queues[queueName];
      const processFn = queue.process.mock.calls[0][1];
      
      // Create a mock job
      const mockJob = {
        id: 'test-job-789',
        data: { test: 'data' },
        updateProgress: vi.fn()
      };
      
      // Mock performance.now to return different values for timing calculation
      mockPerformance.now
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(3500); // End time - 2.5 seconds later
      
      // Call the processor wrapper with the mock job
      const result = await processFn(mockJob);
      
      // Verify processor was called with the job
      expect(processor).toHaveBeenCalledWith(mockJob);
      
      // Verify job.updateProgress was called
      expect(mockJob.updateProgress).toHaveBeenCalled();
      
      // Verify the expected result was returned
      expect(result).toEqual(processResult);
      
      // Verify logger.info was called with processing time
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Job ${mockJob.id} processing completed`),
        expect.objectContaining({
          jobId: mockJob.id,
          duration: '2500.00ms'
        })
      );
    });
    
    it('should handle processor errors correctly', async () => {
      // Create a processor function that throws an error
      const queueName = 'error-queue';
      const testError = new Error('Test processor error');
      const processor = vi.fn().mockRejectedValue(testError);
      
      // Register the processor
      jobManager.registerProcessor(queueName, processor);
      
      // Extract the processor wrapper function
      const queue = jobManager.queues[queueName];
      const processFn = queue.process.mock.calls[0][1];
      
      // Create a mock job
      const mockJob = {
        id: 'test-job-error',
        data: { test: 'data' },
        updateProgress: vi.fn()
      };
      
      // Call the processor wrapper and expect it to throw
      await expect(processFn(mockJob)).rejects.toThrow('Test processor error');
      
      // Verify processor was called with the job
      expect(processor).toHaveBeenCalledWith(mockJob);
      
      // Verify logger.error was called
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error processing job ${mockJob.id}`),
        expect.objectContaining({
          jobId: mockJob.id,
          error: testError.message
        })
      );
    });
    
    it('should get job counts from Bull queue when in real mode', async () => {
      // Create a queue
      const queueName = 'counts-queue';
      const queue = jobManager.createQueue(queueName);
      
      // Mock getJobCounts to return specific values
      queue.getJobCounts.mockResolvedValueOnce({
        waiting: 7,
        active: 3,
        completed: 20,
        failed: 2,
        delayed: 1
      });
      
      // Get job counts
      const counts = await jobManager.getJobCounts(queueName);
      
      // Verify getJobCounts was called on the queue
      expect(queue.getJobCounts).toHaveBeenCalled();
      
      // Verify counts has the expected properties
      expect(counts).toHaveProperty('waiting', 7);
      expect(counts).toHaveProperty('active', 3);
      expect(counts).toHaveProperty('completed', 20);
      expect(counts).toHaveProperty('failed', 2);
      expect(counts).toHaveProperty('delayed', 1);
    });
    
    it('should close all queues properly', async () => {
      // Create multiple queues
      const queue1 = jobManager.createQueue('queue1');
      const queue2 = jobManager.createQueue('queue2');
      const queue3 = jobManager.createQueue('queue3');
      
      // Close all queues
      await jobManager.close();
      
      // Verify close was called on each queue
      expect(queue1.close).toHaveBeenCalled();
      expect(queue2.close).toHaveBeenCalled();
      expect(queue3.close).toHaveBeenCalled();
      
      // Verify logger.info was called
      expect(logger.info).toHaveBeenCalledWith('All job queues closed');
    });
  });
  
  describe('Edge Cases and Error Handling', () => {
    it('should handle queue connection errors gracefully', async () => {
      // Force real mode
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      
      // Create a queue that will throw on add
      const queueName = 'error-queue';
      const queue = jobManager.createQueue(queueName);
      const testError = new Error('Connection error');
      
      // Mock add to throw
      queue.add.mockRejectedValueOnce(testError);
      
      // Try to enqueue a job
      try {
        await jobManager.enqueueJob(queueName, { test: 'data' });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Verify error is passed through
        expect(error.message).toBe('Connection error');
        
        // Verify logger.error was called
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error adding job to queue'),
          expect.objectContaining({
            queueName,
            error: testError.message
          })
        );
      }
    });
    
    it('should handle getJobStatus errors gracefully', async () => {
      // Force real mode
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      
      // Create a queue that will throw on getJob
      const queueName = 'status-error-queue';
      const queue = jobManager.createQueue(queueName);
      const testError = new Error('GetJob error');
      
      // Mock getJob to throw
      queue.getJob.mockRejectedValueOnce(testError);
      
      // Try to get job status
      try {
        await jobManager.getJobStatus(queueName, 'test-job');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Verify error is passed through
        expect(error.message).toBe('GetJob error');
        
        // Verify logger.error was called
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error getting job status'),
          expect.objectContaining({
            queueName,
            jobId: 'test-job',
            error: testError.message
          })
        );
      }
    });
    
    it('should handle close errors gracefully', async () => {
      // Force real mode
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      
      // Create a queue that will throw on close
      const queueName = 'close-error-queue';
      const queue = jobManager.createQueue(queueName);
      const testError = new Error('Close error');
      
      // Mock close to throw
      queue.close.mockRejectedValueOnce(testError);
      
      // Try to close queues
      try {
        await jobManager.close();
        // Should still succeed even with errors
        expect(true).toBe(true);
        
        // Verify logger.error was called
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error closing queue'),
          expect.objectContaining({
            queueName,
            error: testError.message
          })
        );
      } catch (error) {
        // Should not reach here
        expect(true).toBe(false);
      }
    });
    
    it('should handle job with no processor gracefully', async () => {
      // Force mock mode for this test
      process.env.USE_MOCK_JOB_MANAGER = 'true';
      
      // Enqueue a job with no processor registered
      const queueName = 'no-processor-queue';
      const jobData = { test: 'data' };
      
      // Mock implementation to simulate no processor
      mockJobManager.enqueueJob.mockImplementationOnce(async (qName, data) => {
        const jobId = `test-job-${Date.now()}`;
        // Return the job ID but don't process it
        return jobId;
      });
      
      // Enqueue the job
      const jobId = await jobManager.enqueueJob(queueName, jobData);
      
      // Verify job ID was returned
      expect(jobId).toBeTruthy();
      
      // No further assertions needed - if it didn't throw, it handled the lack of processor
    });
  });
});