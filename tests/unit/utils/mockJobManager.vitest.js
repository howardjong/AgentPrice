/**
 * Tests for the MockJobManager utility
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { assertRejects, createErrorTrackingSpy } from '../utils/error-handling-utils.js';
import { assertRejects, createErrorTrackingSpy } from '../utils/error-handling-utils.js';
import { assertRejects, createErrorTrackingSpy } from '../utils/error-handling-utils.js';
import MockJobManager, { JOB_STATES } from '../../utils/mockJobManager.js'
import { createTimeController, mockPerformanceNowSequence, wait, withTimeout } from '../utils/time-testing-utils.js';;

describe('MockJobManager', () => {
  let jobManager;

  beforeEach(() => {
    // Create a fresh instance for each test with fast processing
    jobManager = new MockJobManager({
      processingDelay: 50, // Fast processing for tests
      verbose: false
    });
    
    // Use vi.useFakeTimers for controlled time advancement
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Cleanup after each test
    jobManager.cleanup();
    vi.useRealTimers();
  });

  describe('Job Creation', () => {
    it('should create a job with the correct properties', () => {
      const job = jobManager.createJob('test-job', { value: 123 });
      
      expect(job).toBeDefined();
      expect(job.id).toMatch(/^job:\d+$/);
      
      const internalJob = jobManager.getJob(job.id);
      expect(internalJob).toBeDefined();
      expect(internalJob.name).toBe('test-job');
      expect(internalJob.data).toEqual({ value: 123 });
      expect(internalJob.state).toBe(JOB_STATES.PENDING);
    });

    it('should create a delayed job', () => {
      // Create a delayed job with auto-processing disabled
      const job = jobManager.createJob('delayed-job', { value: 456 }, { 
        delay: 1000,
        autoProcess: false  // Prevent auto-processing
      });
      
      const internalJob = jobManager.getJob(job.id);
      expect(internalJob.state).toBe(JOB_STATES.DELAYED);
      
      // Advance time to trigger the delay expiration
      vi.advanceTimersByTime(1000);
      
      // Now the job should be pending (not automatically processed)
      expect(internalJob.state).toBe(JOB_STATES.PENDING);
    });
  });

  describe('Job Processing', () => {
    it('should automatically process a job to completion', async () => {
      const job = jobManager.createJob('auto-job', { value: 789 });
      
      // Fast-forward time to allow processing to complete
      vi.advanceTimersByTime(200);
      
      const completedJob = jobManager.getJob(job.id);
      expect(completedJob.state).toBe(JOB_STATES.COMPLETED);
      expect(completedJob.progress).toBe(100);
      expect(completedJob.result).toBeDefined();
    });

    it('should update job progress during processing', () => {
      const progressEvents = [];
      
      // Register a progress event handler to track updates
      jobManager.on('progress', (job) => {
        progressEvents.push({ jobId: job.id, progress: job.progress });
      });
      
      // Create a job
      const job = jobManager.createJob('progress-job', { value: 'test' });
      
      // Right after creation, there might not be progress updates yet
      // We need to advance time a bit to allow the job processing to start
      vi.advanceTimersByTime(10);
      
      // Now advance time in small increments to trigger progress updates
      vi.advanceTimersByTime(20);
      vi.advanceTimersByTime(20);
      
      // By now we should definitely have progress updates
      expect(progressEvents.length).toBeGreaterThan(0);
      
      // Complete the processing
      vi.advanceTimersByTime(50);
      
      // We should end up with multiple progress updates
      expect(progressEvents.length).toBeGreaterThan(1);
      
      // The progress should increase over time and reach 100%
      const finalProgress = progressEvents[progressEvents.length - 1].progress;
      expect(finalProgress).toBe(100);
      
      // The progress values should include expected checkpoints
      const allProgresses = progressEvents.map(e => e.progress);
      expect(allProgresses).toContain(20); // First checkpoint
      expect(allProgresses).toContain(40); // Second checkpoint
    });
  });

  describe('Job State Transitions', () => {
    it('should complete a job manually', () => {
      const job = jobManager.createJob('manual-job', { value: 'manual' }, { 
        autoProcess: false 
      });
      
      const completedResult = { custom: 'result' };
      jobManager.completeJob(job.id, completedResult);
      
      const completedJob = jobManager.getJob(job.id);
      expect(completedJob.state).toBe(JOB_STATES.COMPLETED);
      expect(completedJob.result).toEqual(completedResult);
    });

    it('should fail a job manually', () => {
      const job = jobManager.createJob('fail-job', { value: 'fail' }, { 
        autoProcess: false 
      });
      
      const error = new Error('Custom error');
      jobManager.failJob(job.id, error);
      
      const failedJob = jobManager.getJob(job.id);
      expect(failedJob.state).toBe(JOB_STATES.FAILED);
      expect(failedJob.error).toBe(error);
    });

    it('should retry a failed job', () => {
      const job = jobManager.createJob('retry-job', { value: 'retry' }, { 
        autoProcess: false 
      });
      
      // Fail the job
      jobManager.failJob(job.id, new Error('Failure before retry'));
      
      // Retry the job
      jobManager.retryJob(job.id);
      
      const retriedJob = jobManager.getJob(job.id);
      expect(retriedJob.state).toBe(JOB_STATES.PENDING);
      
      // Auto process should kick in
      vi.advanceTimersByTime(200);
      
      // Job should be completed after retry
      expect(retriedJob.state).toBe(JOB_STATES.COMPLETED);
    });
  });

  describe('Events and Callbacks', () => {
    it('should trigger completion events', async () => {
      // Create a promise that resolves when the event is triggered
      const eventPromise = new Promise(resolve => {
        jobManager.on('completed', (completedJob) => {
          try {
            expect(completedJob.state).toBe(JOB_STATES.COMPLETED);
            resolve();
          } catch (error) {
            resolve(error);
          }
        });
      });
      
      // Create the job
      const job = jobManager.createJob('event-job', { value: 'event' });
      
      // Progress time to complete the job
      vi.advanceTimersByTime(200);
      
      // Wait for the event to be triggered
      await eventPromise;
    });

    it('should trigger failure events', async () => {
      // Create a promise that resolves when the event is triggered
      const eventPromise = new Promise(resolve => {
        // Force failure by setting failure rate to 100%
        jobManager = new MockJobManager({
          processingDelay: 50,
          failureRate: 1.0 // Always fail
        });
        
        jobManager.on('failed', (failedJob, error) => {
          try {
            expect(failedJob.state).toBe(JOB_STATES.FAILED);
            expect(error).toBeDefined();
            resolve();
          } catch (err) {
            resolve(err);
          }
        });
      });
      
      // Create the job
      const job = jobManager.createJob('failure-job', { value: 'fail' });
      
      // Progress time to fail the job
      vi.advanceTimersByTime(200);
      
      // Wait for the event to be triggered
      await eventPromise;
    });

    it('should handle job completion', () => {
      const job = jobManager.createJob('finished-job', { value: 'await' });
      
      // Advance time to complete the job
      vi.advanceTimersByTime(200);
      
      // Check job state directly
      expect(job.isCompleted()).toBe(true);
      
      const jobObj = jobManager.getJob(job.id);
      expect(jobObj.state).toBe(JOB_STATES.COMPLETED);
      expect(jobObj.progress).toBe(100);
    });

    it('should handle job failure', () => {
      // Configure manager to always fail jobs
      jobManager = new MockJobManager({
        processingDelay: 50,
        failureRate: 1.0
      });
      
      const job = jobManager.createJob('failing-job', { value: 'fail' });
      
      // Advance time to fail the job
      vi.advanceTimersByTime(200);
      
      // Check job state directly
      expect(job.isFailed()).toBe(true);
      
      const jobObj = jobManager.getJob(job.id);
      expect(jobObj.state).toBe(JOB_STATES.FAILED);
      expect(jobObj.error).toBeDefined();
      expect(jobObj.error.message).toBe('Simulated job failure');
    });
  });

  describe('Collection Management', () => {
    it('should track completed jobs', () => {
      // Create and complete multiple jobs
      const job1 = jobManager.createJob('complete1', { value: 1 });
      const job2 = jobManager.createJob('complete2', { value: 2 });
      const job3 = jobManager.createJob('complete3', { value: 3 });
      
      // Advance time to complete the jobs
      vi.advanceTimersByTime(200);
      
      const completedJobs = jobManager.getCompletedJobs();
      expect(completedJobs.length).toBe(3);
      expect(completedJobs.map(j => j.name)).toEqual([
        'complete1', 'complete2', 'complete3'
      ]);
    });

    it('should track failed jobs', () => {
      // Configure to always fail
      jobManager = new MockJobManager({
        processingDelay: 50,
        failureRate: 1.0
      });
      
      // Create jobs that will fail
      const job1 = jobManager.createJob('fail1', { value: 1 });
      const job2 = jobManager.createJob('fail2', { value: 2 });
      
      // Advance time to fail the jobs
      vi.advanceTimersByTime(200);
      
      const failedJobs = jobManager.getFailedJobs();
      expect(failedJobs.length).toBe(2);
      expect(failedJobs.map(j => j.name)).toEqual(['fail1', 'fail2']);
    });

    it('should retrieve all jobs', () => {
      // Create mix of jobs
      const job1 = jobManager.createJob('all1', { value: 1 });
      const job2 = jobManager.createJob('all2', { value: 2 });
      const job3 = jobManager.createJob('all3', { value: 3 }, { delay: 1000 }); // This will stay delayed
      
      // Advance time partially
      vi.advanceTimersByTime(200);
      
      const allJobs = jobManager.getAllJobs();
      expect(allJobs.length).toBe(3);
      
      // Find delayed job
      const delayedJob = allJobs.find(j => j.name === 'all3');
      expect(delayedJob.state).toBe(JOB_STATES.DELAYED);
    });
  });
});