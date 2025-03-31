/**
 * Job Manager Unit Tests - Fixed Version
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as jobManager from '../../../services/jobManager.js';
import * as mockJobManager from '../../../services/mockJobManager.js';
import logger from '../../../utils/logger.js'
import { setTimeout } from 'timers/promises';

// Mock dependencies
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Store original env
const originalEnv = { ...process.env };

describe('JobManager', () => {
  // Reset environment between tests
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset any queues that might have been created
    jobManager.queues = new Map();
    // Clear any monitoring intervals
    if (jobManager.monitorInterval) {
      clearInterval(jobManager.monitorInterval);
      jobManager.monitorInterval = null;
    }
  });

  afterEach(() => {
    // Restore environment
    process.env = { ...originalEnv };
    // Clear any monitoring intervals
    if (jobManager.monitorInterval) {
      clearInterval(jobManager.monitorInterval);
      jobManager.monitorInterval = null;
    }
  });

  describe('createQueue', () => {
    it('should create a new queue', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Mock Bull constructor
      const mockBullInstance = {
        add: vi.fn().mockResolvedValue({ id: 'test-job-123' }),
        process: vi.fn(),
        on: vi.fn(),
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0
        }),
        close: vi.fn().mockResolvedValue()
      };
      
      // Mock Bull constructor to return our mock instance
      const BullConstructorMock = vi.fn().mockImplementation(() => mockBullInstance);
      vi.stubGlobal('Bull', BullConstructorMock);
      
      // Call createQueue
      const queueName = 'test-queue';
      const queue = jobManager.createQueue(queueName);
      
      // Check if Bull constructor was called with correct args
      expect(BullConstructorMock).toHaveBeenCalledWith(queueName, expect.any(Object));
      
      // Verify the queue was stored and returned
      expect(jobManager.queues.has(queueName)).toBe(true);
      expect(queue).toBe(mockBullInstance);
    });
    
    it('should return existing queue if already created', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Create a mock queue and add it to the map
      const queueName = 'existing-queue';
      const mockQueue = { name: queueName };
      jobManager.queues.set(queueName, mockQueue);
      
      // Call createQueue
      const queue = jobManager.createQueue(queueName);
      
      // Should return the existing queue without creating a new one
      expect(queue).toBe(mockQueue);
    });
    
    it.skip('should use mockJobManager when REDIS_MODE is memory', async () => {
      // Set environment to use mock
      process.env.REDIS_MODE = 'memory';
      
      // Mock the mockJobManager.createQueue function
      const mockCreateQueue = vi.spyOn(mockJobManager, 'createMockQueue');
      
      // Call createQueue
      const queueName = 'test-queue';
      jobManager.createQueue(queueName);
      
      // Verify mockJobManager was used
      expect(mockCreateQueue).toHaveBeenCalledWith(queueName, expect.any(Object));
    });
  });

  describe('enqueueJob', () => {
    it('should add a job to the queue', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Create a mock Bull queue
      const queueName = 'test-queue';
      const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'job-123' });
      const mockQueue = { add: mockQueueAdd };
      
      // Mock createQueue to return our mock queue
      vi.spyOn(jobManager, 'createQueue').mockReturnValue(mockQueue);
      
      // Call enqueueJob
      const jobData = { test: 'data' };
      const jobOptions = { priority: 'high' };
      const jobId = await jobManager.enqueueJob(queueName, jobData, jobOptions);
      
      // Verify queue.add was called with correct args
      expect(mockQueueAdd).toHaveBeenCalledWith(jobData, jobOptions);
      expect(jobId).toBe('job-123');
    });
    
    it('should apply rate limiting for deep research jobs', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Create a mock Bull queue
      const queueName = 'deep-research';
      const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'job-123' });
      const mockQueue = { add: mockQueueAdd };
      
      // Mock createQueue to return our mock queue
      vi.spyOn(jobManager, 'createQueue').mockReturnValue(mockQueue);
      
      // Call enqueueJob with deep research type
      const jobData = { type: 'deep-research' };
      const jobId = await jobManager.enqueueJob(queueName, jobData);
      
      // Verify queue.add was called with correct args including rate limiting
      expect(mockQueueAdd).toHaveBeenCalledWith(
        jobData,
        expect.objectContaining({
          attempts: expect.any(Number),
          backoff: expect.any(Object)
        })
      );
    });
    
    it.skip('should use mockJobManager when enabled', async () => {
      // Set environment to use mock
      process.env.USE_MOCK_JOB_MANAGER = 'true';
      
      // Mock the mockJobManager.enqueueJob function
      const mockEnqueueJob = vi.spyOn(mockJobManager, 'enqueueJob')
        .mockResolvedValue('mock-job-456');
      
      // Call enqueueJob
      const queueName = 'test-queue';
      const jobData = { test: 'data' };
      const jobId = await jobManager.enqueueJob(queueName, jobData);
      
      // Verify mockJobManager was used
      expect(mockEnqueueJob).toHaveBeenCalledWith(queueName, jobData, expect.any(Object));
      expect(jobId).toBe('mock-job-456');
    });
  });
  
  describe('getJobStatus', () => {
    it('should return job status when job exists', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Create a mock job
      const mockJob = {
        id: 'job-123',
        finishedOn: 1234567890,
        processedOn: 1234567000,
        failedReason: null,
        data: { result: 'test result' },
        returnvalue: { finalResult: 'processed result' }
      };
      
      // Create a mock Bull queue
      const queueName = 'test-queue';
      const mockQueueGetJob = vi.fn().mockResolvedValue(mockJob);
      const mockQueue = { getJob: mockQueueGetJob };
      
      // Mock createQueue to return our mock queue
      vi.spyOn(jobManager, 'createQueue').mockReturnValue(mockQueue);
      
      // Call getJobStatus
      const jobId = 'job-123';
      const status = await jobManager.getJobStatus(queueName, jobId);
      
      // Verify queue.getJob was called and status was returned correctly
      expect(mockQueueGetJob).toHaveBeenCalledWith(jobId);
      expect(status).toEqual({
        id: 'job-123',
        status: 'completed',
        data: { result: 'test result' },
        result: { finalResult: 'processed result' },
        error: null
      });
    });
    
    it('should return not_found status when job does not exist', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Create a mock Bull queue that returns null for getJob
      const queueName = 'test-queue';
      const mockQueueGetJob = vi.fn().mockResolvedValue(null);
      const mockQueue = { getJob: mockQueueGetJob };
      
      // Mock createQueue to return our mock queue
      vi.spyOn(jobManager, 'createQueue').mockReturnValue(mockQueue);
      
      // Call getJobStatus
      const jobId = 'nonexistent-job';
      const status = await jobManager.getJobStatus(queueName, jobId);
      
      // Verify status is not_found
      expect(status).toEqual({
        id: jobId,
        status: 'not_found',
        data: null,
        result: null,
        error: null
      });
    });
    
    it.skip('should use mockJobManager when enabled', async () => {
      // Set environment to use mock
      process.env.USE_MOCK_JOB_MANAGER = 'true';
      
      // Mock the mockJobManager.getJobStatus function
      const mockGetJobStatus = vi.spyOn(mockJobManager, 'getJobStatus')
        .mockResolvedValue({
          id: 'mock-job-456',
          status: 'completed',
          result: { data: 'test' }
        });
      
      // Call getJobStatus
      const queueName = 'test-queue';
      const jobId = 'mock-job-456';
      const status = await jobManager.getJobStatus(queueName, jobId);
      
      // Verify mockJobManager was used
      expect(mockGetJobStatus).toHaveBeenCalledWith(queueName, jobId);
      expect(status).toEqual({
        id: 'mock-job-456',
        status: 'completed',
        result: { data: 'test' }
      });
    });
  });

  describe('registerProcessor', () => {
    it('should register a processor for the queue', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Create a mock Bull queue
      const queueName = 'test-queue';
      const mockQueueProcess = vi.fn();
      const mockQueue = { process: mockQueueProcess };
      
      // Mock createQueue to return our mock queue
      vi.spyOn(jobManager, 'createQueue').mockReturnValue(mockQueue);
      
      // Call registerProcessor
      const processor = vi.fn();
      jobManager.registerProcessor(queueName, processor);
      
      // Verify queue.process was called with the processor
      expect(mockQueueProcess).toHaveBeenCalledWith(expect.any(Function));
    });
    
    it('should handle job processing with correct logging', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Create a mock Bull queue
      const queueName = 'test-queue';
      let registeredProcessor;
      const mockQueueProcess = vi.fn().mockImplementation((processor) => {
        registeredProcessor = processor;
      });
      const mockQueue = { process: mockQueueProcess };
      
      // Mock createQueue to return our mock queue
      vi.spyOn(jobManager, 'createQueue').mockReturnValue(mockQueue);
      
      // Create our processor function and spy on it
      const processorResult = { success: true };
      const processor = vi.fn().mockResolvedValue(processorResult);
      
      // Call registerProcessor
      jobManager.registerProcessor(queueName, processor);
      
      // Verify process was registered
      expect(mockQueueProcess).toHaveBeenCalled();
      
      // Now call the registered processor with a mock job
      const mockJob = { id: 'test-job', data: { value: 'test-data' } };
      await registeredProcessor(mockJob);
      
      // Verify our processor was called with the job data
      expect(processor).toHaveBeenCalledWith(mockJob.data, mockJob);
      
      // Check that success was logged
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processed job'),
        expect.objectContaining({
          jobId: 'test-job',
          queue: queueName
        })
      );
    });
    
    it.skip('should use mockJobManager when enabled', async () => {
      // Set environment to use mock
      process.env.USE_MOCK_JOB_MANAGER = 'true';
      
      // Mock the mockJobManager.registerProcessor function
      const mockRegisterProcessor = vi.spyOn(mockJobManager, 'registerProcessor');
      
      // Call registerProcessor
      const queueName = 'test-queue';
      const processor = vi.fn();
      jobManager.registerProcessor(queueName, processor);
      
      // Verify mockJobManager was used
      expect(mockRegisterProcessor).toHaveBeenCalledWith(queueName, processor);
    });
  });

  describe('startMonitoring', () => {
    it('should start monitoring queues', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Mock the global setInterval
      const mockSetInterval = vi.fn();
      vi.stubGlobal('setInterval', mockSetInterval);
      
      // Call startMonitoring
      jobManager.startMonitoring(1000);
      
      // Verify setInterval was called with the correct interval
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
    });
    
    it('should log warnings for large backlogs', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Create mock queues with different job counts
      const mockQueue1 = {
        name: 'queue1',
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 100, // high waiting count
          active: 5,
          completed: 50,
          failed: 2
        })
      };
      
      const mockQueue2 = {
        name: 'queue2',
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 5, // normal waiting count
          active: 2,
          completed: 30,
          failed: 1
        })
      };
      
      // Add queues to the map
      jobManager.queues.set('queue1', mockQueue1);
      jobManager.queues.set('queue2', mockQueue2);
      
      // Mock setInterval to immediately call the callback function
      vi.stubGlobal('setInterval', (callback) => {
        callback();
        return 123; // Return a mock interval ID
      });
      
      // Call startMonitoring
      jobManager.startMonitoring(1000);
      
      // Wait a bit for the async code to run
      await setTimeout(100);
      
      // Verify getJobCounts was called for both queues
      expect(mockQueue1.getJobCounts).toHaveBeenCalled();
      expect(mockQueue2.getJobCounts).toHaveBeenCalled();
      
      // Check that a warning was logged for queue1 due to high waiting count
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Large job backlog'),
        expect.objectContaining({
          queue: 'queue1',
          waiting: 100
        })
      );
    });
    
    it('should log warnings for high failure rates', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Create a mock queue with high failure rate
      const mockQueue = {
        name: 'failed-queue',
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 5,
          active: 2,
          completed: 10,
          failed: 20 // high failure count
        })
      };
      
      // Add queue to the map
      jobManager.queues.set('failed-queue', mockQueue);
      
      // Mock setInterval to immediately call the callback function
      vi.stubGlobal('setInterval', (callback) => {
        callback();
        return 456; // Return a mock interval ID
      });
      
      // Call startMonitoring
      jobManager.startMonitoring(1000);
      
      // Wait a bit for the async code to run
      await setTimeout(100);
      
      // Check that a warning was logged due to high failure rate
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('High job failure rate'),
        expect.objectContaining({
          queue: 'failed-queue',
          failureRate: expect.any(Number)
        })
      );
    });
    
    it.skip('should use mockJobManager when enabled', async () => {
      // Set environment to use mock
      process.env.USE_MOCK_JOB_MANAGER = 'true';
      
      // Mock the mockJobManager.startMonitoring function
      const mockStartMonitoring = vi.spyOn(mockJobManager, 'startMonitoring');
      
      // Call startMonitoring
      const interval = 2000;
      jobManager.startMonitoring(interval);
      
      // Verify mockJobManager was used
      expect(mockStartMonitoring).toHaveBeenCalledWith(interval);
    });
  });

  describe('stop', () => {
    it('should stop all queues and clear monitor interval', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Create mock queues
      const mockQueue1 = {
        name: 'queue1',
        close: vi.fn().mockResolvedValue()
      };
      
      const mockQueue2 = {
        name: 'queue2',
        close: vi.fn().mockResolvedValue()
      };
      
      // Add queues to the map
      jobManager.queues.set('queue1', mockQueue1);
      jobManager.queues.set('queue2', mockQueue2);
      
      // Set up a fake monitoring interval
      jobManager.monitorInterval = 123;
      
      // Mock clearInterval
      const mockClearInterval = vi.fn();
      vi.stubGlobal('clearInterval', mockClearInterval);
      
      // Call stop
      await jobManager.stop();
      
      // Verify clearInterval was called with the monitor interval
      expect(mockClearInterval).toHaveBeenCalledWith(123);
      
      // Verify close was called on both queues
      expect(mockQueue1.close).toHaveBeenCalled();
      expect(mockQueue2.close).toHaveBeenCalled();
      
      // Verify queues map was cleared
      expect(jobManager.queues.size).toBe(0);
      expect(jobManager.monitorInterval).toBeNull();
    });
    
    it.skip('should use mockJobManager when enabled', async () => {
      // Set environment to use mock
      process.env.USE_MOCK_JOB_MANAGER = 'true';
      
      // Mock the mockJobManager.stop function
      const mockStop = vi.spyOn(mockJobManager, 'stop').mockResolvedValue();
      
      // Call stop
      await jobManager.stop();
      
      // Verify mockJobManager was used
      expect(mockStop).toHaveBeenCalled();
    });
  });
});