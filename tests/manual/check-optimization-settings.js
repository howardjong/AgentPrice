
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

// Check current memory usage and format it
function checkCurrentMemoryUsage() {
  const memUsage = process.memoryUsage();
  return {
    heapUsed: formatMemory(memUsage.heapUsed),
    heapTotal: formatMemory(memUsage.heapTotal),
    rss: formatMemory(memUsage.rss),
    external: formatMemory(memUsage.external)
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
  try {
    console.log(`- Cleanup interval: ${formatDuration(resourceManager.cleanupInterval || 0)}`);
    console.log(`- Monitoring interval: ${formatDuration(resourceManager.monitoringInterval || 0)}`);
    console.log(`- Heap usage threshold: ${resourceManager.heapUsageThreshold || 'N/A'} MB`);
    console.log(`- CPU usage threshold: ${resourceManager.cpuUsageThreshold || 'N/A'}%`);
    console.log(`- GC interval: ${formatDuration(resourceManager.gcInterval || 0)}`);
    console.log(`- Is Active: ${resourceManager.isActive ? 'Yes' : 'No'}`);
  } catch (err) {
    console.log(`- ❌ Error checking Resource Manager: ${err.message}`);
  }
  
  // Check Smart Cache settings
  console.log('\n2. Smart Cache Configuration');
  try {
    console.log(`- Maximum size: ${smartCache.maxSize || 'N/A'} items`);
    console.log(`- Default TTL: ${formatDuration(smartCache.defaultTTL || 0)}`);
    console.log(`- Enable fuzzy matching: ${smartCache.enableFuzzyMatch ? 'Yes' : 'No'}`);
    console.log(`- Memory limit: ${smartCache.memoryLimitMB || 'N/A'} MB`);
    console.log(`- Low memory mode: ${smartCache.lowMemoryMode ? 'Yes' : 'No'}`);
    console.log(`- Current cache size: ${smartCache.cache ? smartCache.cache.size : 'N/A'} items`);
  } catch (err) {
    console.log(`- ❌ Error checking Smart Cache: ${err.message}`);
  }
  
  // Check Memory Leak Detector settings
  console.log('\n3. Memory Leak Detector Configuration');
  try {
    console.log(`- Enabled: ${memoryLeakDetector.enabled ? 'Yes' : 'No'}`);
    console.log(`- Check interval: ${formatDuration(memoryLeakDetector.checkInterval || 0)}`);
    console.log(`- Alert threshold: ${memoryLeakDetector.alertThreshold || 'N/A'}%`);
    console.log(`- GC before check: ${memoryLeakDetector.gcBeforeCheck ? 'Yes' : 'No'}`);
    console.log(`- Maximum samples: ${memoryLeakDetector.maxSamples || 'N/A'}`);
    console.log(`- Resource saving mode: ${memoryLeakDetector.resourceSavingMode ? 'Yes' : 'No'}`);
    console.log(`- Is monitoring: ${memoryLeakDetector.isMonitoring ? 'Yes' : 'No'}`);
  } catch (err) {
    console.log(`- ❌ Error checking Memory Leak Detector: ${err.message}`);
  }
  
  // Check Component Loader settings
  console.log('\n4. Component Loader Configuration');
  try {
    console.log(`- Lazy loading enabled: ${componentLoader.lazyLoadingEnabled ? 'Yes' : 'No'}`);
    console.log(`- Cache components: ${componentLoader.cacheComponents ? 'Yes' : 'No'}`);
    console.log(`- Maximum cache age: ${formatDuration(componentLoader.maxCacheAge || 0)}`);
    console.log(`- Preload critical components: ${componentLoader.preloadCritical ? 'Yes' : 'No'}`);
  } catch (err) {
    console.log(`- ❌ Error checking Component Loader: ${err.message}`);
  }
  
  // Check if optimizations are applied
  console.log('\n5. Optimization Status Check');
  try {
    const resourceManagerOptimized = 
      resourceManager.isActive && 
      resourceManager.heapUsageThreshold && 
      resourceManager.heapUsageThreshold <= 75;
    
    const smartCacheOptimized = 
      smartCache.maxSize && 
      smartCache.maxSize <= 100 && 
      smartCache.lowMemoryMode;
    
    const memoryLeakDetectorOptimized = 
      memoryLeakDetector.enabled && 
      memoryLeakDetector.isMonitoring && 
      memoryLeakDetector.resourceSavingMode;
    
    const componentLoaderOptimized = 
      componentLoader.lazyLoadingEnabled && 
      componentLoader.cacheComponents;
    
    console.log(`- Resource Manager: ${resourceManagerOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);
    console.log(`- Smart Cache: ${smartCacheOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);
    console.log(`- Memory Leak Detector: ${memoryLeakDetectorOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);
    console.log(`- Component Loader: ${componentLoaderOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);
    
    console.log('\nOverall system optimization: ' + 
      (resourceManagerOptimized && smartCacheOptimized && 
       memoryLeakDetectorOptimized && componentLoaderOptimized ?
       '✅ OPTIMIZED' : '❌ NOT FULLY OPTIMIZED'));
  } catch (err) {
    console.log(`- ❌ Error checking optimization status: ${err.message}`);
  }
  
  console.log('\n======================================');
  console.log('         OPTIMIZATION CHECK COMPLETE        ');
  console.log('======================================');
}

checkOptimizationSettings().catch(error => {
  console.error('Error checking optimization settings:', error);
  process.exit(1);
});
