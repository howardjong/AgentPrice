/**
 * Shared test utilities and mock factories
 * Designed to facilitate Jest to Vitest migration
 */

// Detect which test runner is being used (some utilities conditionally adapt based on this)
export const isVitest = typeof vi !== 'undefined';
export const mockFn = isVitest ? () => vi.fn() : () => jest.fn();

/**
 * Universal mock factory functions 
 * These work with both Jest and Vitest
 */

// Create standardized mock objects for services
export const createMockLogger = (mockFunc = mockFn) => ({
  info: mockFunc(),
  error: mockFunc(),
  warn: mockFunc(),
  debug: mockFunc()
});

export const createMockClaudeService = (mockFunc = mockFn) => ({
  generateClarifyingQuestions: mockFunc().mockResolvedValue(['Question 1', 'Question 2']),
  generateChartData: mockFunc().mockResolvedValue({ data: [] }),
  generateResponse: mockFunc().mockResolvedValue({
    response: 'Mock response',
    modelUsed: 'claude-3-7-sonnet-20250219'
  })
});

export const createMockPerplexityService = (mockFunc = mockFn) => ({
  performResearch: mockFunc().mockResolvedValue({
    response: 'Mock research response', 
    modelUsed: 'sonar'
  }),
  performDeepResearch: mockFunc().mockResolvedValue({
    content: 'Mock research results',
    sources: ['source1', 'source2'],
    modelUsed: 'sonar-deep-research'
  })
});

export const createMockContextManager = (mockFunc = mockFn) => ({
  storeContext: mockFunc().mockResolvedValue(true),
  getContext: mockFunc().mockResolvedValue({
    jobId: 'test-uuid',
    originalQuery: 'test query',
    history: []
  }),
  updateContext: mockFunc().mockResolvedValue(true)
});

export const createMockJobManager = (mockFunc = mockFn) => ({
  enqueueJob: mockFunc().mockResolvedValue('test-uuid'),
  getJobStatus: mockFunc().mockResolvedValue({
    status: 'completed',
    progress: 100,
    returnvalue: {
      content: 'Mock results',
      sources: ['source1']
    }
  }),
  stop: mockFunc().mockResolvedValue(true)
});

export const createMockRedisClient = (mockFunc = mockFn) => ({
  get: mockFunc().mockResolvedValue(null),
  set: mockFunc().mockResolvedValue('OK'),
  stop: mockFunc().mockResolvedValue(true),
  setex: mockFunc().mockResolvedValue('OK')
});

// API response mock factories
export const createPerplexityResponse = (model = 'sonar') => ({
  data: {
    id: 'chatcmpl-test',
    model,
    object: 'chat.completion',
    created: Date.now() / 1000,
    choices: [
      {
        message: {
          role: 'assistant',
          content: 'This is a test response from Perplexity'
        },
        index: 0,
        finish_reason: 'stop'
      }
    ],
    citations: ['https://example.com/citation1'],
    usage: {
      prompt_tokens: 50,
      completion_tokens: 50,
      total_tokens: 100
    }
  }
});

/**
 * Migration helper functions 
 * These simplify the process of migrating tests
 */

// Helper to mock modules in both Jest and Vitest - DO NOT USE DIRECTLY
// Instead, use vi.mock or jest.mock in your test files
export const mockModule = (path, implementation) => {
  if (isVitest) {
    // This is just a stub - the actual mocking should be done with vi.mock
    console.warn('Use vi.mock directly instead of mockModule helper');
    return null;
  } else {
    // This is just a stub - the actual mocking should be done with jest.mock
    console.warn('Use jest.mock directly instead of mockModule helper');
    return null;
  }
};

// Setup fake timers in a test-runner-agnostic way
export const useFakeTimers = () => {
  if (isVitest) {
    vi.useFakeTimers();
  } else {
    jest.useFakeTimers();
  }
};

// Reset timers in a test-runner-agnostic way
export const useRealTimers = () => {
  if (isVitest) {
    vi.useRealTimers();
  } else {
    jest.useRealTimers();
  }
};

// Reset all mocks in a test-runner-agnostic way
export const resetAllMocks = () => {
  if (isVitest) {
    vi.clearAllMocks();
    vi.resetModules();
  } else {
    // Only use Jest if it's actually available
    if (typeof jest !== 'undefined') {
      jest.clearAllMocks();
      jest.resetModules();
    } else {
      console.warn('jest is not defined, skipping jest reset');
    }
  }
};

// Simplified test tracing function to help with memory management
export const traceTest = (testName) => {
  console.log(`Running test: ${testName}`);
  const memUsage = process.memoryUsage();
  console.log(`Memory: RSS ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
};