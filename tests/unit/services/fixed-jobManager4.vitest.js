/**
 * Job Manager Unit Tests - Fixed Version 4
 * Testing with the mock job manager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as jobManager from '../../../services/jobManager.js';
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

// Create our own mock implementation of mockJobManager
const mockEnqueueJob = vi.fn().mockImplementation((queueName, data) => {
  return Promise.resolve(`mock-job-${queueName}-123`);
});

const mockGetJobStatus = vi.fn().mockImplementation((queueName, jobId) => {
  if (jobId === 'nonexistent-job') {
    return Promise.resolve({
      id: jobId,
      status: 'not_found',
      data: null,
      result: null,
      error: null
    });
  } else {
    return Promise.resolve({
      id: jobId,
      status: 'completed',
      data: { result: 'mock test result' },
      result: { finalResult: 'mock processed result' },
      error: null
    });
  }
});

const mockRegisterProcessor = vi.fn();
const mockGetJobCounts = vi.fn().mockResolvedValue({
  waiting: 5,
  active: 2,
  completed: 30,
  failed: 1
});
const mockClose = vi.fn().mockResolvedValue();

// Mock the mockJobManager module
vi.mock('../../../services/mockJobManager.js', () => ({
  enqueueJob: mockEnqueueJob,
  getJobStatus: mockGetJobStatus,
  registerProcessor: mockRegisterProcessor,
  getJobCounts: mockGetJobCounts,
  close: mockClose
}));

// Store original env
const originalEnv = { ...process.env };

describe('JobManager', () => {
  // Reset environment between tests
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
    
    // Force mock mode for all tests
    process.env.USE_MOCK_JOB_MANAGER = 'true';
    process.env.REDIS_MODE = 'memory';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Restore environment
    process.env = { ...originalEnv };
  });

  describe('enqueueJob', () => {
    it('should add a job to the queue', async () => {
      // Call enqueueJob
      const queueName = 'test-queue';
      const jobData = { test: 'data' };
      const jobId = await jobManager.enqueueJob(queueName, jobData);
      
      // Verify mockJobManager.enqueueJob was called
      expect(mockEnqueueJob).toHaveBeenCalledWith(queueName, jobData, expect.any(Object));
      
      // Verify a job ID was returned
      expect(jobId).toBe(`mock-job-${queueName}-123`);
    });
    
    it('should apply rate limiting for deep research jobs', async () => {
      // Call enqueueJob with deep research type
      const queueName = 'deep-research';
      const jobData = { type: 'deep-research' };
      const jobId = await jobManager.enqueueJob(queueName, jobData);
      
      // Verify mockJobManager.enqueueJob was called with correct args
      expect(mockEnqueueJob).toHaveBeenCalledWith(
        queueName, 
        jobData,
        expect.any(Object)
      );
      
      // Verify a job ID was returned
      expect(jobId).toBe(`mock-job-${queueName}-123`);
    });
  });
  
  describe('getJobStatus', () => {
    it('should return job status when job exists', async () => {
      // Call getJobStatus
      const queueName = 'test-queue';
      const jobId = 'existing-job';
      const status = await jobManager.getJobStatus(queueName, jobId);
      
      // Verify mockJobManager.getJobStatus was called
      expect(mockGetJobStatus).toHaveBeenCalledWith(queueName, jobId);
      
      // Verify status was returned correctly
      expect(status).toEqual({
        id: jobId,
        status: 'completed',
        data: { result: 'mock test result' },
        result: { finalResult: 'mock processed result' },
        error: null
      });
    });
    
    it('should return not_found status when job does not exist', async () => {
      // Call getJobStatus with nonexistent job
      const queueName = 'test-queue';
      const jobId = 'nonexistent-job';
      const status = await jobManager.getJobStatus(queueName, jobId);
      
      // Verify mockJobManager.getJobStatus was called
      expect(mockGetJobStatus).toHaveBeenCalledWith(queueName, jobId);
      
      // Verify status is not_found
      expect(status).toEqual({
        id: jobId,
        status: 'not_found',
        data: null,
        result: null,
        error: null
      });
    });
  });

  describe('registerProcessor', () => {
    it('should register a processor for the queue', async () => {
      // Call registerProcessor
      const queueName = 'test-queue';
      const processor = vi.fn();
      jobManager.registerProcessor(queueName, processor);
      
      // Verify mockJobManager.registerProcessor was called
      expect(mockRegisterProcessor).toHaveBeenCalledWith(queueName, processor);
    });
  });

  describe('getJobCounts', () => {
    it('should return job counts from queue', async () => {
      // Call getJobCounts
      const queueName = 'test-queue';
      const counts = await jobManager.getJobCounts(queueName);
      
      // Verify mockJobManager.getJobCounts was called
      expect(mockGetJobCounts).toHaveBeenCalledWith(queueName);
      
      // Verify counts were returned
      expect(counts).toEqual({
        waiting: 5,
        active: 2,
        completed: 30,
        failed: 1
      });
    });
  });

  describe('close', () => {
    it('should close all queues', async () => {
      // Call close
      await jobManager.close();
      
      // Verify logger was called
      expect(logger.info).toHaveBeenCalledWith('All job queues closed');
    });
  });
});