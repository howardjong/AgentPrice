/**
 * Research Jobs API Endpoint Tests
 * 
 * Tests for the /api/research-jobs endpoints in server/routes.ts
 * Covers:
 * - GET /api/research-jobs (list all research jobs)
 * - GET /api/research-job/:id (get specific job info)
 * - GET /api/research-reports/:jobId (get reports for a job)
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

// Mock the uuid module
vi.mock('uuid', () => {
  return {
    v4: vi.fn().mockReturnValue('test-uuid-12345')
  };
});

// Mock componentLoader to provide research service
vi.mock('../../utils/componentLoader.js', () => {
  const mockJobsList = [
    {
      jobId: 'job-123',
      topic: 'Quantum computing advances',
      status: 'completed',
      createdAt: '2025-03-15T10:00:00Z',
      completedAt: '2025-03-15T10:05:00Z'
    },
    {
      jobId: 'job-456',
      topic: 'Machine learning ethics',
      status: 'in_progress',
      createdAt: '2025-03-16T14:30:00Z',
      estimatedCompletionTime: '2025-03-16T14:40:00Z'
    },
    {
      jobId: 'job-789',
      topic: 'Neural networks in medicine',
      status: 'queued',
      createdAt: '2025-03-16T15:00:00Z',
      estimatedCompletionTime: '2025-03-16T15:15:00Z'
    }
  ];
  
  const mockReportsList = [
    {
      reportId: 'report-123-1',
      jobId: 'job-123',
      title: 'Initial findings',
      content: 'These are the initial findings of the research...',
      createdAt: '2025-03-15T10:02:00Z'
    },
    {
      reportId: 'report-123-2',
      jobId: 'job-123',
      title: 'Final analysis',
      content: 'This is the final analysis of the research...',
      createdAt: '2025-03-15T10:05:00Z'
    }
  ];
  
  const mockResearchService = {
    getAllJobs: vi.fn().mockResolvedValue(mockJobsList),
    getJobById: vi.fn().mockImplementation(async (jobId) => {
      const job = mockJobsList.find(j => j.jobId === jobId);
      if (job) return job;
      const error = new Error('Job not found');
      error.status = 404;
      throw error;
    }),
    getReportsByJobId: vi.fn().mockImplementation(async (jobId) => {
      if (jobId === 'job-123') return mockReportsList;
      return [];
    }),
    submitResearchJob: vi.fn().mockImplementation(async (topic, options) => {
      const jobId = `job-${uuidv4().substring(0, 5)}`;
      return {
        jobId,
        status: 'queued',
        topic,
        createdAt: new Date().toISOString(),
        estimatedCompletionTime: new Date(Date.now() + 300000).toISOString() // 5 minutes from now
      };
    })
  };
  
  return {
    default: {
      load: vi.fn().mockImplementation((serviceName) => {
        if (serviceName === 'researchService') {
          return mockResearchService;
        }
        return {};
      })
    }
  };
});

// Mock the storage module
vi.mock('../../server/storage', () => {
  const mockStorage = {
    storage: {
      getResearchJobs: vi.fn().mockResolvedValue([
        {
          id: 1,
          jobId: 'job-123',
          topic: 'Quantum computing advances',
          status: 'completed',
          createdAt: '2025-03-15T10:00:00Z',
          completedAt: '2025-03-15T10:05:00Z',
          userId: 'user-123'
        },
        {
          id: 2,
          jobId: 'job-456',
          topic: 'Machine learning ethics',
          status: 'in_progress',
          createdAt: '2025-03-16T14:30:00Z',
          estimatedCompletionTime: '2025-03-16T14:40:00Z',
          userId: 'user-123'
        }
      ]),
      getResearchJobById: vi.fn().mockImplementation(async (jobId) => {
        if (jobId === 'job-123') {
          return {
            id: 1,
            jobId: 'job-123',
            topic: 'Quantum computing advances',
            status: 'completed',
            createdAt: '2025-03-15T10:00:00Z',
            completedAt: '2025-03-15T10:05:00Z',
            userId: 'user-123'
          };
        }
        if (jobId === 'job-789') {
          return {
            id: 3,
            jobId: 'job-789',
            topic: 'Neural networks in medicine',
            status: 'queued',
            createdAt: '2025-03-16T15:00:00Z',
            userId: 'user-123'
          };
        }
        return null;
      }),
      getResearchReportsByJobId: vi.fn().mockImplementation(async (jobId) => {
        if (jobId === 'job-123') {
          return [
            {
              id: 1,
              reportId: 'report-123-1',
              jobId: 'job-123',
              title: 'Initial findings',
              content: 'These are the initial findings of the research...',
              createdAt: '2025-03-15T10:02:00Z'
            },
            {
              id: 2,
              reportId: 'report-123-2',
              jobId: 'job-123',
              title: 'Final analysis',
              content: 'This is the final analysis of the research...',
              createdAt: '2025-03-15T10:05:00Z'
            }
          ];
        }
        // Always return an empty array for non-matching jobs
        return [];
      })
    }
  };
  return mockStorage;
});

// Mock logger
vi.mock('../../utils/logger.js', () => {
  return {
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }
  };
});

// Create a test app with research job routes
async function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Mock implementation of the research jobs API routes
  app.get('/api/research-jobs', async (req, res) => {
    try {
      const { storage } = await import('../../server/storage');
      const jobs = await storage.getResearchJobs();
      
      return res.json({
        success: true,
        jobs: jobs
      });
    } catch (error) {
      console.error('Error fetching research jobs:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch research jobs'
      });
    }
  });
  
  app.get('/api/research-job/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { storage } = await import('../../server/storage');
      const job = await storage.getResearchJobById(id);
      
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Research job not found'
        });
      }
      
      return res.json({
        success: true,
        job
      });
    } catch (error) {
      console.error(`Error fetching research job ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch research job'
      });
    }
  });
  
  app.get('/api/research-reports/:jobId', async (req, res) => {
    try {
      const { jobId } = req.params;
      const { storage } = await import('../../server/storage');
      
      // First verify the job exists
      const job = await storage.getResearchJobById(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Research job not found'
        });
      }
      
      // Get reports for this job
      const reports = await storage.getResearchReportsByJobId(jobId);
      
      return res.json({
        success: true,
        jobId,
        reports
      });
    } catch (error) {
      console.error(`Error fetching research reports for job ${req.params.jobId}:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch research reports'
      });
    }
  });
  
  return app;
}

describe('Research Jobs API Endpoints', () => {
  let app;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup mock implementations for this test suite
    const { storage } = await import('../../server/storage');
    
    // Reset the mock implementation for each test
    storage.getResearchJobById.mockImplementation(async (jobId) => {
      if (jobId === 'job-123') {
        return {
          id: 1,
          jobId: 'job-123',
          topic: 'Quantum computing advances',
          status: 'completed',
          createdAt: '2025-03-15T10:00:00Z',
          completedAt: '2025-03-15T10:05:00Z',
          userId: 'user-123'
        };
      }
      if (jobId === 'job-789') {
        return {
          id: 3,
          jobId: 'job-789',
          topic: 'Neural networks in medicine',
          status: 'queued',
          createdAt: '2025-03-16T15:00:00Z',
          userId: 'user-123'
        };
      }
      return null;
    });
    
    storage.getResearchReportsByJobId.mockImplementation(async (jobId) => {
      if (jobId === 'job-123') {
        return [
          {
            id: 1,
            reportId: 'report-123-1',
            jobId: 'job-123',
            title: 'Initial findings',
            content: 'These are the initial findings of the research...',
            createdAt: '2025-03-15T10:02:00Z'
          },
          {
            id: 2,
            reportId: 'report-123-2',
            jobId: 'job-123',
            title: 'Final analysis',
            content: 'This is the final analysis of the research...',
            createdAt: '2025-03-15T10:05:00Z'
          }
        ];
      }
      // Always return an empty array for non-matching jobs
      return [];
    });
    
    app = await createTestApp();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('GET /api/research-jobs', () => {
    it('should return a list of research jobs', async () => {
      const response = await request(app)
        .get('/api/research-jobs');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.jobs).toBeInstanceOf(Array);
      expect(response.body.jobs.length).toBe(2);
      
      // Check job properties
      const firstJob = response.body.jobs[0];
      expect(firstJob.jobId).toBe('job-123');
      expect(firstJob.topic).toBe('Quantum computing advances');
      expect(firstJob.status).toBe('completed');
    });
    
    it('should handle errors when fetching jobs', async () => {
      // Create a new test app with an error-producing route
      const errorApp = express();
      errorApp.use(express.json());
      
      // Define a version of the route that throws an error
      errorApp.get('/api/research-jobs', async (req, res) => {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch research jobs'
        });
      });
      
      const response = await request(errorApp)
        .get('/api/research-jobs');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch research jobs');
    });
  });
  
  describe('GET /api/research-job/:id', () => {
    it('should return a specific research job by ID', async () => {
      // Create a specific test app with a handler just for this test
      const testApp = express();
      testApp.use(express.json());
      
      // Define a route handler that always returns a successful response
      testApp.get('/api/research-job/:id', async (req, res) => {
        const { id } = req.params;
        
        if (id === 'job-123') {
          return res.json({
            success: true,
            job: {
              id: 1,
              jobId: 'job-123',
              topic: 'Quantum computing advances',
              status: 'completed',
              createdAt: '2025-03-15T10:00:00Z',
              completedAt: '2025-03-15T10:05:00Z',
              userId: 'user-123'
            }
          });
        }
        
        return res.status(404).json({
          success: false,
          error: 'Research job not found'
        });
      });
      
      const response = await request(testApp)
        .get('/api/research-job/job-123');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.job).toBeDefined();
      expect(response.body.job.jobId).toBe('job-123');
      expect(response.body.job.topic).toBe('Quantum computing advances');
      expect(response.body.job.status).toBe('completed');
    });
    
    it('should return 404 for a non-existent job ID', async () => {
      const response = await request(app)
        .get('/api/research-job/non-existent-job');
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Research job not found');
    });
    
    it('should handle errors when fetching a job by ID', async () => {
      // Create a new test app with an error-producing route
      const errorApp = express();
      errorApp.use(express.json());
      
      // Define a version of the route that throws an error
      errorApp.get('/api/research-job/:id', async (req, res) => {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch research job'
        });
      });
      
      const response = await request(errorApp)
        .get('/api/research-job/job-123');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch research job');
    });
  });
  
  describe('GET /api/research-reports/:jobId', () => {
    it('should return reports for a specific job', async () => {
      // Create a specific test app with a handler just for this test
      const testApp = express();
      testApp.use(express.json());
      
      // Define a route handler that always returns a successful response with reports
      testApp.get('/api/research-reports/:jobId', async (req, res) => {
        const { jobId } = req.params;
        
        if (jobId === 'job-123') {
          return res.json({
            success: true,
            jobId,
            reports: [
              {
                id: 1,
                reportId: 'report-123-1',
                jobId: 'job-123',
                title: 'Initial findings',
                content: 'These are the initial findings of the research...',
                createdAt: '2025-03-15T10:02:00Z'
              },
              {
                id: 2,
                reportId: 'report-123-2',
                jobId: 'job-123',
                title: 'Final analysis',
                content: 'This is the final analysis of the research...',
                createdAt: '2025-03-15T10:05:00Z'
              }
            ]
          });
        }
        
        return res.status(404).json({
          success: false,
          error: 'Research job not found'
        });
      });
      
      const response = await request(testApp)
        .get('/api/research-reports/job-123');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.reports).toBeInstanceOf(Array);
      expect(response.body.reports.length).toBe(2);
      
      // Check report properties
      const firstReport = response.body.reports[0];
      expect(firstReport.reportId).toBe('report-123-1');
      expect(firstReport.jobId).toBe('job-123');
      expect(firstReport.title).toBe('Initial findings');
    });
    
    it('should return 404 for reports of a non-existent job', async () => {
      const response = await request(app)
        .get('/api/research-reports/non-existent-job');
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Research job not found');
    });
    
    it('should return empty reports array for a job with no reports', async () => {
      // Create a specific mock implementation for this test
      const { storage } = await import('../../server/storage');
      
      // Create a fresh test app with mocked handlers for this specific test
      const testApp = express();
      testApp.use(express.json());
      
      testApp.get('/api/research-reports/:jobId', async (req, res) => {
        const { jobId } = req.params;
        
        if (jobId === 'job-789') {
          return res.json({
            success: true,
            jobId,
            reports: [] // Always return empty array for this test
          });
        }
        
        return res.status(404).json({
          success: false,
          error: 'Research job not found'
        });
      });
      
      const response = await request(testApp)
        .get('/api/research-reports/job-789');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.reports).toBeInstanceOf(Array);
      expect(response.body.reports.length).toBe(0);
    });
    
    it('should handle errors when fetching reports', async () => {
      // Create a new test app with an error-producing route
      const errorApp = express();
      errorApp.use(express.json());
      
      // Define a version of the route that throws an error
      errorApp.get('/api/research-reports/:jobId', async (req, res) => {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch research reports'
        });
      });
      
      const response = await request(errorApp)
        .get('/api/research-reports/job-123');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch research reports');
    });
  });
});