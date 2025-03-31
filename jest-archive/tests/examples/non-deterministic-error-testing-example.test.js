/**
 * Example test file demonstrating how to use the non-deterministic error testing library
 * 
 * This test demonstrates various techniques for testing code that deals with
 * non-deterministic errors and behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NonDeterministicErrorSimulator } from '../utils/non-deterministic-error-simulator';
import { expectEventualSuccess, expectConsistentFailure, createScheduledFailure, trackAttempts, withRetry } from '../utils/non-deterministic-test-helpers';
import { createTestEnvironment } from '../utils/non-deterministic-test-environment';

// Mock service client that we want to test
class ServiceClient {
  constructor(service) {
    this.service = service || {
      getData: async (id) => ({ id, value: 'test' }),
      updateData: async (id, data) => ({ id, ...data, updated: true })
    };
    this.retryCount = 3;
  }
  
  async fetchData(id) {
    // Example of retry logic with exponential backoff
    let attempt = 0;
    
    while (attempt < this.retryCount) {
      try {
        return await this.service.getData(id);
      } catch (error) {
        attempt++;
        
        if (attempt >= this.retryCount) {
          throw error;
        }
        
        const delay = 100 * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  async updateData(id, data) {
    try {
      return await this.service.updateData(id, data);
    } catch (error) {
      // Forward rate limiting errors
      if (error.status === 429) {
        throw error;
      }
      
      // Handle network errors by returning a partial success
      if (error.code && ['ECONNRESET', 'ETIMEDOUT'].includes(error.code)) {
        return { 
          id, 
          partialSuccess: true, 
          error: error.message, 
          needsVerification: true 
        };
      }
      
      throw error;
    }
  }
}

describe('Non-Deterministic Error Testing Examples', () => {
  describe('Error Simulator', () => {
    it('should handle network flakiness', async () => {
      // Create a function that simulates network flakiness
      const fetchWithFlakiness = async (id) => {
        return NonDeterministicErrorSimulator.simulateNetworkFlakiness(
          async () => {
            // Actual operation
            return { id, value: 'test data' };
          },
          { failureRate: 0.7, retries: 5 }
        );
      };
      
      const result = await fetchWithFlakiness('test-id');
      expect(result).toEqual({ id: 'test-id', value: 'test data' });
    });
    
    it('should handle race conditions', async () => {
      // Create an array to track execution order
      const executionOrder = [];
      
      // Define a set of operations that will execute in a random order
      const operations = [
        async () => { 
          executionOrder.push(1);
          return 'first'; 
        },
        async () => { 
          executionOrder.push(2);
          return 'second'; 
        },
        async () => { 
          executionOrder.push(3);
          return 'third'; 
        }
      ];
      
      const results = await NonDeterministicErrorSimulator.simulateRaceCondition(
        operations,
        { minDelay: 10, maxDelay: 50 }
      );
      
      // Verify all operations completed
      expect(results).toHaveLength(3);
      expect(results).toContain('first');
      expect(results).toContain('second');
      expect(results).toContain('third');
      
      // The execution order should be recorded
      expect(executionOrder).toHaveLength(3);
    });
    
    it('should handle resource exhaustion', async () => {
      // This test might fail approximately 30% of the time
      try {
        const result = await NonDeterministicErrorSimulator.simulateResourceExhaustion(
          async () => {
            return { success: true, data: 'test data' };
          },
          'database connection',
          { probability: 0.3 }
        );
        
        // If it succeeds, verify the data
        expect(result).toEqual({ success: true, data: 'test data' });
      } catch (error) {
        // If it fails, verify the error
        expect(error.message).toContain('database connection resource exhausted');
        expect(error.code).toBe('RESOURCE_EXHAUSTED');
      }
    });
    
    it('should handle partial failures', async () => {
      // Define a set of operations where some might fail
      const operations = [
        async () => 'first',
        async () => 'second',
        async () => 'third',
        async () => 'fourth',
        async () => 'fifth'
      ];
      
      const { results, errors } = await NonDeterministicErrorSimulator.simulatePartialFailure(
        operations,
        { failureRate: 0.4 }
      );
      
      // Verify some operations completed and some failed
      expect(results.length + errors.length).toBe(5);
    });
  });
  
  describe('Test Helpers', () => {
    it('should eventually succeed', async () => {
      // Create a function that fails the first few times
      let attempts = 0;
      const flakyOperation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Failed attempt ${attempts}`);
        }
        return 'success';
      };
      
      const result = await expectEventualSuccess(flakyOperation, { maxAttempts: 5 });
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });
    
    it('should verify consistent failure', async () => {
      // Create a function that always fails in a specific way
      const failingOperation = async () => {
        const error = new Error('Authentication failed');
        error.status = 401;
        throw error;
      };
      
      // Verify it consistently fails with the expected error
      await expectConsistentFailure(
        failingOperation,
        { status: 401 },
        { attempts: 3 }
      );
    });
    
    it('should track attempts', async () => {
      // Create a tracked function
      let count = 0;
      const trackedOperation = trackAttempts(async () => {
        count++;
        if (count < 3) {
          throw new Error(`Failed attempt ${count}`);
        }
        return 'success';
      });
      
      // First two calls will fail
      try { await trackedOperation(); } catch (e) {}
      try { await trackedOperation(); } catch (e) {}
      
      // Third call should succeed
      const result = await trackedOperation();
      expect(result).toBe('success');
      
      // Check attempt history
      expect(trackedOperation.getAttemptCount()).toBe(3);
      expect(trackedOperation.getFailed()).toHaveLength(2);
      expect(trackedOperation.getSuccessful()).toHaveLength(1);
    });
    
    it('should support exponential backoff retry strategy', async () => {
      let attempts = 0;
      const startTime = Date.now();
      
      try {
        await withRetry(
          async () => {
            attempts++;
            throw new Error('Always fails');
          },
          {
            strategy: 'exponential',
            maxAttempts: 4,
            baseDelay: 10 // Use small delay for tests
          }
        );
      } catch (error) {
        // Expected to fail after all retries
      }
      
      const totalTime = Date.now() - startTime;
      expect(attempts).toBe(4);
      
      // Total time should be at least the sum of exponential delays (10 + 20 + 40 = 70ms)
      // but will include some execution time and jitter
      expect(totalTime).toBeGreaterThan(50);
    });
  });
  
  describe('Test Environment', () => {
    let { flakyService } = createTestEnvironment();
    let client;
    
    beforeEach(() => {
      flakyService.reset();
      client = new ServiceClient(flakyService);
    });
    
    it('should handle network failures', async () => {
      // Set up the environment to fail network requests
      flakyService.setErrorProbability(0.8, 'connection');
      
      // Client should retry and eventually succeed
      const result = await client.fetchData('test-id');
      expect(result).toBeDefined();
      expect(result.id).toBe('test-id');
      
      // Check the state to verify retries happened
      const state = flakyService.getState();
      expect(state.callCount).toBeGreaterThan(1);
    });
    
    it('should handle rate limiting correctly', async () => {
      // Trigger rate limiting for the first call
      flakyService.triggerRateLimit();
      
      // Client's update should fail with rate limit error
      await expect(client.updateData('test-id', { value: 'new value' }))
        .rejects
        .toHaveProperty('status', 429);
      
      // Reset rate limit and try again
      flakyService.resetRateLimit();
      const result = await client.updateData('test-id', { value: 'new value' });
      
      // Should succeed now
      expect(result.id).toBe('test-id');
      expect(result.value).toBe('new value');
      expect(result.updated).toBe(true);
    });
    
    it('should handle network errors gracefully', async () => {
      // Set up service for network error simulation
      flakyService.disableNetwork();
      
      // The client's partial success logic should handle this
      const result = await client.updateData('test-id', { value: 'new value' });
      
      // Should return a partial success
      expect(result.partialSuccess).toBe(true);
      expect(result.needsVerification).toBe(true);
    });
  });
});