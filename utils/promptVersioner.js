
/**
 * Prompt Versioning Utility
 * 
 * This utility provides functions to:
 * 1. Save the current version of a prompt
 * 2. Create a new version of a prompt
 * 3. Switch between prompt versions
 */

import promptManager from '../services/promptManager.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PromptVersioner {
  constructor() {
    this.promptManager = promptManager;
    this.basePath = path.join(__dirname, '..', 'prompts');
  }

  /**
   * Saves the current version of a prompt under a new version name
   * 
   * @param {string} engine - The engine (e.g., 'perplexity', 'claude')
   * @param {string} promptType - The prompt type (e.g., 'deep_research')
   * @param {string} versionName - The name to save this version as
   */
  async saveCurrentAsVersion(engine, promptType, versionName) {
    try {
      // Initialize prompt manager if not already initialized
      if (!this.promptManager.activeVersions) {
        await this.promptManager.initialize();
      }

      // Get the current prompt content
      const currentPrompt = await this.promptManager.getPrompt(engine, promptType, null, { useCache: false });

      // Create a variant first (temporary storage)
      const variantName = `temp_${Date.now()}`;
      await this.promptManager.createPromptVariant(engine, promptType, variantName, currentPrompt);

      // Promote the variant to a version
      await this.promptManager.promoteVariantToVersion(engine, promptType, variantName, versionName);

      // Log success
      logger.info(`Saved current ${engine}/${promptType} prompt as version: ${versionName}`);
      return {
        success: true,
        message: `Current prompt saved as version: ${versionName}`,
        engine,
        promptType,
        versionName
      };
    } catch (error) {
      logger.error('Error saving prompt version', {
        engine,
        promptType,
        versionName,
        error: error.message
      });
      return {
        success: false,
        message: `Failed to save prompt version: ${error.message}`,
        error
      };
    }
  }

  /**
   * Updates the prompt with new content and saves the previous as a version
   * 
   * @param {string} engine - The engine (e.g., 'perplexity', 'claude')
   * @param {string} promptType - The prompt type (e.g., 'deep_research')
   * @param {string} newContent - The new content for the prompt
   * @param {string} saveOldAsVersion - Optional name to save the old version as
   */
  async updatePromptWithVersion(engine, promptType, newContent, saveOldAsVersion) {
    try {
      // Initialize prompt manager if not already initialized
      if (!this.promptManager.activeVersions) {
        await this.promptManager.initialize();
      }

      // If a version name is provided for the old content, save it first
      if (saveOldAsVersion) {
        await this.saveCurrentAsVersion(engine, promptType, saveOldAsVersion);
      }

      // Update the prompt file
      const promptPath = path.join(this.basePath, engine, `${promptType}.txt`);
      await fs.writeFile(promptPath, newContent);

      // Clear any cache for this prompt
      const cacheKey = `${engine}:${promptType}:default`;
      this.promptManager.promptCache.delete(cacheKey);

      logger.info(`Updated ${engine}/${promptType} prompt`);
      return {
        success: true,
        message: `Prompt updated successfully${saveOldAsVersion ? ` and old version saved as '${saveOldAsVersion}'` : ''}`,
        engine,
        promptType
      };
    } catch (error) {
      logger.error('Error updating prompt', {
        engine,
        promptType,
        error: error.message
      });
      return {
        success: false,
        message: `Failed to update prompt: ${error.message}`,
        error
      };
    }
  }

  /**
   * Switch to a different version of a prompt
   * 
   * @param {string} engine - The engine (e.g., 'perplexity', 'claude')
   * @param {string} promptType - The prompt type (e.g., 'deep_research')
   * @param {string} versionName - The version to switch to, or 'default'
   */
  async switchToVersion(engine, promptType, versionName) {
    try {
      // Initialize prompt manager if not already initialized
      if (!this.promptManager.activeVersions) {
        await this.promptManager.initialize();
      }

      // Set the active version
      await this.promptManager.setActiveVersion(engine, promptType, versionName);

      logger.info(`Switched ${engine}/${promptType} to version: ${versionName}`);
      return {
        success: true,
        message: `Switched to version: ${versionName}`,
        engine,
        promptType,
        versionName
      };
    } catch (error) {
      logger.error('Error switching prompt version', {
        engine,
        promptType,
        versionName,
        error: error.message
      });
      return {
        success: false,
        message: `Failed to switch version: ${error.message}`,
        error
      };
    }
  }

  /**
   * List all available versions for a prompt
   * 
   * @param {string} engine - The engine (e.g., 'perplexity', 'claude')
   * @param {string} promptType - The prompt type (e.g., 'deep_research')
   */
  async listVersions(engine, promptType) {
    try {
      // Initialize prompt manager if not already initialized
      if (!this.promptManager.activeVersions) {
        await this.promptManager.initialize();
      }

      const versionInfo = await this.promptManager.listPromptVersions(engine, promptType);
      
      logger.info(`Listed versions for ${engine}/${promptType}`, versionInfo);
      return {
        success: true,
        ...versionInfo
      };
    } catch (error) {
      logger.error('Error listing prompt versions', {
        engine,
        promptType,
        error: error.message
      });
      return {
        success: false,
        message: `Failed to list versions: ${error.message}`,
        error
      };
    }
  }
}

const promptVersioner = new PromptVersioner();
export default promptVersioner;
