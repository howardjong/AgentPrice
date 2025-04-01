# Prompt Manager Testing Patterns

## Overview

This document outlines comprehensive patterns for testing the PromptManager service, which is responsible for managing, loading, versioning, and applying templates for AI prompts across multiple engines.

## Testing Structure

We've organized the PromptManager tests into three focused files:

1. **promptManager.simple.vitest.js**
   - Simplified approach using full module replacement
   - Focused on core functionality without filesystem dependencies
   - Higher-level API testing with controlled implementation

2. **promptManager.template.vitest.js**
   - Tests for initialization, template loading, and variable replacement
   - Covers the core functionality of retrieving and using prompts
   - Detailed filesystem mocking for lower-level testing

3. **promptManager.versions.vitest.js**
   - Tests for version and variant management
   - Covers the creation, promotion, and activation of prompt versions
   - Detailed filesystem mocking for version management

This modular approach enables:
- More focused test suites with clear responsibilities
- Better isolation of failure points
- Improved maintainability
- Multiple testing approaches at different levels of abstraction

## Key Testing Patterns

### 1. Module Replacement Mocking

The most reliable approach for testing PromptManager is to mock the entire module with a controlled implementation:

```javascript
// First, import the original instance so we can reference it
import originalPromptManager from '../../../services/promptManager.js';

// Then mock the entire module with a controlled implementation
vi.mock('../../../services/promptManager.js', () => {
  // Create a mock implementation with essential methods
  const mockPromptManager = {
    promptCache: new Map(),
    activeVersions: {},
    basePath: '/test/prompts',
    
    // Add method implementations we want to test
    getPrompt: vi.fn(async (engine, promptType, variant = null, options = {}) => {
      const useCache = options.useCache !== false;
      const version = variant || mockPromptManager.getActiveVersion(engine, promptType);
      const cacheKey = `${engine}:${promptType}:${version}`;
      
      // Return from cache if available and requested
      if (useCache && mockPromptManager.promptCache.has(cacheKey)) {
        return mockPromptManager.promptCache.get(cacheKey);
      }
      
      // For testing, just return a fixed content
      const content = `Prompt content for ${engine}/${promptType} (${version})`;
      mockPromptManager.promptCache.set(cacheKey, content);
      return content;
    }),
    
    // Other necessary methods...
  };
  
  return {
    default: mockPromptManager
  };
});
```

This approach avoids filesystem interactions entirely and gives us full control over the behavior.

### 2. Filesystem Mocking (Alternative Approach)

For tests that need to verify filesystem interaction, we can mock the filesystem module:

```javascript
// Mock the filesystem module
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  stat: vi.fn(() => Promise.resolve({ isDirectory: () => false })),
  mkdir: vi.fn(() => Promise.resolve())
}));

// Get the mocked fs module
import * as fs from 'fs/promises';
```

For each test, implement context-specific mock behaviors:

```javascript
// Mock the filesystem
fs.access.mockImplementation((path) => {
  if (path.includes('/expected/path')) {
    return Promise.resolve();
  }
  return Promise.reject(new Error('ENOENT: file not found'));
});

fs.readFile.mockImplementation((path) => {
  if (path.includes('specific_file.txt')) {
    return Promise.resolve('Content for this file');
  }
  return Promise.reject(new Error('File not found'));
});
```

### 3. Clean Instance Per Test

Create a fresh PromptManager instance for each test to avoid cross-test contamination:

```javascript
beforeEach(() => {
  vi.clearAllMocks();
  
  // Create a new instance for each test
  promptManager = new PromptManager();
  
  // Reset the prompt cache
  promptManager.promptCache.clear();
  
  // Initialize with test data
  promptManager.activeVersions = { ... };
});
```

### 4. Path Normalization

The PromptManager uses `path.dirname(__filename)` which depends on the module system. Mock it for consistent testing:

```javascript
const originalDirname = path.dirname;

beforeEach(() => {
  // Mock path.dirname to return a consistent path for testing
  path.dirname = vi.fn().mockReturnValue('/test/services');
});

afterEach(() => {
  // Restore original path.dirname function
  path.dirname = originalDirname;
});
```

### 5. Cache Testing

Test caching behavior explicitly by manipulating the cache and verifying its effects:

```javascript
it('should use cached prompt when available', async () => {
  // Add a prompt to the cache
  const cacheKey = 'claude:test_prompt:default';
  promptManager.promptCache.set(cacheKey, 'Cached prompt content');
  
  const result = await promptManager.getPrompt('claude', 'test_prompt');
  
  expect(result).toBe('Cached prompt content');
  // Should not read from filesystem
  expect(fs.readFile).not.toHaveBeenCalled();
});
```

### 6. Error Handling Tests

Test both happy path and error scenarios:

```javascript
it('should throw error when prompt file not found', async () => {
  // Mock file not found
  fs.readFile.mockRejectedValueOnce(new Error('ENOENT: file not found'));
  
  await expect(promptManager.getPrompt('claude', 'nonexistent'))
    .rejects.toThrow('Failed to load prompt');
});
```

### 7. Directory Structure Variations

Test both flat and nested directory structures that the PromptManager supports:

```javascript
// Test flat structure
it('should create a variant in the flat directory structure', async () => {
  // Mock root path exists
  fs.access.mockImplementation(path => {
    if (path.includes('/claude/test_prompt.txt')) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('File not found'));
  });
  
  // Test for flat structure behavior...
});

// Test nested structure
it('should create a variant in the nested directory structure', async () => {
  // Mock nested path exists
  fs.access.mockImplementation(path => {
    if (path.includes('/claude/test_prompt/default.txt')) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('File not found'));
  });
  
  // Test for nested structure behavior...
});
```

## Test Categories

### 1. Initialization Tests

Test that the PromptManager initializes correctly:
- Loading configuration
- Creating default configuration if none exists
- Validating directory structure
- Creating missing directories
- Generating default prompts

### 2. Template Loading Tests

Test the core prompt loading functionality:
- Loading from correct paths
- Handling default and specific versions
- Caching behavior
- Error handling

### 3. Variable Replacement Tests

Test the template variable replacement:
- Basic variable replacement
- Handling missing variables
- Handling edge cases

### 4. Version Management Tests

Test creating and managing versions:
- Creating variants
- Promoting variants to versions
- Setting active versions
- Listing available versions

## Implementation Patterns

### Testing File Access Patterns

```javascript
// Access success vs failure patterns
fs.access.mockImplementation(path => {
  // Specify exact paths that should succeed
  if (path.includes('/specific/success/path')) {
    return Promise.resolve();
  }
  // All other paths fail
  return Promise.reject(new Error('File not found'));
});
```

### Testing Directory Reading Patterns

```javascript
// Directory content patterns
fs.readdir.mockImplementation(dirPath => {
  if (dirPath.includes('/versions')) {
    return Promise.resolve(['file1.txt', 'file2.txt']);
  }
  return Promise.resolve([]);
});
```

### Behavior Simulation Patterns

```javascript
// Simulate behavior sequence with multiple calls
let callCount = 0;
fs.readFile.mockImplementation(() => {
  callCount++;
  if (callCount === 1) {
    return Promise.resolve('First call content');
  }
  return Promise.resolve('Later call content');
});
```

## Common Test Scenarios

### Cache Verification

```javascript
// Pre-populate cache
promptManager.promptCache.set('key', 'value');

// Call method that should use cache
await promptManager.method();

// Verify filesystem wasn't accessed
expect(fs.readFile).not.toHaveBeenCalled();
```

### Cache Invalidation

```javascript
// Pre-populate cache
promptManager.promptCache.set('key', 'value');

// Call method that should invalidate cache
await promptManager.methodThatInvalidatesCache();

// Verify cache entry was removed
expect(promptManager.promptCache.has('key')).toBe(false);
```

### Error Propagation

```javascript
// Mock error
fs.readFile.mockRejectedValue(new Error('Specific error'));

// Verify error propagation or handling
await expect(promptManager.method()).rejects.toThrow('Expected error message');
```

## Comprehensive Test Matrix

For thorough testing, cover this matrix of conditions:

1. **File Structure:**
   - Flat directory structure
   - Nested directory structure

2. **Cache States:**
   - Empty cache
   - Populated cache
   - Forced reload

3. **Version States:**
   - Default version
   - Specific version
   - Missing version

4. **File Access:**
   - File exists
   - File doesn't exist
   - Permission error

5. **Content Types:**
   - With variables
   - Without variables
   - Empty content

## Coverage Goals

- **Line Coverage:** >90% to ensure comprehensive coverage
- **Function Coverage:** 100% to ensure all public methods are tested
- **Branch Coverage:** >85% to test conditional logic
- **Statement Coverage:** >90% to verify execution of all statements

For the PromptManager, prioritize testing:
- Template loading and resolution logic across directory structures
- Version and variant management
- Caching and cache invalidation
- Error handling and recovery
- File path resolution and normalization