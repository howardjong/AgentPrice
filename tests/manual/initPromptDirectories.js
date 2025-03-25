
/**
 * Initialize Prompt Directory Structure
 * 
 * This script creates the necessary prompt directory structure before merging,
 * ensuring compatibility with the prompt reorganization in the main branch.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initPromptDirectories() {
  const basePath = path.join(__dirname, '..', '..', 'prompts');
  
  try {
    logger.info('Initializing prompt directory structure');
    
    // Ensure base prompts directory exists
    await fs.mkdir(basePath, { recursive: true });
    
    // Create engine-specific directories
    const engines = ['claude', 'perplexity'];
    for (const engine of engines) {
      const enginePath = path.join(basePath, engine);
      await fs.mkdir(enginePath, { recursive: true });
      
      // Create versions and variants subdirectories
      await fs.mkdir(path.join(enginePath, 'versions'), { recursive: true });
      await fs.mkdir(path.join(enginePath, 'variants'), { recursive: true });
      
      // For Claude, create chart_data directory
      if (engine === 'claude') {
        await fs.mkdir(path.join(enginePath, 'chart_data'), { recursive: true });
      }
    }
    
    logger.info('Prompt directory structure initialized successfully');
    return true;
  } catch (error) {
    logger.error('Error initializing prompt directories', { error: error.message });
    return false;
  }
}

// Run the initialization
initPromptDirectories()
  .then(success => {
    if (success) {
      logger.info('Directory structure verification complete');
      console.log('✅ Prompt directory structure is ready for merge');
    } else {
      logger.error('Directory structure verification failed');
      console.error('❌ Failed to initialize prompt directory structure');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error('Unexpected error during directory initialization', { error: error.message });
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  });
