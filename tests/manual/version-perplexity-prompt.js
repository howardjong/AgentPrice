
/**
 * Script to version the Perplexity deep_research prompt
 * 
 * This script:
 * 1. Saves the current Perplexity deep_research prompt as a version
 * 2. Updates the prompt with new content
 * 3. Lists all available versions
 */

import promptVersioner from '../../utils/promptVersioner.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function versionPerplexityPrompt() {
  const engine = 'perplexity';
  const promptType = 'deep_research';
  
  // Save the current prompt as a version with today's date
  const date = new Date();
  const versionName = `v${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
  
  console.log(`Saving current Perplexity deep_research prompt as version: ${versionName}`);
  const saveResult = await promptVersioner.saveCurrentAsVersion(engine, promptType, versionName);
  console.log(saveResult.message);
  
  // If you want to update with a new prompt, uncomment and modify these lines:
  // const newPromptContent = `Your new prompt content goes here...`;
  // const updateResult = await promptVersioner.updatePromptWithVersion(engine, promptType, newPromptContent);
  // console.log(updateResult.message);
  
  // List all available versions
  console.log('\nListing all available versions:');
  const versions = await promptVersioner.listVersions(engine, promptType);
  console.log(`Active version: ${versions.activeVersion}`);
  console.log(`Available versions: ${versions.availableVersions.join(', ')}`);
}

// Run the versioning process
versionPerplexityPrompt().catch(console.error);
