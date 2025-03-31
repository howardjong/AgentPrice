# Vitest Mocking Guidelines

This document provides guidelines and best practices for creating reliable mocks in Vitest, especially when migrating from Jest.

## Key Differences Between Jest and Vitest Mocking

### 1. Module Mocking

#### Jest Approach
```javascript
// Jest uses require for mocking
jest.mock('../path/to/module');
const module = require('../path/to/module');
```

#### Vitest Approach
```javascript
// Vitest with ESM - must mock before importing
vi.mock('../path/to/module');
import module from '../path/to/module'; // After mocking
```

### 2. Promise Rejection Mocking

#### Jest Approach
```javascript
// Jest's simple way to mock rejections
jest.spyOn(service, 'method').mockRejectedValueOnce(new Error('failure'));
```

#### Vitest Approach
```javascript
// In Vitest, use mockImplementation for more reliable rejection handling
vi.spyOn(service, 'method').mockImplementation(() => Promise.reject(new Error('failure')));

// Or alternative approach with mockRejectedValueOnce (but can be less reliable)
vi.spyOn(service, 'method').mockRejectedValueOnce(new Error('failure'));
```

### 3. Timer Mocking

#### Jest Approach
```javascript
// Jest's timer approach
jest.useFakeTimers();
jest.advanceTimersByTime(1000);
```

#### Vitest Approach
```javascript
// Vitest timer approach
vi.useFakeTimers();
// For synchronous tests:
vi.advanceTimersByTime(1000);
// For asynchronous tests (preferred method):
await vi.advanceTimersByTimeAsync(1000);
```

### 4. Mock Restoration

#### Jest Approach
```javascript
// Restore mocks after test
afterEach(() => {
  jest.restoreAllMocks();
});
```

#### Vitest Approach
```javascript
// Restore mocks after test
afterEach(() => {
  vi.restoreAllMocks();
  // Vitest distinguishes between mock restoration vs clearing:
  // vi.clearAllMocks(); // Reset call counts but keep mock implementation
  // vi.resetAllMocks(); // Reset both call counts and implementations
});
```

## Best Practices for ES Module Mocking

### 1. Factory Function Approach

When mocking ES modules that export classes or complex objects, use a factory function approach:

```javascript
// Instead of directly mocking methods
vi.mock('../utils/service.js', () => ({
  default: {
    method1: vi.fn(),
    method2: vi.fn()
  }
}));

// Use a factory function to create new instances for each test
vi.mock('../utils/service.js', () => ({
  default: {
    createInstance: () => ({
      method1: vi.fn(),
      method2: vi.fn()
    })
  }
}));

// Then in your test:
const service = ServiceModule.default.createInstance();
```

### 2. Hoisting Issues

Vitest mocking is hoisted just like Jest, but it behaves differently with ES modules. Keep these points in mind:

1. Always place `vi.mock()` calls at the top of your file, before any imports
2. For dynamic mocks, make sure the mock factory function doesn't reference any imports
3. Use inline mock factories for complex mocking scenarios

```javascript
// Bad - referencing imported objects in mock factory
import { helper } from './helper';
vi.mock('./service', () => {
  // This will fail because helper is not defined during hoisting
  return { default: { method: () => helper.doSomething() } };
});

// Good - using only variables available during hoisting
vi.mock('./service', () => {
  return { 
    default: { 
      method: vi.fn().mockImplementation(() => 'mocked result')
    } 
  };
});
```

### 3. Named Exports

Handle named exports carefully in Vitest mocks:

```javascript
// Module that has both default and named exports
vi.mock('./module', () => {
  return {
    default: { methodA: vi.fn() },
    namedExport: vi.fn(),
    NamedClass: vi.fn().mockImplementation(() => ({
      classMethod: vi.fn()
    }))
  };
});
```

## Integration Testing Patterns

### 1. Component Isolation

When testing a component that depends on others, use targeted mocking:

```javascript
// Mock only what you need
vi.mock('./database'); // Fully mock database
vi.mock('./logger', () => ({ // Partially mock logger
  default: {
    ...vi.importActual('./logger').default,
    error: vi.fn()
  }
}));

// Don't mock the component under test
import { componentToTest } from './component';
```

### 2. External API Mocking

Use `nock` or `axios-mock-adapter` for HTTP request mocking:

```javascript
// Setup API mocks before the test
import nock from 'nock';

beforeEach(() => {
  nock('https://api.example.com')
    .get('/data')
    .reply(200, { success: true });
});

afterEach(() => {
  nock.cleanAll();
});
```

### 3. Non-deterministic Code

For testing code with setTimeout, setInterval, or Date:

```javascript
// Control time in tests
vi.useFakeTimers();

// Mock Date constructor
const mockDate = new Date('2025-01-01');
vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

// Restore after test
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
```

## Advanced Mocking Techniques

### 1. Mock Implementation Factory

Create a factory that generates consistent mocks:

```javascript
// Mock factory
function createServiceMock(overrides = {}) {
  return {
    methodA: vi.fn().mockResolvedValue({ data: 'default' }),
    methodB: vi.fn().mockImplementation(() => 42),
    ...overrides
  };
}

// In your test
const serviceMock = createServiceMock({ 
  methodA: vi.fn().mockResolvedValue({ data: 'custom' }) 
});

vi.mock('./service', () => ({
  default: serviceMock
}));
```

### 2. Mock Return Value Sequencing

Set up a sequence of return values for a mock:

```javascript
const mockFn = vi.fn();

// Return different values on consecutive calls
mockFn
  .mockReturnValueOnce(1)
  .mockReturnValueOnce(2)
  .mockReturnValue(3);

// For promises:
mockFn
  .mockResolvedValueOnce({ first: true })
  .mockResolvedValueOnce({ second: true })
  .mockRejectedValue(new Error('failed'));
```

### 3. Controlled Failures and Recovery

For testing retry and failure recovery logic:

```javascript
let callCount = 0;
const mockFn = vi.fn().mockImplementation(() => {
  callCount++;
  if (callCount <= 2) {
    throw new Error('Temporary failure');
  }
  return 'success';
});
```

## Common Testing Patterns

### 1. Async/Await Testing

Always use async/await for asynchronous tests:

```javascript
test('async operations', async () => {
  const result = await serviceUnderTest.asyncMethod();
  expect(result).toBe('expected');
});
```

### 2. Event Testing

For event-based code, use Promises:

```javascript
test('emits events correctly', () => {
  return new Promise((resolve) => {
    const emitter = createEventEmitter();
    
    emitter.on('event', (data) => {
      expect(data).toEqual({ success: true });
      resolve();
    });
    
    emitter.trigger('event', { success: true });
  });
});
```

### 3. Error Testing

Properly test error states:

```javascript
test('throws expected error', async () => {
  await expect(async () => {
    await serviceUnderTest.methodThatThrows();
  }).rejects.toThrow('Expected error message');
});
```

## Workflow-focused Testing

### 1. Setup and Teardown

Always clean up after tests, especially for integration tests:

```javascript
describe('Integration test', () => {
  beforeEach(async () => {
    // Setup dependencies, clear databases, etc.
  });
  
  afterEach(async () => {
    // Cleanup - restore mocks, clear state
    vi.restoreAllMocks();
    await cleanupDatabases();
  });
});
```

### 2. Environmental Isolation

For tests that modify environment variables:

```javascript
const originalEnv = { ...process.env };

beforeEach(() => {
  // Set test environment
  process.env.TEST_MODE = 'true';
});

afterEach(() => {
  // Restore original environment
  process.env = { ...originalEnv };
});
```

### 3. Comprehensive Testing

Test workflows end-to-end while mocking external dependencies:

```javascript
test('complete workflow', async () => {
  // 1. Setup initial state
  // 2. Mock external services
  // 3. Execute workflow
  // 4. Assert on final state and interactions
  // 5. Verify mocks were called as expected
});
```

## Troubleshooting Common Issues

### 1. Module Not Mocked Properly

- Ensure `vi.mock()` is called before the import statement
- Check for proper mock factory implementation
- Verify the mock path matches the actual import path

### 2. Mock Function Not Called

- Confirm the mock is properly bound to the right object
- Check if the function is called via a different reference
- Use `vi.spyOn()` correctly to track method calls

### 3. Restoring Original Implementation

- Use `vi.restoreAllMocks()` to restore spied methods
- For comprehensive reset, use both `vi.resetModules()` and `vi.restoreAllMocks()`

### 4. Testing Time-based Logic

- Always use `vi.useFakeTimers()` and properly advance time with `vi.advanceTimersByTimeAsync()`
- Remember to `vi.useRealTimers()` in the afterEach block
- For particularly troublesome timing code, consider refactoring to dependency injection

## Migration Checklist

When migrating from Jest to Vitest:

1. ✅ Replace `jest` globals with `vi` equivalents
2. ✅ Convert `jest.fn()` to `vi.fn()`
3. ✅ Update timer functions: `jest.useFakeTimers()` → `vi.useFakeTimers()`
4. ✅ Check mock implementation methods and promise handling
5. ✅ Ensure proper mock restoration in afterEach blocks
6. ✅ Review and update any ES module mocking patterns
7. ✅ Replace done callbacks with async/await pattern
8. ✅ Update snapshot testing if used