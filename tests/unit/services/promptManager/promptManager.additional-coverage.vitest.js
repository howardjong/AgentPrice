/**
 * Additional Prompt Manager Tests for Coverage Improvement
 * 
 * This file focuses on improving the test coverage for the Prompt Manager service
 * by targeting specific code paths and edge cases that aren't covered by the 
 * existing tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';

// Mock dependencies before import
vi.mock('../../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(() => Promise.resolve({ isDirectory: () => false }))
}));

vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    join: vi.fn((...args) => args.join('/').replace('//', '/')),
    dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
    resolve: vi.fn((...args) => args.join('/').replace('//', '/'))
  };
});

vi.mock('url', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fileURLToPath: vi.fn(() => '/mock/path/services/promptManager.js')
  };
});

// Import dependencies after mocking
import logger from '../../../../utils/logger.js';
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Import the module under test after setting up mocks
// Reset all modules to ensure we have a clean import
vi.resetModules();
import promptManager from '../../../../services/promptManager.js';

describe('PromptManager Additional Coverage Tests', () => {
  let originalBasePath;
  
  beforeEach(() => {
    // Reset mocks and cache
    vi.clearAllMocks();
    promptManager.promptCache.clear();
    
    // Store the original basePath
    originalBasePath = promptManager.basePath;
    
    // Set a controlled basePath for testing
    promptManager.basePath = '/test/prompts';
    
    // Mock active versions
    promptManager.activeVersions = {
      claude: {
        clarifying_questions: 'v2',
        response_generation: 'default',
        chart_data: {
          van_westendorp: 'default',
          conjoint: 'v1'
        }
      },
      perplexity: {
        deep_research: 'v1'
      }
    };
    
    // Mock file read operations for the most common scenarios
    fs.readFile.mockImplementation((filePath, encoding) => {
      if (filePath.includes('active_versions.json')) {
        return Promise.resolve(JSON.stringify(promptManager.activeVersions));
      }
      
      // Return templated content for prompt files
      if (filePath.includes('.txt')) {
        return Promise.resolve('Test prompt content with {{variable}}');
      }
      
      return Promise.reject(new Error('File not found'));
    });
    
    // Mock file existence checks
    fs.access.mockImplementation((filePath) => {
      // Default success for most paths
      if (filePath.includes('/test/prompts')) {
        return Promise.resolve();
      }
      // Reject for non-existent paths
      return Promise.reject(new Error('ENOENT: file not found'));
    });
    
    // Mock directory listing
    fs.readdir.mockImplementation((dirPath) => {
      if (dirPath.includes('/versions')) {
        return Promise.resolve([
          'clarifying_questions_v1.txt',
          'clarifying_questions_v2.txt',
          'response_generation_v1.txt'
        ]);
      }
      if (dirPath.includes('/variants')) {
        return Promise.resolve([
          'clarifying_questions_experimental.txt'
        ]);
      }
      return Promise.resolve([]);
    });
    
    // Mock file write operations
    fs.writeFile.mockResolvedValue(undefined);
    fs.mkdir.mockResolvedValue(undefined);
  });
  
  afterEach(() => {
    // Restore original basePath
    promptManager.basePath = originalBasePath;
  });
  
  describe('formatPrompt Function', () => {
    it('should replace variables in templates correctly', () => {
      // Arrange
      const template = 'Hello {{name}}, your age is {{age}}. Welcome to {{service}}!';
      const variables = {
        name: 'John',
        age: '30',
        service: 'Our Platform'
      };
      
      // Act
      const result = promptManager.formatPrompt(template, variables);
      
      // Assert
      expect(result).toBe('Hello John, your age is 30. Welcome to Our Platform!');
    });
    
    it('should handle multiple occurrences of the same variable', () => {
      // Arrange
      const template = 'Your name is {{name}}. Hello {{name}}! Goodbye {{name}}.';
      const variables = { name: 'Alice' };
      
      // Act
      const result = promptManager.formatPrompt(template, variables);
      
      // Assert
      expect(result).toBe('Your name is Alice. Hello Alice! Goodbye Alice.');
    });
    
    it('should leave unmatched variables unchanged', () => {
      // Arrange
      const template = 'Hello {{name}}. Your task is {{task}}.';
      const variables = { name: 'Bob' };
      
      // Act
      const result = promptManager.formatPrompt(template, variables);
      
      // Assert
      expect(result).toBe('Hello Bob. Your task is {{task}}.');
    });
    
    it('should handle empty variables object', () => {
      // Arrange
      const template = 'Hello {{name}}!';
      const variables = {};
      
      // Act
      const result = promptManager.formatPrompt(template, variables);
      
      // Assert
      expect(result).toBe('Hello {{name}}!');
    });
    
    it('should handle special characters in variables', () => {
      // Arrange
      const template = 'Query: {{query}}';
      const variables = { query: 'How to use regex like (.*) and [a-z]?' };
      
      // Act
      const result = promptManager.formatPrompt(template, variables);
      
      // Assert
      expect(result).toBe('Query: How to use regex like (.*) and [a-z]?');
    });
  });
  
  describe('setActiveVersion Function', () => {
    it('should update the active version for a prompt type', async () => {
      // Arrange
      const engine = 'claude';
      const promptType = 'clarifying_questions';
      const newVersion = 'v3';
      
      // Act
      const result = await promptManager.setActiveVersion(engine, promptType, newVersion);
      
      // Assert
      expect(result).toBe(true);
      expect(promptManager.activeVersions.claude.clarifying_questions).toBe(newVersion);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('active_versions.json'),
        expect.any(String)
      );
    });
    
    it('should handle nested chart data paths', async () => {
      // Arrange
      const engine = 'claude';
      const promptType = 'chart_data/van_westendorp';
      const newVersion = 'v2';
      
      // Act
      const result = await promptManager.setActiveVersion(engine, promptType, newVersion);
      
      // Assert
      expect(result).toBe(true);
      expect(promptManager.activeVersions.claude.chart_data.van_westendorp).toBe(newVersion);
    });
    
    it('should create missing engine and prompt type entries', async () => {
      // Arrange
      const engine = 'openai';  // New engine not in activeVersions
      const promptType = 'completion';
      const version = 'v1';
      
      // Act
      const result = await promptManager.setActiveVersion(engine, promptType, version);
      
      // Assert
      expect(result).toBe(true);
      expect(promptManager.activeVersions.openai.completion).toBe(version);
    });
    
    it('should handle write errors gracefully', async () => {
      // Arrange
      fs.writeFile.mockRejectedValueOnce(new Error('Permission denied'));
      
      // Act
      const result = await promptManager.setActiveVersion('claude', 'clarifying_questions', 'v3');
      
      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to set active version',
        expect.objectContaining({
          error: 'Permission denied'
        })
      );
    });
    
    it('should clear cache entries for the affected prompt type', async () => {
      // Arrange
      // Add a couple of items to the cache
      promptManager.promptCache.set('claude:clarifying_questions:v1', 'cached content v1');
      promptManager.promptCache.set('claude:clarifying_questions:v2', 'cached content v2');
      promptManager.promptCache.set('claude:response_generation:v1', 'other prompt'); // Should remain
      
      // Act
      await promptManager.setActiveVersion('claude', 'clarifying_questions', 'v3');
      
      // Assert
      expect(promptManager.promptCache.has('claude:clarifying_questions:v1')).toBe(false);
      expect(promptManager.promptCache.has('claude:clarifying_questions:v2')).toBe(false);
      expect(promptManager.promptCache.has('claude:response_generation:v1')).toBe(true);
    });
  });
  
  describe('promoteVariantToVersion Function', () => {
    it('should promote a variant to a version using flat structure', async () => {
      // Arrange
      // Mock finding the variant in the flat structure
      fs.access.mockImplementation((filePath) => {
        if (filePath.includes('variants/clarifying_questions_experimental.txt')) {
          return Promise.resolve();
        }
        if (filePath.includes('claude/clarifying_questions.txt')) {
          return Promise.resolve(); // Root file exists (for defaultInRoot check)
        }
        return Promise.reject(new Error('File not found'));
      });
      
      // Act
      const result = await promptManager.promoteVariantToVersion(
        'claude', 
        'clarifying_questions', 
        'experimental', 
        'v3'
      );
      
      // Assert
      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/versions/clarifying_questions_v3.txt'),
        expect.any(String)
      );
    });
    
    it('should promote a variant to a version using nested structure', async () => {
      // Arrange
      // Mock file existence checks for nested structure
      fs.access.mockImplementation((filePath) => {
        if (filePath.includes('variants/clarifying_questions/experimental.txt')) {
          return Promise.resolve();
        }
        if (filePath.includes('claude/clarifying_questions.txt')) {
          return Promise.reject(new Error('File not found')); // Root file doesn't exist
        }
        return Promise.reject(new Error('File not found'));
      });
      
      // Act
      const result = await promptManager.promoteVariantToVersion(
        'claude', 
        'clarifying_questions', 
        'experimental', 
        'v3'
      );
      
      // Assert
      expect(result).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('/versions/clarifying_questions'),
        expect.objectContaining({ recursive: true })
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/versions/clarifying_questions/v3.txt'),
        expect.any(String)
      );
    });
    
    it('should handle errors when variant file does not exist', async () => {
      // Arrange
      // Mock file non-existence
      fs.access.mockRejectedValue(new Error('File not found'));
      
      // Act
      const result = await promptManager.promoteVariantToVersion(
        'claude', 
        'clarifying_questions', 
        'nonexistent', 
        'v3'
      );
      
      // Assert
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to promote variant',
        expect.objectContaining({
          error: expect.stringContaining('not found')
        })
      );
    });
  });
  
  describe('listPromptVersions Function', () => {
    it('should list available prompt versions including default', async () => {
      // Arrange
      // Mock finding the default prompt
      fs.access.mockImplementation((filePath) => {
        if (filePath.includes('claude/clarifying_questions.txt')) {
          return Promise.resolve();
        }
        return Promise.resolve(); // Allow other files too
      });
      
      // Act
      const result = await promptManager.listPromptVersions('claude', 'clarifying_questions');
      
      // Assert
      expect(result.availableVersions).toContain('default');
      expect(result.availableVersions).toContain('v1');
      expect(result.availableVersions).toContain('v2');
      expect(result.activeVersion).toBe('v2');
    });
    
    it('should handle subdirectory structure for version listing', async () => {
      // Arrange
      // Mock subdirectory structure
      fs.access.mockImplementation((filePath) => {
        if (filePath.includes('claude/clarifying_questions.txt')) {
          return Promise.reject(new Error('Not found'));
        }
        if (filePath.includes('claude/clarifying_questions/default.txt')) {
          return Promise.resolve();
        }
        return Promise.resolve();
      });
      
      fs.readdir.mockImplementation((dirPath) => {
        if (dirPath.includes('/versions/clarifying_questions')) {
          return Promise.resolve(['v1.txt', 'v2.txt', 'v3.txt']);
        }
        return Promise.resolve([]);
      });
      
      // Act
      const result = await promptManager.listPromptVersions('claude', 'clarifying_questions');
      
      // Assert
      expect(result.availableVersions).toContain('default');
      expect(result.availableVersions).toContain('v1');
      expect(result.availableVersions).toContain('v2');
      expect(result.availableVersions).toContain('v3');
    });
    
    it('should handle errors during version listing', async () => {
      // Arrange
      fs.readdir.mockRejectedValue(new Error('Permission denied'));
      
      // Act & Assert
      await expect(promptManager.listPromptVersions('claude', 'clarifying_questions'))
        .rejects.toThrow('Error listing prompt versions');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Error listing prompt versions',
        expect.objectContaining({
          error: 'Permission denied'
        })
      );
    });
  });
  
  describe('Advanced getPrompt Scenarios', () => {
    it('should handle chart data prompts special case', async () => {
      // Arrange
      fs.access.mockImplementation((filePath) => {
        if (filePath.includes('chart_data/van_westendorp.txt')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });
      
      // Act
      const result = await promptManager.getPrompt('claude', 'chart_data/van_westendorp');
      
      // Assert
      expect(result).toBe('Test prompt content with {{variable}}');
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('chart_data/van_westendorp.txt'),
        'utf8'
      );
    });
    
    it('should check subdirectory when main file not found for default version', async () => {
      // Arrange
      fs.access.mockImplementation((filePath) => {
        if (filePath.includes('claude/response_generation.txt')) {
          return Promise.reject(new Error('Not found'));
        }
        if (filePath.includes('claude/response_generation/default.txt')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });
      
      // Mock activeVersions to return default for this prompt
      const originalGetActiveVersion = promptManager.getActiveVersion;
      promptManager.getActiveVersion = vi.fn().mockReturnValue('default');
      
      // Act
      const result = await promptManager.getPrompt('claude', 'response_generation');
      
      // Assert
      expect(result).toBe('Test prompt content with {{variable}}');
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('response_generation/default.txt'),
        'utf8'
      );
      
      // Restore original function
      promptManager.getActiveVersion = originalGetActiveVersion;
    });
    
    it('should check subdirectory when main file not found for specific version', async () => {
      // Arrange
      fs.access.mockImplementation((filePath) => {
        if (filePath.includes('versions/response_generation_v1.txt')) {
          return Promise.reject(new Error('Not found'));
        }
        if (filePath.includes('versions/response_generation/v1.txt')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });
      
      // Mock activeVersions to return v1 for this prompt
      const originalGetActiveVersion = promptManager.getActiveVersion;
      promptManager.getActiveVersion = vi.fn().mockReturnValue('v1');
      
      // Act
      const result = await promptManager.getPrompt('claude', 'response_generation');
      
      // Assert
      expect(result).toBe('Test prompt content with {{variable}}');
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('versions/response_generation/v1.txt'),
        'utf8'
      );
      
      // Restore original function
      promptManager.getActiveVersion = originalGetActiveVersion;
    });
  });
  
  describe('getActiveVersion Function', () => {
    it('should return the correct version for a simple prompt type', () => {
      // Act
      const version = promptManager.getActiveVersion('claude', 'clarifying_questions');
      
      // Assert
      expect(version).toBe('v2');
    });
    
    it('should return the correct version for a nested chart data path', () => {
      // Act
      const version = promptManager.getActiveVersion('claude', 'chart_data/conjoint');
      
      // Assert
      expect(version).toBe('v1');
    });
    
    it('should return default for a non-existent prompt type', () => {
      // Act
      const version = promptManager.getActiveVersion('claude', 'nonexistent_prompt');
      
      // Assert
      expect(version).toBe('default');
    });
    
    it('should return default for a non-existent engine', () => {
      // Act
      const version = promptManager.getActiveVersion('nonexistent_engine', 'clarifying_questions');
      
      // Assert
      expect(version).toBe('default');
    });
    
    it('should handle error conditions gracefully', () => {
      // Arrange
      // Temporarily break activeVersions
      const originalVersions = promptManager.activeVersions;
      promptManager.activeVersions = null;
      
      // Act
      const version = promptManager.getActiveVersion('claude', 'clarifying_questions');
      
      // Assert
      expect(version).toBe('default');
      
      // Restore
      promptManager.activeVersions = originalVersions;
    });
  });
});