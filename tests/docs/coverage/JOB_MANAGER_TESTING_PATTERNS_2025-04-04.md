# Job Manager Testing Patterns (2025-04-04)

## Overview

This document outlines the best practices for testing the Job Manager service in our application. The Job Manager service is a critical part of our infrastructure that manages background processing tasks using Bull queues with Redis.

Due to the complex dependencies and environmental requirements, testing the Job Manager requires special care and thoughtful mocking strategies.

## Testing Challenges

The Job Manager presents several testing challenges:

1. **Redis Dependency**: The real Job Manager depends on a Redis instance
2. **External Queues**: Tests need to mock Bull queues
3. **Environmental Switching**: The service changes behavior based on environment variables
4. **Module Mocking**: Proper mocking requires careful setup due to ES module behavior

## Successful Testing Patterns

### 1. Using Auto-Mock Approach

The most reliable approach is to use Vitest's auto-mocking capabilities to mock dependencies before importing the module:

```javascript
// Import test utilities
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Auto-mock all dependencies (MUST come before any imports)
vi.mock('bull');
vi.mock('../../../services/mockJobManager.js');
vi.mock('../../../utils/logger.js');

// Import AFTER mocking
import * as jobManager from '../../../services/jobManager.js';
import * as mockJobManager from '../../../services/mockJobManager.js';
```

### 2. Setting Mock Return Values in Tests

Set specific mock return values in the tests rather than in the mock definitions:

```javascript
beforeEach(() => {
  // Setup the mocks to return test values
  mockJobManager.enqueueJob.mockResolvedValue('mock-job-123');
  mockJobManager.getJobStatus.mockResolvedValue({
    id: 'test-job-123',
    status: 'completed',
    result: { value: 'test result' }
  });
});
```

### 3. Testing in Mock Mode

Focus on testing the service in mock mode to avoid requiring Redis:

```javascript
describe('Mock Mode', () => {
  beforeEach(() => {
    // Force mock mode
    process.env.USE_MOCK_JOB_MANAGER = 'true';
  });
  
  it('should add a job to a queue', async () => {
    // Setup
    const queueName = 'test-queue';
    const jobData = { test: 'data' };
    
    // Execute
    const jobId = await jobManager.enqueueJob(queueName, jobData);
    
    // Verify
    expect(mockJobManager.enqueueJob).toHaveBeenCalledWith(
      queueName, jobData, expect.any(Object)
    );
    expect(jobId).toBe('mock-job-123');
  });
});
```

### 4. Skipping or Isolating Real Mode Tests

Either skip the real mode tests or run them in a separate suite that can be conditionally run:

```javascript
describe.skip('Real Mode', () => {
  beforeEach(() => {
    process.env.USE_MOCK_JOB_MANAGER = 'false';
  });
  
  // Tests that would need a real Redis connection
});
```

## Anti-Patterns to Avoid

1. **Manual Module Mocking**: Don't try to manually create mock objects for complex modules
2. **Using Variables in vi.mock()**: Remember that vi.mock() is hoisted to the top of the file
3. **Mixing Real and Mock Tests**: Keep tests that require real Redis separate
4. **Forgetting Environment Variables**: Always set the appropriate environment variables for testing

## Future Improvements

1. Add integration tests with a real Redis instance in CI
2. Create a mock Redis adapter specific to Job Manager testing
3. Improve error handling coverage in the tests

## References

- [Vitest Mocking Documentation](https://vitest.dev/api/vi.html#vi-mock)
- [Redis Mocking Patterns](./REDIS_TESTING_PATTERNS_2025-04-02.md)