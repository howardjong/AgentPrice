
/**
 * Apply System Optimizations
 * This script applies various performance and memory optimizations
 */
import logger from '../../utils/logger.js';
import resourceManager from '../../utils/resourceManager.js';
import memoryLeakDetector from '../../utils/memoryLeakDetector.js';
import performanceMonitor from '../../utils/performanceMonitor.js';

// Format memory for display
function formatMemory(bytes) {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

async function applyOptimizations() {
  console.log('======================================');
  console.log('    APPLYING SYSTEM OPTIMIZATIONS    ');
  console.log('======================================');
  
  // Get initial memory usage
  const initialMemory = process.memoryUsage();
  console.log(`\nInitial memory usage:`);
  console.log(`Heap Used: ${formatMemory(initialMemory.heapUsed)}`);
  console.log(`RSS: ${formatMemory(initialMemory.rss)}`);
  
  console.log('\n1. Configuring Memory Leak Detector...');
  // Configure memory leak detector for maximum efficiency
  memoryLeakDetector.configure({
    enabled: true,
    checkInterval: 300000, // 5 minutes
    alertThreshold: 25, // 25% growth threshold
    gcBeforeCheck: true,
    maxSamples: 8,
    resourceSavingMode: true
  });
  
  console.log('✅ Memory Leak Detector configured');
  
  console.log('\n2. Configuring Resource Manager...');
  // Configure resource manager with optimized settings
  resourceManager.configure({
    memory: {
      heapLimitMB: 75, // Lower threshold to 75MB
      gcThresholdMB: 60 // Trigger GC earlier
    },
    cpu: {
      maxUtilization: 50 // Lower CPU threshold
    },
    gcInterval: 600000, // 10 minutes
    monitoringInterval: 300000, // 5 minutes
    cleanupInterval: 1200000 // 20 minutes
  });
  
  console.log('✅ Resource Manager configured');
  
  console.log('\n3. Starting resource monitoring...');
  // Start monitoring and management
  resourceManager.start();
  console.log('✅ Resource monitoring started');
  
  // Suggest a manual garbage collection
  if (global.gc && typeof global.gc === 'function') {
    console.log('\n4. Running manual garbage collection...');
    const beforeGC = process.memoryUsage();
    
    // Run garbage collection
    global.gc();
    
    // Check results
    const afterGC = process.memoryUsage();
    const freedMB = Math.round((beforeGC.heapUsed - afterGC.heapUsed) / 1024 / 1024);
    
    console.log(`✅ Garbage collection freed ${freedMB}MB of memory`);
    console.log(`   Current heap usage: ${formatMemory(afterGC.heapUsed)}`);
  } else {
    console.log('\n4. Manual garbage collection not available');
    console.log('   Run with --expose-gc flag to enable manual GC');
  }
  
  console.log('\n======================================');
  console.log('     OPTIMIZATIONS APPLIED SUCCESSFULLY     ');
  console.log('======================================');
  
  console.log('\nThe system is now configured for optimal performance');
  console.log('Memory leak detection and resource management are active');
  
  // Return optimization status
  return {
    success: true,
    optimizedMemoryUsage: process.memoryUsage(),
    memoryLeakDetector: {
      isActive: memoryLeakDetector.isMonitoring,
      resourceSavingMode: memoryLeakDetector.resourceSavingMode
    },
    resourceManager: {
      isActive: resourceManager.isActive,
      heapUsageThreshold: `${resourceManager.options.heapUsageThreshold}MB`
    }
  };
}

// Run optimizations
applyOptimizations().then(result => {
  console.log('\nOptimization complete!');
}).catch(error => {
  console.error('Error applying optimizations:', error);
  process.exit(1);
});
/**
 * System Optimization Script
 * Applies performance optimizations to reduce memory usage
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import memoryLeakDetector from '../../utils/memoryLeakDetector.js';
import resourceManager from '../../utils/resourceManager.js';
import smartCache from '../../utils/smartCache.js';
import logger from '../../utils/logger.js';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to format memory values
function formatMemory(bytes) {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

async function applyOptimizations() {
  console.log('======================================');
  console.log('    APPLYING SYSTEM OPTIMIZATIONS    ');
  console.log('======================================');
  
  // Get initial memory usage
  const initialMemory = process.memoryUsage();
  console.log(`\nInitial memory usage:`);
  console.log(`Heap Used: ${formatMemory(initialMemory.heapUsed)}`);
  console.log(`RSS: ${formatMemory(initialMemory.rss)}`);
  
  console.log('\n1. Configuring Memory Leak Detector...');
  // Configure memory leak detector for maximum efficiency
  memoryLeakDetector.configure({
    enabled: true,
    checkInterval: 300000, // 5 minutes
    alertThreshold: 25, // 25% growth threshold
    gcBeforeCheck: true,
    maxSamples: 8,
    resourceSavingMode: true
  });
  
  console.log('✅ Memory Leak Detector configured');
  
  console.log('\n2. Configuring Resource Manager...');
  // Configure resource manager with optimized settings
  resourceManager.configure({
    memory: {
      heapLimitMB: 75, // Lower threshold to 75MB
      gcThresholdMB: 60 // Trigger GC earlier
    },
    cpu: {
      maxUtilization: 50 // Lower CPU threshold
    },
    gcInterval: 600000, // 10 minutes
    monitoringInterval: 300000, // 5 minutes
    cleanupInterval: 1200000 // 20 minutes
  });
  
  console.log('✅ Resource Manager configured');
  
  console.log('\n3. Configuring Smart Cache...');
  // Configure smart cache with optimized settings
  smartCache.configure({
    maxSize: 50, // Reduce cache size
    ttl: 1800000, // 30 minutes TTL
    cleanInterval: 300000 // 5 minutes cleanup
  });
  
  console.log('✅ Smart Cache configured');
  
  console.log('\n4. Starting resource monitoring...');
  // Start monitoring and management
  resourceManager.start();
  console.log('✅ Resource monitoring started');
  
  // Suggest a manual garbage collection
  if (global.gc && typeof global.gc === 'function') {
    console.log('\n5. Running manual garbage collection...');
    const beforeGC = process.memoryUsage();
    
    // Run garbage collection
    global.gc();
    
    // Check results
    const afterGC = process.memoryUsage();
    const freedMB = Math.round((beforeGC.heapUsed - afterGC.heapUsed) / 1024 / 1024);
    
    console.log(`✅ Garbage collection freed ${freedMB}MB of memory`);
    console.log(`   Current heap usage: ${formatMemory(afterGC.heapUsed)}`);
  } else {
    console.log('\n5. Manual garbage collection not available');
    console.log('   Run with --expose-gc flag to enable manual GC');
  }
  
  console.log('\n======================================');
  console.log('     OPTIMIZATIONS APPLIED SUCCESSFULLY     ');
  console.log('======================================');
  
  console.log('\nThe system is now configured for optimal performance');
  console.log('Memory leak detection and resource management are active');
  
  // Return optimization status
  return {
    success: true,
    optimizedMemoryUsage: process.memoryUsage(),
    memoryLeakDetector: {
      isActive: memoryLeakDetector.isMonitoring,
      resourceSavingMode: memoryLeakDetector.resourceSavingMode
    },
    resourceManager: {
      isActive: resourceManager.isActive,
      heapUsageThreshold: `${resourceManager.options.heapUsageThreshold}MB`
    },
    smartCache: {
      maxSize: smartCache.maxSize,
      currentSize: smartCache.cache.size
    }
  };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  applyOptimizations().then(result => {
    console.log('\nOptimization result:', result.success ? 'SUCCESS' : 'FAILED');
    console.log(`Final heap usage: ${formatMemory(result.optimizedMemoryUsage.heapUsed)}`);
  }).catch(err => {
    console.error('Error during optimization:', err);
    process.exit(1);
  });
}

export default applyOptimizations;
/**
 * Performance Optimization Script
 * 
 * This script applies various optimizations to improve system performance
 * and reduce memory usage, especially for LLM API calls.
 */

import logger from '../../utils/logger.js';
import enhancedCache from '../../utils/enhancedCache.js';
import batchProcessor from '../../utils/batchProcessor.js';
import documentFingerprinter from '../../utils/documentFingerprinter.js';
import contentChunker from '../../utils/contentChunker.js';

// Set a timeout to prevent the script from running indefinitely
const SCRIPT_TIMEOUT = 30000; // 30 seconds
const timeoutId = setTimeout(() => {
  logger.warn('Apply optimizations script timed out, exiting');
  process.exit(0);
}, SCRIPT_TIMEOUT);

// Ensure the timeout is cleared if the script completes normally
timeoutId.unref();

/**
 * Main optimization function
 */
async function applyOptimizations() {
  console.log('=================================================');
  console.log('   APPLYING PERFORMANCE OPTIMIZATIONS');
  console.log('=================================================');
  
  try {
    // 1. Optimize memory usage by cleaning up caches
    console.log('\n[1/4] Optimizing memory usage...');
    const cacheStats = enhancedCache.getStats();
    console.log(`Cache before cleanup: ${cacheStats.size} items, ${cacheStats.sizeInBytes} bytes`);
    
    // Clean old items from the cache
    const cleanedItems = enhancedCache.prune();
    console.log(`Cleaned ${cleanedItems} stale items from cache`);
    
    // Clear fingerprint cache to reduce memory footprint
    documentFingerprinter.clearCache();
    console.log('Cleared document fingerprint cache');
    
    // 2. Optimize batch processor settings
    console.log('\n[2/4] Optimizing batch processor...');
    const batchStats = batchProcessor.getStats();
    console.log(`Batch processor stats: ${batchStats.processed} items processed, ${batchStats.activeBatches} active batches`);
    
    // If memory usage is high, adjust batch settings
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    if (heapUsedMB > 200) { // If using more than 200MB
      console.log(`High memory usage detected (${heapUsedMB}MB), reducing batch size`);
      batchProcessor.options.maxBatchSize = Math.max(1, Math.floor(batchProcessor.options.maxBatchSize / 2));
      console.log(`Adjusted batch size to ${batchProcessor.options.maxBatchSize}`);
    }
    
    // 3. Optimize content chunker settings
    console.log('\n[3/4] Optimizing content chunker...');
    // Adjust chunking settings for better performance
    contentChunker.options.defaultChunkSize = 6000; // Reduce default chunk size
    contentChunker.options.defaultOverlap = 150;    // Reduce default overlap
    console.log('Adjusted content chunker settings for better performance');
    
    // 4. Run global garbage collection if available
    console.log('\n[4/4] Running memory cleanup...');
    if (global.gc) {
      console.log('Running garbage collection');
      global.gc();
    } else {
      console.log('Manual garbage collection not available (run with --expose-gc to enable)');
    }
    
    // Display current memory usage
    const currentMemUsage = process.memoryUsage();
    console.log('\nCurrent memory usage:');
    console.log(`- RSS: ${Math.round(currentMemUsage.rss / 1024 / 1024)}MB`);
    console.log(`- Heap Total: ${Math.round(currentMemUsage.heapTotal / 1024 / 1024)}MB`);
    console.log(`- Heap Used: ${Math.round(currentMemUsage.heapUsed / 1024 / 1024)}MB`);
    console.log(`- External: ${Math.round(currentMemUsage.external / 1024 / 1024)}MB`);
    
    console.log('\n=================================================');
    console.log('   OPTIMIZATIONS SUCCESSFULLY APPLIED');
    console.log('=================================================');
    
  } catch (error) {
    console.error(`Error applying optimizations: ${error.message}`);
    logger.error('Optimization error', { error: error.message, stack: error.stack });
  } finally {
    // Clear the timeout
    clearTimeout(timeoutId);
  }
}

// Run the optimization function
applyOptimizations().catch(err => {
  console.error('Fatal error in optimization script:', err);
  process.exit(1);
});
