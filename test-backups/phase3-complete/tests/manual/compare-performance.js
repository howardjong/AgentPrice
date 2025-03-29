/**
 * Performance Comparison Tool
 * 
 * This script tests and compares system performance before and after
 * applying optimization settings.
 */

import resourceManager from '../../utils/resourceManager.js';
import smartCache from '../../utils/smartCache.js';
import memoryLeakDetector from '../../utils/memoryLeakDetector.js';
import componentLoader from '../../utils/componentLoader.js';
import logger from '../../utils/logger.js';

// Function to measure memory usage
function getMemoryUsage() {
  const mem = process.memoryUsage();
  return {
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    rss: Math.round(mem.rss / 1024 / 1024),
    external: Math.round(mem.external / 1024 / 1024)
  };
}

// Function to simulate load
async function simulateLoad(intensity = 1) {
  const startTime = Date.now();
  
  // Create different types of load
  const promises = [];
  
  // 1. CPU load
  promises.push(new Promise(resolve => {
    let counter = 0;
    const iterations = 1000000 * intensity;
    for (let i = 0; i < iterations; i++) {
      counter += Math.sqrt(i);
    }
    resolve(counter);
  }));
  
  // 2. Memory load
  promises.push(new Promise(resolve => {
    const arrays = [];
    for (let i = 0; i < 10 * intensity; i++) {
      const arr = new Array(10000).fill(0).map((_, idx) => `item-${idx}`);
      arrays.push(arr);
    }
    setTimeout(() => {
      resolve(arrays.length);
      // Clear arrays after resolution to allow garbage collection
      arrays.length = 0; 
    }, 500);
  }));
  
  // 3. Cache load
  promises.push(new Promise(resolve => {
    let cacheHits = 0;
    for (let i = 0; i < 100 * intensity; i++) {
      const key = `key-${i % 10}`;  // Reuse keys to test cache
      const value = smartCache.get(key);
      if (value) {
        cacheHits++;
      } else {
        smartCache.set(key, `value-${i}`, 60000);
      }
    }
    resolve(cacheHits);
  }));
  
  await Promise.all(promises);
  
  return {
    duration: Date.now() - startTime,
    memory: getMemoryUsage()
  };
}

// Reset to default settings
function resetToDefault() {
  resourceManager.configure({
    cleanupInterval: 60 * 60 * 1000, // 60 minutes
    monitoringInterval: 60 * 1000,   // 1 minute
    heapUsageThreshold: 500,         // 500 MB
    cpuUsageThreshold: 90,           // 90%
    enableCleanup: true
  });
  
  smartCache.configure({
    maxSize: 250,
    ttl: 4 * 60 * 60 * 1000, // 4 hours
    enableFuzzyMatch: true,
    memoryLimitMB: 50,
    lowMemoryMode: false
  });
  
  memoryLeakDetector.configure({
    enabled: true,
    checkInterval: 180000, // 3 minutes
    alertThreshold: 15,
    maxSamples: 20,
    resourceSavingMode: false
  });
  
  componentLoader.configure({
    lazyLoad: false, 
    unloadThreshold: 3600000, // 1 hour
    preloadCritical: false
  });
  
  logger.info('Reset to default settings');
}

// Apply optimized settings
function applyOptimizedSettings() {
  // Configure resource manager for low memory usage
  resourceManager.configure({
    cleanupInterval: 15 * 60 * 1000, // 15 minutes
    monitoringInterval: 2 * 60 * 1000, // 2 minutes
    heapUsageThreshold: 200, // 200 MB
    cpuUsageThreshold: 60, // 60%
    gcInterval: 5 * 60 * 1000, // 5 minutes
    enableCleanup: true
  });
  
  // Configure smart cache for optimal memory usage
  smartCache.configure({
    maxSize: 100, // Reduce max size
    ttl: 30 * 60 * 1000, // 30 minutes
    enableFuzzyMatch: true,
    memoryLimitMB: 50,
    lowMemoryMode: false, // Only enable in extreme cases
    aggressiveEviction: true
  });
  
  // Configure memory leak detector
  memoryLeakDetector.configure({
    enabled: true,
    checkInterval: 5 * 60 * 1000, // 5 minutes
    alertThreshold: 20, // 20% growth threshold
    maxSamples: 10,
    resourceSavingMode: true
  });
  
  // Configure component loader for lazy loading
  componentLoader.configure({
    lazyLoad: true,
    unloadThreshold: 5 * 60 * 1000, // 5 minutes
    preloadCritical: true
  });
  
  logger.info('Applied optimized settings');
}

async function runComparisonTest() {
  console.log('======================================');
  console.log('     PERFORMANCE COMPARISON TEST      ');
  console.log('======================================');
  
  // Collect initial metrics
  console.log('\nCollecting initial metrics...');
  const initialMemory = getMemoryUsage();
  console.log('Initial memory usage:');
  console.log(`- Heap used: ${initialMemory.heapUsed} MB`);
  console.log(`- RSS: ${initialMemory.rss} MB`);
  
  // Run test with default settings
  console.log('\nRunning test with DEFAULT settings...');
  resetToDefault();
  const defaultResult = await simulateLoad(2);
  
  console.log(`\nDefault settings test completed in ${defaultResult.duration} ms`);
  console.log('Memory usage (default settings):');
  console.log(`- Heap used: ${defaultResult.memory.heapUsed} MB`);
  console.log(`- RSS: ${defaultResult.memory.rss} MB`);
  
  // Add small delay to allow system to stabilize
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Run test with optimized settings
  console.log('\nRunning test with OPTIMIZED settings...');
  applyOptimizedSettings();
  const optimizedResult = await simulateLoad(2);
  
  console.log(`\nOptimized settings test completed in ${optimizedResult.duration} ms`);
  console.log('Memory usage (optimized settings):');
  console.log(`- Heap used: ${optimizedResult.memory.heapUsed} MB`);
  console.log(`- RSS: ${optimizedResult.memory.rss} MB`);
  
  // Calculate improvements
  const durationImprovement = ((defaultResult.duration - optimizedResult.duration) / defaultResult.duration * 100).toFixed(2);
  const memoryImprovement = ((defaultResult.memory.heapUsed - optimizedResult.memory.heapUsed) / defaultResult.memory.heapUsed * 100).toFixed(2);
  
  console.log('\n======================================');
  console.log('          COMPARISON RESULTS          ');
  console.log('======================================');
  console.log(`Duration improvement: ${durationImprovement}%`);
  console.log(`Memory usage improvement: ${memoryImprovement}%`);
  
  if (optimizedResult.duration < defaultResult.duration) {
    console.log('\n✅ Performance optimization successful - Faster execution time');
  } else {
    console.log('\n❌ Optimized settings have higher execution time');
  }
  
  if (optimizedResult.memory.heapUsed < defaultResult.memory.heapUsed) {
    console.log('✅ Memory optimization successful - Lower memory usage');
  } else {
    console.log('❌ Optimized settings have higher memory usage');
  }
  
  // Return to optimized settings after test
  applyOptimizedSettings();
  console.log('\nReturned to optimized settings after test');
}

runComparisonTest().catch(error => {
  console.error('Error running comparison test:', error);
});