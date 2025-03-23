import { jest } from '@jest/globals';

// Using let for variables that will be loaded dynamically
let initiateResearch;
let getResearchStatus;
let answerWithContext;
let mockClaudeService;
let mockPerplexityService;
let mockContextManager;
let mockJobManager;
let mockLogger;

// Create mock implementations for all required services
const createMockLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
});

const createMockJobManager = () => ({
  enqueueJob: jest.fn().mockResolvedValue('test-uuid'),
  getJobStatus: jest.fn()
});

const createMockContextManager = () => ({
  storeContext: jest.fn(),
  getContext: jest.fn(),
  updateContext: jest.fn()
});

const createMockClaudeService = () => ({
  generateResponse: jest.fn().mockResolvedValue('Generated response'),
  generateClarifyingQuestions: jest.fn(),
  generateChartData: jest.fn()
});

const createMockPerplexityService = () => ({
  performDeepResearch: jest.fn()
});

// Mock dependencies before dynamic imports
jest.mock('uuid', () => ({
  v4: () => 'test-uuid'
}));

jest.mock('../../../services/claudeService.js', () => ({
  default: createMockClaudeService()
}));

jest.mock('../../../services/perplexityService.js', () => ({
  default: createMockPerplexityService()
}));

jest.mock('../../../services/contextManager.js', () => ({
  default: createMockContextManager()
}));

jest.mock('../../../services/jobManager.js', () => ({
  default: createMockJobManager()
}));

jest.mock('../../../utils/logger.js', () => ({
  default: createMockLogger()
}));

// Load all modules in beforeAll to avoid torn down environment
beforeAll(async () => {
  // Import the functions we want to test
  const researchModule = await import('../../../services/researchService.js');
  initiateResearch = researchModule.initiateResearch;
  getResearchStatus = researchModule.getResearchStatus;
  answerWithContext = researchModule.answerWithContext;

  // Get references to mocks for direct access in tests
  mockClaudeService = (await import('../../../services/claudeService.js')).default;
  mockPerplexityService = (await import('../../../services/perplexityService.js')).default;
  mockContextManager = (await import('../../../services/contextManager.js')).default;
  mockJobManager = (await import('../../../services/jobManager.js')).default;
  mockLogger = (await import('../../../utils/logger.js')).default;
});

// Implementing fixes for the "You are trying to `import` a file after the Jest environment has been torn down" error
describe('ResearchService', () => {
  // Store original module cache state to restore later
  const originalModules = { moduleChildren: [...module.children] };

  // Use fake timers to prevent any timers from running after tests complete
  jest.useFakeTimers();

  // Add proper teardown to prevent "module torn down" errors
  afterAll(() => {
    // Reset timers
    jest.useRealTimers();

    // Restore module cache to original state
    module.children = originalModules.moduleChildren;

    // Cleanup any open handles that might be left behind
    jest.clearAllMocks();
    jest.resetModules();
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
      mockClaudeService.generateResponse.mockResolvedValue(mockResponse);

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