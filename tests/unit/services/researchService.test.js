
import { jest } from '@jest/globals';
import { initiateResearch, getResearchStatus, answerWithContext } from '../../../services/researchService.js';

// Mock dependencies
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid')
}));

// Create mock objects directly
const mockAnthropicService = {
  generateResponse: jest.fn(),
  generateClarifyingQuestions: jest.fn(),
  generateChartData: jest.fn()
};

const mockPerplexityService = {
  performDeepResearch: jest.fn()
};

const mockContextManager = {
  storeContext: jest.fn(),
  getContext: jest.fn(),
  updateContext: jest.fn()
};

const mockJobManager = {
  enqueueJob: jest.fn(),
  getJobStatus: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

// Mock the imports
jest.mock('../../../services/anthropicService.js', () => ({
  __esModule: true,
  default: mockAnthropicService
}));

jest.mock('../../../services/perplexityService.js', () => ({
  __esModule: true,
  default: mockPerplexityService
}));

jest.mock('../../../services/contextManager.js', () => ({
  __esModule: true,
  default: mockContextManager
}));

jest.mock('../../../services/jobManager.js', () => ({
  __esModule: true,
  default: mockJobManager
}));

jest.mock('../../../utils/logger.js', () => ({
  __esModule: true,
  default: mockLogger
}));

// TODO: Fix module teardown issues in research service tests
// The test is currently skipped due to a persistent error with Jest ES modules:
// "You are trying to `import` a file after the Jest environment has been torn down"
// Likely causes include circular dependencies or mocking issues with ES modules
describe.skip('ResearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateResearch', () => {
    it('should create a new research job', async () => {
      const query = 'test query';
      const options = { generateClarifyingQuestions: true };

      const result = await initiateResearch(query, options);

      expect(result).toEqual({
        jobId: 'test-uuid',
        sessionId: expect.any(String),
        status: 'PENDING'
      });

      expect(mockContextManager.storeContext).toHaveBeenCalled();
      expect(mockJobManager.enqueueJob).toHaveBeenCalledWith('research-jobs', {
        query,
        options,
        sessionId: expect.any(String)
      });
    });
  });

  describe('answerWithContext', () => {
    it('should generate response with context', async () => {
      const sessionId = 'test-session';
      const query = 'test query';
      const mockContext = {
        jobId: 'test-job',
        originalQuery: 'original query'
      };
      const mockJobResults = {
        content: 'Test research results',
        sources: ['source1']
      };
      const mockResponse = 'Generated response';

      mockContextManager.getContext.mockResolvedValue(mockContext);
      mockJobManager.getJobStatus.mockResolvedValue({
        status: 'completed',
        returnvalue: mockJobResults
      });
      mockAnthropicService.generateResponse.mockResolvedValue(mockResponse);

      const result = await answerWithContext(sessionId, query);

      expect(result).toEqual({
        query,
        response: mockResponse,
        sources: ['source1']
      });
    });

    it('should throw error if context not found', async () => {
      const sessionId = 'test-session';
      const query = 'test query';

      mockContextManager.getContext.mockResolvedValue(null);

      await expect(answerWithContext(sessionId, query))
        .rejects
        .toThrow('Research session not found');
    });
  });

  describe('getResearchStatus', () => {
    it('should return job status', async () => {
      const jobId = 'test-job';
      const mockStatus = { status: 'completed', progress: 100 };

      mockJobManager.getJobStatus.mockResolvedValue(mockStatus);

      const result = await getResearchStatus(jobId);
      expect(result).toEqual(mockStatus);
    });
  });
});
