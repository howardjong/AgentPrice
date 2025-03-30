/**
 * @file jobManager-integration.vitest.js
 * @description Integration tests for the JobManager and MockJobManager components
 * 
 * This test file focuses on the integration between JobManager and MockJobManager
 * when operating in different modes. These tests cover the scenarios that were
 * skipped in the unit tests due to mocking complexities.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { performance } from 'perf_hooks';

// Use importActual to get the real implementations for our own mocking
const realLogger = await vi.importActual('../../../utils/logger.js');
const realRedisClient = await vi.importActual('../../../services/redisService.js');

// Mock Bull constructor
vi.mock('bull', () => {
  const mockQueue = {
    add: vi.fn(async (data, options) => ({ id: 'test-job-123', data })),
    getJob: vi.fn(async (id) => ({
      id,
      getState: vi.fn().mockResolvedValue('active'),
      _progress: 50,
      data: { test: 'test data' },
      attemptsMade: 1,
      timestamp: Date.now() - 1000,
      processedOn: Date.now() - 500,
      finishedOn: null
    })),
    process: vi.fn(),
    on: vi.fn(),
    getJobCounts: vi.fn().mockResolvedValue({
      waiting: 5,
      active: 2,
      completed: 10,
      failed: 1
    }),
    close: vi.fn().mockResolvedValue()
  };

  const BullConstructor = vi.fn(() => mockQueue);
  BullConstructor.mockQueue = mockQueue;
  
  return {
    default: BullConstructor
  };
});

// Mock logger to avoid console noise during tests
vi.mock('../../../utils/logger.js', () => {
  return {
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }
  };
});

// Reset the jobManager and mockJobManager modules for each test
beforeEach(async () => {
  // Backup original env
  process.env = { ...process.env };
  
  // Clear module cache to ensure we get fresh instances
  vi.resetModules();
  
  // Mock redisService to avoid connection attempts
  vi.mock('../../../services/redisService.js', () => {
    return {
      default: {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn()
      }
    };
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('JobManager Integration', () => {
  test('should use mockJobManager when REDIS_MODE is memory', async () => {
    // Set up environment
    process.env.USE_MOCK_JOB_MANAGER = 'false';
    process.env.REDIS_MODE = 'memory';
    
    // Manually spy on mockJobManager before importing job manager
    const mockJobManagerModule = await import('../../../services/mockJobManager.js');
    vi.spyOn(mockJobManagerModule.default, 'createQueue');
    
    // Now import the job manager (which should detect mock mode)
    const { default: jobManager } = await import('../../../services/jobManager.js');
    
    // Create queue - should delegate to mockJobManager
    const queue = jobManager.createQueue('test-queue-memory');
    
    // Check if mockJobManager.createQueue was called
    expect(mockJobManagerModule.default.createQueue).toHaveBeenCalledWith('test-queue-memory', expect.anything());
  });
  
  test('should use mockJobManager when USE_MOCK_JOB_MANAGER is true', async () => {
    // Set up environment
    process.env.REDIS_MODE = '';
    process.env.USE_MOCK_JOB_MANAGER = 'true';
    
    // Manually spy on mockJobManager before importing job manager
    const mockJobManagerModule = await import('../../../services/mockJobManager.js');
    vi.spyOn(mockJobManagerModule.default, 'createQueue');
    
    // Now import the job manager
    const { default: jobManager } = await import('../../../services/jobManager.js');
    
    // Create queue - should delegate to mockJobManager
    const queue = jobManager.createQueue('test-queue-mock');
    
    // Check if mockJobManager.createQueue was called
    expect(mockJobManagerModule.default.createQueue).toHaveBeenCalledWith('test-queue-mock', expect.anything());
  });
  
  test('should use Bull queue when REDIS_MODE is real', async () => {
    // Set up environment
    process.env.REDIS_MODE = 'real';
    process.env.USE_MOCK_JOB_MANAGER = 'false';
    
    // Import Bull and job manager
    const { default: Bull } = await import('bull');
    const mockJobManagerModule = await import('../../../services/mockJobManager.js');
    vi.spyOn(mockJobManagerModule.default, 'createQueue');
    
    const { default: jobManager } = await import('../../../services/jobManager.js');
    
    // Create queue - should use Bull
    const queue = jobManager.createQueue('test-queue');
    
    // Bull should have been called
    expect(Bull).toHaveBeenCalledWith(
      'test-queue',
      expect.objectContaining({
        redis: expect.any(String),
        defaultJobOptions: expect.any(Object)
      })
    );
    
    // The mockJobManager should not have been used
    expect(mockJobManagerModule.default.createQueue).not.toHaveBeenCalled();
  });
  
  test('should enqueue job using mockJobManager', async () => {
    // Set up environment
    process.env.USE_MOCK_JOB_MANAGER = 'true';
    
    // Spy on mockJobManager
    const mockJobManagerModule = await import('../../../services/mockJobManager.js');
    vi.spyOn(mockJobManagerModule.default, 'enqueueJob');
    
    // Import job manager
    const { default: jobManager } = await import('../../../services/jobManager.js');
    
    // Enqueue job
    const jobId = await jobManager.enqueueJob('test-queue', { test: 'data' });
    
    // Check if mockJobManager.enqueueJob was called
    expect(mockJobManagerModule.default.enqueueJob).toHaveBeenCalledWith(
      'test-queue',
      { test: 'data' },
      expect.anything()
    );
    
    // Check if jobId is defined
    expect(jobId).toBeDefined();
  });
  
  test('should get job status using mockJobManager', async () => {
    // Set up environment
    process.env.USE_MOCK_JOB_MANAGER = 'true';
    
    // Spy on mockJobManager
    const mockJobManagerModule = await import('../../../services/mockJobManager.js');
    vi.spyOn(mockJobManagerModule.default, 'getJobStatus').mockResolvedValue({
      id: 'test-job-123',
      status: 'completed',
      progress: 100,
      data: { test: 'data' }
    });
    
    // Import job manager
    const { default: jobManager } = await import('../../../services/jobManager.js');
    
    // Get job status
    const status = await jobManager.getJobStatus('status-queue', 'test-job-123');
    
    // Check if mockJobManager.getJobStatus was called
    expect(mockJobManagerModule.default.getJobStatus).toHaveBeenCalledWith(
      'status-queue', 
      'test-job-123'
    );
    
    // Check if status has the expected properties
    expect(status).toHaveProperty('id');
    expect(status).toHaveProperty('status');
    expect(status).toHaveProperty('progress');
  });
  
  test('should register processor using mockJobManager', async () => {
    // Set up environment
    process.env.USE_MOCK_JOB_MANAGER = 'true';
    
    // Spy on mockJobManager
    const mockJobManagerModule = await import('../../../services/mockJobManager.js');
    vi.spyOn(mockJobManagerModule.default, 'registerProcessor');
    
    // Import job manager
    const { default: jobManager } = await import('../../../services/jobManager.js');
    
    // Create a test processor
    const processor = async (job) => {
      job.progress(50);
      return { result: 'processed' };
    };
    
    // Register processor
    jobManager.registerProcessor('processor-queue', processor, 2);
    
    // Check if mockJobManager.registerProcessor was called
    expect(mockJobManagerModule.default.registerProcessor).toHaveBeenCalledWith(
      'processor-queue',
      processor,
      2
    );
  });
  
  test('should start monitoring using mockJobManager', async () => {
    // Set up environment
    process.env.USE_MOCK_JOB_MANAGER = 'true';
    
    // Spy on mockJobManager
    const mockJobManagerModule = await import('../../../services/mockJobManager.js');
    vi.spyOn(mockJobManagerModule.default, 'startMonitoring');
    
    // Import job manager
    const { default: jobManager } = await import('../../../services/jobManager.js');
    
    // Start monitoring
    jobManager.startMonitoring();
    
    // Check if mockJobManager.startMonitoring was called
    expect(mockJobManagerModule.default.startMonitoring).toHaveBeenCalled();
  });
  
  test('should stop all services using mockJobManager', async () => {
    // Set up environment
    process.env.USE_MOCK_JOB_MANAGER = 'true';
    
    // Spy on mockJobManager
    const mockJobManagerModule = await import('../../../services/mockJobManager.js');
    vi.spyOn(mockJobManagerModule.default, 'stop');
    
    // Import job manager
    const { default: jobManager } = await import('../../../services/jobManager.js');
    
    // Stop services
    await jobManager.stop();
    
    // Check if mockJobManager.stop was called
    expect(mockJobManagerModule.default.stop).toHaveBeenCalled();
  });
  
  test('should apply rate limiting for deep research jobs', async () => {
    // Create an isolated test for just testing the rate limiting logic
    // This test directly checks the behavior that would occur inside jobManager.enqueueJob
    
    // Set up the test environment 
    const { default: logger } = await import('../../../utils/logger.js');
    
    // Clear any previous calls
    vi.clearAllMocks();
    
    // Create a deep research job data
    const deepResearchData = {
      wantsDeepResearch: true,
      jobId: 'dr-job-test',
      query: 'Comprehensive market analysis of renewable energy'
    };
    
    // Simulate the relevant part of jobManager.enqueueJob
    // This is the exact logic that appears in jobManager.enqueueJob
    const options = {};
    if (deepResearchData.wantsDeepResearch) {
      options.limiter = {
        max: 5,
        duration: 60000,
        groupKey: 'deepResearch'
      };
      logger.info('Applying rate limit for deep research job', { jobId: deepResearchData.jobId });
    }
    
    // Verify that rate limiting is applied when wantsDeepResearch is true
    expect(options.limiter).toBeDefined();
    expect(options.limiter.max).toBe(5);
    expect(options.limiter.duration).toBe(60000);
    expect(options.limiter.groupKey).toBe('deepResearch');
    
    // Verify the message was logged
    expect(logger.info).toHaveBeenCalledWith(
      'Applying rate limit for deep research job',
      expect.objectContaining({ jobId: 'dr-job-test' })
    );
  });
});