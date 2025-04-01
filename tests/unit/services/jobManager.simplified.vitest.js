/**
 * Job Manager Simplified Tests
 * 
 * This test suite provides a simplified approach to testing the Job Manager
 * focusing on testing the interface behavior rather than implementation details.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create a simple version of the mock functions
const mockJobManager = {
  enqueueJob: vi.fn().mockResolvedValue('mock-job-123'),
  getJobStatus: vi.fn().mockResolvedValue({
    id: 'mock-job-123',
    status: 'completed',
    result: { value: 'test result' }
  }),
  registerProcessor: vi.fn(),
  getJobCounts: vi.fn().mockResolvedValue({
    waiting: 5,
    active: 2,
    completed: 10,
    failed: 1
  }),
  clearAllMocks: vi.fn()
};

// Mock Bull queue
const mockBullQueue = {
  on: vi.fn(),
  add: vi.fn().mockResolvedValue({ id: 'real-job-123' }),
  getJob: vi.fn().mockResolvedValue({
    id: 'real-job-123',
    getState: vi.fn().mockResolvedValue('completed'),
    finished: vi.fn().mockResolvedValue({ result: 'test' }),
    _progress: 100,
    failedReason: null
  }),
  process: vi.fn(),
  getJobCounts: vi.fn().mockResolvedValue({
    waiting: 1,
    active: 1,
    completed: 5,
    failed: 0
  }),
  close: vi.fn().mockResolvedValue()
};

// Mock Bull constructor
const mockBull = vi.fn().mockReturnValue(mockBullQueue);

// Mock dependencies
vi.mock('../../../services/mockJobManager.js', () => mockJobManager);
vi.mock('bull', () => ({ default: mockBull }));
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

// Store original environment
const originalEnv = { ...process.env };

describe('JobManager Service', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Reset environment
    process.env = { ...originalEnv };
  });
  
  afterEach(() => {
    process.env = { ...originalEnv };
  });
  
  describe('Mock Mode', () => {
    beforeEach(() => {
      // Force mock mode
      process.env.USE_MOCK_JOB_MANAGER = 'true';
    });
    
    it('should add a job to a queue', async () => {
      // Setup
      const queueName = 'test-queue';
      const jobData = { test: 'data' };
      const options = { priority: 'high' };
      
      // Execute
      await jobManager.enqueueJob(queueName, jobData, options);
      
      // Verify
      expect(mockJobManager.enqueueJob).toHaveBeenCalledWith(
        queueName, jobData, options
      );
    });
    
    it('should retrieve job status', async () => {
      // Setup
      const jobId = 'test-job-123';
      
      // Execute
      await jobManager.getJobStatus(jobId);
      
      // Verify
      expect(mockJobManager.getJobStatus).toHaveBeenCalledWith(jobId);
    });
    
    it('should register a processor', () => {
      // Setup
      const queueName = 'processor-queue';
      const processor = vi.fn();
      const options = { concurrency: 2 };
      
      // Execute
      jobManager.registerProcessor(queueName, processor, options);
      
      // Verify
      expect(mockJobManager.registerProcessor).toHaveBeenCalledWith(
        queueName, processor, options
      );
    });
    
    it('should get job counts', async () => {
      // Setup
      const queueName = 'count-queue';
      
      // Execute
      await jobManager.getJobCounts(queueName);
      
      // Verify
      expect(mockJobManager.getJobCounts).toHaveBeenCalledWith(queueName);
    });
  });
  
  describe('Real Mode', () => {
    beforeEach(() => {
      // Force real mode
      process.env.USE_MOCK_JOB_MANAGER = 'false';
    });
    
    it('should create a queue instance', async () => {
      // Setup
      const queueName = 'test-queue';
      const jobData = { test: 'data' };
      
      // Execute
      await jobManager.enqueueJob(queueName, jobData);
      
      // Verify
      expect(mockBull).toHaveBeenCalled();
      expect(mockBullQueue.add).toHaveBeenCalledWith(jobData, expect.any(Object));
    });
    
    it('should implement rate limiting when requested', async () => {
      // Setup
      const queueName = 'rate-limited-queue';
      const jobData = { 
        message: 'test data',
        options: { shouldRateLimit: true }
      };
      
      // Mock that we have an active job
      mockBullQueue.getJobCounts.mockResolvedValue({
        active: 1,
        waiting: 2,
        completed: 0,
        failed: 0
      });
      
      // Execute
      await jobManager.enqueueJob(queueName, jobData);
      
      // Verify that it called getJobCounts for rate limiting
      expect(mockBullQueue.getJobCounts).toHaveBeenCalled();
      
      // And that it added the job with a delay
      expect(mockBullQueue.add).toHaveBeenCalledWith(
        jobData,
        expect.objectContaining({ delay: expect.any(Number) })
      );
    });
    
    it('should properly close all queues', async () => {
      // First create some queues
      await jobManager.enqueueJob('queue1', { test: 'data1' });
      await jobManager.enqueueJob('queue2', { test: 'data2' });
      
      // Now close them
      await jobManager.close();
      
      // Verify
      expect(mockBullQueue.close).toHaveBeenCalled();
    });
  });
});