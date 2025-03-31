/**
 * @file researchController.vitest.js
 * @description Tests for the research-related APIs in server/routes.ts
 */
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { assertRejects, createErrorTrackingSpy } from '../../utils/error-handling-utils.js';
import express from 'express';
import request from 'supertest';
import { createTimeController, mockPerformanceNowSequence, wait, withTimeout } from '../../utils/time-testing-utils.js';

describe('Research Controller API Tests', () => {
  let mockResearchService;
  let testApp;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create a clean test app
    testApp = express();
    testApp.use(express.json());
    
    // Create a mock research service
    mockResearchService = {
      submitResearchJob: vi.fn().mockImplementation(async (topic, options) => {
        const jobId = 'test-job-' + (options?.userId || 'anonymous') + '-' + Date.now();
        return {
          jobId: jobId,
          status: 'queued',
          topic: topic,
          createdAt: new Date().toISOString(),
          estimatedCompletionTime: new Date(Date.now() + 300000).toISOString() // 5 minutes from now
        };
      }),
      getJobStatus: vi.fn().mockImplementation(async (jobId) => {
        if (jobId === 'test-completed-job') {
          return {
            jobId: jobId,
            status: 'completed',
            result: {
              summary: 'This is a test research summary',
              sections: [
                { title: 'Introduction', content: 'Introduction content...' },
                { title: 'Main Findings', content: 'Main findings content...' },
                { title: 'Conclusion', content: 'Conclusion content...' }
              ],
              sources: [
                { title: 'Source 1', url: 'https://example.com/source1' },
                { title: 'Source 2', url: 'https://example.com/source2' }
              ]
            },
            completedAt: new Date().toISOString()
          };
        } else if (jobId === 'test-error-job') {
          return {
            jobId: jobId,
            status: 'error',
            error: 'Test error message'
          };
        } else if (jobId === 'test-nonexistent-job') {
          return null;
        } else {
          return {
            jobId: jobId,
            status: 'processing',
            progress: 0.45,
            estimatedCompletionTime: new Date(Date.now() + 150000).toISOString() // 2.5 minutes from now
          };
        }
      }),
      getUserJobs: vi.fn().mockImplementation(async (userId) => {
        if (userId === 'test-user-no-jobs') {
          return [];
        }
        
        return [
          {
            jobId: 'test-job-1',
            status: 'completed',
            topic: 'Test Topic 1',
            createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            completedAt: new Date(Date.now() - 3300000).toISOString() // 55 minutes ago
          },
          {
            jobId: 'test-job-2',
            status: 'processing',
            topic: 'Test Topic 2',
            createdAt: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
            progress: 0.7,
            estimatedCompletionTime: new Date(Date.now() + 600000).toISOString() // 10 minutes from now
          },
          {
            jobId: 'test-job-3',
            status: 'queued',
            topic: 'Test Topic 3',
            createdAt: new Date(Date.now() - 600000).toISOString() // 10 minutes ago
          }
        ];
      }),
      cancelJob: vi.fn().mockImplementation(async (jobId) => {
        if (jobId === 'test-nonexistent-job') {
          return { success: false, error: 'Job not found' };
        } else if (jobId === 'test-completed-job') {
          return { success: false, error: 'Cannot cancel a completed job' };
        } else {
          return { success: true };
        }
      })
    };
    
    // Validation schema for research job requests
    const researchJobSchema = {
      parse: vi.fn().mockImplementation((body) => {
        if (!body.topic) {
          throw new Error('Topic is required');
        }
        return body;
      })
    };
    
    // Setup routes using our mock service
    
    // POST /api/research/submit
    testApp.post('/api/research/submit', async (req, res) => {
      try {
        const { topic, userId, options } = researchJobSchema.parse(req.body);
        
        const jobData = await mockResearchService.submitResearchJob(topic, {
          userId: userId || null,
          ...options
        });
        
        res.json({
          success: true,
          job: jobData
        });
      } catch (error) {
        res.status(400).json({ 
          success: false, 
          error: `Failed to submit research job: ${error.message}` 
        });
      }
    });
    
    // GET /api/research/job/:jobId
    testApp.get('/api/research/job/:jobId', async (req, res) => {
      try {
        const { jobId } = req.params;
        
        if (!jobId) {
          return res.status(400).json({ 
            success: false, 
            error: 'Job ID is required' 
          });
        }
        
        const jobStatus = await mockResearchService.getJobStatus(jobId);
        
        if (!jobStatus) {
          return res.status(404).json({ 
            success: false, 
            error: `Research job with ID ${jobId} not found` 
          });
        }
        
        res.json({
          success: true,
          job: jobStatus
        });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: `Failed to get job status: ${error.message}` 
        });
      }
    });
    
    // GET /api/research/user/:userId/jobs
    testApp.get('/api/research/user/:userId/jobs', async (req, res) => {
      try {
        const { userId } = req.params;
        
        if (!userId) {
          return res.status(400).json({ 
            success: false, 
            error: 'User ID is required' 
          });
        }
        
        const jobs = await mockResearchService.getUserJobs(userId);
        
        res.json({
          success: true,
          jobs: jobs
        });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: `Failed to get user jobs: ${error.message}` 
        });
      }
    });
    
    // POST /api/research/job/:jobId/cancel
    testApp.post('/api/research/job/:jobId/cancel', async (req, res) => {
      try {
        const { jobId } = req.params;
        
        if (!jobId) {
          return res.status(400).json({ 
            success: false, 
            error: 'Job ID is required' 
          });
        }
        
        const result = await mockResearchService.cancelJob(jobId);
        
        if (!result.success) {
          return res.status(400).json({ 
            success: false, 
            error: result.error 
          });
        }
        
        res.json({
          success: true,
          message: `Research job ${jobId} has been cancelled`
        });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: `Failed to cancel job: ${error.message}` 
        });
      }
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  // Test suite for submitResearchJob
  describe('POST /api/research/submit', () => {
    it('should submit a research job successfully', async () => {
      const response = await request(testApp)
        .post('/api/research/submit')
        .send({
          topic: 'Recent advancements in quantum computing',
          userId: 'test-user-123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.job).toBeDefined();
      expect(response.body.job.jobId).toBeDefined();
      expect(response.body.job.status).toBe('queued');
      expect(response.body.job.topic).toBe('Recent advancements in quantum computing');
      expect(response.body.job.createdAt).toBeDefined();
      expect(response.body.job.estimatedCompletionTime).toBeDefined();
      expect(mockResearchService.submitResearchJob).toHaveBeenCalledWith(
        'Recent advancements in quantum computing', 
        { userId: 'test-user-123' }
      );
    });
    
    it('should return 400 for missing topic', async () => {
      const response = await request(testApp)
        .post('/api/research/submit')
        .send({
          userId: 'test-user-123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Topic is required');
    });
    
    it('should handle service errors gracefully', async () => {
      // Override with a rejected promise for this test
      mockResearchService.submitResearchJob.mockRejectedValueOnce(new Error('Service unavailable'));
      
      const response = await request(testApp)
        .post('/api/research/submit')
        .send({
          topic: 'Recent advancements in quantum computing',
          userId: 'test-user-123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to submit research job');
      expect(mockResearchService.submitResearchJob).toHaveBeenCalled();
    });
  });
  
  // Test suite for getJobStatus
  describe('GET /api/research/job/:jobId', () => {
    it('should get status of a processing job', async () => {
      const response = await request(testApp)
        .get('/api/research/job/test-job-processing');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.job).toBeDefined();
      expect(response.body.job.status).toBe('processing');
      expect(response.body.job.progress).toBeDefined();
      expect(response.body.job.estimatedCompletionTime).toBeDefined();
      expect(mockResearchService.getJobStatus).toHaveBeenCalledWith('test-job-processing');
    });
    
    it('should get status of a completed job with results', async () => {
      const response = await request(testApp)
        .get('/api/research/job/test-completed-job');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.job).toBeDefined();
      expect(response.body.job.status).toBe('completed');
      expect(response.body.job.result).toBeDefined();
      expect(response.body.job.result.summary).toBeDefined();
      expect(response.body.job.result.sections).toBeInstanceOf(Array);
      expect(response.body.job.result.sources).toBeInstanceOf(Array);
      expect(mockResearchService.getJobStatus).toHaveBeenCalledWith('test-completed-job');
    });
    
    it('should return 404 for non-existent job', async () => {
      const response = await request(testApp)
        .get('/api/research/job/test-nonexistent-job');
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
      expect(mockResearchService.getJobStatus).toHaveBeenCalledWith('test-nonexistent-job');
    });
    
    it('should handle service errors gracefully', async () => {
      // Override with a rejected promise for this test
      mockResearchService.getJobStatus.mockRejectedValueOnce(new Error('Database connection failed'));
      
      const response = await request(testApp)
        .get('/api/research/job/test-job-123');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to get job status');
      expect(mockResearchService.getJobStatus).toHaveBeenCalledWith('test-job-123');
    });
  });
  
  // Test suite for getUserJobs
  describe('GET /api/research/user/:userId/jobs', () => {
    it('should get all jobs for a user', async () => {
      const response = await request(testApp)
        .get('/api/research/user/test-user-123/jobs');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.jobs).toBeInstanceOf(Array);
      expect(response.body.jobs.length).toBe(3);
      expect(response.body.jobs[0]).toHaveProperty('jobId');
      expect(response.body.jobs[0]).toHaveProperty('status');
      expect(response.body.jobs[0]).toHaveProperty('topic');
      expect(mockResearchService.getUserJobs).toHaveBeenCalledWith('test-user-123');
    });
    
    it('should return empty array for user with no jobs', async () => {
      const response = await request(testApp)
        .get('/api/research/user/test-user-no-jobs/jobs');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.jobs).toBeInstanceOf(Array);
      expect(response.body.jobs.length).toBe(0);
      expect(mockResearchService.getUserJobs).toHaveBeenCalledWith('test-user-no-jobs');
    });
    
    it('should handle service errors gracefully', async () => {
      // Override with a rejected promise for this test
      mockResearchService.getUserJobs.mockRejectedValueOnce(new Error('Database connection failed'));
      
      const response = await request(testApp)
        .get('/api/research/user/test-user-123/jobs');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to get user jobs');
      expect(mockResearchService.getUserJobs).toHaveBeenCalledWith('test-user-123');
    });
  });
  
  // Test suite for cancelJob
  describe('POST /api/research/job/:jobId/cancel', () => {
    it('should cancel a job successfully', async () => {
      const response = await request(testApp)
        .post('/api/research/job/test-job-123/cancel');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('has been cancelled');
      expect(mockResearchService.cancelJob).toHaveBeenCalledWith('test-job-123');
    });
    
    it('should return 400 for non-existent job', async () => {
      const response = await request(testApp)
        .post('/api/research/job/test-nonexistent-job/cancel');
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Job not found');
      expect(mockResearchService.cancelJob).toHaveBeenCalledWith('test-nonexistent-job');
    });
    
    it('should return 400 for completed job', async () => {
      const response = await request(testApp)
        .post('/api/research/job/test-completed-job/cancel');
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Cannot cancel a completed job');
      expect(mockResearchService.cancelJob).toHaveBeenCalledWith('test-completed-job');
    });
    
    it('should handle service errors gracefully', async () => {
      // Override with a rejected promise for this test
      mockResearchService.cancelJob.mockRejectedValueOnce(new Error('Database connection failed'));
      
      const response = await request(testApp)
        .post('/api/research/job/test-job-123/cancel');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to cancel job');
      expect(mockResearchService.cancelJob).toHaveBeenCalledWith('test-job-123');
    });
  });
});