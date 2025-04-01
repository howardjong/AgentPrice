# Perplexity Service Testing Patterns

**Date:** April 1, 2025  
**Author:** Test Engineering Team  
**Module:** PerplexityService

## Overview

This document outlines the most effective testing patterns we've identified for testing the Perplexity API service. These patterns are designed to ensure robust test coverage, particularly for error handling, model selection, and message validation.

## 1. Error Response Testing Pattern

### Problem
The Perplexity API can return errors in various formats, and our service needs to handle all of them gracefully.

### Pattern
Test multiple error formats with a loop through different error objects:

```javascript
const errorCases = [
  { status: 400, message: 'Bad request' },
  { status: 401, message: 'Unauthorized' },
  { status: 429, message: 'Rate limit exceeded' },
  // ...more cases
];

for (const errorCase of errorCases) {
  // Reset mocks for clean testing
  consoleSpy.error.mockClear();
  
  // Mock the specific error
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
  
  // Verify logging behavior
  expect(consoleSpy.error).toHaveBeenCalled();
}
```

### Benefits
- Tests multiple error cases with minimal code duplication
- Ensures consistent error handling
- Verifies error logging behavior

## 2. Model Selection and Fallback Pattern

### Problem
The Perplexity service needs to handle model selection logic, including fallbacks when the API doesn't return expected model information.

### Pattern
Test model selection with different API response patterns:

```javascript
// Test model name extraction with various formats
const modelNameVariations = [
  { response: 'sonar', expected: 'sonar' },
  { response: 'sonar-pro', expected: 'sonar-pro' },
  { response: 'llama-3.1-sonar-small-128k-online', expected: 'llama-3.1-sonar-small-128k-online' },
  // No model in response (should use fallback)
  { response: null, expected: 'sonar' }
];

for (const variation of modelNameVariations) {
  // Mock response with this model (or missing model)
  axios.post.mockResolvedValueOnce({
    data: {
      choices: [
        {
          message: {
            content: 'Model test response'
          }
        }
      ],
      model: variation.response, // May be null
      citations: []
    }
  });
  
  // Execute research
  const result = await perplexityService.performResearch([
    { role: 'user', content: 'Model test' }
  ]);
  
  // Verify model handling
  expect(result.modelUsed).toBe(variation.expected);
}
```

### Benefits
- Tests model selection logic comprehensively
- Verifies fallback behavior when model information is missing
- Checks that model information is correctly included in responses

## 3. Message Format Validation Pattern

### Problem
The Perplexity API requires messages in a specific format, and our service needs to validate and fix message formats.

### Pattern
Test message validation with various incorrect formats:

```javascript
// Test cases with different message format issues
const messageCases = [
  {
    description: 'Messages ending with assistant role',
    messages: [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'Response' },
      { role: 'assistant', content: 'Another response' } // Should be removed
    ],
    expectedRoles: ['system', 'user', 'assistant', 'user'] // Expected after validation
  },
  {
    description: 'Empty messages array',
    messages: [],
    expectError: true
  },
  {
    description: 'Only system message',
    messages: [{ role: 'system', content: 'System message' }],
    expectsValidation: true
  }
  // ...more cases
];

for (const testCase of messageCases) {
  if (testCase.expectError) {
    // Should throw an error
    await expect(
      perplexityService.performResearch(testCase.messages)
    ).rejects.toThrow();
  } else {
    // Should validate successfully
    await perplexityService.performResearch(testCase.messages);
    
    // Get payload sent to API
    const payload = axios.post.mock.calls[0][1];
    
    // Check message structure if specified
    if (testCase.expectedRoles) {
      const actualRoles = payload.messages.map(m => m.role);
      expect(actualRoles).toEqual(testCase.expectedRoles);
    }
  }
}
```

### Benefits
- Tests various message format issues
- Verifies that invalid formats are corrected or rejected
- Ensures consistent validation behavior

## 4. Response Processing Pattern

### Problem
The Perplexity service needs to process API responses to extract information like citations and model details.

### Pattern
Test response processing with various response formats:

```javascript
// Test with different response formats
const responseCases = [
  {
    description: 'Complete response',
    response: {
      data: {
        choices: [{ message: { content: 'Response content' } }],
        model: 'sonar',
        citations: ['https://example.com/1', 'https://example.com/2']
      }
    },
    expectedCitations: 2
  },
  {
    description: 'Response without citations',
    response: {
      data: {
        choices: [{ message: { content: 'Response content' } }],
        model: 'sonar'
        // No citations field
      }
    },
    expectedCitations: 0,
    expectWarning: true
  }
  // ...more cases
];

for (const testCase of responseCases) {
  // Reset console spies
  consoleSpy.warn.mockClear();
  
  // Mock the response
  axios.post.mockResolvedValueOnce(testCase.response);
  
  // Execute research
  const result = await perplexityService.performResearch([
    { role: 'user', content: 'Test query' }
  ]);
  
  // Verify citations handling
  expect(result.citations.length).toBe(testCase.expectedCitations);
  
  // Check for expected warnings
  if (testCase.expectWarning) {
    expect(consoleSpy.warn).toHaveBeenCalled();
  } else {
    expect(consoleSpy.warn).not.toHaveBeenCalled();
  }
}
```

### Benefits
- Tests handling of different response formats
- Verifies extraction of citations and model information
- Checks warning behavior for missing information

## 5. Deep Research Options Testing Pattern

### Problem
The deep research functionality has multiple configuration options that need to be tested.

### Pattern
Test different options combinations:

```javascript
// Test various options combinations
const optionsCases = [
  {
    description: 'Default options',
    options: {},
    expectedModel: 'sonar-deep-research',
    expectedContext: false
  },
  {
    description: 'With context and max citations',
    options: {
      context: 'Research context',
      maxCitations: 25
    },
    expectedModel: 'sonar-deep-research',
    expectedContext: true,
    expectedMaxCitations: 25
  }
  // ...more cases
];

for (const testCase of optionsCases) {
  // Execute with options
  await perplexityService.performDeepResearch('Test query', testCase.options);
  
  // Get payload
  const payload = axios.post.mock.calls[0][1];
  
  // Verify options were applied correctly
  expect(payload.model).toBe(testCase.expectedModel);
  
  if (testCase.expectedContext) {
    expect(payload.messages[1].content).toContain(testCase.options.context);
  }
  
  if (testCase.expectedMaxCitations) {
    expect(payload.top_k).toBe(testCase.expectedMaxCitations);
  }
}
```

### Benefits
- Tests various option combinations
- Verifies that options are correctly applied to API requests
- Ensures consistent behavior with different configurations

## 6. Connection Status Testing Pattern

### Problem
The Perplexity service needs to handle connection status correctly, especially when API keys are missing.

### Pattern
Test different connection states:

```javascript
// Test with different API key states
describe('Connection Status', () => {
  it('should initialize properly with valid API key', () => {
    const service = new PerplexityService('valid-api-key');
    expect(service.getStatus().status).toBe('connected');
  });
  
  it('should indicate disconnected status with empty API key', () => {
    const service = new PerplexityService('');
    expect(service.getStatus().status).toBe('disconnected');
    expect(service.getStatus().error).toBe('API key not configured');
  });
  
  it('should throw error when attempting to use disconnected service', async () => {
    const service = new PerplexityService('');
    await expect(
      service.performResearch([{ role: 'user', content: 'Test' }])
    ).rejects.toThrow('Perplexity service is not connected');
  });
});
```

### Benefits
- Tests connection status logic
- Verifies error handling when service is not connected
- Ensures proper status reporting

## Best Practices Summary

1. **Use loops for similar test cases** to reduce code duplication and increase coverage.

2. **Mock console methods** to verify logging behavior.

3. **Test boundary conditions** like empty arrays, missing fields, and unexpected formats.

4. **Verify both success and error paths** for all service methods.

5. **Test option combinations** to ensure they're correctly applied.

6. **Check side effects** like logging and error reporting.

7. **Verify that returned objects match expected formats**, including model information and citations.

By following these patterns, we can maintain high test coverage and ensure the Perplexity service remains robust and reliable.

---

**Note:** These patterns have been implemented in the enhanced test suite, improving coverage from approximately 65% to 85% and ensuring more robust error handling.