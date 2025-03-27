
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class PromptManager {
  constructor(promptsDir = '../prompts') {
    this.promptsDir = path.resolve(__dirname, promptsDir);
    this.prompts = {};
    this.promptStats = {
      totalPrompts: 0,
      categoryCounts: {},
      usageCounts: {},
      averageLength: 0
    };
  }

  async loadPrompts() {
    try {
      // Get all directories in the prompts directory
      const services = await fs.readdir(this.promptsDir);
      
      for (const service of services) {
        const servicePath = path.join(this.promptsDir, service);
        const stats = await fs.stat(servicePath);
        
        if (!stats.isDirectory()) continue;
        
        // Get all categories in the service directory
        const categories = await fs.readdir(servicePath);
        
        for (const category of categories) {
          const categoryPath = path.join(servicePath, category);
          const categoryStats = await fs.stat(categoryPath);
          
          if (!categoryStats.isDirectory()) continue;
          
          // Get all prompts in the category directory
          const prompts = await fs.readdir(categoryPath);
          
          // Initialize category count
          if (!this.promptStats.categoryCounts[category]) {
            this.promptStats.categoryCounts[category] = 0;
          }
          
          for (const promptFile of prompts) {
            if (!promptFile.endsWith('.txt')) continue;
            
            const promptPath = path.join(categoryPath, promptFile);
            const promptContent = await fs.readFile(promptPath, 'utf8');
            
            // Store the prompt
            const promptKey = `${service}/${category}/${path.basename(promptFile, '.txt')}`;
            this.prompts[promptKey] = promptContent;
            
            // Update stats
            this.promptStats.totalPrompts++;
            this.promptStats.categoryCounts[category]++;
            this.promptStats.usageCounts[promptKey] = 0;
            this.promptStats.averageLength += promptContent.length;
          }
        }
      }
      
      // Calculate average prompt length
      if (this.promptStats.totalPrompts > 0) {
        this.promptStats.averageLength /= this.promptStats.totalPrompts;
      }
      
      logger.info(`Loaded ${this.promptStats.totalPrompts} prompts`);
      return this.prompts;
    } catch (error) {
      logger.error('Error loading prompts:', error);
      throw error;
    }
  }

  async getPrompt(service, category, name) {
    const promptKey = `${service}/${category}/${name}`;
    
    if (this.prompts[promptKey]) {
      // Increment usage count
      this.promptStats.usageCounts[promptKey]++;
      return this.prompts[promptKey];
    }
    
    // If prompt isn't loaded, try to load it directly
    try {
      const promptPath = path.join(this.promptsDir, service, category, `${name}.txt`);
      const promptContent = await fs.readFile(promptPath, 'utf8');
      
      // Store the prompt
      this.prompts[promptKey] = promptContent;
      
      // Update stats
      if (!this.promptStats.usageCounts[promptKey]) {
        this.promptStats.totalPrompts++;
        if (!this.promptStats.categoryCounts[category]) {
          this.promptStats.categoryCounts[category] = 0;
        }
        this.promptStats.categoryCounts[category]++;
      }
      
      this.promptStats.usageCounts[promptKey] = 1;
      
      return promptContent;
    } catch (error) {
      logger.error(`Error loading prompt ${service}/${category}/${name}:`, error);
      return null;
    }
  }

  async savePrompt(service, category, name, content) {
    try {
      // Ensure directories exist
      const servicePath = path.join(this.promptsDir, service);
      const categoryPath = path.join(servicePath, category);
      
      await fs.mkdir(servicePath, { recursive: true });
      await fs.mkdir(categoryPath, { recursive: true });
      
      // Save the prompt
      const promptPath = path.join(categoryPath, `${name}.txt`);
      await fs.writeFile(promptPath, content);
      
      // Update in-memory prompt
      const promptKey = `${service}/${category}/${name}`;
      this.prompts[promptKey] = content;
      
      // Update stats
      if (!this.promptStats.usageCounts[promptKey]) {
        this.promptStats.totalPrompts++;
        if (!this.promptStats.categoryCounts[category]) {
          this.promptStats.categoryCounts[category] = 0;
        }
        this.promptStats.categoryCounts[category]++;
      }
      
      logger.info(`Saved prompt ${service}/${category}/${name}`);
      return true;
    } catch (error) {
      logger.error(`Error saving prompt ${service}/${category}/${name}:`, error);
      return false;
    }
  }

  getStats() {
    return {
      ...this.promptStats,
      promptCount: this.promptStats.totalPrompts
    };
  }

  // Count total prompts for a specific service or category
  countPrompts(service = null, category = null) {
    if (!service && !category) {
      return this.promptStats.totalPrompts;
    }

    if (service && !category) {
      // Count prompts for a specific service
      return Object.keys(this.prompts)
        .filter(key => key.startsWith(`${service}/`))
        .length;
    }

    if (!service && category) {
      // Count prompts for a specific category
      return this.promptStats.categoryCounts[category] || 0;
    }

    // Count prompts for a specific service and category
    return Object.keys(this.prompts)
      .filter(key => key.startsWith(`${service}/${category}/`))
      .length;
  }

  // Get most used prompts
  getMostUsedPrompts(limit = 5) {
    return Object.entries(this.promptStats.usageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, count]) => ({
        prompt: key,
        usageCount: count
      }));
  }
}

module.exports = new PromptManager();
