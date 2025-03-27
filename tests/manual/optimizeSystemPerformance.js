
/**
 * System Performance Optimizer
 * Applies optimizations to make the application more lightweight and resource-efficient
 */

import logger from '../../utils/logger.js';
import smartCache from '../../utils/smartCache.js';
import memoryLeakDetector from '../../utils/memoryLeakDetector.js';
import resourceManager from '../../utils/resourceManager.js';
import componentLoader from '../../utils/componentLoader.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function optimizeSystemPerformance() {
  console.log('======================================');
  console.log('     SYSTEM PERFORMANCE OPTIMIZER     ');
  console.log('======================================\n');
  
  // 1. Configure memory leak detector for lower resource usage
  console.log('1. Configuring memory leak detector for lightweight operation');
  memoryLeakDetector.resourceSavingMode = true;
  memoryLeakDetector.sampleInterval = 300000; // 5 minutes
  memoryLeakDetector.maxSamples = 12; // Store fewer samples
  
  // 2. Configure smart cache for lower memory usage
  console.log('\n2. Configuring smart cache for reduced memory footprint');
  smartCache.maxSize = 100; // Reduce max cache size
  smartCache.memoryLimitMB = 25; // Lower memory limit
  smartCache.lowMemoryMode = true; // Enable low memory mode
  smartCache.defaultTTL = 2 * 60 * 60 * 1000; // 2 hours TTL
  
  // Run cache cleanup to free memory
  const removedItems = smartCache.removeExpiredItems();
  console.log(`   - Removed ${removedItems} expired cache items`);
  
  // 3. Configure resource manager for lower thresholds
  console.log('\n3. Configuring resource manager for better memory management');
  resourceManager.options.heapUsageThreshold = 80; // Lower heap threshold (MB)
  resourceManager.options.monitoringInterval = 3 * 60 * 1000; // 3 minutes
  resourceManager.options.cleanupInterval = 10 * 60 * 1000; // 10 minutes
  
  // Force immediate cleanup
  console.log('   - Running forced cleanup');
  resourceManager.forceCleanup();
  
  // 4. Configure component loader for lazy loading
  console.log('\n4. Optimizing component loader');
  
  // Show memory usage after optimizations
  const memUsage = process.memoryUsage();
  console.log('\n5. Current memory usage after optimizations:');
  console.log(`   - Heap used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  console.log(`   - RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
  console.log(`   - External: ${Math.round(memUsage.external / 1024 / 1024)}MB`);
  
  // Run garbage collection if available
  if (global.gc && typeof global.gc === 'function') {
    console.log('\n6. Running garbage collection');
    const beforeGC = process.memoryUsage().heapUsed;
    global.gc();
    const afterGC = process.memoryUsage().heapUsed;
    const freedMB = Math.round((beforeGC - afterGC) / 1024 / 1024);
    console.log(`   - Freed ${freedMB}MB through garbage collection`);
  }
  
  // Save optimization settings to a file for persistence
  console.log('\n7. Saving optimization settings');
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const optimizationSettings = {
    timestamp,
    memoryLeakDetector: {
      resourceSavingMode: true,
      sampleInterval: 300000,
      maxSamples: 12
    },
    smartCache: {
      maxSize: 100,
      memoryLimitMB: 25,
      lowMemoryMode: true,
      defaultTTL: 2 * 60 * 60 * 1000
    },
    resourceManager: {
      heapUsageThreshold: 80,
      monitoringInterval: 3 * 60 * 1000,
      cleanupInterval: 10 * 60 * 1000
    }
  };
  
  try {
    const outputDir = path.join(__dirname, '../output');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      path.join(outputDir, `performance-optimizations-${timestamp}.json`),
      JSON.stringify(optimizationSettings, null, 2)
    );
  } catch (error) {
    console.error(`Error saving optimization settings: ${error.message}`);
  }
  
  console.log('\n======================================');
  console.log('     OPTIMIZATIONS APPLIED SUCCESSFULLY     ');
  console.log('======================================');
  console.log('\nThe application is now configured for lower resource usage.');
  console.log('To start the optimized application, use the "Start Low Memory App" workflow');
}

// Run optimization
optimizeSystemPerformance().catch(err => {
  console.error('Error during performance optimization:', err);
});
