
import { jest } from '@jest/globals';

// Use dynamic imports to prevent teardown issues
let initiateResearch, getResearchStatus, answerWithContext;
let jobManager, contextManager, logger;

// Create mock implementations
const createMockLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
});

const createMockJobManager = () => ({
  enqueueJob: jest.fn().mockResolvedValue('test-job-id'),
  getJobStatus: jest.fn().mockResolvedValue({
    status: 'completed',
    progress: 100,
    returnvalue: {
      content: 'Test research results',
      sources: ['source1', 'source2']
    }
  })
});

const createMockContextManager = () => ({
  storeContext: jest.fn(),
  getContext: jest.fn().mockResolvedValue({
    jobId: 'test-job',
    originalQuery: 'test query'
  }),
  updateContext: jest.fn()
});

const createMockClaudeService = () => ({
  generateResponse: jest.fn().mockResolvedValue('Generated response'),
  generateClarifyingQuestions: jest.fn()
});

const createMockPerplexityService = () => ({
  performDeepResearch: jest.fn()
});

// Mock these modules to prevent real service calls
jest.mock('../../../services/jobManager.js', () => ({
  default: createMockJobManager()
}));

jest.mock('../../../services/contextManager.js', () => ({
  default: createMockContextManager()
}));

jest.mock('../../../utils/logger.js', () => ({
  default: createMockLogger()
}));

jest.mock('../../../services/anthropicService.js', () => ({
  default: createMockAnthropicService()
}));

jest.mock('../../../services/perplexityService.js', () => ({
  default: createMockPerplexityService()
}));

// Implementing fixes for teardown issues with Jest ES modules
describe('Research Workflow Integration', () => {
  jest.setTimeout(30000);

  // For proper test isolation
  const originalModules = {};

  // Import all dependencies before tests run
  beforeAll(async () => {
    // Dynamic imports to prevent teardown issues
    const researchModule = await import('../../../services/researchService.js');
    initiateResearch = researchModule.initiateResearch;
    getResearchStatus = researchModule.getResearchStatus;
    answerWithContext = researchModule.answerWithContext;
    
    jobManager = (await import('../../../services/jobManager.js')).default;
    contextManager = (await import('../../../services/contextManager.js')).default;
    logger = (await import('../../../utils/logger.js')).default;
    
    // Store original module.children
    originalModules.moduleChildren = [...module.children];
    
    // Mock the logger methods
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  // Use fake timers to prevent timers from running after tests complete
  jest.useFakeTimers();
  
  afterAll(() => {
    // Reset timers
    jest.useRealTimers();
    
    // Restore module cache to original state to prevent torn down errors
    module.children = originalModules.moduleChildren;
    
    // Cleanup any open handles that might be left behind
    jest.clearAllMocks();
    jest.resetModules();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup job manager mock behavior
    jobManager.getJobStatus.mockResolvedValue({
      status: 'completed',
      progress: 100,
      returnvalue: {
        content: 'Test research results',
        sources: ['source1', 'source2']
      }
    });

    // Setup context manager mock behavior
    contextManager.getContext.mockResolvedValue({
      jobId: 'test-job',
      originalQuery: 'test query'
    });
    
    jobManager.enqueueJob.mockResolvedValue('test-job-id');
  });

  it('should complete a full research workflow', async () => {
    const query = 'What are the latest developments in quantum computing?';
    
    const { jobId, sessionId } = await initiateResearch(query);
    expect(jobId).toBeTruthy();
    expect(sessionId).toBeTruthy();

    const status = await getResearchStatus(jobId);
    expect(status.status).toBe('completed');
    expect(status.progress).toBe(100);
    expect(status.returnvalue.content).toBe('Test research results');
    expect(status.returnvalue.sources).toEqual(['source1', 'source2']);

    const followUpResponse = await answerWithContext(sessionId, 'Tell me more about that');
    expect(followUpResponse).toEqual({
      query: 'Tell me more about that',
      response: expect.any(String),
      sources: expect.any(Array)
    });
  });
});
