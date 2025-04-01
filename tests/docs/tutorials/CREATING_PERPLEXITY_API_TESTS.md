# Creating Effective Perplexity API Tests: A Step-by-Step Guide

**Date:** April 1, 2025  
**Author:** Test Engineering Team  

This tutorial provides a step-by-step approach to creating effective tests for the Perplexity API service or similar LLM API clients. By following these steps, you'll be able to create comprehensive test suites that ensure reliable service operation even in edge cases.

## Prerequisites

- Basic understanding of Vitest and mocking
- Familiarity with the Perplexity service implementation
- Node.js development environment

## Step 1: Set Up the Test Environment

Start by creating a test file with proper imports and mocks:

```javascript
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';

// Mock external dependencies
vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}));

// Import dependencies (after mocking)
import axios from 'axios';
import { PerplexityService } from '../../../server/services/perplexity';
```

## Step 2: Set Up Test Fixtures

Create reusable test fixtures to support your tests:

```javascript
// Define mock responses
const mockSuccessResponse = {
  data: {
    choices: [
      {
        message: {
          content: 'This is a successful response from Perplexity AI.'
        }
      }
    ],
    citations: [
      'https://example.com/1',
      'https://example.com/2'
    ],
    model: 'sonar',
    usage: {
      prompt_tokens: 100,
      completion_tokens: 200
    }
  }
};

const mockRateLimitResponse = {
  response: {
    status: 429,
    headers: {
      'retry-after': '2'
    },
    data: {
      error: {
        message: 'Rate limit exceeded'
      }
    }
  }
};
```

## Step 3: Set Up Test Lifecycle Hooks

Implement `beforeEach` and `afterEach` to ensure tests are isolated:

```javascript
describe('Perplexity Service Tests', () => {
  let perplexityService;
  let consoleSpy;
  
  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
    
    // Spy on console methods
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {})
    };
    
    // Mock environment variables
    process.env.PERPLEXITY_API_KEY = 'test-api-key';
    
    // Set up default mock implementation
    axios.post.mockResolvedValue(mockSuccessResponse);
    
    // Create service instance
    perplexityService = new PerplexityService('test-api-key', 'sonar');
  });
  
  afterEach(() => {
    // Clean up
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });
  
  // Test cases will go here
});
```

## Step 4: Write Basic Success Path Tests

Start with tests that verify the basic success path:

```javascript
it('should successfully perform research with valid messages', async () => {
  const messages = [{ role: 'user', content: 'What is quantum computing?' }];
  
  const result = await perplexityService.performResearch(messages);
  
  // Verify API request was made
  expect(axios.post).toHaveBeenCalled();
  
  // Verify request structure
  const [url, payload, config] = axios.post.mock.calls[0];
  expect(url).toBe('https://api.perplexity.ai/chat/completions');
  expect(payload.model).toBe('sonar');
  expect(payload.messages[1].content).toContain('What is quantum computing?');
  
  // Verify response processing
  expect(result.response).toContain('This is a successful response');
  expect(result.citations).toHaveLength(2);
  expect(result.modelUsed).toBe('sonar');
});
```

## Step 5: Test Error Handling

Next, add tests for error scenarios:

```javascript
it('should handle API rate limit errors', async () => {
  // Mock a rate limit error
  axios.post.mockRejectedValueOnce(mockRateLimitResponse);
  
  // Execute and verify error is thrown
  await expect(
    perplexityService.performResearch([{ role: 'user', content: 'Test' }])
  ).rejects.toThrow(/Failed to perform research/);
  
  // Verify error logging
  expect(consoleSpy.error).toHaveBeenCalledWith(
    expect.stringContaining('Error performing research with Perplexity')
  );
});
```

## Step 6: Test Different Response Formats

Test handling of different response formats:

```javascript
it('should handle response with missing fields', async () => {
  // Mock response with missing fields
  axios.post.mockResolvedValueOnce({
    data: {
      choices: [{ message: { content: 'Response with missing fields' } }]
      // Missing model and citations
    }
  });
  
  // Execute
  const result = await perplexityService.performResearch([
    { role: 'user', content: 'Test' }
  ]);
  
  // Verify fallbacks are used
  expect(result.modelUsed).toBe('sonar'); // Should fall back to default
  expect(result.citations).toEqual([]); // Should default to empty array
  
  // Verify warning is logged
  expect(consoleSpy.warn).toHaveBeenCalledWith(
    expect.stringContaining('No citations returned')
  );
});
```

## Step 7: Test Input Validation

Test the service's input validation logic:

```javascript
it('should validate and fix message sequences', async () => {
  // Create message sequence with issues
  const messages = [
    { role: 'assistant', content: 'I should not be first' },
    { role: 'user', content: 'User message' },
    { role: 'assistant', content: 'First response' },
    { role: 'assistant', content: 'Invalid second response' } // Should be removed
  ];
  
  // Execute
  await perplexityService.performResearch(messages);
  
  // Get request payload
  const payload = axios.post.mock.calls[0][1];
  
  // Verify message sequence was fixed
  expect(payload.messages[0].role).toBe('system'); // Should start with system
  expect(payload.messages[payload.messages.length - 1].role).toBe('user'); // Should end with user
  
  // Verify warning was logged
  expect(consoleSpy.warn).toHaveBeenCalledWith(
    expect.stringContaining('Last message must be from user')
  );
});
```

## Step 8: Test Edge Cases

Add tests for edge cases:

```javascript
it('should handle empty messages array', async () => {
  // Execute with empty array
  await expect(
    perplexityService.performResearch([])
  ).rejects.toThrow(); // Should fail with empty array
});

it('should handle network timeouts', async () => {
  // Mock a timeout error
  const timeoutError = new Error('timeout of 180000ms exceeded');
  timeoutError.code = 'ECONNABORTED';
  axios.post.mockRejectedValueOnce(timeoutError);
  
  // Execute and verify error handling
  await expect(
    perplexityService.performDeepResearch('Test timeout')
  ).rejects.toThrow(/timeout/);
});
```

## Step 9: Test Configuration Options

Test different configuration options:

```javascript
it('should apply maxCitations parameter correctly', async () => {
  // Execute with custom maxCitations
  await perplexityService.performDeepResearch('Citation test', {
    maxCitations: 25
  });
  
  // Verify parameter was applied
  const payload = axios.post.mock.calls[0][1];
  expect(payload.top_k).toBe(25);
});

it('should use deep research model for performDeepResearch', async () => {
  // Execute deep research
  await perplexityService.performDeepResearch('Test');
  
  // Verify model selection
  const payload = axios.post.mock.calls[0][1];
  expect(payload.model).toBe('sonar-deep-research');
});
```

## Step 10: Test Advanced Patterns with Loops

Use loops to test multiple similar cases efficiently:

```javascript
it('should handle different HTTP error codes appropriately', async () => {
  const errorCases = [
    { status: 400, message: 'Bad request' },
    { status: 401, message: 'Unauthorized' },
    { status: 403, message: 'Forbidden' },
    { status: 429, message: 'Rate limit exceeded' },
    { status: 500, message: 'Internal server error' }
  ];
  
  for (const errorCase of errorCases) {
    // Reset error logs
    consoleSpy.error.mockClear();
    
    // Mock the error
    axios.post.mockRejectedValueOnce({
      response: {
        status: errorCase.status,
        data: {
          error: {
            message: errorCase.message
          }
        }
      }
    });
    
    // Execute and verify error handling
    await expect(
      perplexityService.performResearch([{ role: 'user', content: 'Test' }])
    ).rejects.toThrow();
    
    // Verify error logging
    expect(consoleSpy.error).toHaveBeenCalled();
  }
});
```

## Step 11: Test Model Processing

Test model information extraction and formatting:

```javascript
it('should extract and format model information', async () => {
  // Test different model variations
  const modelVariations = [
    'sonar',
    'sonar-pro',
    'llama-3.1-sonar-small-128k-online',
    'sonar-deep-research'
  ];
  
  for (const model of modelVariations) {
    // Reset mocks
    axios.post.mockClear();
    
    // Mock response with this model
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: 'Response' } }],
        model: model,
        citations: []
      }
    });
    
    // Execute
    const result = await perplexityService.performResearch([
      { role: 'user', content: 'Model test' }
    ]);
    
    // Verify model extraction
    expect(result.modelUsed).toBe(model);
    
    // Verify model info in response
    expect(result.response).toContain(`[Using Perplexity AI - Model: ${model}]`);
  }
});
```

## Step 12: Test Connection Status

Test service connection status handling:

```javascript
it('should handle missing API key', () => {
  // Create service with no API key
  const service = new PerplexityService('');
  
  // Verify connection status
  expect(service.getStatus().status).toBe('disconnected');
  expect(service.getStatus().error).toBe('API key not configured');
  
  // Verify console error was logged
  expect(consoleSpy.error).toHaveBeenCalledWith(
    expect.stringContaining('PERPLEXITY_API_KEY is not set')
  );
});
```

## Step 13: Organize Tests with Nested Describes

Organize your tests into logical groups:

```javascript
describe('Perplexity Service', () => {
  // Test setup from earlier steps...
  
  describe('Error Handling', () => {
    // Error handling tests go here
  });
  
  describe('Message Validation', () => {
    // Message validation tests go here
  });
  
  describe('Model Selection', () => {
    // Model selection tests go here
  });
  
  describe('Deep Research', () => {
    // Deep research tests go here
  });
  
  describe('Connection Status', () => {
    // Connection status tests go here
  });
});
```

## Step 14: Run and Analyze Tests

Run your tests and analyze the results:

```bash
cd tests && npx vitest run unit/services/perplexityService.vitest.js
```

Review the test results to identify any failures or areas needing improvement.

## Step 15: Check Test Coverage

Run tests with coverage to identify gaps:

```bash
cd tests && npx vitest run unit/services/perplexityService.vitest.js --coverage
```

Look for untested code paths and add tests to cover them.

## Summary of Best Practices

1. **Mock External Dependencies**: Always mock axios and other external services.

2. **Spy on Console Methods**: Monitor logging behavior.

3. **Reset Mocks Between Tests**: Ensure test isolation.

4. **Test Both Success and Error Paths**: Verify all possible outcomes.

5. **Use Parametrized Tests**: Test multiple similar cases with loops.

6. **Verify Request Structure**: Check that API requests are properly formed.

7. **Verify Response Processing**: Ensure responses are correctly processed.

8. **Test Edge Cases**: Include empty arrays, missing fields, and other edge conditions.

9. **Test Configuration Options**: Verify that options are correctly applied.

10. **Organize Tests Logically**: Use nested describe blocks to group related tests.

By following these steps and best practices, you'll create a comprehensive test suite that ensures your Perplexity service or similar API client operates reliably in all conditions.

## Example Test Snippets

See the [`perplexityService-enhanced-coverage.vitest.js`](../../../tests/unit/services/perplexityService-enhanced-coverage.vitest.js) file for complete examples of these testing patterns in action.