/**
 * Test-specific implementation of CircuitBreaker
 * 
 * This implementation is designed to be used in tests instead of the real CircuitBreaker.
 * It provides a simplified API that matches what our tests expect, while avoiding
 * the complexity of the full CircuitBreaker implementation.
 */

import { vi } from 'vitest';

class TestCircuitBreaker {
  constructor(options = {}) {
    this.options = {
      failureThreshold: 5,
      resetTimeout: 30000,
      successThreshold: 2,
      name: 'TestCircuitBreaker',
      ...options
    };
    
    this.state = 'CLOSED'; // Always start closed for tests
    this.failureCount = 0;
    this.successCount = 0;
    
    // Create spies for all methods
    this.execute = vi.fn().mockImplementation(async (fn) => {
      try {
        // Execute the function but enhance its response with mock properties if needed
        const result = await fn();
        
        // If this appears to be a mock for an AI API without usage info, add it
        if (result && typeof result === 'object') {
          // For Anthropic/Claude API
          if (result.content && result.content[0] && !result.usage) {
            result.usage = {
              input_tokens: 500,
              output_tokens: 800,
              total_tokens: 1300
            };
          }
          
          // For OpenAI API
          if (result.choices && !result.usage) {
            result.usage = {
              prompt_tokens: 400,
              completion_tokens: 600,
              total_tokens: 1000
            };
          }
        }
        
        return result;
      } catch (err) {
        console.error('Error in TestCircuitBreaker execute:', err);
        throw err;
      }
    });
    
    this.recordSuccess = vi.fn();
    this.recordFailure = vi.fn();
    this.isOpen = vi.fn().mockReturnValue(false);
    this.reset = vi.fn();
  }
  
  getState() {
    return this.state;
  }
}

export default TestCircuitBreaker;