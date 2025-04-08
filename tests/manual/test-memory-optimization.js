/**
 * Memory Optimization Test Script
 * 
 * This script tests the memory optimization and relief capabilities
 * by making requests to the memory endpoints.
 */

import axios from 'axios';

// Configuration
const BASE_URL = 'http://localhost:5000';
const MEMORY_STATUS_ENDPOINT = '/api/system/memory-status';
const MEMORY_RELIEF_ENDPOINT = '/api/system/memory-relief';

// Utility to format memory values
function formatMemory(bytes) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

// Check memory status
async function checkMemoryStatus() {
  console.log('\n=== Checking Memory Status ===');
  
  try {
    const response = await axios.get(`${BASE_URL}${MEMORY_STATUS_ENDPOINT}`);
    
    if (response.status === 200) {
      const data = response.data;
      
      console.log('Status:', data.status);
      console.log('Memory Usage:');
      console.log(`- Heap Used: ${data.currentUsage?.heapUsedMB || 0} MB`);
      console.log(`- Heap Total: ${data.currentUsage?.heapTotalMB || 0} MB`);
      console.log(`- RSS: ${data.currentUsage?.rssMB || 0} MB`);
      console.log(`- Usage: ${data.currentUsage?.usagePercent || 0}%`);
      
      if (data.resourceManager) {
        console.log('\nResource Manager:');
        console.log(`- Active: ${data.resourceManager.isActive ? 'Yes' : 'No'}`);
        console.log(`- Connection pools: ${data.resourceManager.connectionPoolCount}`);
        console.log(`- Total connections: ${data.resourceManager.totalConnections}`);
        console.log(`- Active connections: ${data.resourceManager.activeConnections}`);
      }
      
      if (data.memoryLeakDetector) {
        console.log('\nMemory Leak Detector:');
        console.log(`- Monitoring: ${data.memoryLeakDetector.isMonitoring ? 'Yes' : 'No'}`);
        console.log(`- Leaks detected: ${data.memoryLeakDetector.leaksDetected}`);
        
        if (data.memoryLeakDetector.lastCheckAt) {
          const lastCheck = new Date(data.memoryLeakDetector.lastCheckAt);
          console.log(`- Last check: ${lastCheck.toLocaleTimeString()}`);
        }
      }
      
      console.log('\nOptimization Status:', data.optimization?.status);
      console.log('Uptime:', Math.round(data.optimization?.uptime || 0), 'seconds');
      console.log('GC Available:', data.optimization?.gcAvailable ? 'Yes' : 'No');
      
      return data;
    } else {
      console.error('Unexpected status:', response.status);
    }
  } catch (error) {
    console.error('Error checking memory status:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
  
  return null;
}

// Perform memory relief
async function performMemoryRelief(aggressive = false) {
  console.log(`\n=== Performing ${aggressive ? 'Aggressive' : 'Standard'} Memory Relief ===`);
  
  try {
    const response = await axios.post(`${BASE_URL}${MEMORY_RELIEF_ENDPOINT}`, {
      aggressive
    });
    
    if (response.status === 200) {
      const data = response.data;
      
      console.log('Status:', data.status);
      console.log('Message:', data.message);
      
      if (data.details) {
        console.log('\nMemory Before:');
        console.log(`- Heap Used: ${data.details.before.heapUsedMB} MB`);
        console.log(`- RSS: ${data.details.before.rssMB} MB`);
        
        console.log('\nMemory After:');
        console.log(`- Heap Used: ${data.details.after.heapUsedMB} MB`);
        console.log(`- RSS: ${data.details.after.rssMB} MB`);
        
        console.log('\nReduction:');
        console.log(`- Heap: ${data.details.reduction.heapMB} MB (${data.details.reduction.percent}%)`);
        console.log(`- RSS: ${data.details.reduction.rssMB} MB`);
      }
      
      return data;
    } else {
      console.error('Unexpected status:', response.status);
    }
  } catch (error) {
    console.error('Error performing memory relief:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
  
  return null;
}

// Run memory tests
async function runMemoryTests() {
  console.log('====================================');
  console.log('  MEMORY OPTIMIZATION TEST SCRIPT');
  console.log('====================================');
  
  // Check initial memory status
  console.log('\nChecking initial memory status...');
  const initialStatus = await checkMemoryStatus();
  
  if (!initialStatus) {
    console.error('Could not get initial memory status. Is the server running?');
    return;
  }
  
  // Allocate memory to test relief
  console.log('\nAllocating memory for testing...');
  const memoryBlocks = [];
  for (let i = 0; i < 10; i++) {
    // Create a 1MB array
    const block = new Array(250000).fill('test memory block');
    memoryBlocks.push(block);
    console.log(`Allocated block ${i+1}/10`);
  }
  
  // Check memory after allocation
  console.log('\nChecking memory after allocation...');
  await checkMemoryStatus();
  
  // Perform standard memory relief
  console.log('\nRunning standard memory relief...');
  await performMemoryRelief(false);
  
  // Check memory after standard relief
  console.log('\nChecking memory after standard relief...');
  await checkMemoryStatus();
  
  // Allocate more memory
  console.log('\nAllocating more memory...');
  for (let i = 0; i < 5; i++) {
    const block = new Array(500000).fill('more test memory');
    memoryBlocks.push(block);
    console.log(`Allocated additional block ${i+1}/5`);
  }
  
  // Check memory again
  console.log('\nChecking memory after additional allocation...');
  await checkMemoryStatus();
  
  // Perform aggressive memory relief
  console.log('\nRunning aggressive memory relief...');
  await performMemoryRelief(true);
  
  // Final memory check
  console.log('\nFinal memory status...');
  await checkMemoryStatus();
  
  console.log('\n====================================');
  console.log('  MEMORY OPTIMIZATION TEST COMPLETE');
  console.log('====================================');
}

// Run the tests
runMemoryTests().catch(error => {
  console.error('Error running memory tests:', error);
});