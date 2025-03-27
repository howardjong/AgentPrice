
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
