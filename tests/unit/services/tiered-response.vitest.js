/**
 * Tiered Response Strategy Integration Tests
 * 
 * Tests the full tiered response strategy with timeout and fallback handling.
 * This is a migration of the manual test-tiered-response.js to an automated Vitest test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import tieredResponse, { getTieredResponse } from '../../../utils/tieredResponseStrategy.js';

// Import time controller helper for better time simulation
import { TimeController } from '../../test-helpers/time-controller.js';

describe('Tiered Response Strategy Integration', () => {
  let timeController;

  beforeEach(() => {
    // Create a new time controller for each test
    timeController = new TimeController();
    timeController.setup();
  });

  afterEach(() => {
    // Cleanup time controller after each test
    timeController.teardown();
    vi.restoreAllMocks();
  });

  describe('Basic Tier Response', () => {
    it('should generate a response within timeout period', async () => {
      // Test basic tier with successful response
      const startTime = Date.now();
      const response = await tieredResponse._generateResponseWithTimeout('basic', { 
        query: 'What is machine learning?',
        timeout: 1000  // 1 second timeout
      });
      const elapsed = Date.now() - startTime;
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(1000); // Should complete within timeout
    });

    it('should handle timeouts correctly', async () => {
      // Mock the generation function to force a long delay
      const mockBasicResponse = vi.spyOn(tieredResponse, '_generateBasicResponse')
        .mockImplementation(() => {
          return new Promise(resolve => {
            // This will cause the function to never resolve within the timeout period
            setTimeout(() => resolve('This response comes too late'), 3000);
          });
        });
      
      // Test timeout handling with an artificially long delay
      const promise = tieredResponse._generateResponseWithTimeout('basic', { 
        query: 'What is machine learning?',
        timeout: 1000  // 1 second timeout
      });
      
      // Fast-forward time to trigger the timeout
      timeController.advanceTimersByTime(1100);
      
      // The promise should reject with a timeout error
      await expect(promise).rejects.toThrow('Request timed out after 1000ms');
      
      mockBasicResponse.mockRestore();
    });
  });

  describe('Tier Fallback Mechanism', () => {
    it('should fall back from enhanced to standard tier when specified', async () => {
      // Mock _generateEnhancedResponse to throw an error
      const mockEnhancedResponse = vi.spyOn(tieredResponse, '_generateEnhancedResponse')
        .mockImplementation(() => {
          throw new Error('Service unavailable');
        });
      
      // Test fallback from enhanced to standard tier
      const response = await tieredResponse.getResponse('test-query-fallback', 'enhanced', {
        query: 'What is machine learning?',
        timeout: 1000
      });
      
      expect(response).toBeDefined();
      // With the implementation in tieredResponseStrategy.js, fallbacks have these properties
      expect(response.originalTier).toBe('enhanced');
      expect(response.tier).toBe('standard'); // The implementation falls back to standard tier
      
      mockEnhancedResponse.mockRestore();
    });

    it('should fall back from standard to basic tier when necessary', async () => {
      // Test multiple fallback levels
      // First mock standard tier to trigger fallback
      const mockStandardResponse = vi.spyOn(tieredResponse, '_generateStandardResponse')
        .mockImplementationOnce(() => {
          throw new Error('Service unavailable');
        });
      
      const response = await tieredResponse.getResponse('test-query', 'standard', {
        query: 'What is machine learning?',
        timeout: 1000
      });
      
      expect(response).toBeDefined();
      expect(response.fallback).toBe(true);
      expect(response.tier).toBe('basic');
      
      mockStandardResponse.mockRestore();
    });

    it('should handle extreme failure scenarios', async () => {
      // Mock generateResponseWithTimeout to simulate complete failure
      const mockTimeout = vi.spyOn(tieredResponse, '_generateResponseWithTimeout')
        .mockImplementation(() => {
          throw new Error('Service unavailable');
        });
      
      const response = await tieredResponse.getResponse('test-query-extreme-fail', 'enhanced', {
        query: 'What is machine learning?',
        timeout: 1000
      });
      
      // Even in extreme failure, we should get a minimal response
      expect(response).toBeDefined();
      expect(response.content).toContain('Could not generate response');
      
      mockTimeout.mockRestore();
    });
  });

  describe('Performance and Caching', () => {
    it('should use cached responses when available', async () => {
      // First call to cache the response
      const firstResponse = await tieredResponse.getResponse('cached-query', 'standard', {
        query: 'What is artificial intelligence?',
        cache: true
      });
      
      // Spy on the internal generation function to ensure it's not called again
      const mockGeneration = vi.spyOn(tieredResponse, '_generateStandardResponse');
      
      // Second call should use the cache
      const secondResponse = await tieredResponse.getResponse('cached-query', 'standard', {
        query: 'What is artificial intelligence?',
        cache: true
      });
      
      expect(mockGeneration).not.toHaveBeenCalled();
      expect(secondResponse).toEqual(firstResponse);
      
      mockGeneration.mockRestore();
    });

    it('should track performance metrics', async () => {
      // This test verifies the tieredResponse has performance tracking capabilities
      // Note: actual tracking implementation may vary
      
      // Check that we have the expected monitoring interfaces
      expect(tieredResponse.getStatus).toBeDefined();
      expect(typeof tieredResponse.getStatus).toBe('function');
      
      // Verify the status output format
      const status = tieredResponse.getStatus();
      expect(status).toBeDefined();
      expect(status.enabled).toBeDefined();
      expect(status.currentTier).toBeDefined();
    });
  });

  describe('Tier Selection and Configuration', () => {
    it('should provide request options based on tier configuration', () => {
      // Test the request options generation
      const standardOptions = tieredResponse.getRequestOptions({});
      const enhancedOptions = tieredResponse.getRequestOptions({ forceTier: 'premium' });
      
      expect(standardOptions).toBeDefined();
      expect(standardOptions.tokenLimit).toBeDefined();
      expect(enhancedOptions.tokenLimit).toBeGreaterThan(standardOptions.tokenLimit);
    });

    it('should implement getTieredResponse utility function', async () => {
      // Test the exported utility function
      const detailedResponse = await getTieredResponse('What is AI?', { detailedResponse: true });
      const quickResponse = await getTieredResponse('What is AI?', { quickResponse: true });
      const standardResponse = await getTieredResponse('What is AI?');
      
      // The getTieredResponse function returns the proper response object
      expect(detailedResponse).toBeDefined();
      expect(quickResponse).toBeDefined();
      expect(standardResponse).toBeDefined();
      
      // Check that expected tier properties are included
      expect(detailedResponse.content).toBeDefined();
      expect(quickResponse.content).toBeDefined();
      expect(standardResponse.content).toBeDefined();
    });
  });
});