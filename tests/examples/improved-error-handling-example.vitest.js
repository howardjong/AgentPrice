/**
 * Example of Improved Error Handling in Tests
 * 
 * This file demonstrates how to refactor tests to use better error handling patterns.
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { 
  assertRejects, 
  createErrorTrackingSpy,
  createFailingFunction,
  createEventuallySuccessfulFunction,
  createMockResponseFactory
} from '../utils/error-handling-utils.js';

// Create mock response factory for API responses
const mockResponses = createMockResponseFactory({
  status: 'success',
  data: { result: 'Sample result' }
});

// Mock the service module
vi.mock('../../services/exampleService.js', () => ({
  default: {
    performQuery: vi.fn(),
    processBatch: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      service: "Example Service",
      healthy: true,
      totalCalls: 10
    })
  }
}));

// Mock the logger
vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Import the mocked modules
import exampleService from '../../services/exampleService.js';
import logger from '../../utils/logger.js';

describe('Example Service with Improved Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Error Handling', () => {
    it('should handle simple API errors with expect().rejects pattern', async () => {
      // Setup - service throws an error
      exampleService.performQuery.mockRejectedValueOnce(new Error('API Error'));
      
      // IMPROVED: Using the expect().rejects pattern instead of try/catch
      await expect(exampleService.performQuery('test query'))
        .rejects.toThrow('API Error');
      
      // Verify the service was called with correct parameters
      expect(exampleService.performQuery).toHaveBeenCalledWith('test query');
    });
    
    it('should handle specific error types with proper property checks', async () => {
      // Setup - create a specific error type
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      rateLimitError.retryAfter = 30;
      rateLimitError.statusCode = 429;
      
      exampleService.performQuery.mockRejectedValueOnce(rateLimitError);
      
      // IMPROVED: Check full error object, not just message
      await expect(exampleService.performQuery('test query'))
        .rejects.toMatchObject({
          message: 'Rate limit exceeded',
          name: 'RateLimitError',
          retryAfter: 30,
          statusCode: 429
        });
    });
    
    it('should use assertRejects helper for cleaner assertions', async () => {
      // Setup - service throws an error
      exampleService.performQuery.mockRejectedValueOnce(new Error('Validation failed'));
      
      // IMPROVED: Using the assertRejects helper for cleaner code
      const error = await assertRejects(
        exampleService.performQuery('invalid input'),
        { message: 'Validation failed' }
      );
      
      // Additional assertions on the error if needed
      expect(error.stack).toBeDefined();
    });
  });
  
  describe('Complex Error Scenarios', () => {
    it('should test retry logic with eventually successful function', async () => {
      // IMPROVED: Setup a function that fails twice then succeeds
      exampleService.performQuery.mockImplementation(
        createEventuallySuccessfulFunction(
          () => ({ result: 'success' }),
          2,
          new Error('Temporary failure')
        )
      );
      
      // First call - should fail
      await expect(exampleService.performQuery('test'))
        .rejects.toThrow('Temporary failure');
      
      // Second call - should still fail
      await expect(exampleService.performQuery('test'))
        .rejects.toThrow('Temporary failure');
      
      // Third call - should succeed
      const result = await exampleService.performQuery('test');
      expect(result).toEqual({ result: 'success' });
    });
    
    it('should track error handling with spy', async () => {
      // IMPROVED: Create error tracking spy
      const errorSpy = createErrorTrackingSpy();
      
      // Setup failing function
      exampleService.processBatch.mockImplementation(async (items) => {
        const results = [];
        
        for (const item of items) {
          try {
            if (item.invalid) {
              throw new Error(`Invalid item: ${item.id}`);
            }
            results.push({ id: item.id, processed: true });
          } catch (error) {
            errorSpy(error);
            results.push({ id: item.id, error: error.message });
          }
        }
        
        return results;
      });
      
      // Test with mix of valid and invalid items
      const items = [
        { id: 1, data: 'valid' },
        { id: 2, invalid: true },
        { id: 3, data: 'valid' }
      ];
      
      const results = await exampleService.processBatch(items);
      
      // Verify error handling
      expect(errorSpy.errorCount).toBe(1);
      expect(errorSpy.errors[0].message).toBe('Invalid item: 2');
      
      // Verify overall processing worked
      expect(results).toEqual([
        { id: 1, processed: true },
        { id: 2, error: 'Invalid item: 2' },
        { id: 3, processed: true }
      ]);
    });
    
    it('should handle multiple response types with mock response factory', async () => {
      // Success response
      exampleService.performQuery
        .mockResolvedValueOnce(mockResponses.success())
        // Rate limit error
        .mockResolvedValueOnce(mockResponses.withError(
          'RATE_LIMIT_EXCEEDED', 
          'Too many requests', 
          { retryAfter: 30 }
        ))
        // Network error
        .mockRejectedValueOnce(mockResponses.networkError());
      
      // Test success case
      const successResult = await exampleService.performQuery('query1');
      expect(successResult.status).toBe('success');
      
      // Test error response (not exception)
      const errorResult = await exampleService.performQuery('query2');
      expect(errorResult.status).toBe('error');
      expect(errorResult.error.code).toBe('RATE_LIMIT_EXCEEDED');
      
      // Test rejected promise
      await expect(exampleService.performQuery('query3'))
        .rejects.toMatchObject({
          name: 'NetworkError',
          message: 'Network error'
        });
    });
  });
  
  describe('Error Propagation Tests', () => {
    it('should test how errors flow through the system', async () => {
      // Setup logger spy to verify error was properly logged
      const errorLogger = createErrorTrackingSpy(logger.error);
      logger.error.mockImplementation(errorLogger);
      
      // Create database error
      const dbError = new Error('Database connection failed');
      dbError.code = 'ECONNREFUSED';
      
      // Mock service to throw then check error handling
      exampleService.performQuery.mockRejectedValueOnce(dbError);
      
      // Define our service wrapper with error handling
      async function serviceWithErrorHandling(query) {
        try {
          return await exampleService.performQuery(query);
        } catch (error) {
          logger.error('Operation failed', error);
          throw new Error(`Query failed: ${error.message}`);
        }
      }
      
      // Test the error flow
      await expect(serviceWithErrorHandling('test query'))
        .rejects.toThrow('Query failed: Database connection failed');
      
      // Verify error was logged properly
      expect(errorLogger.errorCount).toBe(1);
      expect(errorLogger.errors[0].code).toBe('ECONNREFUSED');
    });
  });
});