
#!/usr/bin/env node

/**
 * Prompt Management CLI Tool
 * 
 * This tool allows you to:
 * - Save current prompts as versions
 * - Update prompts with new content
 * - Switch between prompt versions
 * - List available prompt versions
 */

import promptVersioner from './promptVersioner.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface for CLI input/output
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
  
  const result = await promptVersioner.updatePromptWithVersion(
    engine, 
    promptType, 
    newContent, 
    saveOldAsVersion
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
  const result = await promptVersioner.switchToVersion(engine, promptType, versionName);
  
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
  await promptVersioner.promptManager.initialize();
  await showMainMenu();
}

start().catch(err => {
  console.error('Error in prompt management CLI:', err);
  rl.close();
  process.exit(1);
});
