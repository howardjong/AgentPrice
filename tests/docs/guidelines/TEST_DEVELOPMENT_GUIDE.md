# Test Development Guide

## Introduction

This guide provides best practices for developing tests in our Multi-LLM Research System (MLRS). We use Vitest as our primary testing framework due to its superior support for ES Modules and better performance characteristics.

## Getting Started

### Setting Up a New Test File

1. Create a new file with the `.vitest.js` extension in the appropriate directory under `tests/`:
   - Unit tests go in `tests/unit/`
   - Integration tests go in `tests/integration/`
   - Manual tests go in `tests/manual/`

2. Use the following template to start:

```javascript
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

// Mock declarations (if needed)
vi.mock('../../path/to/dependency.js');

// Imports
import { FunctionOrClass } from '../../path/to/module.js';

// Test suite
describe('Component Name', () => {
  // Setup
  beforeAll(() => {
    console.log('Running test: Component Name');
    console.log(`Memory: RSS ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB, Heap ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  });
  
  beforeEach(() => {
    // Reset mocks and setup test state
    vi.resetAllMocks();
  });
  
  afterEach(() => {
    // Clean up after each test
    vi.resetAllMocks();
  });
  
  afterAll(() => {
    // Log memory usage after tests
    console.log('Cleaning up global test environment');
    console.log('Memory Usage:');
    console.log(`RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
    console.log(`Heap Total: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
    console.log(`Heap Used: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  });
  
  // Tests
  it('should do something specific', () => {
    // Arrange
    const input = 'test input';
    
    // Act
    const result = FunctionOrClass(input);
    
    // Assert
    expect(result).toBe('expected output');
  });
});
```

## Running Tests

### Single Test File

Run a single test file with:

```bash
node scripts/run-vitest.js --pattern "path/to/test.vitest.js"
```

### All Tests

Run all tests with:

```bash
node scripts/run-vitest.js
```

### With Coverage

Run tests with coverage:

```bash
node scripts/run-vitest.js --coverage
```

## Test Organization

### Directory Structure

```
tests/
├── integration/          # Integration tests
│   └── workflow/         # Full workflow tests
├── manual/               # Manual test scripts
├── unit/                 # Unit tests for individual components
│   ├── services/         # Tests for service modules
│   └── utils/            # Tests for utility modules
├── utils/                # Test utilities and helpers
└── vitest.setup.js       # Global setup for Vitest
```

### Naming Conventions

- Test files: `componentName.vitest.js`
- Test descriptions: Should clearly describe the functionality being tested
- Test cases: Should follow the pattern "should [expected behavior] when [condition]"

## Testing Patterns

### 1. Unit Testing

Unit tests should focus on testing a single unit of code in isolation:

```javascript
// Example unit test for a utility function
describe('formatTimestamp', () => {
  it('should format a timestamp in ISO format', () => {
    const timestamp = new Date('2025-03-15T10:30:00Z');
    const result = formatTimestamp(timestamp);
    expect(result).toBe('2025-03-15 10:30:00');
  });
  
  it('should handle null input by returning empty string', () => {
    const result = formatTimestamp(null);
    expect(result).toBe('');
  });
});
```

### 2. Integration Testing

Integration tests verify that different parts of the system work together:

```javascript
// Example integration test
describe('Research Workflow', () => {
  it('should process a research request end-to-end', async () => {
    // Setup the mocks for external dependencies
    anthropicService.processQuery.mockResolvedValue({
      response: 'Anthropic analysis result',
      modelUsed: 'claude-3-7-sonnet-20250219'
    });
    
    perplexityService.processQuery.mockResolvedValue({
      response: 'Perplexity research result',
      citations: [{ url: 'https://example.com' }],
      modelUsed: 'llama-3.1-sonar-small-128k-online'
    });
    
    // Execute the workflow
    const result = await researchWorkflow.execute({
      query: 'research topic',
      depth: 'standard'
    });
    
    // Verify the result combines data from both services
    expect(result).toEqual(expect.objectContaining({
      analysis: expect.stringContaining('Anthropic analysis'),
      research: expect.stringContaining('Perplexity research'),
      citations: expect.any(Array)
    }));
  });
});
```

### 3. Mocking External Services

For external API calls, use our standard mocking pattern:

```javascript
vi.mock('../../services/perplexityService.js');
import PerplexityService from '../../services/perplexityService.js';

beforeEach(() => {
  // Setup the mock implementation
  PerplexityService.processQuery.mockResolvedValue({
    response: 'Mocked research result',
    citations: [{ url: 'https://example.com' }],
    modelUsed: 'llama-3.1-sonar-small-128k-online'
  });
});
```

See the [Vitest Mocking Guide](./VITEST_MOCKING_GUIDE.md) for more detailed mocking patterns.

### 4. Testing Asynchronous Code

For asynchronous code, use `async`/`await`:

```javascript
it('should handle asynchronous operations', async () => {
  // Arrange
  const input = 'test input';
  
  // Act
  const result = await asyncFunction(input);
  
  // Assert
  expect(result).toBe('expected output');
});
```

### 5. Testing Error Handling

Test both success and error paths:

```javascript
it('should handle API errors gracefully', async () => {
  // Setup the error case
  apiClient.post.mockRejectedValue(new Error('API failure'));
  
  // Act & Assert
  await expect(service.processQuery('query')).resolves.toEqual(
    expect.objectContaining({
      error: expect.stringContaining('API failure'),
      success: false
    })
  );
});
```

## Best Practices

### 1. Test Isolation

Each test should be independent and not rely on the state from previous tests:

```javascript
// Don't do this - tests depend on each other
let sharedState;

it('test 1', () => {
  sharedState = setupSomething();
});

it('test 2', () => {
  // Using sharedState from previous test
  const result = doSomethingWith(sharedState);
});

// Do this instead - each test is self-contained
it('test 1', () => {
  const localState = setupSomething();
  // rest of test...
});

it('test 2', () => {
  const localState = setupSomething();
  const result = doSomethingWith(localState);
});
```

### 2. Arrange-Act-Assert Pattern

Structure tests with the AAA pattern:

- **Arrange**: Set up the test data and conditions
- **Act**: Perform the action being tested
- **Assert**: Verify the results meet expectations

```javascript
it('should calculate total price with tax', () => {
  // Arrange
  const items = [
    { name: 'Item 1', price: 10 },
    { name: 'Item 2', price: 20 }
  ];
  const taxRate = 0.1;
  
  // Act
  const total = calculateTotal(items, taxRate);
  
  // Assert
  expect(total).toBe(33); // (10 + 20) * 1.1
});
```

### 3. Use Descriptive Test Names

Test names should describe the behavior being tested:

```javascript
// Not descriptive
it('test parser', () => {});

// Descriptive
it('should parse CSV data into structured objects', () => {});
```

### 4. Memory Management

For long-running tests or tests of resource-intensive components:

```javascript
// Track memory usage
beforeAll(() => {
  console.log('Initial Memory:');
  console.log(`RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
});

afterEach(() => {
  // Force cleanup
  if (global.gc) {
    global.gc();
  }
});

afterAll(() => {
  console.log('Final Memory:');
  console.log(`RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
});
```

### 5. Test Coverage

Aim for comprehensive test coverage:

- Happy path testing: The main success scenario
- Edge case testing: Boundary values, empty inputs, etc.
- Error path testing: How the code handles errors

```javascript
describe('User validation', () => {
  // Happy path
  it('should validate a valid user object', () => {});
  
  // Edge cases
  it('should reject a user with empty name', () => {});
  it('should accept a user with minimum age (13)', () => {});
  it('should reject a user below minimum age', () => {});
  
  // Error paths
  it('should handle null input gracefully', () => {});
  it('should reject malformed email addresses', () => {});
});
```

## Testing External API Services

When testing components that interact with external APIs (Anthropic, Perplexity), follow these guidelines:

1. **Always mock the API calls** in unit and integration tests
2. **Create separate manual tests** for actual API verification
3. **Use descriptive mock responses** that match real API formats

Example for API service testing:

```javascript
// In unit tests
vi.mock('../../utils/apiClient.js');
import ApiClient from '../../utils/apiClient.js';

beforeEach(() => {
  ApiClient.mockImplementation(() => ({
    post: vi.fn().mockResolvedValue({
      data: {
        choices: [{
          message: {
            content: 'Mocked API response with realistic format'
          }
        }],
        model: 'llama-3.1-sonar-small-128k-online',
        citations: [
          { url: 'https://example.com/source1', text: 'Source information' }
        ]
      }
    })
  }));
});

// For manual testing (in tests/manual/perplexityApiTest.js)
import PerplexityService from '../../services/perplexityService.js';

async function testRealApiCall() {
  const service = new PerplexityService();
  
  try {
    console.log('Testing Perplexity API with real credentials...');
    const result = await service.processQuery('What are the latest developments in quantum computing?');
    console.log('API Response:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('API Test failed:', error);
    throw error;
  }
}

// Execute test if this script is run directly
if (process.argv[1].includes('perplexityApiTest.js')) {
  testRealApiCall()
    .then(() => console.log('Test completed successfully'))
    .catch(() => process.exit(1));
}
```

## Conclusion

Following these guidelines will help ensure consistent, reliable tests across our codebase. Remember:

1. Tests should be isolated and independent
2. Always clean up resources after tests
3. Mock external dependencies
4. Use descriptive test names
5. Follow the AAA pattern
6. Monitor memory usage for resource-intensive tests

For specific guidance on mocking in an ESM environment, refer to the [Vitest Mocking Guide](./VITEST_MOCKING_GUIDE.md).