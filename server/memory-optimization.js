/**
 * Memory Optimization Module
 * 
 * This module integrates resource management, memory leak detection, and
 * memory optimization capabilities for the server.
 */

import resourceManager from '../utils/resourceManager.js';
import memoryLeakDetector from '../utils/memoryLeakDetector.js';
import logger from '../utils/logger.js';

/**
 * Initialize memory optimization tools
 * @param {Object} options - Optimization options
 */
export function initializeMemoryOptimization(options = {}) {
  const {
    enableAggressive = false,
    lowMemoryMode = false,
    gcInterval = 300000, // 5 minutes
    monitoringInterval = 60000, // 1 minute
    memoryThreshold = 70, // 70MB
    heapDumpOnLeak = false
  } = options;
  
  logger.info('Initializing memory optimization', {
    aggressive: enableAggressive,
    lowMemoryMode,
    gcInterval: `${gcInterval / 1000}s`,
    monitoringInterval: `${monitoringInterval / 1000}s`
  });
  
  // Configure resource manager
  resourceManager.configure({
    maxConcurrentRequests: lowMemoryMode ? 3 : 10,
    memoryThreshold: lowMemoryMode ? memoryThreshold : memoryThreshold * 1.5,
    cpuThreshold: lowMemoryMode ? 50 : 70,
    monitoringInterval: lowMemoryMode ? monitoringInterval : monitoringInterval * 2,
    cleanupInterval: lowMemoryMode ? gcInterval : gcInterval * 2,
    enableActiveMonitoring: true
  });
  
  // Configure memory leak detector
  memoryLeakDetector.configure({
    checkInterval: lowMemoryMode ? monitoringInterval : monitoringInterval * 3,
    growthThreshold: lowMemoryMode ? 15 : 20,
    gcTriggerThreshold: lowMemoryMode ? memoryThreshold : memoryThreshold * 1.5,
    resourceSavingMode: true,
    enableMonitoring: true,
    heapDumpOnLeak
  });
  
  // If aggressive mode is enabled, apply more intensive optimizations
  if (enableAggressive) {
    applyAggressiveOptimizations();
  }
  
  // Start the optimizations
  resourceManager.start();
  memoryLeakDetector.start();
  
  logger.info('Memory optimization initialized');
  
  return {
    resourceManager,
    memoryLeakDetector
  };
}

/**
 * Apply aggressive optimizations for extreme memory pressure situations
 */
function applyAggressiveOptimizations() {
  logger.info('Applying aggressive memory optimizations');
  
  // Force garbage collection if available
  if (global.gc) {
    logger.info('Performing initial garbage collection');
    try {
      global.gc();
    } catch (error) {
      logger.error('Failed to perform garbage collection', { error: error.message });
    }
  }
  
  // Configure resource manager with extreme settings
  resourceManager.configure({
    maxConcurrentRequests: 2,
    memoryThreshold: 40,
    cpuThreshold: 40,
    monitoringInterval: 30000, // 30 seconds
    cleanupInterval: 60000, // 1 minute
    enableActiveMonitoring: true
  });
  
  // Configure memory leak detector with extreme settings
  memoryLeakDetector.configure({
    checkInterval: 60000, // 1 minute
    growthThreshold: 10,
    gcTriggerThreshold: 40,
    resourceSavingMode: true,
    enableMonitoring: true
  });
  
  // Schedule regular garbage collection
  if (global.gc) {
    const gcInterval = setInterval(() => {
      logger.debug('Performing scheduled garbage collection');
      try {
        global.gc();
      } catch (error) {
        logger.error('Failed to perform garbage collection', { error: error.message });
      }
    }, 120000); // 2 minutes
    
    // Keep reference to allow cleanup
    global.scheduledGc = gcInterval;
  }
}

/**
 * Get current memory usage and optimization status
 * @returns {Object} Memory status information
 */
export function getMemoryStatus() {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);
  
  const resourceStatus = resourceManager.getStatus();
  const leakDetectorStatus = memoryLeakDetector.getStatus();
  
  return {
    currentUsage: {
      heapUsedMB,
      heapTotalMB,
      rssMB,
      externalMB: Math.round((memUsage.external || 0) / 1024 / 1024),
      usagePercent: Math.round((heapUsedMB / heapTotalMB) * 100)
    },
    resourceManager: {
      isActive: resourceStatus.isActive,
      connectionPoolCount: resourceStatus.connectionMetrics?.pools || 0,
      totalConnections: resourceStatus.connectionMetrics?.totalConnections || 0,
      activeConnections: resourceStatus.connectionMetrics?.activeConnections || 0
    },
    memoryLeakDetector: {
      isMonitoring: leakDetectorStatus.isMonitoring,
      leaksDetected: leakDetectorStatus.leaksDetected || 0,
      lastCheckAt: leakDetectorStatus.lastCheckAt
    },
    optimization: {
      status: heapUsedMB > 100 ? 'critical' : heapUsedMB > 70 ? 'warning' : 'normal',
      uptime: process.uptime(),
      gcAvailable: typeof global.gc === 'function'
    }
  };
}

/**
 * Perform immediate memory relief operations
 * @param {boolean} aggressive - Whether to use aggressive relief measures
 * @returns {Object} Results of memory relief operations
 */
export async function performMemoryRelief(aggressive = false) {
  logger.info('Performing memory relief operations', { aggressive });
  
  const before = process.memoryUsage();
  
  // Step 1: Force garbage collection if available
  if (global.gc) {
    try {
      logger.info('Performing garbage collection');
      global.gc();
      // More aggressive GC with multiple passes if requested
      if (aggressive) {
        setTimeout(() => global.gc(), 100);
        setTimeout(() => global.gc(), 500);
      }
    } catch (error) {
      logger.error('Failed to perform garbage collection', { error: error.message });
    }
  }
  
  // Step 2: Clean up resource manager connections
  try {
    resourceManager.cleanup();
  } catch (error) {
    logger.error('Error cleaning up resources', { error: error.message });
  }
  
  // Step 3: If aggressive, reset memory baselines and restart monitors
  if (aggressive) {
    try {
      // Restart memory leak detector with new baseline
      memoryLeakDetector.stop();
      memoryLeakDetector.start();
      
      // Apply aggressive settings
      applyAggressiveOptimizations();
    } catch (error) {
      logger.error('Error applying aggressive optimizations', { error: error.message });
    }
  }
  
  // Wait a moment for GC to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Measure results
  const after = process.memoryUsage();
  const heapReductionMB = Math.round((before.heapUsed - after.heapUsed) / 1024 / 1024);
  const rssReductionMB = Math.round((before.rss - after.rss) / 1024 / 1024);
  
  logger.info('Memory relief completed', {
    heapReductionMB,
    rssReductionMB,
    reductionPercent: Math.round((heapReductionMB / (before.heapUsed / 1024 / 1024)) * 100)
  });
  
  return {
    before: {
      heapUsedMB: Math.round(before.heapUsed / 1024 / 1024),
      rssMB: Math.round(before.rss / 1024 / 1024)
    },
    after: {
      heapUsedMB: Math.round(after.heapUsed / 1024 / 1024),
      rssMB: Math.round(after.rss / 1024 / 1024)
    },
    reduction: {
      heapMB: heapReductionMB,
      rssMB: rssReductionMB,
      percent: Math.round((heapReductionMB / (before.heapUsed / 1024 / 1024)) * 100)
    },
    timestamp: new Date().toISOString()
  };
}

export default {
  initializeMemoryOptimization,
  getMemoryStatus,
  performMemoryRelief
};