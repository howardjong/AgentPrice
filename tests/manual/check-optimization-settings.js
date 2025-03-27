/**
 * Optimization Settings Check
 * 
 * This script checks the current configuration of all performance-related utilities
 * to verify that our optimizations are applied.
 */

import resourceManager from '../../utils/resourceManager.js';
import smartCache from '../../utils/smartCache.js';
import memoryLeakDetector from '../../utils/memoryLeakDetector.js';
import componentLoader from '../../utils/componentLoader.js';
import logger from '../../utils/logger.js';

// Function to format memory size
function formatMemory(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

// Function to format time duration
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60 * 1000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 60 * 60 * 1000) return `${(ms / 1000 / 60).toFixed(1)}m`;
  return `${(ms / 1000 / 60 / 60).toFixed(1)}h`;
}

function checkCurrentMemoryUsage() {
  const mem = process.memoryUsage();
  return {
    heapUsed: formatMemory(mem.heapUsed),
    heapTotal: formatMemory(mem.heapTotal),
    rss: formatMemory(mem.rss),
    external: formatMemory(mem.external)
  };
}

async function checkOptimizationSettings() {
  console.log('\n======================================');
  console.log('    PERFORMANCE OPTIMIZATION CHECK    ');
  console.log('======================================\n');
  
  // Check current memory usage
  const memoryUsage = checkCurrentMemoryUsage();
  console.log('Current memory usage:');
  console.log(`- Heap used: ${memoryUsage.heapUsed}`);
  console.log(`- Heap total: ${memoryUsage.heapTotal}`);
  console.log(`- RSS: ${memoryUsage.rss}`);
  console.log(`- External: ${memoryUsage.external}`);
  
  // Check Resource Manager settings
  console.log('\n1. Resource Manager Configuration');
  console.log(`- Cleanup interval: ${formatDuration(resourceManager.cleanupInterval)}`);
  console.log(`- Monitoring interval: ${formatDuration(resourceManager.monitoringInterval)}`);
  console.log(`- Heap usage threshold: ${resourceManager.heapUsageThreshold} MB`);
  console.log(`- CPU usage threshold: ${resourceManager.cpuUsageThreshold}%`);
  console.log(`- GC interval: ${formatDuration(resourceManager.gcInterval)}`);
  
  // Check Smart Cache settings
  console.log('\n2. Smart Cache Configuration');
  console.log(`- Maximum size: ${smartCache.maxSize} items`);
  console.log(`- Default TTL: ${formatDuration(smartCache.defaultTTL)}`);
  console.log(`- Enable fuzzy matching: ${smartCache.enableFuzzyMatch}`);
  console.log(`- Memory limit: ${smartCache.memoryLimitMB} MB`);
  console.log(`- Low memory mode: ${smartCache.lowMemoryMode}`);
  console.log(`- Aggressive eviction: ${smartCache.aggressiveEviction || false}`);
  
  // Get cache stats
  const cacheStats = smartCache.getStats();
  console.log('\n   Cache Statistics:');
  console.log(`   - Items in cache: ${cacheStats.size}/${cacheStats.maxSize} (${cacheStats.utilization} utilized)`);
  console.log(`   - Hit rate: ${cacheStats.hitRate}`);
  console.log(`   - Total evictions: ${Object.values(cacheStats.evictions).reduce((a, b) => a + b, 0)}`);
  
  // Check Memory Leak Detector settings
  console.log('\n3. Memory Leak Detector Configuration');
  console.log(`- Sample interval: ${formatDuration(memoryLeakDetector.sampleInterval)}`);
  console.log(`- Growth threshold: ${memoryLeakDetector.growthThreshold}%`);
  console.log(`- Consecutive growth limit: ${memoryLeakDetector.consecutiveGrowthLimit}`);
  console.log(`- GC trigger threshold: ${memoryLeakDetector.gcTriggerThreshold} MB`);
  console.log(`- Resource-saving mode: ${memoryLeakDetector.resourceSavingMode}`);
  console.log(`- Monitoring active: ${memoryLeakDetector.isMonitoring}`);
  
  // Check Component Loader settings
  console.log('\n4. Component Loader Configuration');
  console.log(`- Lazy loading: ${componentLoader.lazyLoad}`);
  console.log(`- Unload threshold: ${formatDuration(componentLoader.unloadThreshold)}`);
  console.log(`- Preload critical components: ${componentLoader.preloadCritical}`);
  
  // Component Stats
  const componentStats = componentLoader.getStats();
  console.log('\n   Component Statistics:');
  console.log(`   - Components loaded: ${componentStats.loaded || 0}`);
  console.log(`   - Total loaded since start: ${componentStats.totalLoaded || 0}`);
  console.log(`   - Critical components: ${componentStats.critical || 0}`);
  console.log(`   - Load errors: ${componentStats.loadErrors || 0}`);
  
  console.log('\n======================================');
  
  // Optimization verification
  console.log('\nOptimization Status Check:');
  
  // Resource Manager optimized?
  const resourceManagerOptimized = 
    resourceManager.cleanupInterval <= 30 * 60 * 1000 && // <= 30 minutes
    resourceManager.heapUsageThreshold <= 250; // <= 250 MB
  
  // Smart Cache optimized?
  const smartCacheOptimized = 
    smartCache.maxSize <= 250 && // <= 250 items
    smartCache.defaultTTL <= 6 * 60 * 60 * 1000; // <= 6 hours
  
  // Memory Leak Detector optimized?
  const memoryLeakDetectorOptimized =
    memoryLeakDetector.isMonitoring &&
    memoryLeakDetector.sampleInterval <= 5 * 60 * 1000; // <= 5 minutes
  
  // Component Loader optimized?
  const componentLoaderOptimized =
    componentLoader.lazyLoad;
  
  console.log(`- Resource Manager: ${resourceManagerOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);
  console.log(`- Smart Cache: ${smartCacheOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);
  console.log(`- Memory Leak Detector: ${memoryLeakDetectorOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);
  console.log(`- Component Loader: ${componentLoaderOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);
  
  console.log('\nOverall system optimization: ' + 
    (resourceManagerOptimized && smartCacheOptimized && 
     memoryLeakDetectorOptimized && componentLoaderOptimized ?
     '✅ OPTIMIZED' : '❌ NOT FULLY OPTIMIZED'));
  
  console.log('\n======================================\n');
}

checkOptimizationSettings().catch(error => {
  console.error('Error checking optimization settings:', error);
});