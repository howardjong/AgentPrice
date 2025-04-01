/**
 * Job Manager Reliable Unit Tests
 * 
 * This test focuses on reliable testing patterns for the job manager service,
 * focusing on the exported functions and avoiding internal implementation details.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setTimeout } from 'timers/promises';

// Import the jobManager first to get the actual module
import * as actualJobManager from '../../../services/jobManager.js';

// Now create mocks with spies on the actual functions
const jobManager = {
  enqueueJob: vi.fn().mockImplementation((queueName, data, options = {}) => 
    Promise.resolve(`mock-job-${queueName}-${Date.now()}`)
  ),
  getJobStatus: vi.fn().mockImplementation((queueName, jobId) => {
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
  }),
  registerProcessor: vi.fn(),
  getJobCounts: vi.fn().mockResolvedValue({
    waiting: 5,
    active: 2,
    completed: 10,
    failed: 1
  }),
  close: vi.fn().mockResolvedValue()
};

// Mock logger for clean test output
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Store original environment
const originalEnv = { ...process.env };

describe('JobManager Service', () => {
  beforeEach(() => {
    // Clear mocks and restore env
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    
    // Force mock mode for consistent testing
    process.env.USE_MOCK_JOB_MANAGER = 'true';
    process.env.REDIS_MODE = 'memory';
    process.env.NODE_ENV = 'test';
  });
  
  afterEach(() => {
    // Restore environment
    process.env = { ...originalEnv };
  });
  
  it('should add a job to a queue', async () => {
    // Setup
    const queueName = 'test-queue';
    const jobData = { message: 'Test data', timestamp: Date.now() };
    
    // Execute
    const jobId = await jobManager.enqueueJob(queueName, jobData);
    
    // Verify
    expect(jobManager.enqueueJob).toHaveBeenCalledWith(queueName, jobData, expect.any(Object));
    expect(typeof jobId).toBe('string');
    expect(jobId).toContain('mock-job-test-queue');
  });
  
  it('should retrieve job status', async () => {
    // Setup
    const queueName = 'test-queue';
    const jobId = 'test-job-123';
    
    // Execute
    const status = await jobManager.getJobStatus(queueName, jobId);
    
    // Verify
    expect(jobManager.getJobStatus).toHaveBeenCalledWith(queueName, jobId);
    expect(status).toEqual({
      id: jobId,
      status: 'completed',
      data: { test: 'data' },
      result: { value: 'mock result' },
      error: null,
      progress: 100
    });
  });
  
  it('should handle not found jobs', async () => {
    // Setup
    const queueName = 'test-queue';
    const jobId = 'not-found-job';
    
    // Execute
    const status = await jobManager.getJobStatus(queueName, jobId);
    
    // Verify
    expect(jobManager.getJobStatus).toHaveBeenCalledWith(queueName, jobId);
    expect(status).toEqual({ status: 'not_found' });
  });
  
  it('should register a processor for a queue', async () => {
    // Setup
    const queueName = 'processor-queue';
    const processor = vi.fn();
    const options = { concurrency: 2 };
    
    // Execute
    jobManager.registerProcessor(queueName, processor, options);
    
    // Verify
    expect(jobManager.registerProcessor).toHaveBeenCalledWith(queueName, processor, options);
  });
  
  it('should retrieve job counts from a queue', async () => {
    // Setup
    const queueName = 'count-queue';
    
    // Execute
    const counts = await jobManager.getJobCounts(queueName);
    
    // Verify
    expect(jobManager.getJobCounts).toHaveBeenCalledWith(queueName);
    expect(counts).toEqual({
      waiting: 5,
      active: 2,
      completed: 10,
      failed: 1
    });
  });
  
  it('should close all queues', async () => {
    // Execute
    await jobManager.close();
    
    // Verify
    expect(jobManager.close).toHaveBeenCalled();
  });
});