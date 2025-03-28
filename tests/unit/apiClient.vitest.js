import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
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

/**
 * Advanced tests with axios-mock-adapter for testing HTTP retry functionality
 */
describe('RobustAPIClient Advanced HTTP Functionality', () => {
  let mock;
  let client;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    client = new RobustAPIClient({
      maxRetries: 3,
      retryDelay: 50, // Keep delays short for tests
      timeout: 1000,
      enableMetrics: false
    });
  });

  afterEach(() => {
    mock.reset();
    mock.restore();
    client.destroy();
    vi.clearAllMocks();
  });

  // Set longer timeout for these tests
  it('should retry on 429 status code', async () => {
    // Will return 429 on first call, then 200 on second call
    mock.onGet('/test').replyOnce(429).onGet('/test').reply(200, { data: 'success' });

    const response = await client.request({
      method: 'GET',
      url: '/test'
    });

    expect(response.data).toEqual({ data: 'success' });
    expect(mock.history.get.length).toBe(2);
  }, 10000);

  it('should retry on 500 server errors', async () => {
    // Will return 500 on first call, then 200 on second call
    mock.onGet('/test-server-error').replyOnce(500).onGet('/test-server-error').reply(200, { data: 'server recovered' });

    const response = await client.request({
      method: 'GET',
      url: '/test-server-error'
    });

    expect(response.data).toEqual({ data: 'server recovered' });
    expect(mock.history.get.length).toBe(2);
  }, 10000);

  it('should respect retry-after header for rate limits', async () => {
    // Set up headers with retry-after to test that logic
    const headers = { 'retry-after': '1' }; // 1 second delay
    mock.onGet('/test-retry-after')
      .replyOnce(429, 'Rate limited', headers)
      .onGet('/test-retry-after')
      .reply(200, { data: 'respected rate limit' });

    const startTime = Date.now();
    const response = await client.request({
      method: 'GET',
      url: '/test-retry-after'
    });
    const duration = Date.now() - startTime;

    expect(response.data).toEqual({ data: 'respected rate limit' });
    expect(mock.history.get.length).toBe(2);
    // Should be at least 1 second delay due to retry-after header
    expect(duration).toBeGreaterThanOrEqual(1000);
  }, 10000);

  it('should exhaust retries and eventually fail', async () => {
    // All 3 attempts will return 500
    mock.onGet('/test-exhausted').reply(500, 'Server error');

    await expect(client.request({
      method: 'GET',
      url: '/test-exhausted'
    })).rejects.toThrow();
    
    // Should have attempted 1 + maxRetries (3) = 4 requests
    expect(mock.history.get.length).toBe(4);
  }, 10000);

  it('should not retry on 4xx client errors (except 429)', async () => {
    mock.onGet('/test-client-error').reply(400, 'Bad request');

    await expect(client.request({
      method: 'GET',
      url: '/test-client-error'
    })).rejects.toThrow();
    
    // Should not retry on 400
    expect(mock.history.get.length).toBe(1);
  }, 10000);
});