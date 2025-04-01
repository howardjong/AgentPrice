# axios-mock-adapter Testing Patterns

## Sequence Response Pattern

When using `axios-mock-adapter` for testing API client behavior, we should **avoid** using the chained response pattern (`.replyOnce().replyOnce()`) and instead use a counter-based approach for multiple sequential responses.

### Pattern: Counter-Based Responses

This pattern provides better stability and control over the sequence of responses:

```javascript
// Instead of:
mockAxios.onGet('https://api.example.com/test')
  .replyOnce(500, { error: 'Server error' })
  .replyOnce(200, { data: 'Success' });

// Use:
let requestCount = 0;
mockAxios.onGet('https://api.example.com/test').reply(() => {
  const responses = [
    [500, { error: 'Server error' }],
    [200, { data: 'Success' }]
  ];
  return responses[requestCount++] || [404, { error: 'Unexpected request' }];
});
```

### Benefits

1. **Predictable behavior**: The counter-based approach offers more explicit control over the sequence of responses.
2. **Better error handling**: By providing a fallback response, unexpected requests are handled gracefully.
3. **Conditional logic**: It's easier to implement complex response patterns based on request properties.
4. **Debugging**: When tests fail, it's clearer to see which response was given at what stage.
5. **Better suited for Vitest**: This pattern works well with Vitest's concurrent test execution model.

### Implementation Examples

#### Basic Sequential Responses:

```javascript
let requestCount = 0;
mockAxios.onGet('/test').reply(() => {
  const responses = [
    [500, { error: 'Internal server error' }],
    [502, { error: 'Bad gateway' }],
    [200, { data: 'success' }]
  ];
  return responses[requestCount++] || [404, { error: 'Unexpected request' }];
});
```

#### Network Error Then Success:

```javascript
let networkErrorRequestCount = 0;
mockAxios.onGet('/test').reply(() => {
  if (networkErrorRequestCount === 0) {
    networkErrorRequestCount++;
    return Promise.reject(new Error('Network Error'));
  } else {
    return [200, { data: 'success' }];
  }
});
```

#### Custom Headers in Response:

```javascript
let rateLimitRequestCount = 0;
mockAxios.onGet('/test').reply(() => {
  if (rateLimitRequestCount === 0) {
    rateLimitRequestCount++;
    return [429, { error: 'Too many requests' }, { 'retry-after': '2' }];
  } else {
    return [200, { data: 'success' }];
  }
});
```

## Common Test Scenarios

### Testing Retry Logic

```javascript
describe('Retry logic', () => {
  it('should retry until success', async () => {
    let attemptCount = 0;
    mockAxios.onGet('/resource').reply(() => {
      if (attemptCount < 2) {
        attemptCount++;
        return [500, { error: 'Temporary server error' }];
      } else {
        return [200, { data: 'Success after retry' }];
      }
    });
    
    const result = await apiClient.get('/resource');
    expect(result).toEqual({ data: 'Success after retry' });
    expect(mockAxios.history.get.length).toBe(3); // Initial + 2 retries
  });
});
```

### Testing Error Handling

```javascript
describe('Error handling', () => {
  it('should handle network errors', async () => {
    let errorResponseSent = false;
    mockAxios.onGet('/error-test').reply(() => {
      if (!errorResponseSent) {
        errorResponseSent = true;
        return Promise.reject(new Error('Network error'));
      }
      return [200, { recovered: true }];
    });
    
    const result = await apiClient.get('/error-test');
    expect(result).toEqual({ recovered: true });
  });
});
```

## Best Practices

1. **Reset counters between tests**: Use `beforeEach` to reset counters to avoid test interdependence.
2. **Always include a fallback response**: Prevent test hangs when unexpected requests occur.
3. **Use descriptive counter names**: Name your counters based on the test scenario for better readability.
4. **Handle unexpected requests**: Return useful error responses for debugging.
5. **Clear mock history**: Use `mockAxios.reset()` in `afterEach` to clear request history.