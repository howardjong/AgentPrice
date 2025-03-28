import { describe, beforeAll, afterAll, it, expect, vi, beforeEach } from 'vitest';

// Mock uuid to return a consistent value
vi.mock('uuid', () => ({
  v4: () => 'test-job-id'
}));

// Use dynamic imports to prevent teardown issues
let initiateResearch, getResearchStatus, answerWithContext;
let jobManager, contextManager, logger;

// Create mock implementations
const createMockLogger = () => ({
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn()
});

const createMockJobManager = () => ({
  enqueueJob: vi.fn().mockResolvedValue('test-job-id'),
  getJobStatus: vi.fn().mockResolvedValue({
    status: 'completed',
    progress: 100,
    returnvalue: {
      content: 'Test research results',
      sources: ['source1', 'source2']
    }
  })
});

const createMockContextManager = () => ({
  storeContext: vi.fn(),
  getContext: vi.fn().mockResolvedValue({
    jobId: 'test-job',
    originalQuery: 'test query'
  }),
  updateContext: vi.fn()
});

const createMockClaudeService = () => ({
  generateResponse: vi.fn().mockResolvedValue('Generated response'),
  generateClarifyingQuestions: vi.fn()
});

const createMockPerplexityService = () => ({
  performDeepResearch: vi.fn()
});

// Fully manual mock for mockJobManager to avoid using its real implementation
vi.mock('../../../services/mockJobManager.js', () => ({
  default: {
    enqueueJob: vi.fn().mockResolvedValue('test-job-id'),
    getJobStatus: vi.fn().mockResolvedValue({
      status: 'completed',
      progress: 100,
      returnvalue: {
        content: 'Test research results',
        sources: ['source1', 'source2']
      }
    }),
    registerProcessor: vi.fn(),
    createQueue: vi.fn(),
    startMonitoring: vi.fn(),
    stop: vi.fn()
  }
}));

// Mock these modules to prevent real service calls
vi.mock('../../../services/jobManager.js', () => ({
  default: createMockJobManager()
}));

vi.mock('../../../services/contextManager.js', () => ({
  default: createMockContextManager()
}));

vi.mock('../../../utils/logger.js', () => ({
  default: createMockLogger()
}));

vi.mock('../../../services/claudeService.js', () => ({
  default: createMockClaudeService()
}));

vi.mock('../../../services/perplexityService.js', () => ({
  default: createMockPerplexityService()
}));

// Implementation of the integration tests with Vitest
describe('Research Workflow Integration', () => {
  vi.setConfig({ testTimeout: 30000 });

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
    
    // Mock the logger methods
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'debug').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  // Use fake timers to prevent timers from running after tests complete
  vi.useFakeTimers();
  
  afterAll(() => {
    // Reset timers
    vi.useRealTimers();
    
    // Cleanup any open handles that might be left behind
    vi.clearAllMocks();
    vi.resetModules();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
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
    
    // Set the test job ID that will be used
    const testJobId = 'test-job-id';
    
    // Update the mock to specifically handle our test job ID
    jobManager.getJobStatus.mockImplementation((queueName, id) => {
      if (id === testJobId) {
        return {
          status: 'completed',
          progress: 100,
          returnvalue: {
            content: 'Test research results',
            sources: ['source1', 'source2']
          }
        };
      }
      return { status: 'not_found' };
    });
    
    // Make enqueueJob return our specific test job ID
    jobManager.enqueueJob.mockResolvedValue(testJobId);
    
    const { jobId, sessionId } = await initiateResearch(query);
    expect(jobId).toBe(testJobId);
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