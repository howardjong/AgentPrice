/**
 * Mock PromptManager for Testing
 * 
 * This module provides a simplified and mockable version of the PromptManager
 * without the complex file system dependencies that make testing difficult.
 */

import EventEmitter from 'events';

class MockPromptManager extends EventEmitter {
  constructor() {
    super();
    this.promptCache = new Map();
    this.activeVersions = {
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
    this.prompts = new Map();
    this.initialized = false;
  }
  
  async initialize() {
    try {
      this.initialized = true;
      this.emit('initialized');
      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }
  
  getActiveVersion(engine, promptType) {
    try {
      if (promptType.includes('/')) {
        // Handle nested path for chart data
        const [category, subtype] = promptType.split('/');
        return this.activeVersions[engine]?.[category]?.[subtype] || 'default';
      }
      return this.activeVersions[engine]?.[promptType] || 'default';
    } catch (error) {
      return 'default';
    }
  }
  
  async setActiveVersion(engine, promptType, versionName) {
    try {
      // Update in-memory config
      if (promptType.includes('/')) {
        // Handle nested path for chart data
        const [category, subtype] = promptType.split('/');
        if (!this.activeVersions[engine]) this.activeVersions[engine] = {};
        if (!this.activeVersions[engine][category]) this.activeVersions[engine][category] = {};
        this.activeVersions[engine][category][subtype] = versionName;
      } else {
        if (!this.activeVersions[engine]) this.activeVersions[engine] = {};
        this.activeVersions[engine][promptType] = versionName;
      }
      
      // Clear cache entries for this prompt type
      for (const key of this.promptCache.keys()) {
        if (key.startsWith(`${engine}:${promptType}:`)) {
          this.promptCache.delete(key);
        }
      }
      
      this.emit('version-updated', { engine, promptType, versionName });
      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }
  
  async getPrompt(engine, promptType, variant = null) {
    const cacheKey = `${engine}:${promptType}:${variant || this.getActiveVersion(engine, promptType)}`;
    
    if (this.promptCache.has(cacheKey)) {
      return this.promptCache.get(cacheKey);
    }
    
    // In the mock, we'll use an in-memory map instead of files
    const key = variant 
      ? `${engine}:${promptType}:${variant}` 
      : `${engine}:${promptType}:${this.getActiveVersion(engine, promptType)}`;
      
    if (!this.prompts.has(key)) {
      this.prompts.set(key, `Mock prompt for ${engine} ${promptType} (${variant || this.getActiveVersion(engine, promptType)})`);
    }
    
    const content = this.prompts.get(key);
    this.promptCache.set(cacheKey, content);
    return content;
  }
  
  async setPrompt(engine, promptType, content, variant = null) {
    const key = variant 
      ? `${engine}:${promptType}:${variant}` 
      : `${engine}:${promptType}:default`;
      
    this.prompts.set(key, content);
    
    // Update cache if needed
    const cacheKey = `${engine}:${promptType}:${variant || 'default'}`;
    this.promptCache.set(cacheKey, content);
    
    return true;
  }
  
  formatPrompt(promptTemplate, variables) {
    if (!variables) return promptTemplate;
    
    let formattedPrompt = promptTemplate;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      formattedPrompt = formattedPrompt.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return formattedPrompt;
  }
}

export default new MockPromptManager();