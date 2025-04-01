/**
 * Job Manager Implementation Tests
 * 
 * This test suite directly tests the implementation of the JobManager module
 * with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../../../services/mockJobManager.js', () => {
  const mockEnqueueJob = vi.fn().mockImplementation((queueName, data, options = {}) => 
    Promise.resolve(`mock-job-${queueName}-123456`)
  );

  const mockGetJobStatus = vi.fn().mockImplementation((jobId) => {
    if (jobId === 'not-found-job') {
      throw new Error('Job not-found-job not found');
    }
    return Promise.resolve({
      id: jobId,
      status: 'completed',
      data: { test: 'data' },
      result: { value: 'mock result' },
      error: null,
      progress: 100,
      queueName: 'test-queue',
      timestamp: Date.now(),
      processedOn: Date.now(),
      finishedOn: Date.now(),
      attempts: 1
    });
  });

  const mockRegisterProcessor = vi.fn();

  const mockGetJobCounts = vi.fn().mockResolvedValue({
    waiting: 5,
    active: 2,
    completed: 10,
    failed: 1,
    delayed: 0
  });
  
  return {
    enqueueJob: mockEnqueueJob,
    getJobStatus: mockGetJobStatus,
    registerProcessor: mockRegisterProcessor,
    getJobCounts: mockGetJobCounts
  };
});

// Mock Bull
vi.mock('bull', () => {
  return {
    default: vi.fn().mockImplementation((name, options) => {
      return {
        name,
        options,
        on: vi.fn(),
        add: vi.fn().mockResolvedValue({ id: `real-job-${Date.now()}` }),
        getJob: vi.fn().mockResolvedValue({
          id: 'real-job-123',
          getState: vi.fn().mockResolvedValue('completed'),
          finished: vi.fn().mockResolvedValue({ value: 'real job result' }),
          _progress: 100,
          timestamp: Date.now(),
          processedOn: Date.now(),
          finishedOn: Date.now(),
          attemptsMade: 1
        }),
        process: vi.fn(),
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 1,
          active: 1,
          completed: 5,
          failed: 0,
          delayed: 0
        }),
        close: vi.fn().mockResolvedValue()
      };
    })
  };
});

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Import the module under test
import * as jobManager from '../../../services/jobManager.js';

// Store original environment variables
const originalEnv = { ...process.env };

describe('JobManager Service', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset environment
    process.env = { ...originalEnv };
    
    // Force mock mode
    process.env.USE_MOCK_JOB_MANAGER = 'true';
    process.env.NODE_ENV = 'test';
  });
  
  afterEach(() => {
    // Restore environment
    process.env = { ...originalEnv };
  });
  
  describe('Mock Mode', () => {
    it('should add a job to a queue in mock mode', async () => {
      // Setup
      const queueName = 'test-queue';
      const jobData = { message: 'Test data' };
      
      // Execute
      const jobId = await jobManager.enqueueJob(queueName, jobData);
      
      // Verify
      expect(jobId).toBe(`mock-job-${queueName}-123456`);
    });
    
    it('should retrieve job status in mock mode', async () => {
      // Setup
      const jobId = 'test-job-123';
      
      // Execute
      const status = await jobManager.getJobStatus(jobId);
      
      // Verify
      expect(status).toBeDefined();
      expect(status.id).toBe(jobId);
      expect(status.status).toBe('completed');
    });
    
    it('should throw an error for non-existent jobs in mock mode', async () => {
      // Setup
      const jobId = 'not-found-job';
      
      // Execute & Verify
      await expect(jobManager.getJobStatus(jobId)).rejects.toThrow(/not found/);
    });
    
    it('should register a processor in mock mode', () => {
      // Setup
      const queueName = 'processor-queue';
      const processor = vi.fn();
      const options = { concurrency: 2 };
      
      // Execute
      jobManager.registerProcessor(queueName, processor, options);
      
      // Verify - just make sure it doesn't throw an error
      expect(true).toBe(true);
    });
    
    it('should get job counts in mock mode', async () => {
      // Setup
      const queueName = 'count-queue';
      
      // Execute
      const counts = await jobManager.getJobCounts(queueName);
      
      // Verify
      expect(counts).toEqual({
        waiting: 5,
        active: 2,
        completed: 10,
        failed: 1,
        delayed: 0
      });
    });
  });
  
  describe('Real Mode', () => {
    beforeEach(() => {
      // Force real mode
      process.env.USE_MOCK_JOB_MANAGER = 'false';
      process.env.NODE_ENV = 'production';
    });
    
    it('should add a job to a queue in real mode', async () => {
      // Setup
      const queueName = 'test-queue';
      const jobData = { message: 'Test data' };
      
      // Execute
      const jobId = await jobManager.enqueueJob(queueName, jobData);
      
      // Verify
      expect(jobId).toContain('real-job-');
    });
    
    it('should retrieve job status in real mode', async () => {
      // Setup
      const jobId = 'real-job-123';
      
      // Execute
      const status = await jobManager.getJobStatus(jobId);
      
      // Verify
      expect(status).toBeDefined();
      expect(status.id).toBe(jobId);
      expect(status.status).toBe('completed');
      expect(status.result).toEqual({ value: 'real job result' });
    });
    
    it('should register a processor in real mode', () => {
      // Setup
      const queueName = 'processor-queue';
      const processor = vi.fn();
      const options = { concurrency: 2 };
      
      // Execute
      jobManager.registerProcessor(queueName, processor, options);
      
      // Verify - just make sure it doesn't throw an error
      expect(true).toBe(true);
    });
    
    it('should get job counts in real mode', async () => {
      // Setup
      const queueName = 'count-queue';
      
      // Execute
      const counts = await jobManager.getJobCounts(queueName);
      
      // Verify
      expect(counts).toEqual({
        waiting: 1,
        active: 1,
        completed: 5,
        failed: 0,
        delayed: 0
      });
    });
    
    it('should close all queues', async () => {
      // Execute
      await jobManager.close();
      
      // No specific verification needed, just make sure it doesn't throw
    });
  });
});