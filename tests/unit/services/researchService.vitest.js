import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { jest } from '@jest/globals';

// Mock service creators
const createMockClaudeService = () => ({
  generateClarifyingQuestions: vi.fn().mockResolvedValue(['Question 1', 'Question 2']),
  generateChartData: vi.fn().mockResolvedValue({ data: [] }),
  generateResponse: vi.fn().mockResolvedValue('Mock response')
});

const createMockPerplexityService = () => ({
  performDeepResearch: vi.fn().mockResolvedValue({
    content: 'Mock research results',
    sources: ['source1', 'source2']
  })
});

const createMockContextManager = () => ({
  storeContext: vi.fn().mockResolvedValue(true),
  getContext: vi.fn().mockResolvedValue({
    jobId: 'test-uuid',
    originalQuery: 'test query',
    history: []
  }),
  updateContext: vi.fn().mockResolvedValue(true)
});

const createMockJobManager = () => ({
  enqueueJob: vi.fn().mockResolvedValue('test-uuid'),
  getJobStatus: vi.fn().mockResolvedValue({
    status: 'completed',
    returnvalue: {
      content: 'Mock results',
      sources: ['source1']
    }
  })
});

const createMockLogger = () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
});

// Mock modules
vi.mock('../../../services/claudeService.js', () => ({
  __esModule: true,
  default: createMockClaudeService()
}));

vi.mock('../../../services/perplexityService.js', () => ({
  __esModule: true,
  default: createMockPerplexityService()
}));

vi.mock('../../../services/contextManager.js', () => ({
  __esModule: true,
  default: createMockContextManager()
}));

vi.mock('../../../services/jobManager.js', () => ({
  __esModule: true,
  default: createMockJobManager()
}));

vi.mock('../../../utils/logger.js', () => ({
  __esModule: true,
  default: createMockLogger()
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid'
}));

describe('ResearchService', () => {
  let researchModule;

  beforeAll(async () => {
    researchModule = await import('../../../services/researchService.js');
  });

  afterEach(() => {
    vi.clearAllMocks();
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

    it('should handle errors gracefully', async () => {
      const mockContextManager = (await import('../../../services/contextManager.js')).default;
      mockContextManager.storeContext.mockRejectedValueOnce(new Error('Storage error'));

      await expect(researchModule.initiateResearch('test query'))
        .rejects.toThrow('Storage error');
    });
  });

  describe('getResearchStatus', () => {
    it('should return job status', async () => {
      const result = await researchModule.getResearchStatus('test-uuid');
      expect(result).toEqual({
        status: 'completed',
        returnvalue: {
          content: 'Mock results',
          sources: ['source1']
        }
      });
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
