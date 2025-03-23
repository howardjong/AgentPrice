
import { jest } from '@jest/globals';

// Using let for variables that will be loaded dynamically
let initiateResearch;
let getResearchStatus;
let answerWithContext;
let mockAnthropicService;
let mockPerplexityService;
let mockContextManager;
let mockJobManager;
let mockLogger;

// Mock dependencies before dynamic imports
jest.mock('uuid');
jest.mock('../../../services/anthropicService.js');
jest.mock('../../../services/perplexityService.js');
jest.mock('../../../services/contextManager.js');
jest.mock('../../../services/jobManager.js');
jest.mock('../../../utils/logger.js');

// Load all modules in beforeAll to avoid torn down environment
beforeAll(async () => {
  // Setup UUID mock
  const uuidModule = await import('uuid');
  jest.spyOn(uuidModule, 'v4').mockReturnValue('test-uuid');
  
  // Import the functions we want to test
  const researchModule = await import('../../../services/researchService.js');
  initiateResearch = researchModule.initiateResearch;
  getResearchStatus = researchModule.getResearchStatus;
  answerWithContext = researchModule.answerWithContext;
  
  // Load and configure mocks
  mockAnthropicService = (await import('../../../services/anthropicService.js')).default;
  mockAnthropicService.generateResponse = jest.fn().mockResolvedValue('Generated response');
  mockAnthropicService.generateClarifyingQuestions = jest.fn();
  mockAnthropicService.generateChartData = jest.fn();
  
  mockPerplexityService = (await import('../../../services/perplexityService.js')).default;
  mockPerplexityService.performDeepResearch = jest.fn();
  
  mockContextManager = (await import('../../../services/contextManager.js')).default;
  mockContextManager.storeContext = jest.fn();
  mockContextManager.getContext = jest.fn();
  mockContextManager.updateContext = jest.fn();
  
  mockJobManager = (await import('../../../services/jobManager.js')).default;
  mockJobManager.enqueueJob = jest.fn().mockResolvedValue('test-uuid');
  mockJobManager.getJobStatus = jest.fn();
  
  mockLogger = (await import('../../../utils/logger.js')).default;
  mockLogger.info = jest.fn();
  mockLogger.error = jest.fn();
  mockLogger.debug = jest.fn();
  mockLogger.warn = jest.fn();
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
