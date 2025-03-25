
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
      
      // Create additional subdirectories based on active versions config
      for (const [engine, promptTypes] of Object.entries(this.activeVersions)) {
        const enginePath = path.join(this.basePath, engine);
        
        for (const promptType of Object.keys(promptTypes)) {
          if (typeof promptTypes[promptType] === 'object') {
            // This is a nested structure like chart_data
            const categoryPath = path.join(enginePath, promptType);
            await fs.access(categoryPath).catch(async () => {
              logger.warn(`Creating missing prompt directory: ${categoryPath}`);
              await fs.mkdir(categoryPath, { recursive: true });
            });
            
            // Also create versions and variants subdirectories for this category
            const versionPath = path.join(enginePath, 'versions', promptType);
            await fs.access(versionPath).catch(async () => {
              logger.warn(`Creating missing prompt directory: ${versionPath}`);
              await fs.mkdir(versionPath, { recursive: true });
            });
            
            const variantPath = path.join(enginePath, 'variants', promptType);
            await fs.access(variantPath).catch(async () => {
              logger.warn(`Creating missing prompt directory: ${variantPath}`);
              await fs.mkdir(variantPath, { recursive: true });
            });
          } else {
            // Regular prompt type
            // Create subdirectories for versions and variants if needed
            const versionPath = path.join(enginePath, 'versions', promptType);
            await fs.access(versionPath).catch(async () => {
              logger.warn(`Creating missing prompt directory: ${versionPath}`);
              await fs.mkdir(versionPath, { recursive: true });
            });
            
            const variantPath = path.join(enginePath, 'variants', promptType);
            await fs.access(variantPath).catch(async () => {
              logger.warn(`Creating missing prompt directory: ${variantPath}`);
              await fs.mkdir(variantPath, { recursive: true });
            });
          }
        }
      }
      
      // Ensure chart_data directory exists for Claude
      const chartDataPath = path.join(this.basePath, 'claude', 'chart_data');
      await fs.access(chartDataPath).catch(async () => {
        logger.warn(`Creating missing prompt directory: ${chartDataPath}`);
        await fs.mkdir(chartDataPath, { recursive: true });
      });
      
      // Create default prompt files if they don't exist
      if (!(await this.ensureDefaultPrompts())) {
        logger.warn('Failed to create some default prompts');
      }
      
      return true;
    } catch (error) {
      logger.error('Error validating prompt structure', { error: error.message });
      throw error;
    }
  }
  
  async ensureDefaultPrompts() {
    try {
      // Check and create default prompts if needed
      const defaultPrompts = {
        'claude': {
          'clarifying_questions': 'Based on this research query, please generate 5 clarifying questions that would help better understand the user\'s specific information needs:\n\nResearch query: {{query}}\n\nGenerate questions that would help narrow down exactly what information would be most helpful to the user. The questions should be concise, non-redundant, and directly relevant to improving the research outcome.',
          'response_generation': 'Please provide a comprehensive response to the user\'s query. Use the following guidelines:\n\n1. Be accurate and factual\n2. Provide relevant examples when helpful\n3. Structure your response clearly with sections and bullet points as appropriate\n4. Identify any limitations or uncertainties in your response\n\nQuery: {{query}}\n{{#if context}}Additional context: {{context}}{{/if}}'
        },
        'perplexity': {
          'deep_research': 'You are a research assistant tasked with providing comprehensive, detailed responses on complex topics. Conduct deep research on the provided query.\n\nFor this deep research task:\n1. Focus on gathering authoritative, accurate, and up-to-date information\n2. Cite your sources clearly within your response\n3. Organize information logically with appropriate headings and structure\n4. Consider multiple perspectives and provide a balanced view\n5. Include relevant statistics, examples, and expert opinions where available\n6. Identify any limitations or gaps in the available information\n\nResearch query: {{query}}\n{{#if context}}Additional context: {{context}}{{/if}}'
        }
      };
      
      for (const [engine, prompts] of Object.entries(defaultPrompts)) {
        for (const [promptType, content] of Object.entries(prompts)) {
          const promptPath = path.join(this.basePath, engine, `${promptType}.txt`);
          
          try {
            await fs.access(promptPath);
            // Prompt exists, no need to create it
          } catch (err) {
            // Prompt doesn't exist, create it
            logger.info(`Creating default prompt: ${engine}/${promptType}`);
            await fs.writeFile(promptPath, content);
          }
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Error creating default prompts', { error: error.message });
      return false;
    }
  }

  async getPrompt(engine, promptType, variant = null, options = {}) {
    const cacheKey = `${engine}:${promptType}:${variant || this.getActiveVersion(engine, promptType)}`;
    const useCache = options.useCache !== false; // Default to using cache
    
    if (useCache && this.promptCache.has(cacheKey)) {
      logger.debug(`Using cached prompt for ${cacheKey}`);
      return this.promptCache.get(cacheKey);
    }
    
    try {
      let promptPath;
      
      if (variant) {
        // For variant testing, look in the variants folder
        promptPath = path.join(this.basePath, engine, 'variants', `${promptType}.txt`);
      } else {
        // Use the active version
        const version = this.getActiveVersion(engine, promptType);
        if (version === 'default') {
          // First try direct file in engine directory
          promptPath = path.join(this.basePath, engine, `${promptType}.txt`);
          
          // Check if file exists
          try {
            await fs.access(promptPath);
          } catch (err) {
            // If not found in direct path, try looking in a subdirectory with the same name as promptType
            const subdirPath = path.join(this.basePath, engine, promptType, 'default.txt');
            try {
              await fs.access(subdirPath);
              promptPath = subdirPath;
            } catch (subErr) {
              // Keep the original path, we'll handle the error below
            }
          }
        } else {
          promptPath = path.join(this.basePath, engine, 'versions', `${promptType}_${version}.txt`);
          
          // Check if file exists
          try {
            await fs.access(promptPath);
          } catch (err) {
            // Try alternative structure with subdirectories
            const subdirPath = path.join(this.basePath, engine, 'versions', promptType, `${version}.txt`);
            try {
              await fs.access(subdirPath);
              promptPath = subdirPath;
            } catch (subErr) {
              // Keep the original path, we'll handle the error below
            }
          }
        }
      }
      
      // Special handling for chart data prompts
      if (promptType.startsWith('chart_data/')) {
        const chartType = promptType.split('/')[1];
        const chartDataPath = path.join(this.basePath, engine, 'chart_data', `${chartType}.txt`);
        
        try {
          await fs.access(chartDataPath);
          promptPath = chartDataPath;
        } catch (err) {
          // The chart data path doesn't exist, keep using the previously calculated path
          logger.debug(`Chart data path ${chartDataPath} not found, using default path`);
        }
      }
      
      logger.debug(`Looking for prompt at path: ${promptPath}`);
      const promptContent = await fs.readFile(promptPath, 'utf8');
      this.promptCache.set(cacheKey, promptContent);
      
      logger.debug(`Loaded prompt ${engine}:${promptType}`, {
        engine,
        promptType,
        variant: variant || this.getActiveVersion(engine, promptType),
        size: promptContent.length,
        path: promptPath
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
      // Try to find the template location to mirror in variants
      let promptExists = false;
      
      // Check if a default prompt exists in root directory
      const rootPath = path.join(this.basePath, engine, `${promptType}.txt`);
      try {
        await fs.access(rootPath);
        promptExists = true;
        
        // Create in flat variant directory structure
        const variantPath = path.join(this.basePath, engine, 'variants', `${promptType}_${variantName}.txt`);
        await fs.writeFile(variantPath, content);
        logger.info(`Created prompt variant at ${variantPath}`);
      } catch (err) {
        // Root path doesn't exist, check subdirectory
        try {
          const subdirPath = path.join(this.basePath, engine, promptType, 'default.txt');
          await fs.access(subdirPath);
          promptExists = true;
          
          // Create in nested variant directory structure
          const variantDir = path.join(this.basePath, engine, 'variants', promptType);
          await fs.mkdir(variantDir, { recursive: true });
          
          const variantPath = path.join(variantDir, `${variantName}.txt`);
          await fs.writeFile(variantPath, content);
          logger.info(`Created prompt variant at ${variantPath}`);
        } catch (subErr) {
          // No existing templates found, create both directory and file
          const variantDir = path.join(this.basePath, engine, 'variants', promptType);
          await fs.mkdir(variantDir, { recursive: true });
          
          const variantPath = path.join(variantDir, `${variantName}.txt`);
          await fs.writeFile(variantPath, content);
          logger.info(`Created prompt variant at ${variantPath}`);
        }
      }
      
      // Clear cache entry if it exists
      const cacheKey = `${engine}:${promptType}:${variantName}`;
      this.promptCache.delete(cacheKey);
      
      logger.info('Created prompt variant', { engine, promptType, variantName });
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
      // Try to find the variant in both flat and nested structures
      let variantPath;
      let variantContent;
      
      // First try the flat structure
      const flatVariantPath = path.join(this.basePath, engine, 'variants', `${promptType}_${variantName}.txt`);
      try {
        await fs.access(flatVariantPath);
        variantPath = flatVariantPath;
      } catch (err) {
        // Try the nested structure
        const nestedVariantPath = path.join(this.basePath, engine, 'variants', promptType, `${variantName}.txt`);
        try {
          await fs.access(nestedVariantPath);
          variantPath = nestedVariantPath;
        } catch (subErr) {
          throw new Error(`Variant '${variantName}' for '${engine}/${promptType}' not found in any location`);
        }
      }
      
      // Read the variant content
      variantContent = await fs.readFile(variantPath, 'utf8');
      
      // Try to find the matching default prompt structure to mirror
      let defaultInRoot = false;
      try {
        await fs.access(path.join(this.basePath, engine, `${promptType}.txt`));
        defaultInRoot = true;
      } catch (err) {
        // Default not in root, check subdirectory
      }
      
      // Write to the appropriate versions directory structure
      if (defaultInRoot) {
        // Use flat structure
        const versionPath = path.join(this.basePath, engine, 'versions', `${promptType}_${versionName}.txt`);
        await fs.writeFile(versionPath, variantContent);
        logger.info(`Promoted variant to version at ${versionPath}`);
      } else {
        // Use nested structure
        const versionDir = path.join(this.basePath, engine, 'versions', promptType);
        await fs.mkdir(versionDir, { recursive: true });
        
        const versionPath = path.join(versionDir, `${versionName}.txt`);
        await fs.writeFile(versionPath, variantContent);
        logger.info(`Promoted variant to version at ${versionPath}`);
      }
      
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
      
      // Check for default prompt in engine directory
      const defaultPath = path.join(this.basePath, engine, `${promptType}.txt`);
      try {
        await fs.access(defaultPath);
        versions.push('default');
      } catch (err) {
        // Check for default in subdirectory
        const subdirDefaultPath = path.join(this.basePath, engine, promptType, 'default.txt');
        try {
          await fs.access(subdirDefaultPath);
          versions.push('default');
        } catch (subErr) {
          // Default doesn't exist in either location, that's ok
        }
      }
      
      // Check for versioned files in both patterns:
      // 1. engine/versions/promptType_version.txt format
      try {
        const versionsDir = path.join(this.basePath, engine, 'versions');
        const files = await fs.readdir(versionsDir);
        for (const file of files) {
          if (file.startsWith(`${promptType}_`) && file.endsWith('.txt')) {
            versions.push(file.replace(`${promptType}_`, '').replace('.txt', ''));
          }
        }
      } catch (err) {
        // Versions directory might not exist, that's ok
      }
      
      // 2. engine/versions/promptType/version.txt format
      try {
        const versionsSubdir = path.join(this.basePath, engine, 'versions', promptType);
        const files = await fs.readdir(versionsSubdir);
        for (const file of files) {
          if (file.endsWith('.txt')) {
            const version = file.replace('.txt', '');
            if (!versions.includes(version)) {
              versions.push(version);
            }
          }
        }
      } catch (err) {
        // Subdirectory might not exist, that's ok
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
