
/**
 * System Health Check
 * 
 * This script performs a comprehensive health check on the system
 * without making actual API calls to LLMs.
 */

import logger from '../../utils/logger.js';
import promptManager from '../../services/promptManager.js';
import { CircuitBreaker } from '../../utils/monitoring.js';
import { isLlmApiDisabled } from '../../utils/disableLlmCalls.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkSystemHealth() {
  console.log('======================================');
  console.log('       SYSTEM HEALTH CHECK');
  console.log('======================================');
  
  // Check environment
  console.log('\n[1] Checking environment configuration...');
  console.log(`- LLM API calls disabled: ${isLlmApiDisabled()}`);
  console.log(`- Node environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Check prompt manager
  console.log('\n[2] Checking prompt manager...');
  try {
    await promptManager.initialize();
    console.log('- Prompt manager initialized successfully');
    
    // List available prompt engines
    const promptsDir = path.join(__dirname, '../../prompts');
    const engines = await fs.readdir(promptsDir);
    console.log(`- Available prompt engines: ${engines.join(', ')}`);
    
    // Check active versions
    console.log('- Active prompt versions:');
    for (const engine of engines) {
      try {
        // Skip non-directory entries
        const stat = await fs.stat(path.join(promptsDir, engine));
        if (!stat.isDirectory()) continue;
        
        // For each engine, list prompt types
        const enginePath = path.join(promptsDir, engine);
        const files = await fs.readdir(enginePath);
        const promptTypes = files.filter(f => f.endsWith('.txt')).map(f => f.replace('.txt', ''));
        
        if (promptTypes.length > 0) {
          console.log(`  ${engine}: ${promptTypes.join(', ')}`);
          
          // Check versions for first prompt type as example
          if (promptTypes.length > 0) {
            const versions = await promptManager.listPromptVersions(engine, promptTypes[0]);
            console.log(`    Example - ${promptTypes[0]}: Active=${versions.activeVersion}, Available=[${versions.availableVersions.join(', ')}]`);
          }
        }
      } catch (err) {
        console.log(`  ${engine}: Error reading prompts - ${err.message}`);
      }
    }
  } catch (error) {
    console.error('- ❌ Prompt manager initialization failed:', error.message);
  }
  
  // Check circuit breaker
  console.log('\n[3] Checking circuit breaker...');
  try {
    const circuitBreaker = new CircuitBreaker();
    console.log('- Circuit breaker initialized successfully');
    console.log('- Current circuit breaker state:');
    console.log(JSON.stringify(circuitBreaker.state, null, 2));
    circuitBreaker.stop();
  } catch (error) {
    console.error('- ❌ Circuit breaker check failed:', error.message);
  }
  
  // Check file system and temp directories
  console.log('\n[4] Checking file system access...');
  const directoriesToCheck = [
    { path: path.join(__dirname, '../../tests/output'), name: 'Test output directory' },
    { path: path.join(__dirname, '../../uploads'), name: 'Uploads directory' },
    { path: path.join(__dirname, '../../content-uploads'), name: 'Content uploads directory' }
  ];
  
  for (const dir of directoriesToCheck) {
    try {
      await fs.access(dir.path);
      console.log(`- ✅ ${dir.name} is accessible`);
      
      // Try writing a test file
      const testFilePath = path.join(dir.path, `health-check-${Date.now()}.txt`);
      await fs.writeFile(testFilePath, 'System health check test file');
      console.log(`- ✅ Successfully wrote test file to ${dir.name}`);
      
      // Clean up test file
      await fs.unlink(testFilePath);
    } catch (error) {
      console.error(`- ❌ ${dir.name} check failed:`, error.message);
    }
  }
  
  // Check package dependencies
  console.log('\n[5] Checking required Node modules...');
  const requiredModules = [
    'axios', 'express', 'bull', 'ioredis', 'anthropic', 'winston', 
    'uuid', 'tailwind-merge', 'react', 'vite'
  ];
  
  for (const module of requiredModules) {
    try {
      require.resolve(module);
      console.log(`- ✅ ${module} is installed`);
    } catch (error) {
      console.error(`- ❌ ${module} is not installed or has issues`);
    }
  }
  
  console.log('\n======================================');
  console.log('       HEALTH CHECK COMPLETE');
  console.log('======================================');
}

// Run the health check
checkSystemHealth().catch(error => {
  console.error('Health check failed:', error);
  process.exit(1);
});
