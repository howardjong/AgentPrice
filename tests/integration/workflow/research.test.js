
import { jest } from '@jest/globals';

// Use dynamic imports to prevent teardown issues
let initiateResearch, getResearchStatus, answerWithContext;
let jobManager, contextManager, logger;

// Mock these modules to prevent real service calls
jest.mock('../../../services/jobManager.js');
jest.mock('../../../services/contextManager.js');
jest.mock('../../../utils/logger.js');
jest.mock('../../../services/anthropicService.js');
jest.mock('../../../services/perplexityService.js');

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

  afterAll(() => {
    // Restore module cache to original state to prevent torn down errors
    module.children = originalModules.moduleChildren;
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
