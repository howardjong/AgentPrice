import { describe, it, expect } from 'vitest';
import { RobustAPIClient } from '../../utils/apiClient.js';

// Simple test for RobustAPIClient
describe('RobustAPIClient Basic Functionality', () => {
  it('should have retry functionality', () => {
    const client = new RobustAPIClient({
      maxRetries: 3,
      retryDelay: 100,
      timeout: 5000
    });
    
    // Verify client configuration
    expect(client.maxRetries).toBe(3);
    expect(client.retryDelay).toBe(100);
    expect(client.timeout).toBe(5000);
    
    // Verify retry methods exist
    expect(typeof client.shouldRetryRequest).toBe('function');
    expect(typeof client.calculateRetryDelay).toBe('function');
    
    // Clean up
    client.destroy();
  });
  
  it('should properly calculate retry delay', () => {
    const client = new RobustAPIClient({
      retryDelay: 100
    });
    
    // First retry should be close to base delay
    const firstDelay = client.calculateRetryDelay(1);
    expect(firstDelay).toBeGreaterThanOrEqual(100);
    expect(firstDelay).toBeLessThan(200); // Allow for jitter
    
    // Second retry should use exponential backoff (base * 2^1)
    const secondDelay = client.calculateRetryDelay(2);
    expect(secondDelay).toBeGreaterThanOrEqual(200);
    expect(secondDelay).toBeLessThan(400); // Allow for jitter
    
    // Clean up
    client.destroy();
  });
});