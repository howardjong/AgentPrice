/**
 * Error Handling Workflow Test
 * 
 * Tests the system's response to various error conditions.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { loadFixtures, runAndValidateTest } from '../test-utils.js';
import { initializeMockServices } from '../test-runner.js';

// We need to import the mock-services directly to modify them for error scenarios
import '../mock-services.js';

describe('Error Handling Workflow Test', () => {
  let mockServices;
  
  // Load fixtures and mock services before tests
  beforeAll(async () => {
    await loadFixtures();
    mockServices = await initializeMockServices();
  });
  
  it('should handle research service errors with graceful degradation', async () => {
    // Save original function to restore later
    const originalPerformDeepResearch = mockServices.perplexity.performDeepResearch;
    
    // Inject an error in the deep research function
    mockServices.perplexity.performDeepResearch = vi.fn().mockRejectedValueOnce(
      new Error('Simulated deep research service failure')
    );
    
    try {
      // Run test with the error injected
      const results = await runAndValidateTest('errorHandling', {
        useRealAPIs: false
      });
      
      // Check if the error was handled
      // In a robust system, the test might still succeed with fallback mechanisms
      if (results.success) {
        console.log('System successfully handled the research service error with fallback mechanisms');
        expect(results.fallback).toBeDefined();
        expect(results.fallback.used).toBe(true);
        expect(results.fallback.service).toBeDefined();
      } else {
        // If the test failed, verify it was due to our injected error
        expect(results.error).toContain('research service failure');
      }
    } finally {
      // Restore the original function
      mockServices.perplexity.performDeepResearch = originalPerformDeepResearch;
    }
  });
  
  it('should handle chart generation errors', async () => {
    // Save original function to restore later
    const originalGenerateChartData = mockServices.claude.generateChartData;
    
    // Inject an error in the chart data generation function
    mockServices.claude.generateChartData = vi.fn().mockRejectedValueOnce(
      new Error('Simulated chart data generation failure')
    );
    
    try {
      // Run test with the error injected
      const results = await runAndValidateTest('errorHandling', {
        useRealAPIs: false
      });
      
      // Check if the error was handled
      if (results.success) {
        console.log('System successfully handled the chart generation error with fallback mechanisms');
        expect(results.fallback).toBeDefined();
        expect(results.fallback.used).toBe(true);
        expect(results.fallback.service).toBeDefined();
      } else {
        // If the test failed, verify it was due to our injected error
        expect(results.error).toContain('chart data generation failure');
      }
    } finally {
      // Restore the original function
      mockServices.claude.generateChartData = originalGenerateChartData;
    }
  });
  
  it('should handle temporarily unavailable services', async () => {
    // Save original function to restore later
    const originalIsOnline = mockServices.perplexity.isOnline;
    
    // Make the service appear offline
    mockServices.perplexity.isOnline = vi.fn().mockReturnValueOnce(false);
    
    try {
      // Run test with the service offline
      const results = await runAndValidateTest('errorHandling', {
        useRealAPIs: false
      });
      
      // In a robust system with proper fallbacks, the workflow might still succeed
      // but should indicate a fallback was used
      if (results.success) {
        console.log('System successfully handled the unavailable service with fallback mechanisms');
        expect(results.fallback).toBeDefined();
        expect(results.fallback.used).toBe(true);
        expect(results.fallback.message).toContain('unavailable');
      } else {
        expect(results.error).toContain('unavailable');
      }
    } finally {
      // Restore the original function
      mockServices.perplexity.isOnline = originalIsOnline;
    }
  });
  
  it('should handle invalid API keys gracefully', async () => {
    // This test is only relevant for real API testing
    // In mock mode, we'll just simulate the behavior
    
    const originalEnv = { ...process.env };
    const originalConsoleError = console.error;
    
    try {
      // Temporarily silence console errors for this test
      console.error = vi.fn();
      
      // Simulate invalid API key
      process.env.PERPLEXITY_API_KEY = 'invalid-key-for-testing';
      
      // Run a test that would use real APIs but with our invalid key
      // The system should detect this and provide a helpful error
      const results = await runAndValidateTest('errorHandling', {
        useRealAPIs: true
      });
      
      // We expect the test to fail with an authentication error
      expect(results.success).toBe(false);
      
      // Check for appropriate error messaging
      const authErrorPatterns = [
        /api key/i,
        /auth/i,
        /authentication/i,
        /credentials/i,
        /unauthorized/i,
        /invalid/i
      ];
      
      const hasAuthError = authErrorPatterns.some(pattern => 
        pattern.test(results.error || '')
      );
      
      expect(hasAuthError).toBe(true);
      
    } finally {
      // Restore environment
      process.env = originalEnv;
      console.error = originalConsoleError;
    }
  });
});