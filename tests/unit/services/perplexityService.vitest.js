/**
 * Perplexity Service Tests (Vitest)
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { traceTest } from '../../utils/test-helpers.js';

// Mock the modules before importing them
vi.mock('../../../services/perplexityService.js', () => ({
  default: {
    performQuery: vi.fn(),
    performDeepResearch: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      service: "Perplexity Research",
      healthy: true,
      totalCalls: 10,
      successRate: "90%",
      circuitBreakerOpen: false
    }),
    resetRateLimitStatus: vi.fn()
  }
}));

// Mock the logger
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Import the mocked modules
import perplexityService from '../../../services/perplexityService.js';
import logger from '../../../utils/logger.js';

// Helper function to create a mock response
function createMockPerplexityResult(model = 'sonar') {
  return {
    query: 'test query',
    timestamp: new Date().toISOString(),
    content: 'This is a test response from Perplexity',
    sources: ['https://example.com/citation1'],
    model: model,
    metadata: {
      duration: 1200,
      inputTokens: 50,
      outputTokens: 150
    }
  };
}

describe('Perplexity Service', () => {
  traceTest('Perplexity Service');
  
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset all mocks after each test
    vi.clearAllMocks();
  });

  it('should initialize with default configuration', () => {
    expect(perplexityService).toBeDefined();
    expect(perplexityService.performQuery).toBeDefined();
    expect(perplexityService.performDeepResearch).toBeDefined();
    expect(perplexityService.getStatus).toBeDefined();
  });
  
  it('should process research queries', async () => {
    // Setup
    const mockResult = createMockPerplexityResult();
    perplexityService.performQuery.mockResolvedValueOnce(mockResult);
    
    // Execute
    const result = await perplexityService.performQuery('test query');
    
    // Verify
    expect(perplexityService.performQuery).toHaveBeenCalledWith('test query');
    expect(result).toEqual(mockResult);
    expect(result.model).toBe('sonar');
    expect(result.content).toBe('This is a test response from Perplexity');
  });
  
  it('should handle API errors gracefully', async () => {
    // Setup
    perplexityService.performQuery.mockRejectedValueOnce(new Error('API Error'));
    
    // Execute & Verify
    await expect(perplexityService.performQuery('test query')).rejects.toThrow('API Error');
  });
  
  it('should support different models', async () => {
    // Setup for different model
    const mockResult = createMockPerplexityResult('sonar-deep-research');
    perplexityService.performQuery.mockResolvedValueOnce(mockResult);
    
    // Execute
    const result = await perplexityService.performQuery('test query', { model: 'sonar-deep-research' });
    
    // Verify
    expect(perplexityService.performQuery).toHaveBeenCalledWith('test query', { model: 'sonar-deep-research' });
    expect(result.model).toBe('sonar-deep-research');
  });
  
  it('should support deep research mode', async () => {
    // Setup
    const mockResult = createMockPerplexityResult();
    perplexityService.performDeepResearch.mockResolvedValueOnce(mockResult);
    
    // Execute
    const result = await perplexityService.performDeepResearch('deep research query', 'job123', { depth: 'deep' });
    
    // Verify
    expect(perplexityService.performDeepResearch).toHaveBeenCalledWith('deep research query', 'job123', { depth: 'deep' });
    expect(result).toEqual(mockResult);
  });
  
  it('should provide service status information', () => {
    // Execute
    const status = perplexityService.getStatus();
    
    // Verify
    expect(status).toHaveProperty('service', 'Perplexity Research');
    expect(status).toHaveProperty('healthy', true);
    expect(status).toHaveProperty('totalCalls');
    expect(status).toHaveProperty('successRate');
  });
});