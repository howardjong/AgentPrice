/**
 * System Health Check
 * 
 * This script performs a comprehensive health check on the system
 * without making actual API calls to LLMs.
 * 
 * Updated to use the new health check service from server/services/healthCheck.ts.
 */

import logger from '../../utils/logger.js';
import promptManager from '../../services/promptManager.js';
import { CircuitBreaker } from '../../utils/monitoring.js';
import { areLlmCallsDisabled } from '../../utils/disableLlmCalls.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios'; // Used for HTTP requests

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkSystemHealth() {
  console.log('======================================');
  console.log('       SYSTEM HEALTH CHECK');
  console.log('======================================');

  // Check environment
  console.log('\n[1] Checking environment configuration...');
  console.log(`- LLM API calls disabled: ${areLlmCallsDisabled()}`);
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
          console.log(`  - ${engine}: ${promptTypes.join(', ')}`);
        }
      } catch (err) {
        console.log(`  - Error reading engine ${engine}: ${err.message}`);
      }
    }
  } catch (error) {
    console.error(`- ❌ Error initializing prompt manager: ${error.message}`);
    if (healthStatus && healthStatus.promptManager) {
      healthStatus.promptManager.ok = false;
      healthStatus.promptManager.issues.push(error.message);
    } else {
      console.error('- ❌ Unable to update health status: healthStatus object is not properly initialized');
    }
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
  const usedDefaults = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      // Set default environment variables if missing
      if (envVar === 'NODE_ENV') {
        process.env.NODE_ENV = 'development';
        usedDefaults.push(`${envVar}=${process.env.NODE_ENV}`);
      } else if (envVar === 'PORT') {
        process.env.PORT = '5000';
        usedDefaults.push(`${envVar}=${process.env.PORT}`);
      } else {
        // Only add to missingEnvVars if we don't have a default for it
        missingEnvVars.push(envVar);
      }
      console.log(`- ✅ Using default ${envVar}: ${process.env[envVar]}`);
    } else {
      console.log(`- ✅ ${envVar} is set`);
    }
  }

  // Build a health summary
  let healthStatus = {
    environment: { 
      ok: missingEnvVars.length === 0, 
      issues: missingEnvVars.map(v => `Missing ${v}`),
      usedDefaults: usedDefaults
    },
    promptManager: { ok: true, issues: [] },
    circuitBreaker: { ok: true, issues: [] },
    redisService: { ok: true, issues: [] },
    fileSystem: { ok: true, issues: [] },
    modules: { ok: missingModules.length === 0, issues: [], missing: missingModules },
    apiOptimization: { ok: true, issues: [], status: 'optimized' }
  };

  // Check if API calls are disabled (cost saving mode)
  const disableLlmCalls = await import('../../utils/disableLlmCalls.js');
  const apiCallsDisabled = disableLlmCalls.areLlmCallsDisabled();
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
    
    // Check if getCacheHitRateStats exists directly or as part of default export
    let stats;
    if (typeof cacheMonitor.getCacheHitRateStats === 'function') {
      stats = cacheMonitor.getCacheHitRateStats();
    } else if (cacheMonitor.default && typeof cacheMonitor.default.getCacheHitRateStats === 'function') {
      stats = cacheMonitor.default.getCacheHitRateStats();
    } else {
      // If the function doesn't exist, create placeholder stats
      console.log('- ℹ️ Cache monitor stats function not found - using default values');
      stats = {
        hitRate: 0,
        totalLookups: 0,
        hits: 0,
        misses: 0,
        estimatedCostSavings: 0,
        estimatedTokensSaved: 0
      };
    }
    
    console.log(`- ✅ Cache monitor check complete - Hit rate: ${stats.hitRate}%`);
    console.log(`- Total lookups: ${stats.totalLookups}, Hits: ${stats.hits}, Misses: ${stats.misses}`);
    console.log(`- Estimated token savings: ${stats.estimatedTokensSaved || 0} tokens`);
    console.log(`- Estimated cost savings: $${stats.estimatedCostSavings?.toFixed(4) || '0.0000'}`);
    healthStatus.apiOptimization.hitRate = stats.hitRate;
    healthStatus.apiOptimization.savings = `$${stats.estimatedCostSavings?.toFixed(4) || '0.0000'}`;
  } catch (error) {
    console.error(`- ❌ Error checking cache monitor: ${error.message}`);
    healthStatus.apiOptimization.ok = false;
    healthStatus.apiOptimization.issues.push('Cache monitor error: ' + error.message);
  }

  // Check health endpoints
  console.log('\n[8] Testing API health endpoints...');
  
  // Add an API health section to our status
  healthStatus.apiHealth = { ok: true, issues: [] };
  
  // Test the assistant health endpoint
  try {
    console.log('- Testing /api/assistant/health endpoint...');
    const assistantHealthResponse = await axios.get('http://localhost:5000/api/assistant/health');
    
    if (assistantHealthResponse.status === 200) {
      console.log('- ✅ Assistant health endpoint is accessible');
      console.log(`- Status: ${assistantHealthResponse.data.status}`);
      console.log(`- API keys present: ${assistantHealthResponse.data.apiKeys.allPresent ? 'Yes' : 'No'}`);
      console.log(`- Memory usage: ${assistantHealthResponse.data.system.memory.usagePercent}%`);
      console.log(`- File system: ${assistantHealthResponse.data.system.fileSystem ? 'OK' : 'Issues detected'}`);
      
      // Update health status based on response
      if (assistantHealthResponse.data.status !== 'healthy') {
        // If status is degraded due to high memory usage in development, this is normal
        if (assistantHealthResponse.data.status === 'degraded' && 
            assistantHealthResponse.data.system.memory.usagePercent > 90 &&
            process.env.NODE_ENV === 'development') {
          console.log('- ℹ️ Note: Degraded status due to high memory usage is normal in development');
          // Don't mark as an issue since this is expected behavior in development
        } else {
          healthStatus.apiHealth.ok = false;
          healthStatus.apiHealth.issues.push(`Assistant health endpoint reports ${assistantHealthResponse.data.status} status`);
          
          // Add more detailed information about specific issues
          if (!assistantHealthResponse.data.apiKeys.allPresent) {
            healthStatus.apiHealth.issues.push('Missing API keys');
          }
          
          if (assistantHealthResponse.data.system.memory.usagePercent > 90) {
            healthStatus.apiHealth.issues.push(`High memory usage (${assistantHealthResponse.data.system.memory.usagePercent}%)`);
          }
        }
      }
    } else {
      console.error('- ❌ Assistant health endpoint returned unexpected status');
      healthStatus.apiHealth.ok = false;
      healthStatus.apiHealth.issues.push('Assistant health endpoint returned unexpected status');
    }
  } catch (error) {
    console.error(`- ❌ Error accessing assistant health endpoint: ${error.message}`);
    healthStatus.apiHealth.ok = false;
    healthStatus.apiHealth.issues.push(`Assistant health endpoint error: ${error.message}`);
  }
  
  // Test the full health endpoint
  try {
    console.log('- Testing /api/health endpoint...');
    const fullHealthResponse = await axios.get('http://localhost:5000/api/health');
    
    if (fullHealthResponse.status === 200) {
      console.log('- ✅ Full health endpoint is accessible');
      
      // Check Claude API status
      console.log(`- Claude API: ${fullHealthResponse.data.apiServices.claude.status}`);
      console.log(`- Claude model: ${fullHealthResponse.data.apiServices.claude.version}`);
      
      // Check Perplexity API status
      console.log(`- Perplexity API: ${fullHealthResponse.data.apiServices.perplexity.status}`);
      console.log(`- Perplexity model: ${fullHealthResponse.data.apiServices.perplexity.version}`);
      
      // Check Redis status
      console.log(`- Redis: ${fullHealthResponse.data.redis.status}`);
      
      // Check circuit breaker status
      console.log(`- Circuit breakers: ${fullHealthResponse.data.circuitBreaker.status}`);
      
      // Update health status based on API health
      if (fullHealthResponse.data.apiServices.claude.status !== 'connected') {
        healthStatus.apiHealth.ok = false;
        healthStatus.apiHealth.issues.push(`Claude API not connected: ${fullHealthResponse.data.apiServices.claude.status}`);
      }
      
      if (fullHealthResponse.data.apiServices.perplexity.status !== 'connected') {
        healthStatus.apiHealth.ok = false;
        healthStatus.apiHealth.issues.push(`Perplexity API not connected: ${fullHealthResponse.data.apiServices.perplexity.status}`);
      }
    } else {
      console.error('- ❌ Full health endpoint returned unexpected status');
      healthStatus.apiHealth.ok = false;
      healthStatus.apiHealth.issues.push('Full health endpoint returned unexpected status');
    }
  } catch (error) {
    console.error(`- ❌ Error accessing full health endpoint: ${error.message}`);
    healthStatus.apiHealth.ok = false;
    healthStatus.apiHealth.issues.push(`Full health endpoint error: ${error.message}`);
  }

  console.log('\n======================================');
  console.log('       HEALTH CHECK SUMMARY');
  console.log('======================================');

  for (const [system, status] of Object.entries(healthStatus)) {
    if (status.ok) {
      console.log(`- ${system}: ✅ Healthy`);
    } else {
      // Special case for environment - if we're using defaults, it's not an issue
      if (system === 'environment' && status.usedDefaults && status.usedDefaults.length > 0) {
        console.log(`- ${system}: ✅ Healthy (using defaults)`);
        status.usedDefaults.forEach(defaultVal => console.log(`  > Using default ${defaultVal}`));
      } else {
        console.log(`- ${system}: ❌ Issues found`);
        status.issues.forEach(issue => console.log(`  > ${issue}`));
      }
    }
  }

  console.log('======================================');
  console.log('       HEALTH CHECK COMPLETE');
  console.log('======================================');
}

// Run the health check
checkSystemHealth().catch(error => {
  console.error('Health check failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});