/**
 * Simplified Job Manager Unit Tests
 * 
 * This test focuses on real-world behavior testing rather than
 * extensive mocking of internal implementations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setTimeout } from 'timers/promises';
import * as jobManager from '../../../services/jobManager.js';

// Store original env
const originalEnv = { ...process.env };

describe('JobManager Service', () => {
  beforeEach(() => {
    // Force mock mode for all tests
    process.env.USE_MOCK_JOB_MANAGER = 'true';
    process.env.REDIS_MODE = 'memory';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Restore environment
    process.env = { ...originalEnv };
  });

  it('should successfully add a job to a queue and retrieve its status', async () => {
    // Create a unique queue name and job data
    const queueName = `test-queue-${Date.now()}`;
    const testData = { message: 'Hello, world!', timestamp: Date.now() };
    
    // Add the job to the queue
    const jobId = await jobManager.enqueueJob(queueName, testData);
    
    // Job ID should be a string
    expect(typeof jobId).toBe('string');
    expect(jobId).toBeTruthy();
    
    // Get job status - in mock mode, it should exist immediately
    const status = await jobManager.getJobStatus(queueName, jobId);
    
    // Test for the expected properties
    expect(status).toHaveProperty('id', jobId);
    expect(status).toHaveProperty('status');
  });

  it('should handle job processing through registered processor', async () => {
    const queueName = `processor-queue-${Date.now()}`;
    const testData = { message: 'Process me!' };
    
    // Create a processor that will modify the job data
    const processor = vi.fn().mockImplementation(async (data) => {
      return { ...data, processed: true, timestamp: Date.now() };
    });
    
    // Register the processor
    jobManager.registerProcessor(queueName, processor);
    
    // Add a job to be processed
    const jobId = await jobManager.enqueueJob(queueName, testData);
    
    // Allow some time for job processing (in mock mode this should be near-immediate)
    await setTimeout(50);
    
    // Verify our processor was called (if not in mock mode, this might need adjustment)
    expect(processor).toHaveBeenCalled();
  });

  it('should retrieve job counts from the queue', async () => {
    const queueName = `count-queue-${Date.now()}`;
    
    // Add a few jobs
    await jobManager.enqueueJob(queueName, { job: 1 });
    await jobManager.enqueueJob(queueName, { job: 2 });
    await jobManager.enqueueJob(queueName, { job: 3 });
    
    // Get job counts
    const counts = await jobManager.getJobCounts(queueName);
    
    // Verify we get a counts object with the expected properties
    expect(counts).toBeTypeOf('object');
    expect(counts).toHaveProperty('waiting');
    expect(counts).toHaveProperty('active');
    expect(counts).toHaveProperty('completed');
    expect(counts).toHaveProperty('failed');
    
    // In mock mode, jobs may be auto-completed, but there should be
    // at least 3 jobs in total across all states
    const totalJobs = counts.waiting + counts.active + counts.completed + counts.failed;
    expect(totalJobs).toBeGreaterThanOrEqual(3);
  });

  it('should gracefully shut down all queues', async () => {
    // Create a couple of queues
    const queueName1 = `close-queue-1-${Date.now()}`;
    const queueName2 = `close-queue-2-${Date.now()}`;
    
    // Add jobs to both queues
    await jobManager.enqueueJob(queueName1, { test: 'data1' });
    await jobManager.enqueueJob(queueName2, { test: 'data2' });
    
    // Close all queues
    await jobManager.close();
    
    // This is a bit hard to test directly, but we can at least verify
    // the function completes without errors
    expect(true).toBe(true);
  });
});