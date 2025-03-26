// Prompt management utility for creating, versioning and comparing prompts
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import promptManager from '../services/promptManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PromptManager {
  constructor() {
    this.basePath = path.join(__dirname, '..', 'prompts');
  }

  async initialize() {
    await promptManager.initialize();
  }

  async saveCurrentAsVersion(engine, promptType, versionName) {
    try {
      // First make sure prompt manager is initialized
      if (!promptManager.activeVersions) {
        await promptManager.initialize();
      }

      // Get the current prompt content
      const currentContent = await promptManager.getPrompt(engine, promptType, null, { useCache: false });

      // Determine the appropriate path for the version
      let versionPath;
      const promptTypeDir = path.join(this.basePath, engine, 'versions', promptType);

      // First check if the directory exists, create if needed
      try {
        await fs.access(promptTypeDir);
      } catch (err) {
        await fs.mkdir(promptTypeDir, { recursive: true });
      }

      versionPath = path.join(promptTypeDir, `${versionName}.txt`);

      // Write the version file
      await fs.writeFile(versionPath, currentContent);

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

  async updatePromptContent(engine, promptType, newContent) {
    try {
      // Initialize prompt manager if not already initialized
      if (!promptManager.activeVersions) {
        await promptManager.initialize();
      }

      const promptPath = path.join(this.basePath, engine, `${promptType}.txt`);

      // Write the new content
      await fs.writeFile(promptPath, newContent);

      // Clear cache
      const cacheKey = `${engine}:${promptType}:default`;
      promptManager.promptCache.delete(cacheKey);

      logger.info(`Updated ${engine}/${promptType} prompt content`);
      return {
        success: true,
        message: `Updated ${engine}/${promptType} prompt content`,
        engine,
        promptType
      };
    } catch (error) {
      logger.error('Error updating prompt content', {
        engine,
        promptType,
        error: error.message
      });
      return {
        success: false,
        message: `Failed to update prompt content: ${error.message}`,
        error
      };
    }
  }

  async listVersions(engine, promptType) {
    try {
      const result = await promptManager.listPromptVersions(engine, promptType);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      logger.error('Error listing prompt versions', {
        engine,
        promptType,
        error: error.message
      });
      return {
        success: false,
        message: `Failed to list prompt versions: ${error.message}`,
        error
      };
    }
  }

  async compareVersions(engine, promptType, version1, version2) {
    try {
      // Initialize prompt manager if not already initialized
      if (!promptManager.activeVersions) {
        await promptManager.initialize();
      }

      const content1 = await promptManager.getPrompt(engine, promptType, version1 === 'default' ? null : version1);
      const content2 = await promptManager.getPrompt(engine, promptType, version2 === 'default' ? null : version2);

      return {
        success: true,
        version1: {
          name: version1,
          content: content1,
          length: content1.length
        },
        version2: {
          name: version2,
          content: content2,
          length: content2.length
        }
      };
    } catch (error) {
      logger.error('Error comparing prompt versions', {
        engine,
        promptType,
        version1,
        version2,
        error: error.message
      });
      return {
        success: false,
        message: `Failed to compare prompt versions: ${error.message}`,
        error
      };
    }
  }

  async setActiveVersion(engine, promptType, versionName) {
    try {
      const result = await promptManager.setActiveVersion(engine, promptType, versionName);
      return {
        success: result,
        message: result ? `Set active version to ${versionName}` : 'Failed to set active version',
        engine,
        promptType,
        versionName
      };
    } catch (error) {
      logger.error('Error setting active version', {
        engine,
        promptType,
        versionName,
        error: error.message
      });
      return {
        success: false,
        message: `Failed to set active version: ${error.message}`,
        error
      };
    }
  }
}

const promptVersioner = new PromptManager();

import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function showMainMenu() {
  console.clear();
  console.log('========================================');
  console.log('🔄 PROMPT MANAGEMENT SYSTEM');
  console.log('========================================');
  console.log('1. Save current prompt as a version');
  console.log('2. Update prompt with new content');
  console.log('3. Switch to a different prompt version');
  console.log('4. List available prompt versions');
  console.log('0. Exit');
  console.log('----------------------------------------');

  const choice = await question('Enter your choice (0-4): ');

  switch (choice) {
    case '1':
      await saveCurrentPrompt();
      break;
    case '2':
      await updatePrompt();
      break;
    case '3':
      await switchVersion();
      break;
    case '4':
      await listVersions();
      break;
    case '0':
      rl.close();
      console.log('Goodbye!');
      process.exit(0);
      break;
    default:
      console.log('Invalid choice, please try again.');
      await new Promise(resolve => setTimeout(resolve, 1500));
      await showMainMenu();
  }
}

async function selectEngine() {
  console.log('\nSelect engine:');
  console.log('1. perplexity');
  console.log('2. claude');

  const choice = await question('Enter choice (1-2): ');

  if (choice === '1') return 'perplexity';
  if (choice === '2') return 'claude';

  console.log('Invalid choice, defaulting to perplexity');
  return 'perplexity';
}

async function selectPromptType(engine) {
  console.log(`\nSelect ${engine} prompt type:`);

  if (engine === 'perplexity') {
    console.log('1. deep_research');
    const choice = await question('Enter choice (1): ');
    return 'deep_research';
  } else if (engine === 'claude') {
    console.log('1. clarifying_questions');
    console.log('2. response_generation');
    console.log('3. chart_data');

    const choice = await question('Enter choice (1-3): ');

    if (choice === '1') return 'clarifying_questions';
    if (choice === '2') return 'response_generation';
    if (choice === '3') {
      console.log('\nSelect chart type:');
      console.log('1. van_westendorp');
      console.log('2. conjoint');
      console.log('3. basic_bar');

      const chartChoice = await question('Enter choice (1-3): ');

      if (chartChoice === '1') return 'chart_data/van_westendorp';
      if (chartChoice === '2') return 'chart_data/conjoint';
      if (chartChoice === '3') return 'chart_data/basic_bar';

      return 'chart_data/van_westendorp';
    }

    return 'clarifying_questions';
  }

  return null;
}

async function saveCurrentPrompt() {
  const engine = await selectEngine();
  const promptType = await selectPromptType(engine);

  if (!promptType) {
    console.log('Invalid prompt type.');
    await returnToMenu();
    return;
  }

  const versionName = await question('Enter version name (e.g., v20250326 or enhanced_prompt): ');

  console.log(`\nSaving current ${engine}/${promptType} prompt as version: ${versionName}`);
  const result = await promptVersioner.saveCurrentAsVersion(engine, promptType, versionName);

  console.log(result.message);
  await returnToMenu();
}

async function updatePrompt() {
  const engine = await selectEngine();
  const promptType = await selectPromptType(engine);

  if (!promptType) {
    console.log('Invalid prompt type.');
    await returnToMenu();
    return;
  }

  const saveOld = await question('Save current prompt as a version? (y/n): ');
  let saveOldAsVersion = null;

  if (saveOld.toLowerCase() === 'y') {
    saveOldAsVersion = await question('Enter version name for current prompt: ');
  }

  console.log('\nEnter new prompt content (end with a line containing only "END"):');
  let newContent = '';
  let line = '';

  do {
    line = await question('');
    if (line !== 'END') {
      newContent += line + '\n';
    }
  } while (line !== 'END');

  const result = await promptVersioner.updatePromptContent(
    engine,
    promptType,
    newContent,
  );

  console.log(result.message);
  await returnToMenu();
}

async function switchVersion() {
  const engine = await selectEngine();
  const promptType = await selectPromptType(engine);

  if (!promptType) {
    console.log('Invalid prompt type.');
    await returnToMenu();
    return;
  }

  const versions = await promptVersioner.listVersions(engine, promptType);

  console.log(`\nCurrent active version: ${versions.activeVersion}`);
  console.log('Available versions:');

  versions.availableVersions.forEach((version, i) => {
    console.log(`${i + 1}. ${version}`);
  });

  const choice = await question(`Select version (1-${versions.availableVersions.length}): `);
  const index = parseInt(choice) - 1;

  if (isNaN(index) || index < 0 || index >= versions.availableVersions.length) {
    console.log('Invalid selection.');
    await returnToMenu();
    return;
  }

  const versionName = versions.availableVersions[index];
  const result = await promptVersioner.setActiveVersion(engine, promptType, versionName);

  console.log(result.message);
  await returnToMenu();
}

async function listVersions() {
  const engine = await selectEngine();
  const promptType = await selectPromptType(engine);

  if (!promptType) {
    console.log('Invalid prompt type.');
    await returnToMenu();
    return;
  }

  const versions = await promptVersioner.listVersions(engine, promptType);

  console.log(`\nActive version: ${versions.activeVersion}`);
  console.log(`Available versions: ${versions.availableVersions.join(', ')}`);

  await returnToMenu();
}

async function returnToMenu() {
  await question('\nPress Enter to return to the main menu...');
  await showMainMenu();
}

// Start the CLI
async function start() {
  console.log('Initializing prompt manager...');
  await promptVersioner.initialize();
  await showMainMenu();
}

start().catch(err => {
  console.error('Error in prompt management CLI:', err);
  rl.close();
  process.exit(1);
});

export default promptVersioner;