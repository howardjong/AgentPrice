import { jest } from '@jest/globals';

// Mock creation helpers
const createMockClaudeService = () => ({
  generateClarifyingQuestions: jest.fn(),
  generateChartData: jest.fn(),
  generateResponse: jest.fn()
});

const createMockPerplexityService = () => ({
  performDeepResearch: jest.fn()
});

const createMockContextManager = () => ({
  storeContext: jest.fn(),
  getContext: jest.fn(),
  updateContext: jest.fn()
});

const createMockJobManager = () => ({
  enqueueJob: jest.fn(),
  getJobStatus: jest.fn()
});

const createMockLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
});

// Mock modules
jest.mock('../../../services/claudeService.js', () => ({
  __esModule: true,
  default: createMockClaudeService()
}));

jest.mock('../../../services/perplexityService.js', () => ({
  __esModule: true,
  default: createMockPerplexityService()
}));

jest.mock('../../../services/contextManager.js', () => ({
  __esModule: true,
  default: createMockContextManager()
}));

jest.mock('../../../services/jobManager.js', () => ({
  __esModule: true,
  default: createMockJobManager()
}));

jest.mock('../../../utils/logger.js', () => ({
  __esModule: true,
  default: createMockLogger()
}));

jest.mock('uuid', () => ({
  v4: () => 'test-uuid'
}));

// Test suite
describe('ResearchService', () => {
  let initiateResearch, getResearchStatus, answerWithContext;
  let mockClaudeService, mockPerplexityService, mockContextManager, mockJobManager, mockLogger;

  beforeAll(async () => {
    const researchModule = await import('../../../services/researchService.js');
    initiateResearch = researchModule.initiateResearch;
    getResearchStatus = researchModule.getResearchStatus;
    answerWithContext = researchModule.answerWithContext;

    mockClaudeService = (await import('../../../services/claudeService.js')).default;
    mockPerplexityService = (await import('../../../services/perplexityService.js')).default;
    mockContextManager = (await import('../../../services/contextManager.js')).default;
    mockJobManager = (await import('../../../services/jobManager.js')).default;
    mockLogger = (await import('../../../utils/logger.js')).default;
  });

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

    it('should handle errors gracefully', async () => {
      mockContextManager.storeContext.mockRejectedValue(new Error('Storage error'));

      await expect(initiateResearch('query')).rejects.toThrow('Storage error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getResearchStatus', () => {
    it('should return job status', async () => {
      const jobId = 'test-job';
      const mockStatus = { status: 'completed', data: { result: 'test' } };

      mockJobManager.getJobStatus.mockResolvedValue(mockStatus);

      const result = await getResearchStatus(jobId);
      expect(result).toEqual(mockStatus);
    });
  });

  describe('answerWithContext', () => {
    it('should generate response using context', async () => {
      const sessionId = 'test-session';
      const query = 'test query';
      const answers = { q1: 'a1' };

      mockContextManager.getContext.mockResolvedValue({
        jobId: 'test-job',
        history: []
      });

      mockJobManager.getJobStatus.mockResolvedValue({
        status: 'completed',
        returnvalue: {
          content: 'research results',
          sources: ['source1']
        }
      });

      mockClaudeService.generateResponse.mockResolvedValue('generated response');

      const result = await answerWithContext(sessionId, query, answers);

      expect(result).toEqual({
        query,
        response: 'generated response',
        sources: ['source1']
      });
    });
  });
});