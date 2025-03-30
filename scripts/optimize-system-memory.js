
/**
 * System Memory Optimization
 * 
 * Lightweight script that uses existing resourceManager to optimize 
 * memory usage without creating additional components.
 */

import resourceManager from '../utils/resourceManager.js';
import logger from '../utils/logger.js';

/**
 * Apply optimal memory settings to existing components
 */
async function optimizeMemory() {
  logger.info('Starting memory optimization...');
  
  try {
    // Get current memory usage for baseline
    const beforeStats = process.memoryUsage();
    logger.info('Memory usage before optimization', {
      heapUsedMB: Math.round(beforeStats.heapUsed / 1024 / 1024),
      rssMB: Math.round(beforeStats.rss / 1024 / 1024)
    });

    // 1. Configure resource manager with optimal settings
    resourceManager.configure({
      maxConcurrentRequests: 3, // Lower concurrent requests 
      memoryThreshold: 60,      // More aggressive memory threshold
      cpuThreshold: 40,         // Lower CPU threshold
      monitoringInterval: 60000, // More frequent monitoring (1 min)
      cleanupInterval: 300000,   // More frequent cleanup (5 mins)
      enableActiveMonitoring: true
    });
    
    // 2. Optimize connection pools
    resourceManager.optimizeConnections({
      poolSize: 3,               // Smaller pool size
      timeout: 10000,            // Shorter connection timeout
      idleTimeout: 20000,        // Shorter idle timeout
      resourceFactor: 0.5        // More aggressive resource factor
    });
    
    // 3. Force initial cleanup
    resourceManager.cleanup();
    
    // 4. Force garbage collection if available
    if (global.gc) {
      logger.info('Running garbage collection');
      global.gc();
    } else {
      logger.info('Garbage collection not available. For better results, run with: node --expose-gc');
    }
    
    // Get memory usage after optimization
    const afterStats = process.memoryUsage();
    const savedHeapMB = (beforeStats.heapUsed - afterStats.heapUsed) / (1024 * 1024);
    const savedRssMB = (beforeStats.rss - afterStats.rss) / (1024 * 1024);
    
    logger.info('Memory optimization complete', {
      heapUsedMB: Math.round(afterStats.heapUsed / 1024 / 1024),
      rssMB: Math.round(afterStats.rss / 1024 / 1024),
      heapSavedMB: Math.round(savedHeapMB * 10) / 10,
      rssSavedMB: Math.round(savedRssMB * 10) / 10
    });
    
    // Return optimization results
    return {
      beforeStats,
      afterStats,
      savedHeapMB,
      savedRssMB,
      success: true
    };
  } catch (error) {
    logger.error('Error during memory optimization', { error: error.message });
    return { success: false, error: error.message };
  }
}

// Run if called directly
if (process.argv[1].includes('optimize-system-memory.js')) {
  optimizeMemory().then(results => {
    if (results.success) {
      console.log(`\n✅ Memory optimization successful!`);
      console.log(`   Heap memory saved: ${Math.round(results.savedHeapMB * 10) / 10} MB`);
      console.log(`   RSS memory saved: ${Math.round(results.savedRssMB * 10) / 10} MB`);
    } else {
      console.error(`\n❌ Memory optimization failed: ${results.error}`);
    }
    process.exit(results.success ? 0 : 1);
  });
}

export default optimizeMemory;
