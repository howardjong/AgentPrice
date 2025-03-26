
/**
 * Script to set the active version of a prompt
 * 
 * Usage: node tests/manual/set-active-prompt.js <engine> <promptType> <versionName>
 * Example: node tests/manual/set-active-prompt.js perplexity deep_research pricing_v1
 */

import promptVersioner from '../../utils/promptVersioner.js';

async function setActivePromptVersion() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node set-active-prompt.js <engine> <promptType> <versionName>');
    console.log('Example: node set-active-prompt.js perplexity deep_research pricing_v1');
    process.exit(1);
  }
  
  const [engine, promptType, versionName] = args;
  
  console.log(`Setting active version of ${engine}/${promptType} prompt to "${versionName}"...`);
  
  try {
    // First list the available versions to check if the version exists
    const versions = await promptVersioner.listVersions(engine, promptType);
    console.log(`Current active version: ${versions.activeVersion}`);
    console.log(`Available versions: ${versions.availableVersions.join(', ')}`);
    
    if (!versions.availableVersions.includes(versionName)) {
      console.error(`❌ Version "${versionName}" not found in available versions`);
      process.exit(1);
    }
    
    // Set the active version
    const result = await promptVersioner.setActiveVersion(engine, promptType, versionName);
    
    if (result.success) {
      console.log(`✅ Successfully set active version to "${versionName}"`);
      
      // Confirm the active version has been updated
      const updatedVersions = await promptVersioner.listVersions(engine, promptType);
      console.log(`\nNew active version: ${updatedVersions.activeVersion}`);
    } else {
      console.error(`❌ Failed to set active version: ${result.message}`);
    }
  } catch (error) {
    console.error('Error setting active prompt version:', error);
    process.exit(1);
  }
}

setActivePromptVersion();
