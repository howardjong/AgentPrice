# Workflow Test Suite for Multi-LLM Service

This directory contains workflow-focused tests for the Multi-LLM system, designed to test end-to-end workflows rather than individual components.

## Current Test Files

- **perplexity-workflow-nock.vitest.js**: Tests Perplexity API integration with 5 passing tests
  - Tests standard queries via the Perplexity API
  - Tests error handling, rate limiting, and circuit breaker functionality
  - Uses Nock for HTTP request mocking

- **claude-chart-workflow-nock.vitest.js**: Tests Claude chart generation with 5 passing tests
  - Tests Van Westendorp and conjoint analysis chart generation
  - Validates chart data structure and model extraction
  - Tests error handling in chart generation workflows
  - Uses Nock for HTTP request mocking

- **service-router-mock.vitest.js**: Tests service routing logic with 8 passing tests
  - Tests routing decisions based on query content and intent
  - Tests fallback behavior when a service is unavailable
  - Tests chart generation routing
  - Tests context management during workflow execution
  - Uses direct mocking instead of Nock for more control over mock behavior

## Testing Approach

### Nock-Based Tests
Used for testing direct API interactions:
- Intercept HTTP requests to external APIs
- Return predefined response fixtures
- Validate request parameters
- Test error handling by returning error responses

### Mock-Based Tests
Used for testing integration points and routing logic:
- Mock service methods with vi.fn() and vi.spyOn()
- Create test-specific implementations with mockImplementation()
- Restore original implementations after each test
- Use method spies to verify call patterns

## Best Practices for Workflow Tests

1. **Proper Test Isolation**:
   - Reset all mocks between tests with vi.resetAllMocks()
   - Store and restore original implementations when overriding for specific tests
   - Do not rely on global state between tests

2. **Mock Restoration**:
   ```javascript
   // Store originals
   const originalFunc = service.method;
   const originalImplementation = service.method.getMockImplementation();
   
   // Override for test
   service.method = vi.fn().mockImplementation(async () => {...});
   
   // Test execution...
   
   // Restore originals
   service.method = originalFunc;
   service.method.mockImplementation(originalImplementation);
   ```

3. **Error Simulation**:
   ```javascript
   // For synchronous errors
   method.mockImplementation(() => { throw new Error('Test error'); });
   
   // For promise rejections
   method.mockImplementation(() => Promise.reject(new Error('Test error')));
   ```

4. **ES Module Mocking Patterns**:
   - Use vi.mock() with factory functions for module-level mocks
   - Use vi.spyOn() for method-level mocks on imported objects
   - Remember that vi.mock() is hoisted, so define mock implementations before imports

## Fixtures

Fixtures are stored in:
- `tests/fixtures/claude/` - Claude API response fixtures
- `tests/fixtures/perplexity/` - Perplexity API response fixtures

Load fixtures using the loadFixture helper:
```javascript
const fixture = await loadFixture('path/to/fixture.json');
```