# Vitest Mocking Guide

## Overview

This guide provides best practices for mocking in Vitest with a special focus on ES Module compatibility. Proper mocking is essential for:

1. Isolating components for testing
2. Preventing external API calls during tests
3. Controlling test dependencies
4. Avoiding module teardown issues in an ESM environment

## Important Concepts

### Hoisting Behavior

Vitest, like Jest, hoists `vi.mock()` calls to the top of the file, regardless of where they appear in your code. This means:

- Mock declarations are processed before any imports
- You cannot use variables defined after imports in your mock implementations
- You need to use factory functions for dynamic mock implementations

```javascript
// This won't work as expected because the mock is hoisted above the import
import { createMock } from './test-utils.js';
vi.mock('./service.js', () => {
  return { default: createMock() }; // Error: createMock is not defined yet
});

// This works because the factory function is called after imports are processed
vi.mock('./service.js', () => {
  return {
    default: () => ({
      getData: vi.fn().mockResolvedValue({ success: true })
    })
  };
});
```

### ESM-Specific Patterns

When mocking ES modules, you need to:

1. Return an object with a `default` property for default exports
2. Match the exact exported names for named exports
3. Handle dynamic imports differently from static imports

```javascript
// Mocking a module with default export
vi.mock('./defaultExportModule.js', () => {
  return { 
    default: vi.fn().mockImplementation(() => ({ 
      method: vi.fn() 
    }))
  };
});

// Mocking a module with named exports
vi.mock('./namedExportModule.js', () => {
  return { 
    namedFunction: vi.fn(),
    NamedClass: vi.fn().mockImplementation(() => ({
      classMethod: vi.fn()
    }))
  };
});
```

## Recommended Patterns

### 1. Consistent Mock Declarations

Always place all `vi.mock()` calls at the top of your test file, even though they'll be hoisted automatically. This improves readability and makes mock dependencies clear.

```javascript
// Good practice - all mocks at the top
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/anthropicService.js');
vi.mock('../../services/perplexityService.js');
vi.mock('../../utils/logger.js');

// Imports after mocks
import AnthropicService from '../../services/anthropicService.js';
import PerplexityService from '../../services/perplexityService.js';
```

### 2. Mock Implementation Setup

Set up mock implementations in `beforeEach` to ensure a fresh state for each test:

```javascript
beforeEach(() => {
  // Set up mock implementations
  AnthropicService.processQuery.mockResolvedValue({
    response: 'Mocked Claude response',
    modelUsed: 'claude-3-7-sonnet-20250219'
  });
  
  PerplexityService.processQuery.mockResolvedValue({
    response: 'Mocked Perplexity response',
    citations: [{ url: 'https://example.com' }],
    modelUsed: 'llama-3.1-sonar-small-128k-online'
  });
});
```

### 3. Mock Cleanup

Always reset mocks in `afterEach` to prevent test bleeding:

```javascript
afterEach(() => {
  vi.resetAllMocks();
  vi.clearAllMocks();
});
```

### 4. Handling Dynamic Imports

When testing code that uses dynamic imports, use the `mockResolvedValue` pattern:

```javascript
// In your test
vi.mock('../../utils/dynamicImporter.js', () => ({
  importModule: vi.fn().mockResolvedValue({
    default: vi.fn().mockImplementation(() => ({
      method: vi.fn().mockReturnValue('mocked result')
    }))
  })
}));

// Then in your test
it('should dynamically import a module', async () => {
  const result = await yourFunction();
  expect(importModule).toHaveBeenCalledWith('expected-module-path');
  expect(result).toBe('mocked result');
});
```

### 5. Mocking Global Objects

For global objects, use `vi.stubGlobal`:

```javascript
// Mock global fetch
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: vi.fn().mockResolvedValue({ data: 'mocked data' })
}));

// Clean up after
afterEach(() => {
  vi.unstubAllGlobals();
});
```

### 6. Mocking Timers

For time-dependent code, use fake timers:

```javascript
beforeEach(() => {
  vi.useFakeTimers();
});

it('should handle timeouts', async () => {
  const promise = yourAsyncFunction();
  vi.advanceTimersByTime(1000);
  const result = await promise;
  expect(result).toBe('expected result');
});

afterEach(() => {
  vi.useRealTimers();
});
```

## Handling API Clients

For our services that call external APIs (Anthropic, Perplexity), we follow this pattern:

```javascript
// Mock the API client
vi.mock('../../utils/apiClient.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    post: vi.fn().mockResolvedValue({
      data: {
        content: [{ text: 'Mocked API response' }],
        model: 'mocked-model-name'
      }
    }),
    get: vi.fn().mockResolvedValue({ data: { result: true } })
  }))
}));

// Later in a test
it('should call the API with correct parameters', async () => {
  const service = new YourService();
  await service.methodThatCallsApi('query text');
  
  // Verify the API was called correctly
  const apiClientInstance = apiClient.mock.results[0].value;
  expect(apiClientInstance.post).toHaveBeenCalledWith(
    'expected/endpoint',
    expect.objectContaining({ 
      query: 'query text',
      options: expect.any(Object)
    })
  );
});
```

## Memory Management

Proper mock cleanup is essential for memory management, especially in large test suites:

```javascript
// Global setup to track memory usage
beforeAll(() => {
  console.log('Memory Usage:');
  console.log(`RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
  console.log(`Heap Total: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
  console.log(`Heap Used: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});

// Global teardown
afterAll(() => {
  console.log('Cleaning up global test environment');
  console.log('Memory Usage:');
  console.log(`RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
  console.log(`Heap Total: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
  console.log(`Heap Used: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});
```

## Common Issues and Solutions

### Issue: Mock Not Working as Expected

**Possible Causes:**
1. Mock is declared after the import
2. Mock doesn't match the export structure

**Solution:**
```javascript
// Always declare mocks before imports
vi.mock('./module.js');
import { func } from './module.js';

// Ensure the mock structure matches exports
vi.mock('./module-with-default.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    property: 'value',
    method: vi.fn()
  }))
}));
```

### Issue: ESM Compatibility Problems

**Possible Causes:**
1. Mixing CommonJS and ESM syntax
2. Using `require` in an ESM context

**Solution:**
```javascript
// Always use ESM syntax in .js files with type="module"
import { vi } from 'vitest';
import { myFunction } from './module.js';

// Don't use require
// const myModule = require('./module.js'); // This will fail
```

### Issue: Memory Leaks in Tests

**Possible Causes:**
1. Not cleaning up resources
2. Circular references
3. Unclosed connections

**Solution:**
```javascript
// Create a cleanup function for each test
let cleanup = [];

beforeEach(() => {
  // Setup resources
  const resource = createResource();
  cleanup.push(() => resource.close());
});

afterEach(() => {
  // Clean up all resources
  cleanup.forEach(fn => fn());
  cleanup = [];
});
```

## Example: Complete Test File

Here's a complete example of a properly structured test file:

```javascript
// perplexityService.vitest.js
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

// Mocks declared at the top
vi.mock('../../utils/apiClient.js');
vi.mock('../../utils/logger.js');
vi.mock('../../utils/circuitBreaker.js');

// Imports after mocks
import ApiClient from '../../utils/apiClient.js';
import Logger from '../../utils/logger.js';
import CircuitBreaker from '../../utils/circuitBreaker.js';
import PerplexityService from '../../services/perplexityService.js';

describe('Perplexity Service', () => {
  let perplexityService;
  
  // Track memory usage
  beforeAll(() => {
    console.log('Running test: Perplexity Service');
    console.log(`Memory: RSS ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB, Heap ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  });
  
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Setup mock implementations
    ApiClient.mockImplementation(() => ({
      post: vi.fn().mockResolvedValue({
        data: {
          choices: [{
            message: {
              content: 'Mocked Perplexity response'
            }
          }],
          model: 'llama-3.1-sonar-small-128k-online',
          citations: [{ url: 'https://example.com' }]
        }
      })
    }));
    
    Logger.mockImplementation(() => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    }));
    
    CircuitBreaker.mockImplementation(() => ({
      execute: vi.fn().mockImplementation(fn => fn()),
      getState: vi.fn().mockReturnValue({ status: 'CLOSED' })
    }));
    
    // Initialize the service
    perplexityService = new PerplexityService();
  });
  
  afterEach(() => {
    // Clean up
    vi.resetAllMocks();
  });
  
  afterAll(() => {
    // Log memory usage after tests
    console.log(`Memory after tests: RSS ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB, Heap ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  });
  
  // Tests
  it('should initialize with default configuration', () => {
    expect(perplexityService).toBeDefined();
    expect(ApiClient).toHaveBeenCalled();
    expect(CircuitBreaker).toHaveBeenCalled();
  });
  
  it('should process research queries', async () => {
    const result = await perplexityService.processQuery('research query');
    
    // Verify API client was called correctly
    const apiClientInstance = ApiClient.mock.results[0].value;
    expect(apiClientInstance.post).toHaveBeenCalledWith(
      'https://api.perplexity.ai/chat/completions',
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: 'research query'
          })
        ])
      })
    );
    
    // Verify result structure
    expect(result).toEqual(expect.objectContaining({
      response: 'Mocked Perplexity response',
      citations: expect.any(Array),
      modelUsed: 'llama-3.1-sonar-small-128k-online'
    }));
  });
  
  // More tests...
});
```

## Conclusion

Following these mocking patterns will help ensure consistent, reliable tests that avoid common pitfalls in an ESM environment. Remember:

1. Declare mocks at the top of the file
2. Set up implementations in `beforeEach`
3. Clean up in `afterEach`
4. Pay attention to export structures
5. Monitor memory usage for large test suites