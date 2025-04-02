/**
 * Mock Job Manager Additional Coverage Tests
 * 
 * This test suite provides targeted tests for the mock job manager's
 * internal functions, improving coverage of edge cases and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setTimeout } from 'timers/promises';

// Mock logger to avoid console output during tests
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Import mockJobManager after mocking
import * as mockJobManager from '../../../services/mockJobManager.js';
import logger from '../../../utils/logger.js';

describe('MockJobManager Additional Coverage Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobManager.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up any remaining mock state
    mockJobManager.clearAllMocks();
  });
  
  describe('Queue Management', () => {
    it('should create a mock queue with the specified name and options', () => {
      // Arrange
      const queueName = 'test-queue';
      const options = { timeout: 5000 };
      
      // Act - access the createMockQueue function by registering a processor
      mockJobManager.registerProcessor(queueName, vi.fn(), options);
      
      // Assert - verify the queue was created correctly by checking job counts
      return mockJobManager.getJobCounts(queueName).then(counts => {
        expect(counts).toEqual(
          expect.objectContaining({
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0
          })
        );
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Creating mock queue: ${queueName}`));
      });
    });
    
    it('should reuse existing queues when creating with the same name', () => {
      // Arrange
      const queueName = 'reused-queue';
      
      // Act - register two processors on the same queue
      mockJobManager.registerProcessor(queueName, vi.fn());
      
      // Capture the call count before second registration
      const initialCallCount = logger.info.mock.calls.length;
      
      // Register another processor on the same queue
      mockJobManager.registerProcessor(queueName, vi.fn());
      
      // Assert
      // Since queues are reused internally, we should still see the 
      // queue creation log message only once for the first creation
      const creationLogs = logger.info.mock.calls.filter(
        call => call[0].includes(`Creating mock queue: ${queueName}`)
      );
      
      expect(creationLogs.length).toBe(1);
    });
  });
  
  describe('Job Processing', () => {
    it('should process a job immediately after registering a processor', async () => {
      // Arrange
      const queueName = 'processor-registration-queue';
      const jobData = { test: 'data' };
      const processor = vi.fn().mockResolvedValue({ status: 'processed' });
      
      // First add a job with no processor
      const jobId = await mockJobManager.enqueueJob(queueName, jobData);
      
      // Then register a processor
      mockJobManager.registerProcessor(queueName, processor);
      
      // Wait for async processing
      await setTimeout(50);
      
      // Assert that the processor was called with the job
      expect(processor).toHaveBeenCalled();
      
      // Check the job status
      const status = await mockJobManager.getJobStatus(jobId);
      expect(status.status).toBe('completed');
      expect(status.result).toEqual({ status: 'processed' });
    });
    
    it('should handle processor functions that throw errors', async () => {
      // Arrange
      const queueName = 'error-processor-queue';
      const errorMessage = 'Test processing error';
      const processor = vi.fn().mockRejectedValue(new Error(errorMessage));
      
      // Register the processor that will throw
      mockJobManager.registerProcessor(queueName, processor);
      
      // Add a job
      const jobId = await mockJobManager.enqueueJob(queueName, { test: 'data' });
      
      // Wait for async processing
      await setTimeout(50);
      
      // Assert
      const status = await mockJobManager.getJobStatus(jobId);
      expect(status.status).toBe('failed');
      expect(status.error).toBe(errorMessage);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error processing mock job ${jobId}`),
        expect.objectContaining({
          error: errorMessage
        })
      );
    });
    
    it('should handle job not found errors for getJobStatus', async () => {
      // Arrange
      const nonExistentJobId = 'job-does-not-exist';
      
      // Act & Assert
      await expect(mockJobManager.getJobStatus(nonExistentJobId))
        .rejects.toThrow(`Job ${nonExistentJobId} not found`);
    });
    
    it('should update job progress when the processor calls updateProgress', async () => {
      // Arrange
      const queueName = 'progress-update-queue';
      const processor = vi.fn().mockImplementation(async (job) => {
        // Update progress during processing
        await job.updateProgress(25);
        await setTimeout(10);
        await job.updateProgress(50);
        await setTimeout(10);
        await job.updateProgress(75);
        await setTimeout(10);
        return { completed: true };
      });
      
      // Register the processor
      mockJobManager.registerProcessor(queueName, processor);
      
      // Add a job
      const jobId = await mockJobManager.enqueueJob(queueName, { test: 'data' });
      
      // Wait for processing to complete
      await setTimeout(100);
      
      // Assert
      const status = await mockJobManager.getJobStatus(jobId);
      expect(status.status).toBe('completed');
      expect(status.progress).toBe(100); // After completion, progress should be 100
    });
  });
  
  describe('Success and Error Handlers', () => {
    it('should call the success handler when a job completes successfully', async () => {
      // Arrange
      const queueName = 'success-handler-queue';
      const successHandler = vi.fn();
      const processor = vi.fn().mockResolvedValue({ status: 'success' });
      
      // Register the processor
      mockJobManager.registerProcessor(queueName, processor);
      
      // Add a job with a success handler
      const jobId = await mockJobManager.enqueueJob(queueName, 
        { test: 'data' }, 
        { successHandler }
      );
      
      // Wait for processing to complete
      await setTimeout(50);
      
      // Assert
      expect(successHandler).toHaveBeenCalled();
      const status = await mockJobManager.getJobStatus(jobId);
      expect(status.status).toBe('completed');
    });
    
    it('should call the error handler when a job fails', async () => {
      // Arrange
      const queueName = 'error-handler-queue';
      const errorHandler = vi.fn();
      const processor = vi.fn().mockRejectedValue(new Error('Test error'));
      
      // Register the processor
      mockJobManager.registerProcessor(queueName, processor);
      
      // Add a job with an error handler
      const jobId = await mockJobManager.enqueueJob(queueName, 
        { test: 'data' }, 
        { errorHandler }
      );
      
      // Wait for processing to complete
      await setTimeout(50);
      
      // Assert
      expect(errorHandler).toHaveBeenCalled();
      const status = await mockJobManager.getJobStatus(jobId);
      expect(status.status).toBe('failed');
    });
    
    it('should handle errors in success handlers', async () => {
      // Arrange
      const queueName = 'failing-success-handler-queue';
      const successHandler = vi.fn().mockImplementation(() => {
        throw new Error('Success handler error');
      });
      const processor = vi.fn().mockResolvedValue({ status: 'success' });
      
      // Register the processor
      mockJobManager.registerProcessor(queueName, processor);
      
      // Add a job with a success handler that throws
      const jobId = await mockJobManager.enqueueJob(queueName, 
        { test: 'data' }, 
        { successHandler }
      );
      
      // Wait for processing to complete
      await setTimeout(50);
      
      // Assert
      expect(successHandler).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Error in success handler for job ${jobId}`),
        expect.objectContaining({
          error: 'Success handler error'
        })
      );
      
      // The job should still be considered completed despite handler error
      const status = await mockJobManager.getJobStatus(jobId);
      expect(status.status).toBe('completed');
    });
    
    it('should handle errors in error handlers', async () => {
      // Arrange
      const queueName = 'failing-error-handler-queue';
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Error handler error');
      });
      const processor = vi.fn().mockRejectedValue(new Error('Original processing error'));
      
      // Register the processor
      mockJobManager.registerProcessor(queueName, processor);
      
      // Add a job with an error handler that throws
      const jobId = await mockJobManager.enqueueJob(queueName, 
        { test: 'data' }, 
        { errorHandler }
      );
      
      // Wait for processing to complete
      await setTimeout(50);
      
      // Assert
      expect(errorHandler).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Error in error handler for job ${jobId}`),
        expect.objectContaining({
          error: 'Error handler error'
        })
      );
      
      // The job should still be considered failed
      const status = await mockJobManager.getJobStatus(jobId);
      expect(status.status).toBe('failed');
    });
  });
  
  describe('Delayed Jobs', () => {
    it('should process delayed jobs after the specified delay', async () => {
      // Arrange
      const queueName = 'delayed-job-queue';
      const jobData = { test: 'delayed' };
      const delay = 50; // 50ms delay
      const processor = vi.fn().mockResolvedValue({ status: 'processed' });
      
      // Register the processor
      mockJobManager.registerProcessor(queueName, processor);
      
      // Add a delayed job
      const jobId = await mockJobManager.enqueueJob(queueName, jobData, { delay });
      
      // Check immediately
      const immediateStatus = await mockJobManager.getJobStatus(jobId);
      
      // Wait less than the delay
      await setTimeout(20);
      
      // Processor should not have been called yet
      expect(processor).not.toHaveBeenCalled();
      
      // Wait for the delay to pass
      await setTimeout(delay);
      
      // Wait a bit more for processing to complete
      await setTimeout(20);
      
      // Assert
      expect(processor).toHaveBeenCalled();
      const finalStatus = await mockJobManager.getJobStatus(jobId);
      expect(finalStatus.status).toBe('completed');
    });
  });
  
  describe('Job Counts', () => {
    it('should accurately count jobs by status', async () => {
      // Arrange
      const queueName = 'job-counts-queue';
      const processor = vi.fn()
        .mockImplementationOnce(async () => {
          // First job completes
          return { status: 'success' };
        })
        .mockImplementationOnce(async () => {
          // Second job fails
          throw new Error('Test error');
        })
        .mockImplementationOnce(async (job) => {
          // Third job stays active (we avoid resolving)
          job.status = 'active';
          return new Promise(() => {}); // Never resolves, job stays active
        });
      
      // Register the processor
      mockJobManager.registerProcessor(queueName, processor);
      
      // Add jobs and a delayed job
      await mockJobManager.enqueueJob(queueName, { id: 1 });
      await mockJobManager.enqueueJob(queueName, { id: 2 });
      await mockJobManager.enqueueJob(queueName, { id: 3 });
      await mockJobManager.enqueueJob(queueName, { id: 4 }, { delay: 1000 }); // Stays delayed
      
      // Wait for processing to start
      await setTimeout(50);
      
      // Get the job counts
      const counts = await mockJobManager.getJobCounts(queueName);
      
      // Assert
      expect(counts.completed).toBeGreaterThanOrEqual(1);
      expect(counts.failed).toBeGreaterThanOrEqual(1);
      expect(counts.active + counts.waiting).toBeGreaterThanOrEqual(1);
      expect(counts.delayed).toBeGreaterThanOrEqual(1);
    });
    
    it('should return empty counts for non-existent queues', async () => {
      // Arrange
      const nonExistentQueueName = 'queue-does-not-exist';
      
      // Act
      const counts = await mockJobManager.getJobCounts(nonExistentQueueName);
      
      // Assert
      expect(counts).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0
      });
    });
  });
  
  describe('Custom Job IDs', () => {
    it('should respect custom job IDs provided in options', async () => {
      // Arrange
      const queueName = 'custom-id-queue';
      const customJobId = 'my-custom-job-id-123';
      
      // Act
      const jobId = await mockJobManager.enqueueJob(queueName, 
        { test: 'data' }, 
        { jobId: customJobId }
      );
      
      // Assert
      expect(jobId).toBe(customJobId);
      
      // Verify the job can be retrieved with the custom ID
      const status = await mockJobManager.getJobStatus(customJobId);
      expect(status.id).toBe(customJobId);
    });
  });
});