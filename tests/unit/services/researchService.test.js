
import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { initiateResearch, getResearchStatus, answerWithContext } from '../../../services/researchService.js';
import anthropicService from '../../../services/anthropicService.js';
import perplexityService from '../../../services/perplexityService.js';
import contextManager from '../../../services/contextManager.js';
import jobManager from '../../../services/jobManager.js';
import logger from '../../../utils/logger.js';

jest.mock('../../../services/anthropicService.js', () => ({
  default: {
    generateClarifyingQuestions: jest.fn(),
    generateChartData: jest.fn(),
    generateResponse: jest.fn()
  }
}));
jest.mock('../../../services/perplexityService.js', () => ({
  default: {
    performDeepResearch: jest.fn()
  }
}));
jest.mock('../../../services/contextManager.js', () => ({
  default: {
    storeContext: jest.fn(),
    getContext: jest.fn(),
    updateContext: jest.fn()
  }
}));
jest.mock('../../../services/jobManager.js', () => ({
  default: {
    enqueueJob: jest.fn(),
    getJobStatus: jest.fn()
  }
}));
jest.mock('../../../services/contextManager.js');
jest.mock('../../../services/jobManager.js');
jest.mock('../../../utils/logger.js');

describe('ResearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  describe('answerWithContext', () => {
    it('should generate response with context', async () => {
      const sessionId = 'test-session';
      const query = 'What about quantum computing?';
      const mockContext = {
        jobId: 'test-job',
        originalQuery: 'quantum computing research'
      };
      const mockJobResults = {
        content: 'Quantum computing research results',
        sources: ['source1']
      };
      const mockResponse = 'Generated response about quantum computing';

      contextManager.getContext.mockResolvedValue(mockContext);
      jobManager.getJobStatus.mockResolvedValue({
        status: 'completed',
        returnvalue: mockJobResults
      });
      anthropicService.generateResponse = jest.fn().mockResolvedValue(mockResponse);

      const result = await answerWithContext(sessionId, query);

      expect(result).toEqual({
        query,
        response: mockResponse,
        sources: ['source1']
      });
      expect(contextManager.updateContext).toHaveBeenCalled();
    });

    it('should throw error if context not found', async () => {
      const sessionId = 'missing-session';
      const query = 'test query';

      contextManager.getContext.mockResolvedValue(null);

      await expect(answerWithContext(sessionId, query))
        .rejects
        .toThrow('Research session not found');
    });
  });

  describe('initiateResearch', () => {
    it('should create a new research job', async () => {
      const query = 'test query';
      const options = { generateClarifyingQuestions: true };
      const jobId = uuidv4();
      const sessionId = `session_${Date.now()}_test`;

      jobManager.enqueueJob.mockResolvedValue(jobId);

      const result = await initiateResearch(query, options);

      expect(result).toEqual({
        jobId: expect.any(String),
        sessionId: expect.any(String),
        status: 'PENDING'
      });

      expect(contextManager.storeContext).toHaveBeenCalled();
      expect(jobManager.enqueueJob).toHaveBeenCalledWith('research-jobs', {
        query,
        options,
        sessionId: expect.any(String)
      });
    });
  });

  describe('getResearchStatus', () => {
    it('should return job status', async () => {
      const jobId = uuidv4();
      const mockStatus = { status: 'completed', progress: 100 };

      jobManager.getJobStatus.mockResolvedValue(mockStatus);

      const result = await getResearchStatus(jobId);
      expect(result).toEqual(mockStatus);
    });
  });
});
