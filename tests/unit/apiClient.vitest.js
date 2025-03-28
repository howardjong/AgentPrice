import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RobustAPIClient } from '../../utils/apiClient.js';

// Mock the CircuitBreaker to avoid dependencies
vi.mock('../../utils/monitoring.js', () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    executeRequest: vi.fn().mockImplementation((serviceKey, requestFn) => requestFn())
  }))
}));

// Mock logger for clean test output
vi.mock('../../utils/logger.js', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

/**
 * Basic tests for the RobustAPIClient
 * 
 * Note: More advanced tests with mock adapters are pending due to 
 * asynchronous execution issues. Future work will include:
 * - Testing retry logic for different HTTP status codes
 * - Testing rate limit handling
 * - Testing promise tracking
 */
describe('RobustAPIClient Basic Functionality', () => {
  let client;

  beforeEach(() => {
    client = new RobustAPIClient({
      maxRetries: 3,
      retryDelay: 100,
      timeout: 5000,
      enableMetrics: false
    });
  });

  afterEach(() => {
    client.destroy();
    vi.clearAllMocks();
  });

  it('should have retry functionality', () => {
    // Verify client configuration
    expect(client.maxRetries).toBe(3);
    expect(client.retryDelay).toBe(100);
    
    // Verify retry methods exist
    expect(typeof client.shouldRetryRequest).toBe('function');
    expect(typeof client.calculateRetryDelay).toBe('function');
  });
  
  it('should properly calculate retry delay', () => {
    // First retry should be close to base delay
    const firstDelay = client.calculateRetryDelay(1);
    expect(firstDelay).toBeGreaterThanOrEqual(100);
    expect(firstDelay).toBeLessThan(200); // Allow for jitter
    
    // Second retry should use exponential backoff (base * 2^1)
    const secondDelay = client.calculateRetryDelay(2);
    expect(secondDelay).toBeGreaterThanOrEqual(200);
    expect(secondDelay).toBeLessThan(400); // Allow for jitter
  });
  
  it('should correctly identify retryable requests', () => {
    // 429 should be retried
    expect(client.shouldRetryRequest({ response: { status: 429 }}, 0)).toBe(true);
    
    // 500 should be retried
    expect(client.shouldRetryRequest({ response: { status: 500 }}, 0)).toBe(true);
    
    // 400 should not be retried
    expect(client.shouldRetryRequest({ response: { status: 400 }}, 0)).toBe(false);
    
    // Network errors should be retried
    expect(client.shouldRetryRequest({ code: 'ECONNABORTED' }, 0)).toBe(true);
    
    // Max retries should not be retried
    expect(client.shouldRetryRequest({ response: { status: 500 }}, 3)).toBe(false);
  });
});