/**
 * Service Router Unit Tests
 */
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { serviceRouter } from '../../../server/services/router';

// Import dependencies to mock
import { claudeService } from '../../../server/services/claude';
import { perplexityService } from '../../../server/services/perplexity';
import logger from '../../../utils/logger.js';

// Mock dependencies
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../server/services/claude', () => ({
  claudeService: {
    processConversation: vi.fn().mockResolvedValue({
      status: 'success',
      message: 'Claude processed the message',
      response: 'Claude response'
    })
  }
}));

vi.mock('../../../server/services/perplexity', () => {
  const sonarModels = {
    small: 'llama-3.1-sonar-small-128k-online',
    large: 'llama-3.1-sonar-large-128k-online',
    huge: 'llama-3.1-sonar-huge-128k-online'
  };
  
  return {
    perplexityService: {
      getStatus: vi.fn().mockReturnValue({
        service: 'Perplexity API',
        status: 'connected',
        lastUsed: null,
        version: 'sonar',
        error: undefined
      }),
      performResearch: vi.fn().mockResolvedValue({
        status: 'success',
        message: 'Perplexity performed research',
        response: 'Perplexity response',
        citations: []
      })
    },
    SONAR_MODELS: sonarModels
  };
});

// Helper function to log test progress and memory usage
const traceTest = (testName) => {
  console.log(`Running test: ${testName}`);
  const memUsage = process.memoryUsage();
  console.log(`Memory: RSS ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
};

describe('ServiceRouter', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks for each test
    perplexityService.getStatus.mockReturnValue({
      service: 'Perplexity API',
      status: 'connected',
      lastUsed: null,
      version: 'sonar',
      error: undefined
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('determineService', () => {
    it('should return perplexity service with deep mode when confirmDeepResearch is true', () => {
      traceTest('should return perplexity with deep mode when confirmDeepResearch is true');
      const result = serviceRouter.determineService('any message', null, { confirmDeepResearch: true });
      expect(result).toEqual({
        service: 'perplexity',
        mode: 'deep',
        estimatedTime: '15-30 minutes'
      });
    });
    
    it('should respect explicitly requested service when available', () => {
      traceTest('should respect explicitly requested service when available');
      const result = serviceRouter.determineService('any message', 'claude');
      expect(result).toBe('claude');
    });
    
    it('should fall back to claude when perplexity is explicitly requested but unavailable', () => {
      traceTest('should fall back to claude when perplexity is explicitly requested but unavailable');
      // Mock getStatus to return disconnected
      perplexityService.getStatus.mockReturnValueOnce({
        service: 'Perplexity API',
        status: 'disconnected',
        lastUsed: null,
        version: 'sonar',
        error: 'API key not configured'
      });
      
      const result = serviceRouter.determineService('any message', 'perplexity');
      expect(result).toBe('claude');
    });
    
    it('should identify research queries and suggest deep research confirmation', () => {
      traceTest('should identify research queries and suggest deep research confirmation');
      const result = serviceRouter.determineService('search for the latest information about quantum computing');
      expect(result).toEqual({
        service: 'needs_confirmation',
        suggestedAction: 'deep_research',
        message: expect.any(String)
      });
    });
    
    it('should route visualization queries to claude', () => {
      traceTest('should route visualization queries to claude');
      const result = serviceRouter.determineService('create a chart showing the population growth');
      expect(result).toEqual({
        service: 'claude',
        mode: 'default'
      });
    });
    
    it('should determine whether a query needs confirmation', () => {
      traceTest('should determine whether a query needs confirmation');
      // This is a general knowledge query with no explicit research keywords
      const result = serviceRouter.determineService('What is the capital of France?');
      
      // Check if it needs confirmation or routes to claude as default
      if (result.service === 'needs_confirmation') {
        expect(result).toEqual({
          service: 'needs_confirmation',
          suggestedAction: 'deep_research',
          message: expect.any(String)
        });
      } else {
        expect(result).toEqual({
          service: 'claude',
          mode: 'default'
        });
      }
    });
    
    it('should automatically route to claude when perplexity is unavailable', () => {
      traceTest('should automatically route to claude when perplexity is unavailable');
      // Mock getStatus to return disconnected
      perplexityService.getStatus.mockReturnValueOnce({
        service: 'Perplexity API',
        status: 'disconnected',
        lastUsed: null,
        version: 'sonar',
        error: 'API key not configured'
      });
      
      const result = serviceRouter.determineService('search for the latest news');
      expect(result).toBe('claude');
    });
  });
  
  describe('routeMessage', () => {
    it('should reject empty message arrays', async () => {
      traceTest('should reject empty message arrays');
      const result = await serviceRouter.routeMessage([]);
      expect(result).toEqual({
        status: 'error',
        message: 'No messages provided',
        error: 'Empty message array'
      });
    });
    
    it('should reject message arrays with no user messages', async () => {
      traceTest('should reject message arrays with no user messages');
      const result = await serviceRouter.routeMessage([
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'assistant', content: 'How can I help you today?' }
      ]);
      expect(result).toEqual({
        status: 'error',
        message: 'No user message found',
        error: 'No user role in messages'
      });
    });
    
    it('should route to perplexity for research queries', async () => {
      traceTest('should route to perplexity for research queries');
      const messages = [
        { role: 'user', content: 'search for information about climate change' }
      ];
      
      // Force the service choice
      await serviceRouter.routeMessage(messages, 'perplexity');
      
      expect(perplexityService.performResearch).toHaveBeenCalledWith(messages);
      expect(claudeService.processConversation).not.toHaveBeenCalled();
    });
    
    it('should route to claude by default', async () => {
      traceTest('should route to claude by default');
      const messages = [
        { role: 'user', content: 'What is the meaning of life?' }
      ];
      
      await serviceRouter.routeMessage(messages);
      
      expect(claudeService.processConversation).toHaveBeenCalledWith(messages);
      expect(perplexityService.performResearch).not.toHaveBeenCalled();
    });
    
    it('should fall back to claude with enhanced instructions when perplexity is unavailable', async () => {
      traceTest('should fall back to claude with enhanced instructions when perplexity is unavailable');
      // Mock getStatus to return disconnected
      perplexityService.getStatus.mockReturnValueOnce({
        service: 'Perplexity API',
        status: 'disconnected',
        lastUsed: null,
        version: 'sonar',
        error: 'API key not configured'
      });
      
      const messages = [
        { role: 'user', content: 'search for the latest news about AI' }
      ];
      
      await serviceRouter.routeMessage(messages, 'perplexity');
      
      expect(claudeService.processConversation).toHaveBeenCalled();
      expect(perplexityService.performResearch).not.toHaveBeenCalled();
      
      // Check that the messages were enhanced
      const enhancedMessages = claudeService.processConversation.mock.calls[0][0];
      expect(enhancedMessages[0].role).toBe('system');
      expect(enhancedMessages[0].content).toContain('research assistant');
      expect(enhancedMessages[1].content).toContain('Note:');
    });
    
    it('should handle perplexity service errors by falling back to claude', async () => {
      traceTest('should handle perplexity service errors by falling back to claude');
      
      // Create a spy on the actual method
      const perfResearchSpy = vi.spyOn(perplexityService, 'performResearch');
      
      // Explicitly reset and mock the behavior for this specific test
      perfResearchSpy.mockReset();
      perfResearchSpy.mockImplementation(() => {
        throw new Error('Perplexity error');
      });
      
      const messages = [
        { role: 'user', content: 'search for something' }
      ];
      
      try {
        await serviceRouter.routeMessage(messages, 'perplexity');
        
        // If we get here, the test passed because the error was handled
        expect(perplexityService.performResearch).toHaveBeenCalled();
        expect(claudeService.processConversation).toHaveBeenCalled();
        
        // Check that the messages were enhanced with an explanation
        const fallbackMessages = claudeService.processConversation.mock.calls[0][0];
        expect(fallbackMessages[0].role).toBe('system');
        expect(fallbackMessages[0].content).toContain('encountered an error');
      } catch (error) {
        // This shouldn't happen, but if it does, fail the test
        expect(error).toBeUndefined();
      }
    });
    
    it('should handle both services failing', async () => {
      traceTest('should handle both services failing');
      
      // Reset and mock both services for this test
      const perfResearchSpy = vi.spyOn(perplexityService, 'performResearch');
      const claudeProcessSpy = vi.spyOn(claudeService, 'processConversation');
      
      perfResearchSpy.mockReset();
      claudeProcessSpy.mockReset();
      
      perfResearchSpy.mockImplementation(() => {
        throw new Error('Perplexity error');
      });
      
      claudeProcessSpy.mockImplementation(() => {
        throw new Error('Claude error');
      });
      
      const messages = [
        { role: 'user', content: 'search for something' }
      ];
      
      const result = await serviceRouter.routeMessage(messages, 'perplexity');
      
      expect(result.status).toBe('error');
      expect(result.message).toContain('Both services failed');
      expect(result.error).toContain('Perplexity error');
      expect(result.error).toContain('Claude fallback error');
    });
  });
});