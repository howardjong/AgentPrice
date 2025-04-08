/**
 * Test script for Health Check API endpoints
 * 
 * This script provides a simple way to test if the health check API endpoints
 * are working correctly without needing to run the full server.
 */

import { createStorage, storage } from './server/storage.js';
import { checkSystemHealth } from './server/services/healthCheck.js';

async function testHealthCheck() {
  console.log('Testing health check functionality...');
  
  try {
    console.log('\n1. Testing storage module...');
    // Ensure storage is initialized
    console.log('Storage instance type:', storage.constructor.name);
    
    // Test API status functions
    console.log('\n2. Testing updateServiceStatus()...');
    await storage.updateServiceStatus('claude', { status: 'running', lastCheck: new Date().toISOString() });
    await storage.updateServiceStatus('perplexity', { status: 'running', lastCheck: new Date().toISOString() });
    console.log('Service statuses updated successfully');
    
    console.log('\n3. Testing getApiStatus()...');
    const apiStatus = await storage.getApiStatus();
    console.log('API Status:', JSON.stringify(apiStatus, null, 2));
    
    console.log('\n4. Testing checkSystemHealth()...');
    const healthStatus = await checkSystemHealth();
    console.log('System Health:', JSON.stringify(healthStatus, null, 2));
    
    console.log('\n5. Simulating full health check response...');
    // Simulate the /api/health endpoint response
    const healthData = {
      status: healthStatus.health,
      service: 'code-reviewer',
      timestamp: new Date().toISOString(),
      memory: {
        usagePercent: healthStatus.memory.usagePercent,
        healthy: healthStatus.memory.healthy
      },
      apiServices: {
        claude: apiStatus.claude || { status: 'unknown' },
        perplexity: apiStatus.perplexity || { status: 'unknown' },
        server: apiStatus.server || { status: 'running' }
      },
      apiKeys: {
        allPresent: healthStatus.apiKeys?.allKeysPresent || false,
        anthropic: process.env.ANTHROPIC_API_KEY !== undefined,
        perplexity: process.env.PERPLEXITY_API_KEY !== undefined,
        gemini: process.env.GEMINI_API_KEY !== undefined
      }
    };
    
    console.log(JSON.stringify(healthData, null, 2));
    
    console.log('\n6. Simulating assistant health response...');
    // Simulate the /api/assistant/health endpoint response
    const assistantHealthData = {
      status: healthStatus.health,
      apiKeys: {
        allPresent: healthStatus.apiKeys?.allKeysPresent || false
      },
      system: {
        memory: {
          usagePercent: Math.round(healthStatus.memory.usagePercent * 100) / 100,
          healthy: healthStatus.memory.healthy
        },
        fileSystem: true
      },
      timestamp: new Date().toISOString()
    };
    
    console.log(JSON.stringify(assistantHealthData, null, 2));
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Error during health check tests:', error);
  }
}

testHealthCheck();