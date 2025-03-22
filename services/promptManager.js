
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PromptManager {
  constructor() {
    this.promptCache = new Map();
    this.activeVersions = {};
    this.basePath = path.join(__dirname, '..', 'prompts');
  }
  
  async initialize() {
    try {
      await this.loadPromptConfig();
      await this.validatePromptStructure();
      logger.info('Prompt manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize prompt manager', { error: error.message });
      throw error;
    }
  }
  
  async loadPromptConfig() {
    try {
      const configPath = path.join(__dirname, '..', 'config', 'prompt_config', 'active_versions.json');
      const configData = await fs.readFile(configPath, 'utf8');
      this.activeVersions = JSON.parse(configData);
      logger.info('Loaded prompt configuration', { versions: this.activeVersions });
    } catch (error) {
      logger.warn('Failed to load prompt config, using defaults', { error: error.message });
      
      // Set default versions
      this.activeVersions = {
        'claude': {
          'clarifying_questions': 'default',
          'response_generation': 'default',
          'chart_data': {
            'van_westendorp': 'default',
            'conjoint': 'default'
          }
        },
        'perplexity': {
          'deep_research': 'default'
        }
      };
      
      // Create the default config file
      try {
        const configPath = path.join(__dirname, '..', 'config', 'prompt_config');
        await fs.mkdir(configPath, { recursive: true });
        await fs.writeFile(
          path.join(configPath, 'active_versions.json'),
          JSON.stringify(this.activeVersions, null, 2)
        );
      } catch (writeError) {
        logger.error('Failed to write default config', { error: writeError.message });
      }
    }
  }
  
  async validatePromptStructure() {
    try {
      // Check for basic prompt directory structure
      const engines = ['claude', 'perplexity'];
      
      for (const engine of engines) {
        const enginePath = path.join(this.basePath, engine);
        await fs.access(enginePath).catch(async () => {
          logger.warn(`Creating missing prompt directory: ${enginePath}`);
          await fs.mkdir(enginePath, { recursive: true });
        });
        
        // Create versions and variants directories
        for (const subdir of ['versions', 'variants']) {
          const subdirPath = path.join(enginePath, subdir);
          await fs.access(subdirPath).catch(async () => {
            logger.warn(`Creating missing prompt directory: ${subdirPath}`);
            await fs.mkdir(subdirPath, { recursive: true });
          });
        }
      }
      
      // Ensure chart_data directory exists for Claude
      const chartDataPath = path.join(this.basePath, 'claude', 'chart_data');
      await fs.access(chartDataPath).catch(async () => {
        logger.warn(`Creating missing prompt directory: ${chartDataPath}`);
        await fs.mkdir(chartDataPath, { recursive: true });
      });
      
      return true;
    } catch (error) {
      logger.error('Error validating prompt structure', { error: error.message });
      throw error;
    }
  }

  async getPrompt(engine, promptType, variant = null) {
    const cacheKey = `${engine}:${promptType}:${variant || this.getActiveVersion(engine, promptType)}`;
    
    if (this.promptCache.has(cacheKey)) {
      return this.promptCache.get(cacheKey);
    }
    
    try {
      let promptPath;
      
      if (variant) {
        // For variant testing, look in the variants folder
        promptPath = path.join(this.basePath, engine, 'variants', promptType, `${variant}.txt`);
      } else {
        // Use the active version
        const version = this.getActiveVersion(engine, promptType);
        if (version === 'default') {
          promptPath = path.join(this.basePath, engine, `${promptType}.txt`);
        } else {
          promptPath = path.join(this.basePath, engine, 'versions', promptType, `${version}.txt`);
        }
      }
      
      // Special handling for chart data prompts
      if (promptType.startsWith('chart_data/')) {
        const chartType = promptType.split('/')[1];
        promptPath = path.join(this.basePath, engine, 'chart_data', `${chartType}.txt`);
      }
      
      const promptContent = await fs.readFile(promptPath, 'utf8');
      this.promptCache.set(cacheKey, promptContent);
      
      logger.debug(`Loaded prompt ${engine}:${promptType}`, {
        engine,
        promptType,
        variant: variant || this.getActiveVersion(engine, promptType),
        size: promptContent.length
      });
      
      return promptContent;
    } catch (error) {
      logger.error('Error loading prompt', {
        engine,
        promptType,
        variant,
        error: error.message
      });
      throw new Error(`Failed to load prompt: ${error.message}`);
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
  
  async createPromptVariant(engine, promptType, variantName, content) {
    try {
      const variantDir = path.join(this.basePath, engine, 'variants', promptType);
      await fs.mkdir(variantDir, { recursive: true });
      
      const variantPath = path.join(variantDir, `${variantName}.txt`);
      await fs.writeFile(variantPath, content);
      
      logger.info('Created prompt variant', { engine, promptType, variantName });
      
      // Clear cache entry if it exists
      const cacheKey = `${engine}:${promptType}:${variantName}`;
      this.promptCache.delete(cacheKey);
      
      return true;
    } catch (error) {
      logger.error('Failed to create prompt variant', {
        engine,
        promptType,
        variantName,
        error: error.message
      });
      return false;
    }
  }
  
  async promoteVariantToVersion(engine, promptType, variantName, versionName) {
    try {
      // Read the variant content
      const variantPath = path.join(this.basePath, engine, 'variants', promptType, `${variantName}.txt`);
      const promptContent = await fs.readFile(variantPath, 'utf8');
      
      // Write to versions directory
      const versionDir = path.join(this.basePath, engine, 'versions', promptType);
      await fs.mkdir(versionDir, { recursive: true });
      
      const versionPath = path.join(versionDir, `${versionName}.txt`);
      await fs.writeFile(versionPath, promptContent);
      
      logger.info('Promoted variant to version', {
        engine,
        promptType,
        variantName,
        versionName
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to promote variant', {
        engine,
        promptType,
        variantName,
        versionName,
        error: error.message
      });
      return false;
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
      
      // Write to config file
      const configPath = path.join(__dirname, '..', 'config', 'prompt_config', 'active_versions.json');
      await fs.writeFile(configPath, JSON.stringify(this.activeVersions, null, 2));
      
      // Clear cache entries for this prompt type
      for (const key of this.promptCache.keys()) {
        if (key.startsWith(`${engine}:${promptType}:`)) {
          this.promptCache.delete(key);
        }
      }
      
      logger.info('Set active version', { engine, promptType, versionName });
      return true;
    } catch (error) {
      logger.error('Failed to set active version', {
        engine,
        promptType,
        versionName,
        error: error.message
      });
      return false;
    }
  }
  
  formatPrompt(promptTemplate, variables) {
    let formattedPrompt = promptTemplate;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      formattedPrompt = formattedPrompt.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return formattedPrompt;
  }
  
  async listPromptVersions(engine, promptType) {
    try {
      const versions = [];
      
      // Always add default if it exists
      const defaultPath = path.join(this.basePath, engine, `${promptType}.txt`);
      try {
        await fs.access(defaultPath);
        versions.push('default');
      } catch (err) {
        // Default doesn't exist, that's ok
      }
      
      // List versions
      const versionsDir = path.join(this.basePath, engine, 'versions', promptType);
      try {
        const files = await fs.readdir(versionsDir);
        for (const file of files) {
          if (file.endsWith('.txt')) {
            versions.push(file.replace('.txt', ''));
          }
        }
      } catch (err) {
        // Versions directory might not exist yet, that's ok
      }
      
      return {
        activeVersion: this.getActiveVersion(engine, promptType),
        availableVersions: versions
      };
    } catch (error) {
      logger.error('Error listing prompt versions', {
        engine,
        promptType,
        error: error.message
      });
      throw error;
    }
  }
}

const promptManager = new PromptManager();
export default promptManager;
