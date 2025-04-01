/**
 * @file promptManager.template.vitest.js
 * @description Tests for the Prompt Manager service template loading and variable replacement
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Import the PromptManager instance
import promptManager from '../../../services/promptManager.js';

// Mock the logger
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('PromptManager Template Handling', () => {
  const originalDirname = path.dirname;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Save the original basePath and set a test path
    promptManager.originalBasePath = promptManager.basePath;
    promptManager.basePath = '/test/prompts';
    
    // Reset the prompt cache
    promptManager.promptCache.clear();
    
    // Setup default activeVersions for testing
    promptManager.activeVersions = {
      'claude': {
        'test_prompt': 'default',
        'chart_data': {
          'test_chart': 'default'
        }
      },
      'perplexity': {
        'test_prompt': 'default'
      }
    };
    
    // Mock filesystem access checks
    fs.access.mockImplementation((path) => {
      // Success for base directories
      if (
        path.includes('/test/prompts/claude') || 
        path.includes('/test/prompts/perplexity') ||
        path.includes('/config/prompt_config')
      ) {
        return Promise.resolve();
      }
      
      // Success for specific files we're testing
      if (
        path.includes('/test/prompts/claude/test_prompt.txt') ||
        path.includes('/test/prompts/claude/variants/test_prompt_test_variant.txt') ||
        path.includes('/test/prompts/claude/versions/test_prompt_v2.txt') ||
        path.includes('/test/prompts/claude/chart_data/test_chart.txt')
      ) {
        return Promise.resolve();
      }
      
      // Reject for all other paths
      return Promise.reject(new Error('ENOENT: file not found'));
    });
    
    // Mock successful file reading operations
    fs.readFile.mockImplementation((path, encoding) => {
      // Configuration file
      if (path.includes('active_versions.json')) {
        return Promise.resolve(JSON.stringify(promptManager.activeVersions));
      }
      
      // Test prompt files
      if (path.includes('/test/prompts/claude/test_prompt.txt')) {
        return Promise.resolve('This is a {{variable}} template');
      }
      if (path.includes('/test/prompts/claude/variants/test_prompt_test_variant.txt')) {
        return Promise.resolve('This is a variant prompt');
      }
      if (path.includes('/test/prompts/claude/versions/test_prompt_v2.txt')) {
        return Promise.resolve('This is version v2');
      }
      if (path.includes('/test/prompts/claude/chart_data/test_chart.txt')) {
        return Promise.resolve('Chart data prompt content');
      }
      
      // Default rejection
      return Promise.reject(new Error('ENOENT: file not found'));
    });
  });
  
  afterEach(() => {
    // Restore original path.dirname function
    path.dirname = originalDirname;
    
    // Restore original basePath if it was saved
    if (promptManager.originalBasePath) {
      promptManager.basePath = promptManager.originalBasePath;
      delete promptManager.originalBasePath;
    }
  });
  
  /**
   * Tests for initialization
   */
  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      // Mock successful config loading
      fs.readFile.mockResolvedValueOnce(JSON.stringify(promptManager.activeVersions));
      
      const result = await promptManager.initialize();
      
      expect(result).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('config/prompt_config/active_versions.json'),
        expect.any(String)
      );
    });
    
    it('should create default config if none exists', async () => {
      // Mock config file not found
      fs.readFile.mockRejectedValueOnce(new Error('ENOENT: file not found'));
      
      const result = await promptManager.initialize();
      
      expect(result).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('config/prompt_config'),
        expect.any(Object)
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('active_versions.json'),
        expect.any(String)
      );
    });
    
    it('should validate prompt directory structure', async () => {
      const result = await promptManager.validatePromptStructure();
      
      expect(result).toBe(true);
      // Should check for engines
      expect(fs.access).toHaveBeenCalledWith(
        expect.stringContaining('/prompts/claude')
      );
      expect(fs.access).toHaveBeenCalledWith(
        expect.stringContaining('/prompts/perplexity')
      );
    });
    
    it('should create missing directories during validation', async () => {
      // Mock missing directories
      fs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      
      await promptManager.validatePromptStructure();
      
      // Should create missing directories
      expect(fs.mkdir).toHaveBeenCalledTimes(expect.any(Number));
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: true })
      );
    });
    
    it('should ensure default prompts exist', async () => {
      // Mock files don't exist
      fs.access.mockRejectedValue(new Error('ENOENT: file not found'));
      
      const result = await promptManager.ensureDefaultPrompts();
      
      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledTimes(expect.any(Number));
    });
  });
  
  /**
   * Tests for getPrompt
   */
  describe('getPrompt', () => {
    it('should get a prompt using default version', async () => {
      // Mock successful file read
      fs.readFile.mockResolvedValueOnce('This is a test prompt');
      
      const result = await promptManager.getPrompt('claude', 'test_prompt');
      
      expect(result).toBe('This is a test prompt');
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('/claude/test_prompt.txt'),
        expect.any(String)
      );
    });
    
    it('should use cached prompt when available', async () => {
      // Add a prompt to the cache
      const cacheKey = 'claude:test_prompt:default';
      promptManager.promptCache.set(cacheKey, 'Cached prompt content');
      
      const result = await promptManager.getPrompt('claude', 'test_prompt');
      
      expect(result).toBe('Cached prompt content');
      // Should not read from filesystem
      expect(fs.readFile).not.toHaveBeenCalled();
    });
    
    it('should bypass cache when requested', async () => {
      // Add a prompt to the cache
      const cacheKey = 'claude:test_prompt:default';
      promptManager.promptCache.set(cacheKey, 'Cached prompt content');
      
      // Mock file content different from cache
      fs.readFile.mockResolvedValueOnce('Fresh prompt content');
      
      const result = await promptManager.getPrompt('claude', 'test_prompt', null, { useCache: false });
      
      expect(result).toBe('Fresh prompt content');
      expect(fs.readFile).toHaveBeenCalled();
    });
    
    it('should handle variant requests', async () => {
      // Mock variant file
      fs.readFile.mockResolvedValueOnce('This is a variant prompt');
      
      const result = await promptManager.getPrompt('claude', 'test_prompt', 'test_variant');
      
      expect(result).toBe('This is a variant prompt');
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('/claude/variants/test_prompt.txt'),
        expect.any(String)
      );
    });
    
    it('should handle specific versions', async () => {
      // Set a specific version
      promptManager.activeVersions.claude.test_prompt = 'v2';
      
      // Mock version file
      fs.readFile.mockResolvedValueOnce('This is version v2');
      
      const result = await promptManager.getPrompt('claude', 'test_prompt');
      
      expect(result).toBe('This is version v2');
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('/claude/versions/test_prompt_v2.txt'),
        expect.any(String)
      );
    });
    
    it('should handle chart data prompts', async () => {
      // Mock chart data file exists
      fs.access.mockImplementation((path) => {
        if (path.includes('chart_data/test_chart.txt')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });
      
      // Mock chart data content
      fs.readFile.mockResolvedValueOnce('Chart data prompt content');
      
      const result = await promptManager.getPrompt('claude', 'chart_data/test_chart');
      
      expect(result).toBe('Chart data prompt content');
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('/claude/chart_data/test_chart.txt'),
        expect.any(String)
      );
    });
    
    it('should throw error when prompt file not found', async () => {
      // Mock file not found
      fs.readFile.mockRejectedValueOnce(new Error('ENOENT: file not found'));
      
      await expect(promptManager.getPrompt('claude', 'nonexistent'))
        .rejects.toThrow('Failed to load prompt');
    });
  });
  
  /**
   * Tests for formatPrompt
   */
  describe('formatPrompt', () => {
    it('should replace variables in a template', () => {
      const template = 'Hello {{name}}, welcome to {{service}}!';
      const variables = {
        name: 'User',
        service: 'PromptManager'
      };
      
      const result = promptManager.formatPrompt(template, variables);
      
      expect(result).toBe('Hello User, welcome to PromptManager!');
    });
    
    it('should handle missing variables', () => {
      const template = 'Hello {{name}}, your age is {{age}}';
      const variables = {
        name: 'User'
        // age is missing
      };
      
      const result = promptManager.formatPrompt(template, variables);
      
      // Missing variables should remain as placeholders
      expect(result).toBe('Hello User, your age is {{age}}');
    });
    
    it('should handle nested object access', () => {
      const template = 'Hello {{user.name}}, your score is {{user.score}}';
      const variables = {
        user: {
          name: 'Test User',
          score: 95
        }
      };
      
      // Our simple implementation doesn't support nested objects
      // This test demonstrates the current behavior
      const result = promptManager.formatPrompt(template, variables);
      
      // Nested objects are not replaced with the current implementation
      expect(result).toBe('Hello {{user.name}}, your score is {{user.score}}');
    });
    
    it('should handle empty template', () => {
      const result = promptManager.formatPrompt('', {});
      expect(result).toBe('');
    });
  });
  
  /**
   * Tests for getActiveVersion
   */
  describe('getActiveVersion', () => {
    it('should return the active version for a prompt type', () => {
      // Set up test data
      promptManager.activeVersions = {
        'claude': {
          'test_prompt': 'v2'
        }
      };
      
      const result = promptManager.getActiveVersion('claude', 'test_prompt');
      
      expect(result).toBe('v2');
    });
    
    it('should return default if no version specified', () => {
      // No version specified for this prompt
      promptManager.activeVersions = {
        'claude': {
          // 'test_prompt' is missing
        }
      };
      
      const result = promptManager.getActiveVersion('claude', 'test_prompt');
      
      expect(result).toBe('default');
    });
    
    it('should handle nested paths for chart data', () => {
      // Set up test data with nested structure
      promptManager.activeVersions = {
        'claude': {
          'chart_data': {
            'test_chart': 'v3'
          }
        }
      };
      
      const result = promptManager.getActiveVersion('claude', 'chart_data/test_chart');
      
      expect(result).toBe('v3');
    });
    
    it('should handle missing engine', () => {
      // Empty activeVersions
      promptManager.activeVersions = {};
      
      const result = promptManager.getActiveVersion('unknown_engine', 'test_prompt');
      
      expect(result).toBe('default');
    });
    
    it('should handle errors gracefully', () => {
      // Set activeVersions to null to trigger error
      promptManager.activeVersions = null;
      
      const result = promptManager.getActiveVersion('claude', 'test_prompt');
      
      expect(result).toBe('default');
    });
  });
});