/**
 * Tiered Response Strategy Tests
 * 
 * These tests verify the functionality of the tiered response strategy module
 * which provides different levels of response quality based on cost and importance.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import tieredResponseStrategy, { getTieredResponse } from '../../../utils/tieredResponseStrategy.js';
import logger from '../../../utils/logger.js';

// Mock dependencies
vi.mock('../../../utils/logger.js', () => {
  return {
    default: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }
  };
});

vi.mock('../../../utils/costTracker.js', () => {
  return {
    default: {
      trackCost: vi.fn(),
      getBudgetStatus: vi.fn().mockReturnValue({ percentUsed: 0.5 }),
      getUsageStats: vi.fn()
    }
  };
});

describe('Tiered Response Strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the strategy's cache for each test
    tieredResponseStrategy.responseCache = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic functionality', () => {
    it('should initialize with default settings', () => {
      expect(tieredResponseStrategy.defaultTier).toBe('standard');
      expect(tieredResponseStrategy.currentTier).toBe('standard');
      expect(tieredResponseStrategy.autoDowngrade).toBe(true);
      expect(tieredResponseStrategy.downgradeTrigger).toBe(0.9);
    });

    it('should return status information', () => {
      const status = tieredResponseStrategy.getStatus();
      expect(status).toHaveProperty('enabled', true);
      expect(status).toHaveProperty('defaultTier', 'standard');
      expect(status).toHaveProperty('currentTier', 'standard');
      expect(status).toHaveProperty('autoDowngrade', true);
    });

    it('should provide request options based on tier', () => {
      const standardOptions = tieredResponseStrategy.getRequestOptions({ service: 'anthropic' });
      expect(standardOptions).toHaveProperty('model', 'claude-3-7-sonnet-20250219');
      expect(standardOptions).toHaveProperty('tokenLimit');
      expect(standardOptions).toHaveProperty('cacheSettings.ttl');

      const perplexityOptions = tieredResponseStrategy.getRequestOptions({ service: 'perplexity' });
      expect(perplexityOptions).toHaveProperty('model', 'sonar');
    });

    it('should handle forced tier in request options', () => {
      const options = tieredResponseStrategy.getRequestOptions({ 
        service: 'anthropic',
        forceTier: 'premium'
      });
      
      expect(options.cacheSettings.ttl).toBe(2 * 60 * 60 * 1000); // 2 hours for premium
    });
  });

  describe('Response Generation', () => {
    it('should return a response in test mode', async () => {
      const response = await tieredResponseStrategy.getResponse(
        'test-query-1',
        'standard',
        { _testMode: true, query: 'What is the capital of France?' }
      );

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('tier', 'standard');
      expect(response).toHaveProperty('testMode', true);
      expect(response.content).toContain('Test standard response');
      expect(logger.info).toHaveBeenCalled();
    });

    it('should handle test fallback mechanism', async () => {
      const response = await tieredResponseStrategy.getResponse(
        'test-query-2',
        'premium',
        { _testMode: true, _testFallback: true }
      );

      expect(response).toHaveProperty('content', 'This is a test fallback response');
      expect(response).toHaveProperty('tier', 'standard');
      expect(response).toHaveProperty('fallback', true);
    });

    it('should cache responses and return from cache when available', async () => {
      // First request should generate a new response
      // We need to modify the implementation temporarily to ensure caching works properly
      // when _testMode is not set
      const originalImpl = tieredResponseStrategy._generateResponseWithTimeout;
      
      // Override the implementation for our test
      tieredResponseStrategy._generateResponseWithTimeout = vi.fn().mockResolvedValue({
        content: 'Generated response for caching test',
        tier: 'standard',
        timestamp: new Date().toISOString()
      });
      
      // First request should call our mocked implementation
      const response1 = await tieredResponseStrategy.getResponse(
        'cache-test',
        'standard',
        { query: 'Cached query' }
      );

      // Reset the logger.info mock to verify it's called again
      vi.mocked(logger.info).mockClear();

      // Second request should use cache
      const response2 = await tieredResponseStrategy.getResponse(
        'cache-test',
        'standard',
        { query: 'Cached query' }
      );

      // Restore original implementation
      tieredResponseStrategy._generateResponseWithTimeout = originalImpl;

      expect(response1).toEqual(response2);
      expect(response1.content).toBe('Generated response for caching test');
      // Verify it logged that it's using the cached version
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Using cached standard tier'));
    });
  });

  describe('Timeout and Error Handling', () => {
    it('should handle timeouts gracefully', async () => {
      // Mock _generateResponseWithTimeout to simulate a timeout
      const timeoutError = new Error('Request timed out after 5000ms');
      
      // We need a simpler approach - directly mock the method we're testing
      // This is more reliable and avoids recursive issues with fallbacks
      const originalGetResponse = tieredResponseStrategy.getResponse;
      
      // Mock the main method and its fallbacks
      vi.spyOn(tieredResponseStrategy, '_generateResponseWithTimeout')
        .mockRejectedValue(timeoutError);
      
      // Skip the fallback mechanism by creating a minimal response directly
      const response = await tieredResponseStrategy.getResponse(
        'timeout-test-direct',
        'basic', // Use basic to avoid fallback logic
        { query: 'Timeout question' }
      );
      
      // Verify minimal error response is returned on timeout
      expect(logger.error).toHaveBeenCalled();
      expect(response.content).toContain('Could not generate response');
      
      // Create our own minimal response that matches what we expect
      const expectedResponse = {
        content: expect.stringContaining('Could not generate response'),
        tier: 'minimal',
        error: true,
        fallback: true,
        originalTier: 'basic',
        timestamp: expect.any(String)
      };
      
      // Check that response matches our expected structure
      expect(response).toMatchObject(expectedResponse);
    });

    it('should fall back to standard tier from enhanced tier on error', async () => {
      // Mock the enhanced response to fail
      const enhancedError = new Error('Enhanced tier failed');
      vi.spyOn(tieredResponseStrategy, '_generateResponseWithTimeout')
        .mockRejectedValueOnce(enhancedError)
        // But allow standard to succeed
        .mockResolvedValueOnce({
          content: 'Standard response for fallback test',
          tier: 'standard',
          timestamp: expect.any(String)
        });

      const response = await tieredResponseStrategy.getResponse(
        'fallback-test-1',
        'enhanced',
        { query: 'Fallback test' }
      );

      expect(response).toHaveProperty('fallback', true);
      expect(response).toHaveProperty('originalTier', 'enhanced');
      expect(response.content).toBe('Standard response for fallback test');
    });

    it('should fall back to basic tier from standard tier on error', async () => {
      // Mock the standard response to fail
      const standardError = new Error('Standard tier failed');
      vi.spyOn(tieredResponseStrategy, '_generateResponseWithTimeout')
        .mockRejectedValueOnce(standardError)
        // But allow basic to succeed
        .mockResolvedValueOnce({
          content: 'Basic response for fallback test',
          tier: 'basic',
          timestamp: expect.any(String)
        });

      const response = await tieredResponseStrategy.getResponse(
        'fallback-test-2',
        'standard',
        { query: 'Fallback test' }
      );

      expect(response).toHaveProperty('fallback', true);
      expect(response).toHaveProperty('originalTier', 'standard');
      expect(response.content).toBe('Basic response for fallback test');
    });
  });

  describe('getTieredResponse utility function', () => {
    it('should use standard tier by default', async () => {
      vi.spyOn(tieredResponseStrategy, 'getResponse').mockResolvedValueOnce({
        content: 'Standard response from utility',
        tier: 'standard'
      });

      const response = await getTieredResponse('What is the capital of France?');
      
      expect(response).toHaveProperty('content', 'Standard response from utility');
      expect(response).toHaveProperty('tier', 'standard');
      expect(tieredResponseStrategy.getResponse).toHaveBeenCalledWith(
        expect.any(String),
        'standard',
        expect.objectContaining({
          query: 'What is the capital of France?'
        })
      );
    });

    it('should use premium tier when detailedResponse is true', async () => {
      vi.spyOn(tieredResponseStrategy, 'getResponse').mockResolvedValueOnce({
        content: 'Premium response from utility',
        tier: 'premium'
      });

      const response = await getTieredResponse('Tell me about quantum physics', { 
        detailedResponse: true 
      });
      
      expect(tieredResponseStrategy.getResponse).toHaveBeenCalledWith(
        expect.any(String),
        'premium',
        expect.objectContaining({
          query: 'Tell me about quantum physics',
          detailedResponse: true
        })
      );
    });

    it('should use minimal tier when quickResponse is true', async () => {
      vi.spyOn(tieredResponseStrategy, 'getResponse').mockResolvedValueOnce({
        content: 'Minimal response from utility',
        tier: 'minimal'
      });

      const response = await getTieredResponse('What time is it?', { 
        quickResponse: true 
      });
      
      expect(tieredResponseStrategy.getResponse).toHaveBeenCalledWith(
        expect.any(String),
        'minimal',
        expect.objectContaining({
          query: 'What time is it?',
          quickResponse: true
        })
      );
    });
  });
});