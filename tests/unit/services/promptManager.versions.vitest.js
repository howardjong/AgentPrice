/**
 * @file promptManager.versions.vitest.js
 * @description Tests for the Prompt Manager service version and variant management
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

describe('PromptManager Version Management', () => {
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
        path.includes('/test/prompts/claude/versions') ||
        path.includes('/test/prompts/claude/variants')
      ) {
        return Promise.resolve();
      }
      
      // Success for specific files we're testing
      if (
        path.includes('/test/prompts/claude/test_prompt.txt') ||
        path.includes('/test/prompts/claude/variants/test_prompt_variant1.txt') ||
        path.includes('/test/prompts/claude/versions/test_prompt_v2.txt') ||
        path.includes('/test/prompts/claude/chart_data/test_chart.txt')
      ) {
        return Promise.resolve();
      }
      
      // Reject for all other paths
      return Promise.reject(new Error('ENOENT: file not found'));
    });
    
    // Mock directory listings
    fs.readdir.mockImplementation((dirPath) => {
      if (dirPath.includes('/test/prompts/claude/versions')) {
        return Promise.resolve(['test_prompt_v1.txt', 'test_prompt_v2.txt', 'other_prompt_v1.txt']);
      }
      
      if (dirPath.includes('/test/prompts/claude/variants')) {
        return Promise.resolve(['test_prompt_variant1.txt', 'test_prompt_variant2.txt']);
      }
      
      if (dirPath.includes('/test/prompts/claude/versions/test_prompt')) {
        return Promise.resolve(['v1.txt', 'v2.txt']);
      }
      
      return Promise.resolve([]);
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
   * Tests for createPromptVariant
   */
  describe('createPromptVariant', () => {
    it('should create a variant in the flat directory structure', async () => {
      // Mock root path exists
      fs.access.mockImplementation(path => {
        if (path.includes('/claude/test_prompt.txt')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });
      
      const result = await promptManager.createPromptVariant('claude', 'test_prompt', 'new_variant', 'New variant content');
      
      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/claude/variants/test_prompt_new_variant.txt'),
        'New variant content'
      );
    });
    
    it('should create a variant in the nested directory structure', async () => {
      // Mock root path doesn't exist but subdir does
      fs.access.mockImplementation(path => {
        if (path.includes('/claude/test_prompt.txt')) {
          return Promise.reject(new Error('File not found'));
        }
        if (path.includes('/claude/test_prompt/default.txt')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });
      
      const result = await promptManager.createPromptVariant('claude', 'test_prompt', 'new_variant', 'New variant content');
      
      expect(result).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('/claude/variants/test_prompt'),
        expect.any(Object)
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/claude/variants/test_prompt/new_variant.txt'),
        'New variant content'
      );
    });
    
    it('should create directories if needed', async () => {
      // Mock all paths don't exist
      fs.access.mockRejectedValue(new Error('File not found'));
      
      const result = await promptManager.createPromptVariant('claude', 'new_prompt', 'new_variant', 'New variant content');
      
      expect(result).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('/claude/variants/new_prompt'),
        expect.any(Object)
      );
    });
    
    it('should clear cache entry for the variant', async () => {
      // Add a cache entry
      const cacheKey = 'claude:test_prompt:new_variant';
      promptManager.promptCache.set(cacheKey, 'Old cached content');
      
      // Mock successful file access
      fs.access.mockResolvedValue(undefined);
      
      await promptManager.createPromptVariant('claude', 'test_prompt', 'new_variant', 'New content');
      
      // Cache should be cleared
      expect(promptManager.promptCache.has(cacheKey)).toBe(false);
    });
    
    it('should handle errors gracefully', async () => {
      // Mock write failure
      fs.writeFile.mockRejectedValue(new Error('Write failed'));
      
      const result = await promptManager.createPromptVariant('claude', 'test_prompt', 'new_variant', 'Content');
      
      expect(result).toBe(false);
    });
  });
  
  /**
   * Tests for promoteVariantToVersion
   */
  describe('promoteVariantToVersion', () => {
    it('should promote a variant to a version in flat directory structure', async () => {
      // Mock variant exists in flat structure
      fs.access.mockImplementation(path => {
        if (path.includes('/claude/variants/test_prompt_variant1.txt')) {
          return Promise.resolve();
        }
        if (path.includes('/claude/test_prompt.txt')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });
      
      // Mock reading the variant content
      fs.readFile.mockResolvedValueOnce('Variant content');
      
      const result = await promptManager.promoteVariantToVersion('claude', 'test_prompt', 'variant1', 'v3');
      
      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/claude/versions/test_prompt_v3.txt'),
        'Variant content'
      );
    });
    
    it('should promote a variant to a version in nested directory structure', async () => {
      // Mock variant exists in nested structure
      fs.access.mockImplementation(path => {
        if (path.includes('/claude/variants/test_prompt_variant1.txt')) {
          return Promise.reject(new Error('File not found'));
        }
        if (path.includes('/claude/variants/test_prompt/variant1.txt')) {
          return Promise.resolve();
        }
        if (path.includes('/claude/test_prompt.txt')) {
          return Promise.reject(new Error('File not found'));
        }
        if (path.includes('/claude/test_prompt/default.txt')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });
      
      // Mock reading the variant content
      fs.readFile.mockResolvedValueOnce('Nested variant content');
      
      const result = await promptManager.promoteVariantToVersion('claude', 'test_prompt', 'variant1', 'v3');
      
      expect(result).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('/claude/versions/test_prompt'),
        expect.any(Object)
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/claude/versions/test_prompt/v3.txt'),
        'Nested variant content'
      );
    });
    
    it('should throw error when variant not found', async () => {
      // Mock variant not found in any location
      fs.access.mockRejectedValue(new Error('File not found'));
      
      await expect(promptManager.promoteVariantToVersion('claude', 'test_prompt', 'nonexistent', 'v3'))
        .rejects.toThrow("Variant 'nonexistent' for 'claude/test_prompt' not found");
    });
    
    it('should update active version when promoted', async () => {
      // Mock variant exists
      fs.access.mockResolvedValueOnce(undefined);
      fs.readFile.mockResolvedValueOnce('Variant content');
      
      // Spy on setActiveVersion
      const setActiveVersionSpy = vi.spyOn(promptManager, 'setActiveVersion');
      
      await promptManager.promoteVariantToVersion('claude', 'test_prompt', 'variant1', 'v3', { setActive: true });
      
      expect(setActiveVersionSpy).toHaveBeenCalledWith('claude', 'test_prompt', 'v3');
    });
    
    it('should not update active version when not requested', async () => {
      // Mock variant exists
      fs.access.mockResolvedValueOnce(undefined);
      fs.readFile.mockResolvedValueOnce('Variant content');
      
      // Spy on setActiveVersion
      const setActiveVersionSpy = vi.spyOn(promptManager, 'setActiveVersion');
      
      await promptManager.promoteVariantToVersion('claude', 'test_prompt', 'variant1', 'v3', { setActive: false });
      
      expect(setActiveVersionSpy).not.toHaveBeenCalled();
    });
  });
  
  /**
   * Tests for setActiveVersion
   */
  describe('setActiveVersion', () => {
    it('should update active version for a prompt type', async () => {
      const result = await promptManager.setActiveVersion('claude', 'test_prompt', 'v2');
      
      expect(result).toBe(true);
      expect(promptManager.activeVersions.claude.test_prompt).toBe('v2');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('active_versions.json'),
        expect.any(String)
      );
    });
    
    it('should create engine entry if it doesn\'t exist', async () => {
      // Remove engine
      delete promptManager.activeVersions.perplexity;
      
      const result = await promptManager.setActiveVersion('perplexity', 'test_prompt', 'v1');
      
      expect(result).toBe(true);
      expect(promptManager.activeVersions.perplexity).toBeDefined();
      expect(promptManager.activeVersions.perplexity.test_prompt).toBe('v1');
    });
    
    it('should handle nested paths for chart data', async () => {
      const result = await promptManager.setActiveVersion('claude', 'chart_data/test_chart', 'v3');
      
      expect(result).toBe(true);
      expect(promptManager.activeVersions.claude.chart_data.test_chart).toBe('v3');
    });
    
    it('should clear cache entries for the prompt type', async () => {
      // Add cache entries
      promptManager.promptCache.set('claude:test_prompt:default', 'Default content');
      promptManager.promptCache.set('claude:test_prompt:v1', 'V1 content');
      promptManager.promptCache.set('claude:other_prompt:default', 'Other content');
      
      await promptManager.setActiveVersion('claude', 'test_prompt', 'v2');
      
      // Cache for test_prompt should be cleared, other_prompt should remain
      expect(promptManager.promptCache.has('claude:test_prompt:default')).toBe(false);
      expect(promptManager.promptCache.has('claude:test_prompt:v1')).toBe(false);
      expect(promptManager.promptCache.has('claude:other_prompt:default')).toBe(true);
    });
    
    it('should handle errors gracefully', async () => {
      // Mock write failure
      fs.writeFile.mockRejectedValue(new Error('Write failed'));
      
      const result = await promptManager.setActiveVersion('claude', 'test_prompt', 'v2');
      
      expect(result).toBe(false);
    });
  });
  
  /**
   * Tests for listPromptVersions
   */
  describe('listPromptVersions', () => {
    it('should list all available versions for a prompt type', async () => {
      // Mock default prompt exists
      fs.access.mockImplementation(path => {
        if (path.includes('/claude/test_prompt.txt')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });
      
      const result = await promptManager.listPromptVersions('claude', 'test_prompt');
      
      expect(result.activeVersion).toBe('default');
      expect(result.availableVersions).toContain('default');
      expect(result.availableVersions).toContain('v1');
      expect(result.availableVersions).toContain('v2');
    });
    
    it('should handle nested directory structure', async () => {
      // Mock default in nested structure
      fs.access.mockImplementation(path => {
        if (path.includes('/claude/test_prompt.txt')) {
          return Promise.reject(new Error('File not found'));
        }
        if (path.includes('/claude/test_prompt/default.txt')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });
      
      // Mock nested versions directory
      fs.readdir.mockImplementation(path => {
        if (path.includes('/claude/versions')) {
          return Promise.resolve([]);
        }
        if (path.includes('/claude/versions/test_prompt')) {
          return Promise.resolve(['v1.txt', 'v2.txt']);
        }
        return Promise.resolve([]);
      });
      
      const result = await promptManager.listPromptVersions('claude', 'test_prompt');
      
      expect(result.availableVersions).toContain('default');
      expect(result.availableVersions).toContain('v1');
      expect(result.availableVersions).toContain('v2');
    });
    
    it('should handle missing prompt directories', async () => {
      // Mock directories don't exist
      fs.access.mockRejectedValue(new Error('File not found'));
      fs.readdir.mockRejectedValue(new Error('Directory not found'));
      
      const result = await promptManager.listPromptVersions('claude', 'nonexistent');
      
      expect(result.availableVersions).toEqual([]);
    });
    
    it('should return active version even if no versions exist', async () => {
      // Mock no prompt files exist
      fs.access.mockRejectedValue(new Error('File not found'));
      fs.readdir.mockResolvedValue([]);
      
      // Set a custom active version
      promptManager.activeVersions.claude.test_prompt = 'custom';
      
      const result = await promptManager.listPromptVersions('claude', 'test_prompt');
      
      expect(result.activeVersion).toBe('custom');
      expect(result.availableVersions).toEqual([]);
    });
    
    it('should handle errors gracefully', async () => {
      // Mock unexpected error
      fs.readdir.mockRejectedValue(new Error('Unexpected error'));
      
      await expect(promptManager.listPromptVersions('claude', 'test_prompt'))
        .rejects.toThrow('Error listing prompt versions');
    });
  });
});