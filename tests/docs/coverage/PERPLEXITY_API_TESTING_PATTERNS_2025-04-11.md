# Perplexity API Testing Patterns

**Date: 2025-04-11**

This document outlines recommended patterns for testing API services like Perplexity in our system. These patterns have been successfully implemented in `perplexity-basic.vitest.js` and can be applied to other similar services.

## Basic Service Test Setup

### 1. Mock Key Dependencies

For effective isolation in API service tests, mock all key dependencies:

```javascript
// Mock all the dependencies
vi.mock('axios');
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));
vi.mock('../../../utils/costTracker.js', () => ({
  trackAPIUsage: vi.fn()
}));
vi.mock('../../../utils/circuitBreaker.js', () => {
  return {
    default: class CircuitBreaker {
      constructor() {}
      execute(fn) { return fn(); }
      recordSuccess() {}
      recordFailure() {}
      isOpen() { return false; }
      getState() { return 'CLOSED'; }
    }
  };
});
vi.mock('../../../utils/apiClient.js', () => {
  const RobustAPIClient = class {
    constructor() {}
    execute(fn) { return fn(); }
  };
  
  return {
    RobustAPIClient: RobustAPIClient,
    default: RobustAPIClient
  };
});
```

### 2. Standard Test Structure

Organize tests into logical functional groups:

```javascript
describe('Perplexity Service Basic Error Handling', () => {
  // Setup common test data
  const mockSuccessResponse = {
    data: {
      choices: [{ message: { content: 'API response content' } }],
      usage: { total_tokens: 100 }
    }
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    process.env.PERPLEXITY_API_KEY = 'test-api-key';
    
    // Default success response
    axios.post.mockResolvedValue(mockSuccessResponse);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('HTTP Error Handling', () => {
    // HTTP error tests
  });

  describe('Input Validation', () => {
    // Input validation tests
  });

  // Additional test groups
});
```

## Error Handling Test Patterns

### 1. HTTP Status Code Testing

Test specific HTTP error codes with appropriate context:

```javascript
it('should handle 429 rate limit errors with specific message', async () => {
  // Mock a 429 rate limit response
  axios.post.mockRejectedValue({
    response: {
      status: 429,
      data: { error: 'Too many requests' }
    }
  });

  // Attempt a query
  await expect(
    processWebQuery('What is quantum computing?')
  ).rejects.toThrow('Perplexity API rate limit exceeded');

  // Should log the error
  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Error processing web query'),
    expect.objectContaining({ statusCode: 429 })
  );
});
```

### 2. Network Error Testing

Test scenarios with no HTTP status code, like network failures:

```javascript
it('should handle network errors without status code', async () => {
  // Mock a network error without response
  axios.post.mockRejectedValue(new Error('Network error'));

  // Attempt a query
  await expect(
    processWebQuery('What is quantum computing?')
  ).rejects.toThrow('Perplexity web query failed');

  // Should log the error
  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Error processing web query'),
    expect.objectContaining({
      error: 'Network error',
      statusCode: 'unknown'
    })
  );
});
```

## Input Validation Testing

### 1. Test Invalid Inputs

Test various invalid input formats and confirm proper errors:

```javascript
it('should validate conversation messages format', async () => {
  // We need to mock axios for conversation to throw error
  axios.post.mockRejectedValue(new Error('Should not be called with empty array'));
  
  // Test with empty messages array - empty conversation should throw
  await expect(
    processConversation([])
  ).rejects.toThrow('Perplexity conversation failed');
});

it('should validate user messages must alternate', async () => {
  // Test with consecutive user messages
  await expect(
    processConversation([
      { role: 'user', content: 'First question' },
      { role: 'user', content: 'Second question' }
    ])
  ).rejects.toThrow('Messages must alternate between user and assistant roles');
});
```

## Multi-Step API Call Testing

### 1. Sequence Mocking Pattern

For testing functions that make multiple API calls in sequence:

```javascript
it('should conduct deep research with follow-up questions', async () => {
  // Reset the counter before the test to fix the callCount issue
  axios.post.mockClear();
  
  // Mock a sequence of API calls for the deep research process
  const initialResponse = { ...mockSuccessResponse };
  initialResponse.data.choices[0].message.content = 'Initial answer';
  
  const followUpResponse = { ...mockSuccessResponse };
  followUpResponse.data.choices[0].message.content = '1. First follow-up?';
  
  const synthesisResponse = { ...mockSuccessResponse };
  synthesisResponse.data.choices[0].message.content = 'Final synthesized research';
  
  // Setup the sequence of API calls - use only as many as needed by the implementation
  axios.post.mockImplementationOnce(() => Promise.resolve(initialResponse))
         .mockImplementationOnce(() => Promise.resolve(followUpResponse))
         .mockImplementationOnce(() => Promise.resolve(synthesisResponse));
  
  // Execute deep research
  const result = await conductDeepResearch('What is quantum computing?');
  
  // Verify result
  expect(result).toEqual(expect.objectContaining({
    content: 'Final synthesized research',
    requestId: expect.any(String)
  }));
  
  // Verify the correct number of API calls were made
  expect(axios.post).toHaveBeenCalledTimes(3);
});
```

### 2. Error Handling in Multi-Step Processes

Test error handling at different steps in the sequence:

```javascript
it('should handle errors in deep research process', async () => {
  // Mock error in the first call
  axios.post.mockRejectedValueOnce(new Error('API error'));
  
  // Execute deep research - should fail
  await expect(
    conductDeepResearch('What is quantum computing?')
  ).rejects.toThrow('Deep research failed');
  
  // Should log the error
  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Error conducting deep research'),
    expect.any(Object)
  );
});
```

## Service Status Testing

Test service health reporting with different configurations:

```javascript
it('should report status details', () => {
  // Ensure API key is set
  process.env.PERPLEXITY_API_KEY = 'test-api-key';
  
  const health = getHealthStatus();
  
  // Just check that we get a valid object back
  expect(health).toBeDefined();
  expect(typeof health).toBe('object');
  expect(health.service).toBe('perplexity');
  
  if (health.status) {
    expect(typeof health.status).toBe('string');
  }
  
  // Delete API key to test missing key scenario
  delete process.env.PERPLEXITY_API_KEY;
  
  const healthNoKey = getHealthStatus();
  expect(healthNoKey).toBeDefined();
  
  // Restore API key for other tests
  process.env.PERPLEXITY_API_KEY = 'test-api-key';
});
```

## Success Path Testing

Verify correct handling of successful API responses:

```javascript
it('should return formatted results for successful web queries', async () => {
  // Setup a more detailed success response
  const detailedResponse = {
    data: {
      choices: [
        {
          message: { 
            content: 'Quantum computing is a type of computing that uses quantum mechanics.' 
          }
        }
      ],
      citations: ['https://example.com/quantum'],
      model: 'test-model',
      usage: {
        prompt_tokens: 50,
        completion_tokens: 100, 
        total_tokens: 150
      }
    }
  };
  
  axios.post.mockResolvedValue(detailedResponse);

  // Make a successful request
  const result = await processWebQuery('What is quantum computing?');

  // Verify the result contains the expected data
  expect(result).toEqual(expect.objectContaining({
    content: 'Quantum computing is a type of computing that uses quantum mechanics.',
    citations: ['https://example.com/quantum'],
    model: 'test-model',
    usage: detailedResponse.data.usage,
    requestId: expect.any(String)
  }));

  // Should track API usage
  expect(costTracker.trackAPIUsage).toHaveBeenCalledWith(
    expect.objectContaining({
      service: 'perplexity',
      tokensUsed: 150,
      isWebConnected: true
    })
  );
});
```

## Best Practices

1. **Reset Mocks Between Tests**
   - Always reset mocks in `beforeEach` and `afterEach` to prevent cross-test contamination

2. **Use Specific Error Types**
   - Test for specific error messages to confirm the right type of error is being thrown

3. **Verify Logging**
   - Check that appropriate errors are logged with correct context information

4. **Test Error and Success Paths**
   - Test both success and failure scenarios comprehensively

5. **Isolate External Dependencies**
   - Mock all external services and dependencies for reliable testing

6. **Test Edge Cases**
   - Include edge cases like empty inputs, missing API keys, etc.

7. **Reset Call Counters for Sequence Testing**
   - Clear mock call count tracking before tests that verify the number of function calls

## Applying These Patterns

These patterns can be applied to other API services in our system:

1. **Anthropic API Service**
   - Apply the same error handling testing patterns
   - Test with Anthropic-specific API responses
   - Verify model selection logic

2. **OpenAI API Service**
   - Test token counting and limit handling
   - Verify model selection and fallback behavior
   - Test specific OpenAI error types

3. **Custom API Services**
   - Adapt the patterns to service-specific functionality
   - Test error handling specific to the service
   - Verify appropriate response processing