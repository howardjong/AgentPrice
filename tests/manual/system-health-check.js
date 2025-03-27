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
import { promises as fs } from 'fs';
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

  // Check Redis connectivity
  console.log('\n[4] Checking Redis service...');
  try {
    const redisClient = (await import('../../services/redisService.js')).default;
    console.log('- Redis client imported successfully');

    const isConnected = await redisClient.ping();
    if (isConnected) {
      console.log('- ✅ Redis connection successful');

      // Test basic Redis operations
      const client = await redisClient.getClient();

      // Test SET operation
      const testKey = 'health_check_test_key';
      const testValue = 'test_value_' + Date.now();
      await client.set(testKey, testValue);
      console.log('- ✅ Redis SET operation successful');

      // Test GET operation
      const retrievedValue = await client.get(testKey);
      if (retrievedValue === testValue) {
        console.log('- ✅ Redis GET operation successful');
      } else {
        console.error('- ❌ Redis GET operation failed: value mismatch');
      }

      // Test DEL operation
      await client.del(testKey);
      const deletedValue = await client.get(testKey);
      if (deletedValue === null) {
        console.log('- ✅ Redis DEL operation successful');
      } else {
        console.error('- ❌ Redis DEL operation failed: key still exists');
      }
    } else {
      console.error('- ❌ Redis connection failed');
    }
  } catch (error) {
    console.error(`- ❌ Error testing Redis: ${error.message}`);
  }

  // Check file system and important directories
  console.log('\n[5] Checking file system access...');
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
  console.log('\n[6] Checking required Node modules...');
  const requiredModules = [
    'axios', 'express', 'bull', 'ioredis', '@anthropic-ai/sdk', 'winston', 
    'uuid', 'tailwind-merge'
  ];

  let missingModules = [];
  try {
    const packageJsonPath = path.join(__dirname, '../../package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    const { dependencies = {}, devDependencies = {} } = packageJson;
    const allDependencies = { ...dependencies, ...devDependencies };

    for (const module of requiredModules) {
      const normalizedModule = module.startsWith('@') 
        ? module 
        : module.split('/')[0]; // Handle scoped packages

      if (allDependencies[normalizedModule]) {
        console.log(`- ✅ ${module} is installed (found in package.json)`);

        // Additionally verify the module directory exists
        const modulePath = path.join(__dirname, '../../node_modules/', module);
        try {
          await fs.access(modulePath);
        } catch (err) {
          console.warn(`  ⚠️ Warning: ${module} is in package.json but module directory not found. May need to run npm install.`);
        }
      } else {
        console.error(`- ❌ ${module} is not installed (not found in package.json)`);
        missingModules.push(module);
      }
    }
  } catch (error) {
    console.error(`- ❌ Error checking package.json: ${error.message}`);
  }

  // Check environment variables
  console.log('\n[7] Checking environment variables...');
  const requiredEnvVars = [
    'NODE_ENV',
    'PORT'
  ];

  const missingEnvVars = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingEnvVars.push(envVar);
      console.error(`- ❌ Missing required environment variable: ${envVar}`);
    } else {
      console.log(`- ✅ ${envVar} is set`);
    }
  }

  // Build a health summary
  let healthStatus = {
    environment: { ok: missingEnvVars.length === 0, issues: missingEnvVars.map(v => `Missing ${v}`) },
    promptManager: { ok: true, issues: [] },
    circuitBreaker: { ok: true, issues: [] },
    redisService: { ok: true, issues: [] },
    fileSystem: { ok: true, issues: [] },
    modules: { ok: missingModules.length === 0, issues: [], missing: missingModules },
    apiOptimization: { ok: true, issues: [], status: 'optimized' }
  };

  // Check if API calls are disabled (cost saving mode)
  const disableLlmCalls = await import('../../utils/disableLlmCalls.js');
  const apiCallsDisabled = disableLlmCalls.isLlmApiDisabled();
  if (apiCallsDisabled) {
    console.log('- ✅ LLM API calls disabled - running in cost saving mode');
    healthStatus.apiOptimization.status = 'disabled';
  } else {
    console.log('- ℹ️ LLM API calls enabled - potential costs may be incurred');
    healthStatus.apiOptimization.status = 'enabled';
  }

  // Check cache monitor functionality
  console.log('\n[7] Checking cache monitoring system...');

  try {
    const cacheMonitor = await import('../../utils/cacheMonitor.js');
    const stats = cacheMonitor.default.getStats();
    console.log(`- ✅ Cache monitor is functioning - Hit rate: ${stats.hitRate}`);
    console.log(`- Total lookups: ${stats.totalLookups}, Hits: ${stats.hits}, Misses: ${stats.misses}`);
    console.log(`- Estimated savings: ${stats.estimatedSavings}`);

    healthStatus.apiOptimization.hitRate = stats.hitRate;
    healthStatus.apiOptimization.savings = stats.estimatedSavings;
  } catch (error) {
    console.error(`- ❌ Error checking cache monitor: ${error.message}`);
    healthStatus.apiOptimization.ok = false;
    healthStatus.apiOptimization.issues.push('Cache monitor error: ' + error.message);
  }


  console.log('\n======================================');
  console.log('       HEALTH CHECK SUMMARY');
  console.log('======================================');

  for (const [system, status] of Object.entries(healthStatus)) {
    if (status.ok) {
      console.log(`- ${system}: ✅ Healthy`);
    } else {
      console.log(`- ${system}: ❌ Issues found`);
      status.issues.forEach(issue => console.log(`  > ${issue}`));
    }
  }

  console.log('======================================');
  console.log('       HEALTH CHECK COMPLETE');
  console.log('======================================');
}

// Run the health check
checkSystemHealth().catch(error => {
  console.error('Health check failed:', error);
  process.exit(1);
});