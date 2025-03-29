/**
 * Memory Pressure Test
 * 
 * This script performs a more intensive memory test to evaluate 
 * how our memory optimization settings handle increasing load.
 */

import resourceManager from '../../utils/resourceManager.js';
import memoryLeakDetector from '../../utils/memoryLeakDetector.js';
import smartCache from '../../utils/smartCache.js';
import componentLoader from '../../utils/componentLoader.js';
import logger from '../../utils/logger.js';

// Function to measure memory usage
function getMemoryUsage() {
  const mem = process.memoryUsage();
  return {
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    rss: Math.round(mem.rss / 1024 / 1024)
  };
}

// Apply optimized settings
function applyOptimizedSettings() {
  // Configure resource manager for low memory usage
  resourceManager.configure({
    cleanupInterval: 15 * 1000, // 15 seconds (shortened for testing)
    monitoringInterval: 5 * 1000, // 5 seconds 
    heapUsageThreshold: 50, // Lower threshold for testing
    cpuUsageThreshold: 60,
    gcInterval: 30 * 1000, // 30 seconds
    enableCleanup: true
  });
  
  // Configure smart cache for minimal memory usage
  smartCache.configure({
    maxSize: 50, // Very limited cache size
    ttl: 60 * 1000, // 1 minute
    enableFuzzyMatch: false, // Disable fuzzy matching to save resources
    memoryLimitMB: 20,
    lowMemoryMode: true,
    aggressiveEviction: true
  });
  
  // Configure memory leak detector for aggressive monitoring
  memoryLeakDetector.configure({
    enabled: true,
    checkInterval: 5 * 1000, // 5 seconds
    alertThreshold: 10, // More sensitive
    maxSamples: 5,
    resourceSavingMode: true,
    gcBeforeCheck: true
  });
  
  // Configure component loader for aggressive unloading
  componentLoader.configure({
    lazyLoad: true,
    unloadThreshold: 30 * 1000, // 30 seconds
    preloadCritical: false
  });
  
  logger.info('Applied aggressive memory optimization settings');
}

async function runMemoryTest() {
  console.log('\n======================================');
  console.log('        MEMORY PRESSURE TEST         ');
  console.log('======================================\n');
  
  // Apply optimized settings first
  applyOptimizedSettings();
  
  // Initial memory state
  const initialMemory = getMemoryUsage();
  console.log('Initial memory state:');
  console.log(`Heap: ${initialMemory.heapUsed}MB / ${initialMemory.heapTotal}MB, RSS: ${initialMemory.rss}MB`);
  
  // Create a large number of objects to simulate memory pressure
  const dataStore = [];
  const reportInterval = 1000; // 1 second
  const totalDuration = 15000; // 15 seconds
  const startTime = Date.now();
  
  console.log('\nStarting memory pressure test...');
  console.log('Adding memory pressure in intervals...\n');
  
  let testComplete = false;
  
  // Set up reporting interval
  const reportTimer = setInterval(() => {
    if (testComplete) return;
    
    const memory = getMemoryUsage();
    const elapsedTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`[${elapsedTime}s] Memory - Heap: ${memory.heapUsed}MB / ${memory.heapTotal}MB, RSS: ${memory.rss}MB, Objects: ${dataStore.length}`);
    
    // Show memory increases
    const heapIncrease = memory.heapUsed - initialMemory.heapUsed;
    const rssIncrease = memory.rss - initialMemory.rss;
    
    console.log(`   Heap +${heapIncrease}MB, RSS +${rssIncrease}MB`);
    
    // Get cache stats
    const cacheStats = smartCache.getStats();
    console.log(`   Cache - Size: ${cacheStats.size}/${cacheStats.maxSize}, Evictions: ${cacheStats.evictions.memory + cacheStats.evictions.lru}`);
  
  }, reportInterval);
  
  // Create objects in intervals to simulate load
  for (let i = 0; i < 10; i++) {
    if (Date.now() - startTime > totalDuration) break;
    
    // Add a batch of objects
    for (let j = 0; j < 10000; j++) {
      const obj = {
        id: `item-${i}-${j}`,
        data: `data-${Math.random()}`.repeat(20),
        timestamp: Date.now()
      };
      dataStore.push(obj);
      
      // Also add to cache to test cache pressure
      smartCache.set(`key-${i}-${j}`, obj);
    }
    
    // Wait before next batch
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Clear the reporting interval
  clearInterval(reportTimer);
  testComplete = true;
  
  // Final memory state
  const finalMemory = getMemoryUsage();
  console.log('\nFinal memory state:');
  console.log(`Heap: ${finalMemory.heapUsed}MB / ${finalMemory.heapTotal}MB, RSS: ${finalMemory.rss}MB`);
  
  // Memory change
  const heapChange = finalMemory.heapUsed - initialMemory.heapUsed;
  const rssChange = finalMemory.rss - initialMemory.rss;
  console.log(`\nMemory change: Heap ${heapChange > 0 ? '+' : ''}${heapChange}MB, RSS ${rssChange > 0 ? '+' : ''}${rssChange}MB`);
  
  // Get cache stats after test
  const cacheStats = smartCache.getStats();
  console.log(`\nFinal cache stats:`);
  console.log(`- Size: ${cacheStats.size}/${cacheStats.maxSize}`);
  console.log(`- Evictions: ${cacheStats.evictions.memory + cacheStats.evictions.lru + cacheStats.evictions.expired}`);
  
  console.log('\nCleaning up test data...');
  // Clear data to allow garbage collection
  dataStore.length = 0;
  smartCache.clear();
  
  // Let GC run
  if (global.gc) {
    console.log('Running manual garbage collection...');
    global.gc();
  }
  
  // Wait for GC to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Post-GC memory state
  const gcMemory = getMemoryUsage();
  console.log('\nPost-cleanup memory state:');
  console.log(`Heap: ${gcMemory.heapUsed}MB / ${gcMemory.heapTotal}MB, RSS: ${gcMemory.rss}MB`);
  
  console.log('\n======================================');
  console.log('          TEST COMPLETE              ');
  console.log('======================================');
}

// Run the test
runMemoryTest().catch(error => {
  console.error('Error running memory test:', error);
});