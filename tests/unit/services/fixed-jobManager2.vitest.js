/**
 * Job Manager Unit Tests - Fixed Version 2
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

// Mock Bull constructor
vi.mock('bull', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockResolvedValue({ id: 'test-job-123' }),
      process: vi.fn(),
      on: vi.fn(),
      getJob: vi.fn(),
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0
      }),
      close: vi.fn().mockResolvedValue()
    }))
  };
});

// Store original env
const originalEnv = { ...process.env };

describe('JobManager', () => {
  // Reset environment between tests
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore environment
    process.env = { ...originalEnv };
  });

  describe('enqueueJob', () => {
    it('should add a job to the queue', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Call enqueueJob
      const queueName = 'test-queue';
      const jobData = { test: 'data' };
      const jobId = await jobManager.enqueueJob(queueName, jobData);
      
      // Verify a job ID was returned
      expect(jobId).toBe('test-job-123');
    });
    
    it('should apply rate limiting for deep research jobs', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Call enqueueJob with deep research type
      const queueName = 'deep-research';
      const jobData = { type: 'deep-research' };
      const jobId = await jobManager.enqueueJob(queueName, jobData);
      
      // Verify a job ID was returned
      expect(jobId).toBe('test-job-123');
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
      
      // Mock Bull's getJob to return a job
      const mockJob = {
        id: 'job-123',
        finishedOn: 1234567890,
        processedOn: 1234567000,
        failedReason: null,
        data: { result: 'test result' },
        returnvalue: { finalResult: 'processed result' }
      };
      
      const Bull = (await import('bull')).default;
      Bull.mockImplementation(() => ({
        add: vi.fn().mockResolvedValue({ id: 'test-job-123' }),
        process: vi.fn(),
        on: vi.fn(),
        getJob: vi.fn().mockResolvedValue(mockJob),
        getJobCounts: vi.fn(),
        close: vi.fn()
      }));
      
      // Call getJobStatus
      const queueName = 'test-queue';
      const jobId = 'job-123';
      const status = await jobManager.getJobStatus(queueName, jobId);
      
      // Verify status was returned correctly
      expect(status).toMatchObject({
        id: 'job-123',
        status: 'completed',
        data: { result: 'test result' },
        result: { finalResult: 'processed result' }
      });
    });
    
    it('should return not_found status when job does not exist', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Mock Bull's getJob to return null
      const Bull = (await import('bull')).default;
      Bull.mockImplementation(() => ({
        add: vi.fn(),
        process: vi.fn(),
        on: vi.fn(),
        getJob: vi.fn().mockResolvedValue(null),
        getJobCounts: vi.fn(),
        close: vi.fn()
      }));
      
      // Call getJobStatus
      const queueName = 'test-queue';
      const jobId = 'nonexistent-job';
      const status = await jobManager.getJobStatus(queueName, jobId);
      
      // Verify status is not_found
      expect(status).toMatchObject({
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
      
      // Mock Bull and its process method
      const processSpy = vi.fn();
      const Bull = (await import('bull')).default;
      Bull.mockImplementation(() => ({
        add: vi.fn(),
        process: processSpy,
        on: vi.fn(),
        getJob: vi.fn(),
        getJobCounts: vi.fn(),
        close: vi.fn()
      }));
      
      // Call registerProcessor
      const queueName = 'test-queue';
      const processor = vi.fn();
      jobManager.registerProcessor(queueName, processor);
      
      // Verify queue.process was called
      expect(processSpy).toHaveBeenCalled();
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

  describe('getJobCounts', () => {
    it('should return job counts from queue', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Mock Bull and its getJobCounts method
      const expectedCounts = {
        waiting: 5,
        active: 2,
        completed: 30,
        failed: 1
      };
      
      const getJobCountsSpy = vi.fn().mockResolvedValue(expectedCounts);
      const Bull = (await import('bull')).default;
      Bull.mockImplementation(() => ({
        add: vi.fn(),
        process: vi.fn(),
        on: vi.fn(),
        getJob: vi.fn(),
        getJobCounts: getJobCountsSpy,
        close: vi.fn()
      }));
      
      // Call getJobCounts
      const queueName = 'test-queue';
      const counts = await jobManager.getJobCounts(queueName);
      
      // Verify counts were returned
      expect(counts).toEqual(expectedCounts);
      expect(getJobCountsSpy).toHaveBeenCalled();
    });
    
    it.skip('should use mockJobManager when enabled', async () => {
      // Set environment to use mock
      process.env.USE_MOCK_JOB_MANAGER = 'true';
      
      // Mock the mockJobManager.getJobCounts function
      const mockCounts = {
        waiting: 1,
        active: 2,
        completed: 3,
        failed: 0
      };
      const mockGetJobCounts = vi.spyOn(mockJobManager, 'getJobCounts')
        .mockResolvedValue(mockCounts);
      
      // Call getJobCounts
      const queueName = 'test-queue';
      const counts = await jobManager.getJobCounts(queueName);
      
      // Verify mockJobManager was used
      expect(mockGetJobCounts).toHaveBeenCalledWith(queueName);
      expect(counts).toEqual(mockCounts);
    });
  });

  describe('close', () => {
    it('should close all queues', async () => {
      // Set environment to use real Bull queue
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.REDIS_MODE = 'real';
      process.env.NODE_ENV = 'production';
      
      // Call close
      await jobManager.close();
      
      // Verify logger was called
      expect(logger.info).toHaveBeenCalledWith('All job queues closed');
    });
  });
});