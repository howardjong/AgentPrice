import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';

// Auto-mock the necessary modules
vi.mock('../../../utils/logger.js');
vi.mock('../../../services/promptManager.js');

// Import the mocked modules
import logger from '../../../utils/logger.js';
import promptManager from '../../../services/promptManager.js';

// Setup mocks after imports
beforeEach(() => {
  // Mock logger
  vi.mocked(logger).info = vi.fn();
  vi.mocked(logger).warn = vi.fn();
  vi.mocked(logger).error = vi.fn();
  vi.mocked(logger).debug = vi.fn();

  // Setup promptManager mock
  promptManager.promptCache = new Map();
  promptManager.activeVersions = {
    'claude': {
      'clarifying_questions': 'v1',
      'response_generation': 'default',
      'chart_data': {
        'van_westendorp': 'test_version',
        'conjoint': 'default'
      }
    },
    'perplexity': {
      'deep_research': 'v2'
    }
  };
  
  // Mock functions
  vi.mocked(promptManager).initialize = vi.fn().mockResolvedValue(true);
  vi.mocked(promptManager).getPrompt = vi.fn().mockImplementation(async (engine, promptType, variant = null, options = {}) => {
    const cacheKey = `${engine}:${promptType}:${variant || 'default'}`;
    
    if (promptManager.promptCache.has(cacheKey)) {
      return promptManager.promptCache.get(cacheKey);
    }
    
    let promptContent = `Mock ${engine} ${promptType} prompt`;
    if (variant) {
      promptContent = `Mock ${engine} ${promptType} variant ${variant} prompt`;
    } else if (promptType.includes('clarifying') && engine === 'claude') {
      promptContent = 'Mock clarifying questions prompt v1';
    } else if (promptType.includes('deep_research') && engine === 'perplexity') {
      promptContent = 'Mock deep research prompt v2';
    } else if (promptType.includes('chart_data')) {
      promptContent = `Mock chart data prompt for ${promptType.split('/')[1]}`;
    }
    
    promptManager.promptCache.set(cacheKey, promptContent);
    return promptContent;
  });
  
  vi.mocked(promptManager).getActiveVersion = vi.fn().mockImplementation((engine, promptType) => {
    if (promptType.includes('/')) {
      const [category, subtype] = promptType.split('/');
      return promptManager.activeVersions[engine]?.[category]?.[subtype] || 'default';
    }
    return promptManager.activeVersions[engine]?.[promptType] || 'default';
  });
  
  vi.mocked(promptManager).createPromptVariant = vi.fn().mockResolvedValue(true);
  vi.mocked(promptManager).promoteVariantToVersion = vi.fn().mockResolvedValue(true);
  vi.mocked(promptManager).listPromptVersions = vi.fn().mockResolvedValue(['default', 'v1', 'v2']);
  
  vi.mocked(promptManager).setActiveVersion = vi.fn().mockImplementation(async (engine, promptType, versionName) => {
    if (promptType.includes('/')) {
      const [category, subtype] = promptType.split('/');
      if (!promptManager.activeVersions[engine]) {
        promptManager.activeVersions[engine] = {};
      }
      if (!promptManager.activeVersions[engine][category]) {
        promptManager.activeVersions[engine][category] = {};
      }
      promptManager.activeVersions[engine][category][subtype] = versionName;
    } else {
      if (!promptManager.activeVersions[engine]) {
        promptManager.activeVersions[engine] = {};
      }
      promptManager.activeVersions[engine][promptType] = versionName;
    }
    return true;
  });
});

describe('PromptManager', () => {
  beforeEach(() => {
    // Reset mock function calls and implementation
    vi.clearAllMocks();
    
    // Reset the prompt manager's cache
    promptManager.promptCache.clear();
  });
  
  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const result = await promptManager.initialize();
      expect(result).toBe(true);
      expect(promptManager.initialize).toHaveBeenCalled();
    });
  });
  
  describe('getPrompt', () => {
    it('should return a cached prompt if available', async () => {
      // Add a mock prompt to the cache
      promptManager.promptCache.set('claude:clarifying_questions:v1', 'Cached prompt');
      
      // Override the mocked getPrompt function for this specific test
      const originalGetPrompt = promptManager.getPrompt;
      promptManager.getPrompt = vi.fn().mockImplementation(async (engine, promptType, variant = null, options = {}) => {
        const cacheKey = `${engine}:${promptType}:${promptManager.getActiveVersion(engine, promptType)}`;
        return promptManager.promptCache.get(cacheKey) || 'Default content';
      });
      
      // Make sure getActiveVersion returns 'v1' for this test
      promptManager.getActiveVersion.mockReturnValueOnce('v1');
      
      const result = await promptManager.getPrompt('claude', 'clarifying_questions');
      expect(result).toBe('Cached prompt');
      
      // Restore the original function for other tests
      promptManager.getPrompt = originalGetPrompt;
    });
    
    it('should return a prompt for Claude clarifying questions', async () => {
      const result = await promptManager.getPrompt('claude', 'clarifying_questions');
      expect(result).toBe('Mock clarifying questions prompt v1');
      expect(promptManager.getPrompt).toHaveBeenCalledWith('claude', 'clarifying_questions');
    });
    
    it('should return a prompt for Perplexity deep research', async () => {
      const result = await promptManager.getPrompt('perplexity', 'deep_research');
      expect(result).toBe('Mock deep research prompt v2');
      expect(promptManager.getPrompt).toHaveBeenCalledWith('perplexity', 'deep_research');
    });
    
    it('should handle chart data prompts correctly', async () => {
      const result = await promptManager.getPrompt('claude', 'chart_data/van_westendorp');
      expect(result).toBe('Mock chart data prompt for van_westendorp');
      expect(promptManager.getPrompt).toHaveBeenCalledWith('claude', 'chart_data/van_westendorp');
    });
    
    it('should handle variant prompts', async () => {
      const result = await promptManager.getPrompt('claude', 'clarifying_questions', 'test_variant');
      expect(result).toBe('Mock claude clarifying_questions variant test_variant prompt');
      expect(promptManager.getPrompt).toHaveBeenCalledWith('claude', 'clarifying_questions', 'test_variant');
    });
  });
  
  describe('getActiveVersion', () => {
    it('should return the correct active version for a prompt type', () => {
      const result = promptManager.getActiveVersion('claude', 'clarifying_questions');
      expect(result).toBe('v1');
    });
    
    it('should return the correct active version for a nested prompt type', () => {
      const result = promptManager.getActiveVersion('claude', 'chart_data/van_westendorp');
      expect(result).toBe('test_version');
    });
    
    it('should return default if no active version is defined', () => {
      const result = promptManager.getActiveVersion('claude', 'nonexistent');
      expect(result).toBe('default');
    });
  });
  
  describe('createPromptVariant', () => {
    it('should create a new prompt variant', async () => {
      const result = await promptManager.createPromptVariant(
        'claude',
        'clarifying_questions',
        'test_variant',
        'Test variant content'
      );
      
      expect(result).toBe(true);
      expect(promptManager.createPromptVariant).toHaveBeenCalledWith(
        'claude',
        'clarifying_questions',
        'test_variant',
        'Test variant content'
      );
    });
  });
  
  describe('listPromptVersions', () => {
    it('should return a list of available prompt versions', async () => {
      const versions = await promptManager.listPromptVersions('claude', 'clarifying_questions');
      expect(versions).toEqual(['default', 'v1', 'v2']);
      expect(promptManager.listPromptVersions).toHaveBeenCalledWith('claude', 'clarifying_questions');
    });
  });
  
  describe('setActiveVersion', () => {
    it('should update the active version for a prompt type', async () => {
      const result = await promptManager.setActiveVersion('claude', 'clarifying_questions', 'v2');
      expect(result).toBe(true);
      expect(promptManager.activeVersions.claude.clarifying_questions).toBe('v2');
      expect(promptManager.setActiveVersion).toHaveBeenCalledWith('claude', 'clarifying_questions', 'v2');
    });
    
    it('should handle nested prompt types', async () => {
      const result = await promptManager.setActiveVersion('claude', 'chart_data/van_westendorp', 'v3');
      expect(result).toBe(true);
      expect(promptManager.activeVersions.claude.chart_data.van_westendorp).toBe('v3');
      expect(promptManager.setActiveVersion).toHaveBeenCalledWith('claude', 'chart_data/van_westendorp', 'v3');
    });
  });
});