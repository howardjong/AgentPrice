/**
 * Enhanced Research Service Tests
 * 
 * These tests provide comprehensive coverage for the Research Service module,
 * focusing on edge cases, error handling, and all public methods.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import { 
  mockClaudeService, 
  mockPerplexityService, 
  mockJobManager, 
  mockLogger,
  resetAllMocks
} from '../../mocks/serviceMocks.js';

// Mock all dependencies
vi.mock('../../../services/claudeService.js', () => mockClaudeService);
vi.mock('../../../services/perplexityService.js', () => mockPerplexityService);
vi.mock('../../../services/jobManager.js', () => mockJobManager);
vi.mock('../../../utils/logger.js', () => mockLogger);
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid')
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockImplementation((filePath) => {
    if (filePath.includes('research-test-query')) {
      return Promise.resolve('# Research: test query\n\nMock research content');
    }
    return Promise.reject(new Error(`File not found: ${filePath}`));
  }),
  readdir: vi.fn().mockResolvedValue([
    'research-test-query-2025-04-25T12-00-00.md',
    'research-another-query-2025-04-26T13-00-00.md',
    'not-a-research-file.txt'
  ]),
  stat: vi.fn().mockImplementation((filePath) => {
    if (filePath.includes('research-test-query')) {
      return Promise.resolve({
        ctime: new Date('2025-04-25T12:00:00Z'),
        size: 1024
      });
    } else if (filePath.includes('research-another-query')) {
      return Promise.resolve({
        ctime: new Date('2025-04-26T13:00:00Z'),
        size: 2048
      });
    }
    return Promise.reject(new Error(`File not found: ${filePath}`));
  }),
  access: vi.fn().mockImplementation((filePath) => {
    if (filePath.includes('research-test-query') || 
        filePath.includes('reports') || 
        filePath.includes('research-another-query')) {
      return Promise.resolve();
    }
    return Promise.reject(new Error(`ENOENT: File or directory not found: ${filePath}`));
  })
}));

describe('Research Service', () => {
  let researchModule;
  const originalEnv = { ...process.env };

  // Import the module under test in beforeEach to get a fresh module for each test
  beforeEach(async () => {
    // Reset all mocks before each test
    resetAllMocks();
    
    // Force a new import of the module for each test
    vi.resetModules();
    researchModule = await import('../../../services/researchService.js');
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore original environment variables
    process.env = { ...originalEnv };
  });

  describe('initialize', () => {
    it('should initialize the research service successfully', async () => {
      // Set a custom directory for testing
      process.env.RESEARCH_DIR = 'custom-reports';
      
      await researchModule.initialize();
      
      // Verify the directory is created
      expect(vi.mocked(require('fs/promises').mkdir)).toHaveBeenCalledWith(
        'custom-reports',
        { recursive: true }
      );
      
      // Verify job processor is registered
      expect(mockJobManager.registerProcessor).toHaveBeenCalledWith(
        'deep-research',
        expect.any(Function)
      );
      
      // Verify successful initialization is logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Research service initialized successfully',
        expect.any(Object)
      );
    });

    it('should throw an error if initialization fails', async () => {
      // Make mkdir throw an error
      vi.mocked(require('fs/promises').mkdir).mockRejectedValueOnce(
        new Error('Permission denied')
      );
      
      // Expect initialization to fail
      await expect(researchModule.initialize()).rejects.toThrow(
        'Research service initialization failed: Permission denied'
      );
      
      // Verify error is logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize research service',
        expect.objectContaining({
          error: 'Permission denied'
        })
      );
    });
  });

  describe('processResearchJob', () => {
    it('should process a research job successfully', async () => {
      // Mock job with data
      const job = {
        id: 'job-123',
        data: {
          query: 'test query',
          options: {
            model: 'sonar-chart-pro',
            recencyFilter: 'week'
          }
        },
        updateProgress: vi.fn().mockResolvedValue(undefined)
      };
      
      // Setup mock responses
      mockPerplexityService.conductDeepResearch = vi.fn().mockResolvedValue({
        content: 'Mock research results',
        citations: ['https://example.com/source1', 'https://example.com/source2'],
        followUpQuestions: ['Follow up question 1?', 'Follow up question 2?'],
        model: 'sonar-chart-pro'
      });
      
      // Call the function
      const result = await researchModule.processResearchJob(job);
      
      // Verify the mocks were called correctly
      expect(mockPerplexityService.conductDeepResearch).toHaveBeenCalledWith(
        'test query',
        expect.objectContaining({
          model: 'sonar-chart-pro',
          recencyFilter: 'week'
        })
      );
      
      // Verify progress updates were called
      expect(job.updateProgress).toHaveBeenCalledTimes(2);
      
      // Verify the result
      expect(result).toEqual(expect.objectContaining({
        query: 'test query',
        content: 'Mock research results',
        citations: ['https://example.com/source1', 'https://example.com/source2'],
        followUpQuestions: ['Follow up question 1?', 'Follow up question 2?'],
        model: 'sonar-chart-pro',
        requestId: 'test-uuid',
        summary: null,
        savedFilePath: null
      }));
      
      // Verify successful completion is logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Deep research job completed successfully [test-uuid]',
        expect.any(Object)
      );
    });

    it('should generate a summary when requested', async () => {
      // Mock job with summary generation enabled
      const job = {
        id: 'job-123',
        data: {
          query: 'test query',
          options: {
            model: 'sonar-chart-pro',
            generateSummary: true,
            summaryModel: 'claude-3-haiku'
          }
        },
        updateProgress: vi.fn().mockResolvedValue(undefined)
      };
      
      // Setup mock responses
      mockPerplexityService.conductDeepResearch = vi.fn().mockResolvedValue({
        content: 'Mock research results',
        citations: ['https://example.com/source1'],
        model: 'sonar-chart-pro'
      });
      
      mockClaudeService.processText = vi.fn().mockResolvedValue({
        content: 'Mock summary of research findings',
        model: 'claude-3-haiku'
      });
      
      // Call the function
      const result = await researchModule.processResearchJob(job);
      
      // Verify Claude was called for summary
      expect(mockClaudeService.processText).toHaveBeenCalledWith(
        expect.stringContaining('Summarize the following research content'),
        expect.objectContaining({
          model: 'claude-3-haiku'
        })
      );
      
      // Verify the result includes summary
      expect(result).toEqual(expect.objectContaining({
        summary: {
          content: 'Mock summary of research findings'
        }
      }));
      
      // Verify progress updates reflect summary generation
      expect(job.updateProgress).toHaveBeenCalledTimes(3);
    });

    it('should save research results to a file when requested', async () => {
      // Mock job with saving enabled
      const job = {
        id: 'job-123',
        data: {
          query: 'test query',
          options: {
            model: 'sonar-chart-pro',
            saveResults: true
          }
        },
        updateProgress: vi.fn().mockResolvedValue(undefined)
      };
      
      // Setup mock responses
      mockPerplexityService.conductDeepResearch = vi.fn().mockResolvedValue({
        content: 'Mock research results',
        citations: ['https://example.com/source1'],
        followUpQuestions: ['Follow up question?'],
        model: 'sonar-chart-pro'
      });
      
      // Setup date to be predictable for filename testing
      const mockDate = new Date('2025-04-25T12:00:00Z');
      const dateSpy = vi.spyOn(global, 'Date').mockImplementation(() => mockDate);
      
      // Call the function
      const result = await researchModule.processResearchJob(job);
      
      // Verify file was written with the correct content
      expect(vi.mocked(require('fs/promises').writeFile)).toHaveBeenCalledWith(
        expect.stringContaining('test-query-2025-04-25T12-00-00.md'),
        expect.stringContaining('# Research: test query'),
        'utf8'
      );
      
      // Verify the result includes the saved file path
      expect(result.savedFilePath).toMatch(/test-query-2025-04-25T12-00-00.md$/);
      
      // Restore Date
      dateSpy.mockRestore();
    });

    it('should handle errors during research job processing', async () => {
      // Mock job with data
      const job = {
        id: 'job-123',
        data: {
          query: 'test query',
          options: {}
        },
        updateProgress: vi.fn().mockResolvedValue(undefined)
      };
      
      // Setup mock to throw an error
      mockPerplexityService.conductDeepResearch = vi.fn().mockRejectedValue(
        new Error('API rate limit exceeded')
      );
      
      // Expect the function to throw an error
      await expect(researchModule.processResearchJob(job)).rejects.toThrow(
        'Deep research job failed: API rate limit exceeded'
      );
      
      // Verify error is logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Deep research job failed [test-uuid]',
        expect.objectContaining({
          error: 'API rate limit exceeded',
          jobId: 'job-123',
          query: 'test query'
        })
      );
    });

    it('should continue processing if summary generation fails', async () => {
      // Mock job with summary generation enabled
      const job = {
        id: 'job-123',
        data: {
          query: 'test query',
          options: {
            generateSummary: true
          }
        },
        updateProgress: vi.fn().mockResolvedValue(undefined)
      };
      
      // Setup research to succeed but summary to fail
      mockPerplexityService.conductDeepResearch = vi.fn().mockResolvedValue({
        content: 'Mock research results',
        citations: ['https://example.com/source1'],
        model: 'sonar-chart-pro'
      });
      
      mockClaudeService.processText = vi.fn().mockRejectedValue(
        new Error('Summary generation failed')
      );
      
      // Call the function
      const result = await researchModule.processResearchJob(job);
      
      // Verify that the job completed despite summary failure
      expect(result).toEqual(expect.objectContaining({
        query: 'test query',
        content: 'Mock research results',
        summary: null // Summary should be null due to error
      }));
      
      // Verify warning is logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to generate research summary [test-uuid]',
        expect.objectContaining({
          error: 'Summary generation failed'
        })
      );
    });

    it('should continue processing if saving results fails', async () => {
      // Mock job with saving enabled
      const job = {
        id: 'job-123',
        data: {
          query: 'test query',
          options: {
            saveResults: true
          }
        },
        updateProgress: vi.fn().mockResolvedValue(undefined)
      };
      
      // Setup research to succeed but file writing to fail
      mockPerplexityService.conductDeepResearch = vi.fn().mockResolvedValue({
        content: 'Mock research results',
        model: 'sonar-chart-pro'
      });
      
      vi.mocked(require('fs/promises').writeFile).mockRejectedValueOnce(
        new Error('Disk full')
      );
      
      // Call the function
      const result = await researchModule.processResearchJob(job);
      
      // Verify that the job completed despite file saving failure
      expect(result).toEqual(expect.objectContaining({
        query: 'test query',
        content: 'Mock research results',
        savedFilePath: null // Path should be null due to error
      }));
      
      // Verify warning is logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to save research results [test-uuid]',
        expect.objectContaining({
          error: 'Disk full'
        })
      );
    });
  });

  describe('startResearchJob', () => {
    it('should enqueue a research job successfully', async () => {
      // Setup mock
      mockJobManager.enqueueJob = vi.fn().mockResolvedValue('job-123');
      
      // Call the function
      const result = await researchModule.startResearchJob('test query', {
        model: 'sonar-chart-pro',
        complex: true
      });
      
      // Verify the job was enqueued with correct parameters
      expect(mockJobManager.enqueueJob).toHaveBeenCalledWith(
        'deep-research',
        {
          query: 'test query',
          options: expect.objectContaining({
            model: 'sonar-chart-pro',
            complex: true,
            requestId: 'test-uuid'
          })
        }
      );
      
      // Verify the result
      expect(result).toEqual({
        jobId: 'job-123',
        requestId: 'test-uuid',
        status: 'queued',
        message: 'Research job has been queued for processing',
        estimatedTime: '60-120 seconds' // Complex job
      });
      
      // Verify job start is logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting research job [test-uuid]',
        expect.any(Object)
      );
    });

    it('should return shorter estimated time for non-complex queries', async () => {
      // Setup mock
      mockJobManager.enqueueJob = vi.fn().mockResolvedValue('job-123');
      
      // Call the function with complex: false (default)
      const result = await researchModule.startResearchJob('test query');
      
      // Verify the estimated time is shorter
      expect(result.estimatedTime).toBe('30-60 seconds');
    });

    it('should handle errors when starting a research job', async () => {
      // Setup mock to throw an error
      mockJobManager.enqueueJob = vi.fn().mockRejectedValue(
        new Error('Queue full')
      );
      
      // Expect the function to throw an error
      await expect(researchModule.startResearchJob('test query')).rejects.toThrow(
        'Research job failed to start: Queue full'
      );
      
      // Verify error is logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error starting research job [test-uuid]',
        expect.objectContaining({
          error: 'Queue full'
        })
      );
    });
  });

  describe('getResearchStatus', () => {
    it('should return job status successfully', async () => {
      // Setup mock
      mockJobManager.getJobStatus = vi.fn().mockResolvedValue({
        id: 'job-123',
        status: 'completed',
        progress: 100,
        result: { content: 'Research results' }
      });
      
      // Call the function
      const result = await researchModule.getResearchStatus('job-123');
      
      // Verify the mock was called with correct parameters
      expect(mockJobManager.getJobStatus).toHaveBeenCalledWith('job-123');
      
      // Verify the result
      expect(result).toEqual({
        id: 'job-123',
        status: 'completed',
        progress: 100,
        result: { content: 'Research results' }
      });
    });

    it('should handle errors when getting job status', async () => {
      // Setup mock to throw an error
      mockJobManager.getJobStatus = vi.fn().mockRejectedValue(
        new Error('Job not found')
      );
      
      // Expect the function to throw an error
      await expect(researchModule.getResearchStatus('job-123')).rejects.toThrow(
        'Failed to get research job status: Job not found'
      );
      
      // Verify error is logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error checking research job status',
        expect.objectContaining({
          error: 'Job not found',
          jobId: 'job-123'
        })
      );
    });
  });

  describe('listResearchReports', () => {
    it('should list research reports successfully', async () => {
      // Call the function
      const reports = await researchModule.listResearchReports();
      
      // Verify readdir was called
      expect(vi.mocked(require('fs/promises').readdir)).toHaveBeenCalled();
      
      // Verify the result
      expect(reports).toHaveLength(2); // Only research files, not other files
      expect(reports[0]).toEqual(expect.objectContaining({
        id: 'research-test-query-2025-04-25T12-00-00',
        query: 'test query',
        filename: 'research-test-query-2025-04-25T12-00-00.md',
        created: expect.any(Date)
      }));
      expect(reports[1]).toEqual(expect.objectContaining({
        id: 'research-another-query-2025-04-26T13-00-00',
        query: 'another query',
        filename: 'research-another-query-2025-04-26T13-00-00.md',
        created: expect.any(Date)
      }));
    });

    it('should filter out non-research files', async () => {
      // Call the function
      const reports = await researchModule.listResearchReports();
      
      // Verify we don't include non-research files
      const filenames = reports.map(r => r.filename);
      expect(filenames).not.toContain('not-a-research-file.txt');
    });

    it('should handle errors when listing reports', async () => {
      // Setup mock to throw an error
      vi.mocked(require('fs/promises').readdir).mockRejectedValueOnce(
        new Error('Permission denied')
      );
      
      // Expect the function to throw an error
      await expect(researchModule.listResearchReports()).rejects.toThrow(
        'Failed to list research reports: Permission denied'
      );
      
      // Verify error is logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error listing research reports',
        expect.objectContaining({
          error: 'Permission denied'
        })
      );
    });

    it('should handle errors processing individual files', async () => {
      // Setup stat to throw an error for one file but succeed for the other
      const statMock = vi.mocked(require('fs/promises').stat);
      statMock.mockImplementation((filePath) => {
        if (filePath.includes('test-query')) {
          return Promise.resolve({
            ctime: new Date('2025-04-25T12:00:00Z'),
            size: 1024
          });
        } else {
          return Promise.reject(new Error('Cannot read file stats'));
        }
      });
      
      // Call the function
      const reports = await researchModule.listResearchReports();
      
      // Verify we still get reports for the successful file
      expect(reports).toHaveLength(1);
      expect(reports[0].query).toBe('test query');
      
      // Verify warning is logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error processing research file'),
        expect.objectContaining({
          error: 'Cannot read file stats'
        })
      );
    });
  });

  describe('getResearchReport', () => {
    it('should get a research report by ID', async () => {
      // Call the function
      const report = await researchModule.getResearchReport('research-test-query-2025-04-25T12-00-00');
      
      // Verify access check was performed
      expect(vi.mocked(require('fs/promises').access)).toHaveBeenCalled();
      
      // Verify file was read
      expect(vi.mocked(require('fs/promises').readFile)).toHaveBeenCalledWith(
        expect.stringContaining('research-test-query-2025-04-25T12-00-00.md'),
        'utf8'
      );
      
      // Verify the result
      expect(report).toEqual(expect.objectContaining({
        id: 'research-test-query-2025-04-25T12-00-00',
        query: 'test query',
        filename: 'research-test-query-2025-04-25T12-00-00.md',
        content: expect.stringContaining('# Research: test query'),
        created: expect.any(Date)
      }));
    });

    it('should throw an error if the report does not exist', async () => {
      // Setup access to throw an error
      vi.mocked(require('fs/promises').access).mockRejectedValueOnce(
        new Error('ENOENT: File not found')
      );
      
      // Expect the function to throw an error
      await expect(researchModule.getResearchReport('non-existent-report')).rejects.toThrow(
        'Research report non-existent-report not found'
      );
    });

    it('should parse the content into sections', async () => {
      // Setup a more complex file content
      vi.mocked(require('fs/promises').readFile).mockResolvedValueOnce(
        `# Research: test query

*Generated on: April 25, 2025*

## Summary

This is a summary of the research.

## Detailed Research

This is the detailed research content.

## Sources

1. https://example.com/source1
2. https://example.com/source2

## Follow-up Questions

1. Follow up question 1?
2. Follow up question 2?

## Metadata

- Query: test query
- Model: sonar-chart-pro
- Citations Count: 2`
      );
      
      // Call the function
      const report = await researchModule.getResearchReport('research-test-query-2025-04-25T12-00-00');
      
      // Verify sections are parsed
      expect(report.sections).toEqual(expect.objectContaining({
        summary: expect.stringContaining('This is a summary'),
        'detailed research': expect.stringContaining('detailed research content'),
        sources: expect.stringContaining('https://example.com/source1'),
        'follow-up questions': expect.stringContaining('Follow up question 1?'),
        metadata: expect.stringContaining('Model: sonar-chart-pro')
      }));
    });

    it('should handle errors when getting a report', async () => {
      // Setup readFile to throw an error
      vi.mocked(require('fs/promises').readFile).mockRejectedValueOnce(
        new Error('Permission denied')
      );
      
      // Make sure access check passes
      vi.mocked(require('fs/promises').access).mockResolvedValueOnce(undefined);
      
      // Expect the function to throw an error
      await expect(researchModule.getResearchReport('research-test-query-2025-04-25T12-00-00')).rejects.toThrow(
        'Failed to get research report: Permission denied'
      );
      
      // Verify error is logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error getting research report',
        expect.objectContaining({
          error: 'Permission denied',
          reportId: 'research-test-query-2025-04-25T12-00-00'
        })
      );
    });
  });
});