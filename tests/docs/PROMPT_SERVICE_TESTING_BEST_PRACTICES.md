# Prompt Service Testing Best Practices

## Introduction

Testing prompt management services presents unique challenges due to their interaction with file systems, template processing, caching mechanisms, and dynamic configurations. This document outlines best practices for testing prompt services like `promptManager.js` to achieve comprehensive coverage.

## Core Testing Strategies

### 1. Mocking External Dependencies

The prompt manager interacts with the file system to load templates. These should be mocked to ensure test stability:

```javascript
// Mock the fs module
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  mkdir: vi.fn(),
}));

// Setup mock implementations
const fs = require('fs/promises');
fs.readFile.mockImplementation((path) => {
  if (path.includes('template.txt')) {
    return Promise.resolve('This is a {{variable}} template');
  }
  return Promise.reject(new Error('File not found'));
});
```

### 2. Testing Template Variable Replacement

Test all prompt template variable replacement scenarios:

```javascript
it('should replace variables in templates', async () => {
  const result = await promptManager.formatPrompt('template', {
    variable: 'test'
  });
  expect(result).toBe('This is a test template');
});

it('should handle missing variables', async () => {
  const result = await promptManager.formatPrompt('template', {});
  expect(result).toBe('This is a {{variable}} template');
});
```

### 3. Cache Validation

Prompt services often implement caching to reduce file I/O. Test both cache hits and misses:

```javascript
it('should use cached templates when available', async () => {
  // First call loads from file
  await promptManager.formatPrompt('template', {});
  
  // Reset the mock to verify it's not called again
  fs.readFile.mockClear();
  
  // Second call should use cache
  await promptManager.formatPrompt('template', {});
  expect(fs.readFile).not.toHaveBeenCalled();
});

it('should reload templates when forced', async () => {
  // Load initially
  await promptManager.formatPrompt('template', {});
  
  // Reset the mock
  fs.readFile.mockClear();
  
  // Force reload
  await promptManager.formatPrompt('template', {}, { forceReload: true });
  expect(fs.readFile).toHaveBeenCalled();
});
```

### 4. Error Handling Testing

Test all error scenarios:

```javascript
it('should handle file not found errors', async () => {
  fs.readFile.mockRejectedValueOnce(new Error('ENOENT: file not found'));
  
  await expect(promptManager.formatPrompt('nonexistent', {}))
    .rejects.toThrow(/Failed to load prompt template/);
});

it('should handle syntax errors in templates', async () => {
  fs.readFile.mockResolvedValueOnce('This template has {{ unclosed tag');
  
  await expect(promptManager.formatPrompt('invalid', {}))
    .rejects.toThrow(/Error parsing template/);
});
```

### 5. Configuration Testing

Test how the prompt service handles different configurations:

```javascript
it('should respect custom prompt directories', async () => {
  // Set custom directory
  promptManager.configure({ promptDir: '/custom/path' });
  
  // Trigger a template load
  await promptManager.formatPrompt('template', {});
  
  // Verify the correct path was used
  expect(fs.readFile).toHaveBeenCalledWith(
    expect.stringContaining('/custom/path'), 
    expect.any(Object)
  );
});
```

## Best Practices for Specific Scenarios

### Testing Prompt Variants

For services that support prompt variants (A/B testing, model-specific variants, etc.):

```javascript
it('should select the correct prompt variant', async () => {
  // Mock directory listing to include variants
  fs.readdir.mockResolvedValueOnce([
    'template.base.txt',
    'template.gpt4.txt',
    'template.claude.txt'
  ]);
  
  // Test variant selection
  const result = await promptManager.formatPrompt('template', {}, { 
    model: 'gpt4'
  });
  
  // Verify the correct variant was loaded
  expect(fs.readFile).toHaveBeenCalledWith(
    expect.stringContaining('template.gpt4.txt'),
    expect.any(Object)
  );
});
```

### Testing Prompt Fallbacks

Test the fallback mechanism for when specific variants aren't available:

```javascript
it('should fall back to base template when variant not found', async () => {
  // Mock directory with only base template
  fs.readdir.mockResolvedValueOnce([
    'template.base.txt'
  ]);
  
  // Request a non-existent variant
  await promptManager.formatPrompt('template', {}, { 
    model: 'nonexistent-model'
  });
  
  // Verify fallback to base template
  expect(fs.readFile).toHaveBeenCalledWith(
    expect.stringContaining('template.base.txt'),
    expect.any(Object)
  );
});
```

### Testing Content Validation

Test validation of prompt content when applicable:

```javascript
it('should validate prompt content', async () => {
  // Mock an invalid template (e.g., too long)
  fs.readFile.mockResolvedValueOnce('X'.repeat(10000)); 
  
  await expect(promptManager.formatPrompt('large', {}))
    .rejects.toThrow(/Prompt exceeds maximum length/);
});
```

## Comprehensive Test Suite Structure

A complete test suite for a prompt service should include:

1. **Basic Functionality Tests**
   - Loading templates
   - Variable replacement
   - Caching behavior

2. **Configuration Tests**
   - Custom directories
   - Format options
   - Default settings

3. **Error Handling Tests**
   - File not found
   - Permission errors
   - Invalid templates
   - Invalid variables

4. **Advanced Feature Tests**
   - Variant selection
   - Prompt composition
   - Template inheritance
   - Content validation

## Example Test Suite Structure

```javascript
describe('PromptManager', () => {
  // Basic functionality
  describe('Template Loading', () => {
    // Template loading tests
  });
  
  describe('Variable Replacement', () => {
    // Variable replacement tests
  });
  
  describe('Caching', () => {
    // Caching tests
  });
  
  // Configuration
  describe('Configuration', () => {
    // Configuration tests
  });
  
  // Error handling
  describe('Error Handling', () => {
    // Error tests
  });
  
  // Advanced features
  describe('Variant Selection', () => {
    // Variant tests
  });
  
  describe('Content Validation', () => {
    // Validation tests
  });
});
```

## Test Coverage Goals

Aim for test coverage that includes:

1. **Line Coverage**: 85%+ to ensure most code paths are exercised
2. **Branch Coverage**: 80%+ to test conditional logic
3. **Function Coverage**: 100% to ensure all public methods are tested
4. **Statement Coverage**: 85%+ to verify execution of all statements

For a prompt service, prioritize testing:
- Template loading paths and error handling
- Variable replacement logic
- Caching mechanisms
- Variant selection algorithms
- Configuration processing

## Conclusion

Testing prompt services thoroughly requires a combination of mocking external dependencies, testing template processing, validating caching behavior, and verifying error handling. By following these best practices, you can achieve high test coverage and confidence in your prompt management code.