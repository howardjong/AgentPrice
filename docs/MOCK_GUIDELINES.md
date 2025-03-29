# Mock Utilities Guidelines

This document outlines the best practices for using mock utilities in our test suite. These utilities help create reliable, fast, and deterministic tests without external dependencies.

## Table of Contents

1. [Introduction](#introduction)
2. [Available Mock Utilities](#available-mock-utilities)
3. [HTTP Request Mocking](#http-request-mocking)
4. [Time Simulation](#time-simulation)
5. [Job Management Mocking](#job-management-mocking)
6. [Best Practices](#best-practices)
7. [Examples](#examples)

## Introduction

Proper mocking is essential for creating a reliable test suite. Our mocking strategy focuses on three key areas:

1. **External API simulation** - Using Nock to mock HTTP requests
2. **Time control** - Using performanceNowMock and Vitest's fake timers for time-based tests
3. **Asynchronous job simulation** - Using MockJobManager for job-based workflows

## Available Mock Utilities

The following mock utilities are available:

| Utility | Purpose | File Location |
|---------|---------|---------------|
| apiMocks | Mock HTTP requests to external APIs | `tests/utils/apiMocks.js` |
| performanceNowMock | Mock performance.now() for time-based tests | `tests/utils/performanceNowMock.js` |
| MockJobManager | Simulate job-based workflows | `tests/utils/mockJobManager.js` |

## HTTP Request Mocking

### Overview

We use Nock for HTTP request mocking, which intercepts outgoing HTTP requests and provides controlled responses. Our `apiMocks.js` utility provides easy-to-use functions for common mocking scenarios.

### Common Functions

- `mockPerplexityAPI(options)` - Mock Perplexity API responses
- `mockClaudeAPI(options)` - Mock Claude API responses
- `mockNetworkError(apiUrl, path, options)` - Simulate network errors
- `mockTimeout(apiUrl, path, options)` - Simulate timeouts
- `mockRateLimitError(apiType, options)` - Simulate rate limiting
- `mockFromFixture(apiType, fixturePath, options)` - Use JSON fixtures

### Example Usage

```javascript
import { mockPerplexityAPI, mockClaudeAPI, cleanupMocks } from '../utils/apiMocks';

// In your test setup
beforeEach(() => {
  // Mock a successful Perplexity API response
  mockPerplexityAPI({
    response: { /* custom response */ },
    persist: true
  });
});

afterEach(() => {
  // Clean up all mocks
  cleanupMocks();
});
```

## Time Simulation

### Overview

The `performanceNowMock` utility allows you to mock `performance.now()` for deterministic time-based tests. It works well with Vitest's built-in fake timers to provide comprehensive time control.

### Common Functions

- `installPerformanceNowMock(options)` - Install the mock
- `advanceTime(milliseconds)` - Advance the mock time
- `setTime(milliseconds)` - Set the mock time to a specific value
- `advanceTimeAndFakeTimers(milliseconds, vi)` - Advance both performance.now and Vitest timers
- `simulateLongOperation(durationMs, vi)` - Simulate a long-running operation

### Example Usage

```javascript
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import performanceNowMock from '../utils/performanceNowMock';

describe('Time-dependent tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    performanceNowMock.installPerformanceNowMock();
  });

  afterEach(() => {
    performanceNowMock.uninstallPerformanceNowMock();
    vi.useRealTimers();
  });

  it('should handle a long operation', () => {
    // ... test setup ...

    // Simulate a 30-minute operation
    performanceNowMock.simulateLongOperation(30 * 60 * 1000, vi);

    // ... test assertions ...
  });
});
```

## Job Management Mocking

### Overview

The `MockJobManager` class provides a complete simulation of job-based workflows without actual processing delays. It's useful for testing long-running asynchronous operations.

### Common Methods

- `createJob(name, data, options)` - Create a new job
- `completeJob(jobId, result)` - Complete a job
- `failJob(jobId, error)` - Fail a job
- `retryJob(jobId)` - Retry a failed job
- `on(event, handler)` - Register event handlers
- `jobFinished(jobId, timeout)` - Wait for job completion

### Example Usage

```javascript
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import MockJobManager from '../utils/mockJobManager';

describe('Job-based workflow tests', () => {
  let jobManager;

  beforeEach(() => {
    vi.useFakeTimers();
    jobManager = new MockJobManager({
      processingDelay: 50, // Fast processing for tests
      verbose: false
    });
  });

  afterEach(() => {
    jobManager.cleanup();
    vi.useRealTimers();
  });

  it('should process a research job', async () => {
    // Create a job
    const job = jobManager.createJob('research', { query: 'test query' });

    // Fast-forward time to complete the job
    vi.advanceTimersByTime(200);

    // Check job state
    expect(job.isCompleted()).toBe(true);

    // Get result
    const jobObj = jobManager.getJob(job.id);
    expect(jobObj.result).toBeDefined();
  });
});
```

## Best Practices

1. **Reset state between tests** - Always clean up mocks in `afterEach` to prevent test interdependence
2. **Use fixtures for complex responses** - Store realistic API responses in fixture files
3. **Mock at the appropriate level** - Mock external APIs, not internal functions
4. **Combine mocks when needed** - Use multiple mock utilities together for complex scenarios
5. **Test both success and failure cases** - Mock failures, timeouts, and errors
6. **Keep mocks minimal** - Only mock what's necessary for the test

## Examples

### Testing a complete workflow with multiple mocks

```javascript
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { mockPerplexityAPI, cleanupMocks } from '../utils/apiMocks';
import performanceNowMock from '../utils/performanceNowMock';
import MockJobManager from '../utils/mockJobManager';
import ResearchService from '../../services/researchService';

describe('Research workflow', () => {
  let jobManager;
  let researchService;

  beforeEach(() => {
    // Setup time mocking
    vi.useFakeTimers();
    performanceNowMock.installPerformanceNowMock();

    // Setup job manager mock
    jobManager = new MockJobManager({ processingDelay: 50 });

    // Setup API mocks
    mockPerplexityAPI({
      response: { /* mock response */ },
      persist: true
    });

    // Create service with mocks
    researchService = new ResearchService({ jobManager });
  });

  afterEach(() => {
    // Clean up all mocks
    jobManager.cleanup();
    cleanupMocks();
    performanceNowMock.uninstallPerformanceNowMock();
    vi.useRealTimers();
  });

  it('should complete a research request', async () => {
    // Start research
    const research = await researchService.startResearch('test query');

    // Simulate time passing
    vi.advanceTimersByTime(1000);

    // Verify research completed successfully
    expect(research.status).toBe('completed');
    expect(research.results).toBeDefined();
  });
});
```

### Testing rate limiting and retries

```javascript
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { mockRateLimitError, mockPerplexityAPI, cleanupMocks } from '../utils/apiMocks';
import performanceNowMock from '../utils/performanceNowMock';
import PerplexityService from '../../services/perplexityService';

describe('Rate limit handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    performanceNowMock.installPerformanceNowMock();
  });

  afterEach(() => {
    cleanupMocks();
    performanceNowMock.uninstallPerformanceNowMock();
    vi.useRealTimers();
  });

  it('should retry after rate limit error', async () => {
    // First request fails with rate limit
    mockRateLimitError('perplexity', { retryAfter: 5 });

    // Second request succeeds
    mockPerplexityAPI({
      response: { /* success response */ }
    });

    const perplexityService = new PerplexityService();
    
    // Start the request
    const responsePromise = perplexityService.query('test query');

    // Advance time past retry delay
    performanceNowMock.advanceTimeAndFakeTimers(6000, vi);

    // Get the response
    const response = await responsePromise;
    
    // Verify successful retry
    expect(response).toBeDefined();
  });
});
```