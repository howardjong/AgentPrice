/**
 * @file jobManager-integration.vitest.js
 * @description Integration tests for the JobManager and MockJobManager components
 * 
 * This test file focuses on the integration between JobManager and MockJobManager
 * when operating in different modes. These tests cover the scenarios that were
 * skipped in the unit tests due to mocking complexities.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger to avoid console noise during tests
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Isolated path mocks for ES module compatibility
vi.mock('bull', async () => {
  // Create a mock for Bull that behaves like the original but is controllable
  const mockQueue = {
    add: vi.fn().mockImplementation((data, options) => Promise.resolve({ id: 'test-job-123', data })),
    getJob: vi.fn().mockImplementation((id) => {
      return Promise.resolve(id === 'not-found' ? null : {
        id,
        data: { test: 'data' },
        getState: vi.fn().mockResolvedValue('active'),
        updateProgress: vi.fn(),
        _progress: 50,
        attemptsMade: 1,
        timestamp: Date.now() - 1000,
        processedOn: Date.now() - 500,
        finishedOn: null
      });
    }),
    process: vi.fn((concurrency, fn) => {
      mockQueue.processorFn = fn;
      return mockQueue;
    }),
    on: vi.fn(),
    getJobCounts: vi.fn().mockResolvedValue({
      waiting: 5,
      active: 2,
      completed: 10,
      failed: 1
    }),
    close: vi.fn().mockResolvedValue()
  };

  // The factory function that will be called when 'new Bull()' is executed
  const BullConstructor = vi.fn().mockImplementation(() => mockQueue);
  
  // Make the constructor and mock queue available to tests
  BullConstructor.mockQueue = mockQueue;
  
  // Mock the default export
  return {
    default: BullConstructor
  };
});

// Mock Redis client - important to do this correctly since it's used by Bull
vi.mock('../../../services/redisService.js', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn()
  }
}));

// After mocking the dependencies, import the actual services
import logger from '../../../utils/logger.js';
import jobManager from '../../../services/jobManager.js';
import mockJobManager from '../../../services/mockJobManager.js';

describe('JobManager Integration', () => {
  // Save original env vars
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Reset job manager's state
    jobManager.queues = {};
    if (jobManager.monitorInterval) {
      clearInterval(jobManager.monitorInterval);
      jobManager.monitorInterval = null;
    }
    
    // Reset mockJobManager state
    Object.keys(mockJobManager.queues).forEach(key => {
      delete mockJobManager.queues[key];
    });
    if (mockJobManager.monitorInterval) {
      clearInterval(mockJobManager.monitorInterval);
      mockJobManager.monitorInterval = null;
    }
  });
  
  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
    
    // Clean up
    if (jobManager.monitorInterval) {
      clearInterval(jobManager.monitorInterval);
      jobManager.monitorInterval = null;
    }
    
    if (mockJobManager.monitorInterval) {
      clearInterval(mockJobManager.monitorInterval);
      mockJobManager.monitorInterval = null;
    }
  });

  describe('Mode Switching Tests', () => {
    test('should use mockJobManager when REDIS_MODE is memory', async () => {
      // Set environment to use memory mode
      process.env.REDIS_MODE = 'memory';
      
      // Access jobManager to ensure it's initialized correctly
      const queue = jobManager.createQueue('test-queue');
      
      // Verify the correct instance was used
      expect(mockJobManager.queues['test-queue']).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/Using mock job manager/),
        expect.anything()
      );
    });
    
    test('should use mockJobManager when USE_MOCK_JOB_MANAGER is true', async () => {
      // Set environment to use mock job manager
      process.env.USE_MOCK_JOB_MANAGER = 'true';
      
      // Access jobManager to ensure it's initialized correctly
      const queue = jobManager.createQueue('test-queue');
      
      // Verify the correct instance was used
      expect(mockJobManager.queues['test-queue']).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/Using mock job manager/),
        expect.anything()
      );
    });
    
    test('should use Bull queue when REDIS_MODE is real', async () => {
      // Set environment to use real Redis
      process.env.REDIS_MODE = 'real';
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      
      // Access jobManager to ensure it's initialized correctly
      const queue = jobManager.createQueue('test-queue');
      
      // Verify the Bull constructor was called with the correct parameters
      const Bull = (await import('bull')).default;
      expect(Bull).toHaveBeenCalledWith(
        'test-queue',
        expect.objectContaining({
          redis: expect.any(String),
          defaultJobOptions: expect.any(Object)
        })
      );
      
      // The mockJobManager should not have this queue
      expect(mockJobManager.queues['test-queue']).toBeUndefined();
    });
  });

  describe('Operations with MockJobManager', () => {
    beforeEach(() => {
      // Configure to use mock job manager
      process.env.USE_MOCK_JOB_MANAGER = 'true';
    });
    
    test('should enqueue job using mockJobManager', async () => {
      // Spy on the mockJobManager's enqueueJob method
      const enqueueSpy = vi.spyOn(mockJobManager, 'enqueueJob');
      
      // Enqueue a job through the jobManager facade
      const jobId = await jobManager.enqueueJob('test-queue', { test: 'data' });
      
      // Verify the operation was delegated to mockJobManager
      expect(enqueueSpy).toHaveBeenCalledWith(
        'test-queue',
        { test: 'data' },
        expect.any(Object)
      );
      
      // Verify a job ID was returned (format depends on mockJobManager implementation)
      expect(jobId).toBeDefined();
    });
    
    test('should get job status using mockJobManager', async () => {
      // Setup - first create a queue and add a job
      const queue = jobManager.createQueue('status-queue');
      const jobId = await jobManager.enqueueJob('status-queue', { test: 'status-data' });
      
      // Spy on the mockJobManager's getJobStatus method
      const getStatusSpy = vi.spyOn(mockJobManager, 'getJobStatus');
      
      // Get the job status
      const status = await jobManager.getJobStatus('status-queue', jobId);
      
      // Verify the operation was delegated to mockJobManager
      expect(getStatusSpy).toHaveBeenCalledWith('status-queue', jobId);
      
      // Verify a status object was returned (with expected fields)
      expect(status).toHaveProperty('id');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('progress');
    });
    
    test('should register processor using mockJobManager', async () => {
      // Spy on the mockJobManager's registerProcessor method
      const registerSpy = vi.spyOn(mockJobManager, 'registerProcessor');
      
      // Create a test processor function
      const processor = async (job) => {
        job.progress(50);
        return { result: 'processed' };
      };
      
      // Register the processor through jobManager
      const queue = jobManager.registerProcessor('processor-queue', processor, 2);
      
      // Verify the operation was delegated to mockJobManager
      expect(registerSpy).toHaveBeenCalledWith(
        'processor-queue',
        processor,
        2
      );
      
      // Since the mock queue should now exist in mockJobManager
      expect(mockJobManager.queues['processor-queue']).toBeDefined();
    });
    
    test('should process jobs through mockJobManager', async () => {
      vi.useFakeTimers();
      
      // Create a test processor that updates progress
      const processor = vi.fn().mockImplementation(async (job) => {
        job.progress(25);
        job.progress(50);
        job.progress(75);
        job.progress(100);
        return { processed: true };
      });
      
      // Register the processor
      jobManager.registerProcessor('process-queue', processor);
      
      // Enqueue a job
      const jobId = await jobManager.enqueueJob('process-queue', { data: 'test-process' });
      
      // Advance timers to allow processing
      await vi.advanceTimersByTimeAsync(500);
      
      // Verify processor was called
      expect(processor).toHaveBeenCalled();
      
      // Get the job status to verify processing occurred
      const jobStatus = await jobManager.getJobStatus('process-queue', jobId);
      
      // Expect the job to be completed with correct progress
      expect(jobStatus.progress).toBe(100);
      
      vi.useRealTimers();
    });
    
    test('should start monitoring using mockJobManager', async () => {
      vi.useFakeTimers();
      
      // Spy on the mockJobManager's startMonitoring method
      const monitorSpy = vi.spyOn(mockJobManager, 'startMonitoring');
      
      // Start monitoring through jobManager
      jobManager.startMonitoring();
      
      // Verify the operation was delegated to mockJobManager
      expect(monitorSpy).toHaveBeenCalled();
      
      // Advance time to trigger monitoring interval
      await vi.advanceTimersByTimeAsync(60000);
      
      // Logger should have been called for monitoring
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Queue .* status/),
        expect.anything()
      );
      
      vi.useRealTimers();
    });
    
    test('should stop all services using mockJobManager', async () => {
      // Spy on the mockJobManager's stop method
      const stopSpy = vi.spyOn(mockJobManager, 'stop');
      
      // Create some queues
      jobManager.createQueue('stop-queue-1');
      jobManager.createQueue('stop-queue-2');
      
      // Start monitoring
      jobManager.startMonitoring();
      
      // Stop all services
      await jobManager.stop();
      
      // Verify the operation was delegated to mockJobManager
      expect(stopSpy).toHaveBeenCalled();
      
      // Verify monitoring was stopped
      expect(jobManager.monitorInterval).toBeNull();
    });
  });

  describe('Job Processing Flow', () => {
    beforeEach(() => {
      // Configure to use mock job manager
      process.env.USE_MOCK_JOB_MANAGER = 'true';
      
      // Use fake timers for controlled job processing
      vi.useFakeTimers();
    });
    
    afterEach(() => {
      vi.useRealTimers();
    });
    
    test('should complete the full job lifecycle', async () => {
      // Create a processor that updates progress incrementally
      const processor = async (job) => {
        // Update progress in stages
        job.progress(20);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        job.progress(40);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        job.progress(60);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        job.progress(80);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        job.progress(100);
        
        return { result: 'success', processed: true };
      };
      
      // Register processor
      jobManager.registerProcessor('lifecycle-queue', processor);
      
      // Enqueue job
      const jobId = await jobManager.enqueueJob('lifecycle-queue', { 
        test: 'lifecycle-data',
        importantValue: 42
      });
      
      // Verify initial job status
      const initialStatus = await jobManager.getJobStatus('lifecycle-queue', jobId);
      expect(initialStatus.status).toMatch(/waiting|pending/i);
      expect(initialStatus.progress).toBeLessThanOrEqual(10); // Initial progress near 0
      
      // Advance time for first progress update
      await vi.advanceTimersByTimeAsync(60);
      
      // Check progress after first update
      const midStatus1 = await jobManager.getJobStatus('lifecycle-queue', jobId);
      expect(midStatus1.progress).toBeGreaterThanOrEqual(20);
      
      // Advance time for more progress updates
      await vi.advanceTimersByTimeAsync(200);
      
      // Check final status
      const finalStatus = await jobManager.getJobStatus('lifecycle-queue', jobId);
      expect(finalStatus.status).toMatch(/completed/i);
      expect(finalStatus.progress).toBe(100);
      
      // Verify the job data was preserved
      expect(finalStatus.data).toEqual(expect.objectContaining({
        test: 'lifecycle-data',
        importantValue: 42
      }));
    });
    
    test('should handle job failures and retries', async () => {
      // Failure counter to make the job succeed on the second attempt
      let attempts = 0;
      
      // Create a processor that fails on first attempt
      const processor = async (job) => {
        attempts++;
        
        if (attempts === 1) {
          throw new Error('Simulated failure for testing');
        }
        
        // Succeed on second attempt
        job.progress(100);
        return { result: 'success after retry' };
      };
      
      // Register processor
      jobManager.registerProcessor('retry-queue', processor);
      
      // Enqueue job
      const jobId = await jobManager.enqueueJob('retry-queue', { test: 'retry-data' });
      
      // Advance time for first attempt (which will fail)
      await vi.advanceTimersByTimeAsync(100);
      
      // Check status after failure
      const failedStatus = await jobManager.getJobStatus('retry-queue', jobId);
      
      // The job might be in failed state or already queued for retry
      const isFailedOrWaiting = ['failed', 'waiting', 'pending'].includes(failedStatus.status.toLowerCase());
      expect(isFailedOrWaiting).toBe(true);
      
      // Advance time for retry and completion
      await vi.advanceTimersByTimeAsync(1200); // Add extra time for retry delay
      
      // Check final status after retry
      const retryStatus = await jobManager.getJobStatus('retry-queue', jobId);
      expect(retryStatus.status).toMatch(/completed/i);
      expect(retryStatus.progress).toBe(100);
      
      // Verify error was logged for the first attempt
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/Error processing job/),
        expect.objectContaining({
          error: 'Simulated failure for testing'
        })
      );
    });
  });

  describe('Deep Research Job Handling', () => {
    beforeEach(() => {
      // Configure to use mock job manager
      process.env.USE_MOCK_JOB_MANAGER = 'true';
    });
    
    test('should apply rate limiting for deep research jobs', async () => {
      // Create queue and register a simple processor
      jobManager.registerProcessor('research-queue', async (job) => {
        job.progress(100);
        return { result: 'research complete' };
      });
      
      // Enqueue a deep research job
      const jobId = await jobManager.enqueueJob('research-queue', {
        wantsDeepResearch: true,
        jobId: 'dr-job-test',
        query: 'Comprehensive market analysis of renewable energy'
      });
      
      // Verify rate limiting was applied via logging
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/Applying rate limit for deep research job/),
        expect.objectContaining({ jobId: 'dr-job-test' })
      );
      
      // Verify job was created
      const jobStatus = await jobManager.getJobStatus('research-queue', jobId);
      expect(jobStatus).toHaveProperty('id');
      expect(jobStatus.data).toEqual(expect.objectContaining({
        wantsDeepResearch: true
      }));
    });
  });
});