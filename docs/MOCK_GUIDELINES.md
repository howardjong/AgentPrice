# Mock Guidelines for Testing

This document provides guidelines and best practices for creating and using mocks in our testing framework.

## Table of Contents

1. [Introduction](#introduction)
2. [Available Mock Utilities](#available-mock-utilities)
3. [Best Practices](#best-practices)
4. [Examples](#examples)

## Introduction

Mocking is an essential technique for isolating components during testing. In our system, we use mocks to:

- Simulate external dependencies (like LLM API calls)
- Control timing and asynchronous behavior
- Test error conditions and edge cases
- Create deterministic test environments

## Available Mock Utilities

### Performance Now Mock

Located at `tests/utils/performanceNowMock.js`, this utility allows you to mock the `performance.now()` function for precise timing control in tests.

#### Key Features:

- **Predefined timestamp sequences** - Define exactly what values `performance.now()` will return in sequence
- **Auto-incrementing timestamps** - Automatically generate timestamps with controlled increments
- **Manual time advancement** - Control the passage of time within tests
- **Timing scenario creation** - Generate realistic timing scenarios for complex operations

#### Usage:

```javascript
// Import the mock utility
import { mockPerformanceNow } from '../../utils/performanceNowMock.js';

// Create a mock with predefined timestamps
const timestamps = [0, 100, 250];
const perfMock = mockPerformanceNow(timestamps);

// Now performance.now() will return these values in sequence
console.log(performance.now()); // 0
console.log(performance.now()); // 100
console.log(performance.now()); // 250

// Clean up after test
perfMock.restore();
```

### Mock Job Manager

Located at `tests/utils/mockJobManager.js`, this utility provides a comprehensive mock implementation of our job queue system for testing asynchronous workflows.

#### Key Features:

- **Isolated queue simulation** - Test job queues without Redis or Bull dependencies
- **Progress tracking** - Simulate and assert job progress updates
- **Job lifecycle management** - Complete, fail, or modify jobs during tests
- **Event simulation** - Dispatch and listen for job lifecycle events
- **Processor registration** - Register and test job processor functions

#### Usage:

```javascript
// Import the mock utility
import { createMockJobManager } from '../../utils/mockJobManager.js';

// Create a mock job manager
const jobManager = createMockJobManager({ autoProcess: false });

// Enqueue a job
const jobId = await jobManager.enqueueJob('test-queue', 'test-job', { data: 'value' });

// Update progress
await jobManager.updateJobProgress(jobId, 50);

// Complete the job
await jobManager.completeJob(jobId, { result: 'success' });

// Get job status
const status = await jobManager.getJobStatus(jobId);
expect(status.progress).toBe(100);
expect(status.status).toBe('completed');

// Clean up
jobManager.reset();
```

## Best Practices

1. **Always clean up mocks** - Use `afterEach` or `afterAll` hooks to restore original functions
2. **Be explicit about timing** - When testing time-sensitive code, always control the timing explicitly
3. **Mock at the appropriate level** - Mock at interfaces or boundaries, not internal implementation details
4. **Use realistic data** - Make mock responses match real API responses in structure
5. **Test error handling** - Include tests for error scenarios and timeouts
6. **Keep tests deterministic** - Avoid random values or real timing in tests
7. **Document expected behavior** - Include clear comments about what each mock is simulating

## Examples

### Testing a Time-Sensitive Function

```javascript
import { mockPerformanceNow } from '../../utils/performanceNowMock.js';

describe('Rate Limiting', () => {
  let perfMock;
  let rateLimiter;
  
  beforeEach(() => {
    // Start with specific timestamps for deterministic tests
    perfMock = mockPerformanceNow([0, 100, 200, 1100, 1200]);
    rateLimiter = new RateLimiter({ limit: 2, window: 1000 });
  });
  
  afterEach(() => {
    perfMock.restore();
  });
  
  test('should allow requests within rate limit', () => {
    expect(rateLimiter.allowRequest()).toBe(true); // Time: 0
    expect(rateLimiter.allowRequest()).toBe(true); // Time: 100
    expect(rateLimiter.allowRequest()).toBe(false); // Time: 200 (limit reached)
    expect(rateLimiter.allowRequest()).toBe(true); // Time: 1100 (window passed)
  });
});
```

### Testing Asynchronous Job Processing

```javascript
import { createMockJobManager } from '../../utils/mockJobManager.js';

describe('Research Service', () => {
  let jobManager;
  let researchService;
  
  beforeEach(() => {
    jobManager = createMockJobManager();
    researchService = new ResearchService({ jobManager });
  });
  
  afterEach(() => {
    jobManager.reset();
  });
  
  test('should process research jobs', async () => {
    // Start research task
    const taskId = await researchService.startResearch('test query');
    
    // Find the job
    const jobId = jobManager._jobs.keys().next().value;
    const job = jobManager._jobs.get(jobId);
    
    // Manually complete the job with result
    await jobManager.completeJob(jobId, { 
      result: 'Research findings',
      sources: ['source1', 'source2']
    });
    
    // Check the research task completed
    const result = await researchService.getResearchResult(taskId);
    expect(result.status).toBe('completed');
    expect(result.result).toBe('Research findings');
  });
});
```

## Important Notes

- The mock utilities are designed for testing only and should never be used in production code
- Tests using these mocks should be maintained alongside the real implementations they simulate
- When APIs change, update both the implementation and corresponding mocks

By following these guidelines, we can create reliable, maintainable tests that accurately verify our system's behavior without relying on external dependencies or non-deterministic timing.