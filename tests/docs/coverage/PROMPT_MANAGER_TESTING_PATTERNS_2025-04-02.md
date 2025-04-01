# PromptManager Testing Patterns

This document outlines the testing strategy and patterns used for the PromptManager module.

## Testing Challenges

The PromptManager presents several testing challenges:

1. **File System Dependency**: The module interacts extensively with the file system for prompt loading and storage.
2. **Nested Directory Structure**: The prompt structure includes nested directories that need validation.
3. **Path Traversal Security**: Path validation and security checks need to be tested.
4. **Cache Management**: Tests need to verify proper cache invalidation and usage.
5. **Nested Configuration**: The active versions configuration has a nested structure that can be difficult to mock.

## Testing Approaches

### Approach 1: In-place Mocking with Simple Tests (promptManager.simple.vitest.js)

This approach involves:
- Mocking file system operations at the lowest level (fs/promises module)
- Using the actual promptManager implementation
- Testing core functions with minimal dependencies
- Focusing on testing the most critical functionality rather than comprehensive coverage

**Pros**:
- Tests the actual code that runs in production
- Finds real issues in the implementation
- Helps understand the complex module flow

**Cons**:
- Tests can break if implementation details change
- Complex file system operations are difficult to mock reliably
- Tests can be brittle due to many mocking dependencies

### Approach 2: Isolated Mock Implementation (promptManager.mock.vitest.js)

This approach involves:
- Creating a separate mock implementation with the same interface
- Replacing file system operations with in-memory storage
- Implementing event-driven patterns for better test observability
- Full test coverage of all behaviors

**Pros**:
- More reliable tests that don't depend on mocking complex fs operations
- Faster test execution
- Clearer test failures
- Can serve as documentation for the expected behavior

**Cons**:
- Not testing the actual implementation
- Possible drift between mock and real implementation
- Additional maintenance burden to keep the mock in sync

## Test Coverage Strategy

For complete test coverage, we use both approaches:

1. **Core Functionality Tests** (using the simple approach):
   - Format template variables
   - Get/set active versions
   - Retrieve prompts
   - Error handling

2. **Comprehensive Behavior Tests** (using the mock approach):
   - Initialization sequence
   - Configuration loading
   - Directory structure validation
   - Prompt variant management
   - Path validation and security
   - Cache management
   - Event handling

## Testing Patterns

### Pattern 1: Manual Dependency Mocking

```javascript
// Mock dependencies before import
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn()
}));

// Import dependencies after mocking
import * as fs from 'fs/promises';
import promptManager from '../../../services/promptManager.js';
```

### Pattern 2: Event-based Testing

```javascript
// Create a spy to check if the event is emitted
const updateSpy = vi.fn();
promptManager.on('version-updated', updateSpy);

const result = await promptManager.setActiveVersion('claude', 'test_prompt', 'v2');

expect(updateSpy).toHaveBeenCalledWith({
  engine: 'claude',
  promptType: 'test_prompt',
  versionName: 'v2'
});

// Clean up event listener
promptManager.off('version-updated', updateSpy);
```

### Pattern 3: Simplified Testing with Mock Implementation

```javascript
// Mock implementation has simpler, more testable interfaces
await promptManager.setPrompt('claude', 'test_prompt', 'This is a test prompt');
const result = await promptManager.getPrompt('claude', 'test_prompt');
expect(result).toBe('This is a test prompt');
```

## Learning and Recommendations

1. **Favor Mockable Design**: Services with heavy file system dependencies should be designed with testing in mind.
2. **Abstract File System Operations**: Consider a middleware layer for file operations that can be easily mocked.
3. **Use Event Emitters**: Event emitters provide better hooks for testing.
4. **In-Memory Alternatives**: Provide in-memory alternatives for configuration storage.
5. **Avoid Complex Path Manipulation**: Path manipulation is error-prone in tests.

## Future Improvements

1. Refactor the real PromptManager to use a mockable filesystem abstraction
2. Add better caching mechanisms with clear invalidation
3. Improve error reporting to include direct details about what went wrong
4. Add validation for prompt content (e.g., template variable validation)