import { jest } from '@jest/globals';

// Mock service creators
const createMockClaudeService = () => ({
  generateClarifyingQuestions: jest.fn().mockResolvedValue(['Question 1', 'Question 2']),
  generateChartData: jest.fn().mockResolvedValue({ data: [] }),
  generateResponse: jest.fn().mockResolvedValue('Mock response')
});

const createMockPerplexityService = () => ({
  performDeepResearch: jest.fn().mockResolvedValue({
    content: 'Mock research results',
    sources: ['source1', 'source2']
  })
});

const createMockContextManager = () => ({
  storeContext: jest.fn().mockResolvedValue(true),
  getContext: jest.fn().mockResolvedValue({
    jobId: 'test-uuid',
    originalQuery: 'test query'
  }),
  updateContext: jest.fn().mockImplementation(async (sessionId, updateFn) => {
    const ctx = { history: [] };
    return updateFn(ctx);
  })
});

const createMockJobManager = () => ({
  enqueueJob: jest.fn().mockResolvedValue('test-uuid'),
  getJobStatus: jest.fn().mockResolvedValue({
    status: 'completed',
    returnvalue: {
      content: 'Mock results',
      sources: ['source1']
    }
  })
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

describe('ResearchService', () => {
  let researchModule;

  beforeAll(async () => {
    researchModule = await import('../../../services/researchService.js');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateResearch', () => {
    it('should initiate research and return job details', async () => {
      const result = await researchModule.initiateResearch('test query');
      expect(result).toEqual({
        jobId: 'test-uuid',
        sessionId: expect.any(String),
        status: 'PENDING'
      });
    });
  });

  describe('getResearchStatus', () => {
    it('should return research job status', async () => {
      const status = await researchModule.getResearchStatus('test-uuid');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('returnvalue');
    });
  });

  describe('answerWithContext', () => {
    it('should generate response using context', async () => {
      const result = await researchModule.answerWithContext('test-session', 'test query');
      expect(result).toEqual({
        query: 'test query',
        response: 'Mock response',
        sources: ['source1']
      });
    });
  });
});