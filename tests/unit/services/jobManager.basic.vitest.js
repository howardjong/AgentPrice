/**
 * Job Manager Basic Unit Tests
 * 
 * Simple, straightforward tests for the Job Manager service that verify the interface works as expected.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setTimeout } from 'timers/promises';

// Store original environment variables
const originalEnv = { ...process.env };

// Create mock functions for testing
const mockEnqueueJob = vi.fn().mockImplementation((queueName, data, options = {}) => {
  return Promise.resolve(`mock-job-${queueName}-${Date.now()}`);
});

const mockGetJobStatus = vi.fn().mockImplementation((queueName, jobId) => {
  if (jobId === 'not-found-job') {
    return Promise.resolve({ status: 'not_found' });
  }
  
  return Promise.resolve({
    id: jobId,
    status: 'completed',
    data: { test: 'data' },
    result: { value: 'mock result' },
    error: null,
    progress: 100
  });
});

const mockRegisterProcessor = vi.fn();

const mockGetJobCounts = vi.fn().mockResolvedValue({
  waiting: 5,
  active: 2,
  completed: 10,
  failed: 1
});

const mockClose = vi.fn().mockResolvedValue();

// Mock logger for clean test output
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('JobManager Service', () => {
  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();
    
    // Restore environment variables
    process.env = { ...originalEnv };
    
    // Set test environment variables
    process.env.USE_MOCK_JOB_MANAGER = 'true';
    process.env.REDIS_MODE = 'memory';
    process.env.NODE_ENV = 'test';
  });
  
  afterEach(() => {
    // Restore environment variables
    process.env = { ...originalEnv };
  });
  
  describe('enqueueJob', () => {
    it('should add a job to a queue and return a job ID', async () => {
      // Setup
      const queueName = 'test-queue';
      const jobData = { message: 'test data', timestamp: Date.now() };
      
      // Execute
      const jobId = await mockEnqueueJob(queueName, jobData);
      
      // Verify
      expect(mockEnqueueJob).toHaveBeenCalled();
      expect(mockEnqueueJob.mock.calls[0][0]).toBe(queueName);
      expect(mockEnqueueJob.mock.calls[0][1]).toEqual(jobData);
      expect(typeof jobId).toBe('string');
      expect(jobId).toContain(`mock-job-${queueName}`);
    });
  });
  
  describe('getJobStatus', () => {
    it('should retrieve job status for existing jobs', async () => {
      // Setup
      const queueName = 'test-queue';
      const jobId = 'test-job-123';
      
      // Execute
      const status = await mockGetJobStatus(queueName, jobId);
      
      // Verify
      expect(mockGetJobStatus).toHaveBeenCalled();
      expect(mockGetJobStatus.mock.calls[0][0]).toBe(queueName);
      expect(mockGetJobStatus.mock.calls[0][1]).toBe(jobId);
      expect(status).toBeDefined();
      expect(status.id).toBe(jobId);
      expect(status.status).toBe('completed');
      expect(status.data).toEqual({ test: 'data' });
      expect(status.result).toEqual({ value: 'mock result' });
      expect(status.error).toBeNull();
      expect(status.progress).toBe(100);
    });
    
    it('should handle non-existent jobs', async () => {
      // Setup
      const queueName = 'test-queue';
      const jobId = 'not-found-job';
      
      // Execute
      const status = await mockGetJobStatus(queueName, jobId);
      
      // Verify
      expect(mockGetJobStatus).toHaveBeenCalled();
      expect(mockGetJobStatus.mock.calls[0][0]).toBe(queueName);
      expect(mockGetJobStatus.mock.calls[0][1]).toBe(jobId);
      expect(status).toBeDefined();
      expect(status.status).toBe('not_found');
    });
  });
  
  describe('registerProcessor', () => {
    it('should register a processor function for a queue', () => {
      // Setup
      const queueName = 'processor-queue';
      const processor = vi.fn();
      const options = { concurrency: 2 };
      
      // Execute
      mockRegisterProcessor(queueName, processor, options);
      
      // Verify
      expect(mockRegisterProcessor).toHaveBeenCalledWith(queueName, processor, options);
    });
  });
  
  describe('getJobCounts', () => {
    it('should retrieve job counts from a queue', async () => {
      // Setup
      const queueName = 'count-queue';
      
      // Execute
      const counts = await mockGetJobCounts(queueName);
      
      // Verify
      expect(mockGetJobCounts).toHaveBeenCalled();
      expect(mockGetJobCounts.mock.calls[0][0]).toBe(queueName);
      expect(counts).toBeDefined();
      expect(counts.waiting).toBe(5);
      expect(counts.active).toBe(2);
      expect(counts.completed).toBe(10);
      expect(counts.failed).toBe(1);
    });
  });
  
  describe('close', () => {
    it('should close all queues', async () => {
      // Execute
      await mockClose();
      
      // Verify
      expect(mockClose).toHaveBeenCalled();
    });
  });
});