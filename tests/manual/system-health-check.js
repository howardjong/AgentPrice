
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
  console.log(`- Redis mode: ${process.env.REDIS_MODE || 'normal'}`);
  
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
        }
      } catch (err) {
        console.error(`  Error reading engine ${engine}: ${err.message}`);
      }
    }
  } catch (error) {
    console.error('- ❌ Error initializing prompt manager:', error.message);
  }
  
  // Check circuit breaker
  console.log('\n[3] Checking circuit breaker...');
  try {
    const testBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000
    });
    
    console.log('- Circuit breaker initialized successfully');
    console.log('- Testing simple call...');
    
    const result = await testBreaker.executeRequest('test-service', async () => {
      return 'Test successful';
    });
    
    console.log(`- ✅ Test result: ${result}`);
    
    // Check if there are any open circuits
    const breakerState = testBreaker.state;
    const openCircuits = Object.keys(breakerState).filter(key => 
      breakerState[key].status === 'OPEN'
    );
    
    if (openCircuits.length > 0) {
      console.warn(`- ⚠️ Warning: ${openCircuits.length} circuits are open`);
      openCircuits.forEach(circuit => {
        console.warn(`  - ${circuit}: last failure at ${new Date(breakerState[circuit].lastFailure).toISOString()}`);
      });
    } else {
      console.log('- ✅ No open circuits');
    }
    
    // Clean up
    testBreaker.stop();
  } catch (error) {
    console.error('- ❌ Error testing circuit breaker:', error.message);
  }
  
  // Check file system and important directories
  console.log('\n[4] Checking file system access...');
  const dirsToCheck = [
    { name: 'Prompts', path: path.join(__dirname, '../../prompts') },
    { name: 'Public', path: path.join(__dirname, '../../public') },
    { name: 'Tests output', path: path.join(__dirname, '../output') },
    { name: 'Uploads', path: path.join(__dirname, '../../uploads') },
  ];
  
  for (const dir of dirsToCheck) {
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
    'axios', 'express', 'bull', 'ioredis', '@anthropic-ai/sdk', 'winston', 
    'uuid', 'tailwind-merge'
  ];
  
  // Use import.meta.resolve in a safe way
  // This approach is safer than require.resolve for ES modules projects
  const fs = await import('fs');
  const path = await import('path');
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  
  for (const module of requiredModules) {
    try {
      // First check if module exists in node_modules
      const modulePath = path.resolve('./node_modules/', module);
      if (fs.existsSync(modulePath)) {
        console.log(`- ✅ ${module} is installed (directory exists)`);
        continue;
      }
      
      // Fallback to require.resolve
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
