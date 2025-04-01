/**
 * Prompt Manager Mock Tests
 * 
 * A robust test suite for the PromptManager using a simplified mock version to avoid
 * complex file system interactions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import promptManager from './promptManager.mock.js';

describe('PromptManager Mock Tests', () => {
  beforeEach(() => {
    // Reset the prompt cache and internal values
    promptManager.promptCache.clear();
    promptManager.prompts.clear();
    promptManager.activeVersions = {
      'claude': {
        'system': 'default',
        'response_generation': 'v2',
        'chart_data': {
          'pricing': 'v1'
        }
      },
      'perplexity': {
        'deep_research': 'default'
      }
    };
  });
  
  describe('initialize', () => {
    it('should initialize successfully', async () => {
      // Create a spy to check if the event is emitted
      const initSpy = vi.fn();
      promptManager.on('initialized', initSpy);
      
      const result = await promptManager.initialize();
      
      expect(result).toBe(true);
      expect(promptManager.initialized).toBe(true);
      expect(initSpy).toHaveBeenCalled();
      
      // Clean up event listener
      promptManager.off('initialized', initSpy);
    });
  });
  
  describe('formatPrompt', () => {
    it('should replace variables in a template', () => {
      const template = 'Hello {{name}}, your query is: {{query}}';
      const variables = {
        name: 'User',
        query: 'How to test prompt systems?'
      };
      
      const result = promptManager.formatPrompt(template, variables);
      
      expect(result).toBe('Hello User, your query is: How to test prompt systems?');
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
    
    it('should handle null or undefined variables', () => {
      const template = 'Hello {{name}}';
      
      // Test with null
      expect(promptManager.formatPrompt(template, null)).toBe(template);
      
      // Test with undefined
      expect(promptManager.formatPrompt(template, undefined)).toBe(template);
    });
    
    it('should handle multiple replacements of the same variable', () => {
      const template = '{{name}} is my name, call me {{name}}';
      const variables = {
        name: 'Bob'
      };
      
      const result = promptManager.formatPrompt(template, variables);
      
      expect(result).toBe('Bob is my name, call me Bob');
    });
  });
  
  describe('getActiveVersion', () => {
    it('should return the active version for a prompt type', () => {
      const result = promptManager.getActiveVersion('claude', 'response_generation');
      expect(result).toBe('v2');
    });
    
    it('should return default if no version specified', () => {
      const result = promptManager.getActiveVersion('claude', 'nonexistent');
      expect(result).toBe('default');
    });
    
    it('should handle nested paths for chart data', () => {
      const result = promptManager.getActiveVersion('claude', 'chart_data/pricing');
      expect(result).toBe('v1');
    });
    
    it('should handle missing engine', () => {
      const result = promptManager.getActiveVersion('nonexistent', 'test_prompt');
      expect(result).toBe('default');
    });
    
    it('should handle errors gracefully', () => {
      // Force an error by using an invalid structure
      promptManager.activeVersions = null;
      
      const result = promptManager.getActiveVersion('claude', 'test_prompt');
      expect(result).toBe('default');
    });
  });
  
  describe('setActiveVersion', () => {
    it('should update active version for a prompt type', async () => {
      // Create a spy to check if the event is emitted
      const updateSpy = vi.fn();
      promptManager.on('version-updated', updateSpy);
      
      const result = await promptManager.setActiveVersion('claude', 'test_prompt', 'v2');
      
      expect(result).toBe(true);
      expect(promptManager.activeVersions.claude.test_prompt).toBe('v2');
      expect(updateSpy).toHaveBeenCalledWith({
        engine: 'claude',
        promptType: 'test_prompt',
        versionName: 'v2'
      });
      
      // Clean up event listener
      promptManager.off('version-updated', updateSpy);
    });
    
    it('should create engine entry if it doesn\'t exist', async () => {
      // Remove engine
      promptManager.activeVersions = {};
      
      const result = await promptManager.setActiveVersion('claude', 'test_prompt', 'v2');
      
      expect(result).toBe(true);
      expect(promptManager.activeVersions.claude).toBeDefined();
      expect(promptManager.activeVersions.claude.test_prompt).toBe('v2');
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
  });
  
  describe('getPrompt and setPrompt', () => {
    it('should retrieve a default prompt', async () => {
      // First set a prompt
      await promptManager.setPrompt('claude', 'test_prompt', 'This is a test prompt');
      
      // Then get it
      const result = await promptManager.getPrompt('claude', 'test_prompt');
      
      expect(result).toBe('This is a test prompt');
    });
    
    it('should retrieve a specific variant', async () => {
      // Set both default and variant
      await promptManager.setPrompt('claude', 'test_prompt', 'Default content');
      await promptManager.setPrompt('claude', 'test_prompt', 'Variant content', 'variant_a');
      
      // Get the variant
      const result = await promptManager.getPrompt('claude', 'test_prompt', 'variant_a');
      
      expect(result).toBe('Variant content');
    });
    
    it('should use cache for repeated requests', async () => {
      // Set a prompt
      await promptManager.setPrompt('claude', 'test_prompt', 'Cached content');
      
      // First get populates cache
      await promptManager.getPrompt('claude', 'test_prompt');
      
      // Change the underlying content without clearing cache
      promptManager.prompts.set('claude:test_prompt:default', 'Updated content');
      
      // Second get should use cache
      const result = await promptManager.getPrompt('claude', 'test_prompt');
      
      expect(result).toBe('Cached content');
    });
    
    it('should generate default prompts when not explicitly set', async () => {
      // Get a prompt that wasn't set
      const result = await promptManager.getPrompt('claude', 'new_prompt');
      
      expect(result).toContain('Mock prompt for claude new_prompt');
    });
  });
  
  describe('formatPrompt with real prompts', () => {
    it('should replace variables in actual prompts', async () => {
      // Set a prompt with variables
      await promptManager.setPrompt(
        'claude', 
        'test_format', 
        'Hello {{name}}, here is info about {{topic}}.'
      );
      
      // Get the prompt
      const template = await promptManager.getPrompt('claude', 'test_format');
      
      // Format it
      const result = promptManager.formatPrompt(template, {
        name: 'User',
        topic: 'testing'
      });
      
      expect(result).toBe('Hello User, here is info about testing.');
    });
  });
});