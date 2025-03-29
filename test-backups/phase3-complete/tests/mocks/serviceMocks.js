/**
 * Service Mocks for Testing
 */
import { vi } from 'vitest';

export const mockClaudeService = {
  generateClarifyingQuestions: vi.fn().mockResolvedValue(['Question 1', 'Question 2']),
  generateChartData: vi.fn().mockResolvedValue({ data: [] }),
  generateResponse: vi.fn().mockResolvedValue('Mock response')
};

export const mockPerplexityService = {
  performDeepResearch: vi.fn().mockResolvedValue({
    content: 'Mock research results',
    sources: ['source1', 'source2']
  })
};

export const mockContextManager = {
  storeContext: vi.fn().mockResolvedValue(true),
  getContext: vi.fn().mockResolvedValue({
    jobId: 'test-uuid',
    originalQuery: 'test query',
    history: []
  }),
  updateContext: vi.fn().mockResolvedValue(true)
};

export const mockJobManager = {
  enqueueJob: vi.fn().mockResolvedValue('test-uuid'),
  getJobStatus: vi.fn().mockResolvedValue({
    id: 'test-uuid',
    status: 'completed',
    progress: 100,
    attempts: 0,
    data: {
      query: 'test query',
      options: {},
      sessionId: 'test-session'
    },
    createdAt: Date.now(),
    processingTime: 1000,
    waitTime: 100,
    returnvalue: {
      content: 'Mock results',
      sources: ['source1']
    }
  }),
  registerProcessor: vi.fn()
};

export const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
};

export const resetAllMocks = () => {
  Object.values(mockClaudeService).forEach(mock => mock.mockClear());
  Object.values(mockPerplexityService).forEach(mock => mock.mockClear());
  Object.values(mockContextManager).forEach(mock => mock.mockClear());
  Object.values(mockJobManager).forEach(mock => mock.mockClear());
  Object.values(mockLogger).forEach(mock => mock.mockClear());
};