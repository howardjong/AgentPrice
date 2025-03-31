/**
 * Prompt Manager Service Tests
 * 
 * Comprehensive tests for the promptManager service, focusing on:
 * - Template loading and parsing
 * - Variable replacement
 * - Caching behavior
 * - Error handling
 * - Configuration options
 * - Variant selection and promotion
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';

// Mock the filesystem module
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(() => Promise.resolve({ isDirectory: () => false })),
  mkdir: vi.fn(() => Promise.resolve())
}));

// Get the mocked fs module
const fs = require('fs/promises');

// Import the module under test
const promptManager = require('../../../services/promptManager');

describe('promptManager', () => {
  // Reset mocks and module state before each test
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Reset the prompt manager's internal cache
    promptManager.resetCache();
    
    // Default configuration
    promptManager.configure({
      promptDir: 'prompts',
      defaultVariables: { },
      loggingEnabled: false
    });
    
    // Default mock implementations
    fs.readFile.mockImplementation((path) => {
      // Simple template with variables
      if (path.includes('test-prompt.txt')) {
        return Promise.resolve('This is a {{variable}} template');
      }
      
      // Simple template without variables
      if (path.includes('simple.txt')) {
        return Promise.resolve('This is a simple template');
      }
      
      // Template with nested variables
      if (path.includes('nested.txt')) {
        return Promise.resolve('Hello {{user.name}}, your score is {{user.score}}');
      }
      
      // Default case - file not found
      return Promise.reject(new Error('ENOENT: file not found'));
    });
    
    // Default directory structure
    fs.readdir.mockResolvedValue([
      'test-prompt.txt',
      'simple.txt',
      'nested.txt'
    ]);
  });
  
  // Basic template loading and formatting
  describe('formatPrompt', () => {
    it('should load and format a prompt template', async () => {
      const result = await promptManager.formatPrompt('test-prompt', { 
        variable: 'example' 
      });
      
      expect(result).toBe('This is a example template');
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('test-prompt.txt'),
        expect.any(Object)
      );
    });
    
    it('should handle simple templates without variables', async () => {
      const result = await promptManager.formatPrompt('simple', {});
      
      expect(result).toBe('This is a simple template');
    });
    
    it('should handle nested object variables', async () => {
      const result = await promptManager.formatPrompt('nested', {
        user: {
          name: 'John',
          score: 85
        }
      });
      
      expect(result).toBe('Hello John, your score is 85');
    });
    
    it('should leave unmatched variables unchanged', async () => {
      const result = await promptManager.formatPrompt('test-prompt', {});
      
      expect(result).toBe('This is a {{variable}} template');
    });
  });
  
  // Cache behavior
  describe('caching', () => {
    it('should cache templates after first load', async () => {
      // First call should read from file
      await promptManager.formatPrompt('test-prompt', { variable: 'first' });
      
      // Clear the mock to check it's not called again
      fs.readFile.mockClear();
      
      // Second call should use cache
      const result = await promptManager.formatPrompt('test-prompt', { variable: 'second' });
      
      expect(result).toBe('This is a second template');
      expect(fs.readFile).not.toHaveBeenCalled();
    });
    
    it('should reload templates when forced', async () => {
      // First call loads the template
      await promptManager.formatPrompt('test-prompt', {});
      
      // Change the mock to return a different template
      fs.readFile.mockImplementation((path) => {
        if (path.includes('test-prompt.txt')) {
          return Promise.resolve('This is an {{variable}} updated template');
        }
        return Promise.reject(new Error('File not found'));
      });
      
      // Second call with forceReload should read from file again
      const result = await promptManager.formatPrompt('test-prompt', 
        { variable: 'newly' }, 
        { forceReload: true }
      );
      
      expect(result).toBe('This is an newly updated template');
      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });
    
    it('should clear the cache when calling resetCache', async () => {
      // Load template into cache
      await promptManager.formatPrompt('test-prompt', {});
      
      // Reset the cache
      promptManager.resetCache();
      
      // Should load from file again
      await promptManager.formatPrompt('test-prompt', {});
      
      expect(fs.readFile).toHaveBeenCalledTimes(2);
    });
  });
  
  // Error handling
  describe('error handling', () => {
    it('should throw an error when template is not found', async () => {
      fs.readFile.mockRejectedValueOnce(new Error('ENOENT: file not found'));
      
      await expect(promptManager.formatPrompt('nonexistent', {}))
        .rejects.toThrow(/Failed to load prompt template/);
    });
    
    it('should throw an error when there is a filesystem error', async () => {
      fs.readFile.mockRejectedValueOnce(new Error('Permission denied'));
      
      await expect(promptManager.formatPrompt('test-prompt', {}))
        .rejects.toThrow(/Failed to load prompt template/);
    });
    
    it('should handle empty templates', async () => {
      fs.readFile.mockResolvedValueOnce('');
      
      const result = await promptManager.formatPrompt('empty', {});
      expect(result).toBe('');
    });
  });
  
  // Configuration
  describe('configuration', () => {
    it('should use custom prompt directory', async () => {
      // Set custom directory
      promptManager.configure({ promptDir: 'custom/prompts' });
      
      // Trigger a template load
      await promptManager.formatPrompt('test-prompt', {});
      
      // Verify the correct path was used
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining(path.join('custom/prompts', 'test-prompt.txt')),
        expect.any(Object)
      );
    });
    
    it('should apply default variables', async () => {
      // Set default variables
      promptManager.configure({
        defaultVariables: {
          variable: 'default'
        }
      });
      
      // Load template without providing variables
      const result = await promptManager.formatPrompt('test-prompt', {});
      
      // Default variable should be applied
      expect(result).toBe('This is a default template');
    });
    
    it('should allow overriding default variables', async () => {
      // Set default variables
      promptManager.configure({
        defaultVariables: {
          variable: 'default'
        }
      });
      
      // Override with explicit variables
      const result = await promptManager.formatPrompt('test-prompt', {
        variable: 'override'
      });
      
      // Explicit variable should take precedence
      expect(result).toBe('This is a override template');
    });
  });
  
  // Variant selection
  describe('variant selection', () => {
    beforeEach(() => {
      // Setup file structure with variants
      fs.readdir.mockResolvedValue([
        'greeting.base.txt',
        'greeting.formal.txt',
        'greeting.casual.txt',
        'greeting.gpt4.txt'
      ]);
      
      // Setup variant content
      fs.readFile.mockImplementation((path) => {
        if (path.includes('greeting.base.txt')) {
          return Promise.resolve('Hello {{name}}');
        }
        if (path.includes('greeting.formal.txt')) {
          return Promise.resolve('Greetings, {{name}}');
        }
        if (path.includes('greeting.casual.txt')) {
          return Promise.resolve('Hey {{name}}!');
        }
        if (path.includes('greeting.gpt4.txt')) {
          return Promise.resolve('Hi {{name}}, GPT-4 here');
        }
        return Promise.reject(new Error('File not found'));
      });
    });
    
    it('should select the base variant by default', async () => {
      const result = await promptManager.formatPrompt('greeting', {
        name: 'User'
      });
      
      expect(result).toBe('Hello User');
    });
    
    it('should select a specific variant when requested', async () => {
      const result = await promptManager.formatPrompt('greeting', 
        { name: 'User' },
        { variant: 'formal' }
      );
      
      expect(result).toBe('Greetings, User');
    });
    
    it('should select a model-specific variant', async () => {
      const result = await promptManager.formatPrompt('greeting',
        { name: 'User' },
        { model: 'gpt4' }
      );
      
      expect(result).toBe('Hi User, GPT-4 here');
    });
    
    it('should fall back to base variant when requested variant is not found', async () => {
      const result = await promptManager.formatPrompt('greeting',
        { name: 'User' },
        { variant: 'nonexistent' }
      );
      
      expect(result).toBe('Hello User');
    });
  });
  
  // Advanced features
  describe('advanced features', () => {
    it('should support prompt composition with includes', async () => {
      // Mock to simulate template includes
      fs.readFile.mockImplementation((path) => {
        if (path.includes('main.txt')) {
          return Promise.resolve('Start\n{{#include header}}\nMiddle\n{{#include footer}}\nEnd');
        }
        if (path.includes('header.txt')) {
          return Promise.resolve('This is the header for {{name}}');
        }
        if (path.includes('footer.txt')) {
          return Promise.resolve('This is the footer');
        }
        return Promise.reject(new Error('File not found'));
      });
      
      // Enable include processing in our mock
      promptManager.configure({ processIncludes: true });
      
      const result = await promptManager.formatPrompt('main', { name: 'User' });
      
      expect(result).toContain('Start');
      expect(result).toContain('This is the header for User');
      expect(result).toContain('Middle');
      expect(result).toContain('This is the footer');
      expect(result).toContain('End');
    });
    
    it('should handle circular includes', async () => {
      // Mock to simulate circular includes
      fs.readFile.mockImplementation((path) => {
        if (path.includes('circular1.txt')) {
          return Promise.resolve('Circular 1\n{{#include circular2}}');
        }
        if (path.includes('circular2.txt')) {
          return Promise.resolve('Circular 2\n{{#include circular1}}');
        }
        return Promise.reject(new Error('File not found'));
      });
      
      // Enable include processing
      promptManager.configure({ processIncludes: true });
      
      // Should throw an error or have some circular reference detection
      await expect(promptManager.formatPrompt('circular1', {}))
        .rejects.toThrow(/circular reference|maximum depth|recursion/i);
    });
    
    it('should handle conditional sections in templates', async () => {
      // Template with conditional section
      fs.readFile.mockImplementation((path) => {
        if (path.includes('conditional.txt')) {
          return Promise.resolve('Start\n{{#if showExtra}}Extra content{{/if}}\nEnd');
        }
        return Promise.reject(new Error('File not found'));
      });
      
      // With condition true
      const resultTrue = await promptManager.formatPrompt('conditional', {
        showExtra: true
      });
      
      expect(resultTrue).toContain('Start');
      expect(resultTrue).toContain('Extra content');
      expect(resultTrue).toContain('End');
      
      // With condition false
      const resultFalse = await promptManager.formatPrompt('conditional', {
        showExtra: false
      });
      
      expect(resultFalse).toContain('Start');
      expect(resultFalse).not.toContain('Extra content');
      expect(resultFalse).toContain('End');
    });
  });
});