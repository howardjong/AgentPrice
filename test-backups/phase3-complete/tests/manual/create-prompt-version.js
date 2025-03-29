
/**
 * Script to create a new version of a prompt
 * 
 * Usage: node tests/manual/create-prompt-version.js <engine> <promptType> <versionName>
 * Example: node tests/manual/create-prompt-version.js perplexity deep_research pricing_v1
 */

import promptVersioner from '../../utils/promptVersioner.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createPromptVersion() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node create-prompt-version.js <engine> <promptType> <versionName>');
    console.log('Example: node create-prompt-version.js perplexity deep_research pricing_v1');
    process.exit(1);
  }
  
  const [engine, promptType, versionName] = args;
  
  console.log(`Creating version "${versionName}" of ${engine}/${promptType} prompt...`);
  
  try {
    // First list the available versions to check if we already have versions
    const versions = await promptVersioner.listVersions(engine, promptType);
    console.log(`Active version: ${versions.activeVersion}`);
    console.log(`Available versions: ${versions.availableVersions.join(', ')}`);
    
    // Save the current prompt as a new version
    const result = await promptVersioner.saveCurrentAsVersion(engine, promptType, versionName);
    
    if (result.success) {
      console.log(`✅ Successfully created version "${versionName}" of ${engine}/${promptType} prompt`);
      
      // List the versions again to confirm the new version is there
      const updatedVersions = await promptVersioner.listVersions(engine, promptType);
      console.log(`\nUpdated versions list: ${updatedVersions.availableVersions.join(', ')}`);
      console.log(`\nTo use this version, run: node tests/manual/set-active-prompt.js ${engine} ${promptType} ${versionName}`);
    } else {
      console.error(`❌ Failed to create version: ${result.message}`);
    }
  } catch (error) {
    console.error('Error creating prompt version:', error);
    process.exit(1);
  }
}

createPromptVersion();
