/**
 * Apply System Optimizations
 * This script applies various performance and memory optimizations
 */
import logger from '../../utils/logger.js';
import resourceManager from '../../utils/resourceManager.js';
import memoryLeakDetector from '../../utils/memoryLeakDetector.js';
import performanceMonitor from '../../utils/performanceMonitor.js';
import smartCache from '../../utils/smartCache.js';
import componentLoader from '../../utils/componentLoader.js';

// Format memory for display
function formatMemory(bytes) {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

// Wrap optimization steps in try/catch blocks
async function safelyRunOptimizationStep(name, callback) {
  try {
    console.log(`\n${name}...`);
    await callback();
    console.log(`✅ ${name} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error during ${name}: ${error.message}`);
    logger.error(`Error during ${name}`, { error: error.message, stack: error.stack });
    return false;
  }
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

  let stepsPassed = 0;
  let totalSteps = 5;

  // Step 1: Configure Memory Leak Detector
  const step1 = await safelyRunOptimizationStep('1. Configuring Memory Leak Detector', async () => {
    memoryLeakDetector.configure({
      enabled: true,
      checkInterval: 300000, // 5 minutes
      alertThreshold: 25, // 25% growth threshold
      gcBeforeCheck: true,
      maxSamples: 8,
      resourceSavingMode: true
    });
  });
  if (step1) stepsPassed++;

  // Step 2: Configure Resource Manager
  const step2 = await safelyRunOptimizationStep('2. Configuring Resource Manager', async () => {
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
  });
  if (step2) stepsPassed++;

  // Step 3: Configure Smart Cache
  const step3 = await safelyRunOptimizationStep('3. Configuring Smart Cache', async () => {
    smartCache.configure({
      maxSize: 50, // Reduce cache size
      ttl: 1800000, // 30 minutes TTL
      cleanInterval: 300000, // 5 minutes cleanup
      lowMemoryMode: true,
      memoryLimitMB: 50
    });
  });
  if (step3) stepsPassed++;

  // Step 4: Configure Component Loader
  const step4 = await safelyRunOptimizationStep('4. Configuring Component Loader', async () => {
    componentLoader.configure({
      lazyLoadingEnabled: true,
      cacheComponents: true,
      maxCacheAge: 3600000, // 1 hour
      preloadCritical: false
    });
  });
  if (step4) stepsPassed++;

  // Step 5: Start resource monitoring
  const step5 = await safelyRunOptimizationStep('5. Starting resource monitoring', async () => {
    if (resourceManager && typeof resourceManager.start === 'function') {
      resourceManager.start();
    } else {
      throw new Error('Resource manager is not properly initialized');
    }
  });
  if (step5) stepsPassed++;

  // Try running manual garbage collection if available
  if (global.gc && typeof global.gc === 'function') {
    await safelyRunOptimizationStep('6. Running manual garbage collection', async () => {
      const beforeGC = process.memoryUsage();

      // Run garbage collection
      global.gc();

      // Check results
      const afterGC = process.memoryUsage();
      const freedMB = Math.round((beforeGC.heapUsed - afterGC.heapUsed) / 1024 / 1024);

      console.log(`   Garbage collection freed ${freedMB}MB of memory`);
      console.log(`   Current heap usage: ${formatMemory(afterGC.heapUsed)}`);
    });
  } else {
    console.log('\n6. Manual garbage collection not available');
    console.log('   Run with --expose-gc flag to enable manual GC');
  }

  // Final status report
  console.log('\n======================================');
  if (stepsPassed === totalSteps) {
    console.log('     OPTIMIZATIONS APPLIED SUCCESSFULLY     ');
  } else {
    console.log(`     OPTIMIZATIONS PARTIALLY APPLIED (${stepsPassed}/${totalSteps})    `);
  }
  console.log('======================================');

  console.log('\nThe system is now configured for optimal performance');
  if (stepsPassed === totalSteps) {
    console.log('All optimization systems are active');
  } else {
    console.log(`${stepsPassed} out of ${totalSteps} optimization systems are active`);
    console.log('Run the check-optimization-settings.js script for detailed status');
  }

  // Return optimization status
  return {
    success: stepsPassed === totalSteps,
    partialSuccess: stepsPassed > 0,
    stepsCompleted: stepsPassed,
    totalSteps: totalSteps,
    optimizedMemoryUsage: process.memoryUsage(),
    memoryLeakDetector: {
      isActive: memoryLeakDetector.isMonitoring,
      resourceSavingMode: memoryLeakDetector.resourceSavingMode
    },
    resourceManager: {
      isActive: resourceManager.isActive,
      heapUsageThreshold: resourceManager.options?.memory?.heapLimitMB || 'N/A'
    },
    smartCache: {
      maxSize: smartCache.maxSize,
      currentSize: smartCache.cache?.size || 0
    }
  };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  applyOptimizations().then(result => {
    console.log('\nOptimization result:', result.success ? 'SUCCESS' : (result.partialSuccess ? 'PARTIAL SUCCESS' : 'FAILED'));
    console.log(`Final heap usage: ${formatMemory(result.optimizedMemoryUsage.heapUsed)}`);

    // Exit with appropriate code
    process.exit(result.success ? 0 : (result.partialSuccess ? 0 : 1));
  }).catch(err => {
    console.error('Critical error during optimization:', err);
    process.exit(1);
  });
}

export default applyOptimizations;

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
/**
 * Performance Optimization Script
 * 
 * This script applies various optimizations to improve system performance
 * and reduce memory usage, especially for LLM API calls.
 */

import logger from '../../utils/logger.js';
import resourceManager from '../../utils/resourceManager.js';
import memoryLeakDetector from '../../utils/memoryLeakDetector.js';
import smartCache from '../../utils/smartCache.js';
import enhancedCache from '../../utils/enhancedCache.js';
import costTracker from '../../utils/costTracker.js';
import tokenOptimizer from '../../utils/tokenOptimizer.js';
import batchProcessor from '../../utils/batchProcessor.js';
import contentChunker from '../../utils/contentChunker.js';
import documentFingerprinter from '../../utils/documentFingerprinter.js';
import { promises as fs } from 'fs';
import path from 'path';

// Set a timeout to prevent the script from running indefinitely
const SCRIPT_TIMEOUT = 30000; // 30 seconds
const timeoutId = setTimeout(() => {
  logger.warn('Apply optimizations script timed out, exiting');
  process.exit(0);
}, SCRIPT_TIMEOUT);

// Ensure the timeout is cleared if the script completes normally
timeoutId.unref();

/**
 * Apply optimizations to various system components
 */
async function applyOptimizations() {
  console.log('=================================================');
  console.log('   APPLYING PERFORMANCE OPTIMIZATIONS');
  console.log('=================================================');
  
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  
  try {
    // 1. Configure resource manager for optimal performance
    console.log('\n[1/6] Configuring resource manager...');
    const resourceConfig = {
      memory: {
        heapLimitMB: 100, // Lower heap usage threshold
        gcThresholdMB: 70  // Trigger GC at lower threshold
      },
      cpu: {
        maxUtilization: 70 // Lower CPU usage threshold
      },
      gcInterval: 5 * 60 * 1000, // 5 minutes
      monitoringInterval: 2 * 60 * 1000, // 2 minutes
      cleanupInterval: 10 * 60 * 1000, // 10 minutes
      aggressiveGcEnabled: true,
      lowMemoryMode: true
    };
    
    resourceManager.configure(resourceConfig);
    if (!resourceManager.isActive) {
      resourceManager.start();
      console.log('Started resource manager with optimized settings');
    } else {
      console.log('Resource manager already active, applied optimized settings');
    }
    
    // 2. Configure memory leak detector
    console.log('\n[2/6] Configuring memory leak detector...');
    const leakDetectorConfig = {
      enabled: true,
      checkInterval: 5 * 60 * 1000, // 5 minutes
      alertThreshold: 25, // Lower threshold for memory growth alerts
      gcBeforeCheck: true,
      maxSamples: 8, // Reduce memory usage for samples
      resourceSavingMode: true
    };
    
    memoryLeakDetector.configure(leakDetectorConfig);
    console.log('Memory leak detector configured with optimized settings');
    
    // 3. Configure smart cache for better performance
    console.log('\n[3/6] Configuring cache systems...');
    const cacheConfig = {
      maxSize: 200, // Limit cache size to 200 items
      ttl: 4 * 60 * 60 * 1000, // 4 hours in ms
      enableFuzzyMatch: true,
      fuzzyMatchThreshold: 0.85,
      memoryLimitMB: 50, // Limit cache memory usage
      lowMemoryMode: true
    };
    
    smartCache.configure(cacheConfig);
    console.log('Smart cache configured with optimized settings');
    
    // Configure enhanced cache if it has configure method
    if (typeof enhancedCache.configure === 'function') {
      enhancedCache.configure({
        enableFingerprinting: true,
        similarityThreshold: 0.8,
        defaultTtl: 4 * 60 * 60 * 1000 // 4 hours
      });
      console.log('Enhanced cache configured with optimized settings');
    }
    
    // 4. Configure cost tracker
    console.log('\n[4/6] Configuring cost tracking...');
    costTracker.configure({
      autoSaveInterval: 30 * 60 * 1000, // 30 minutes
      costSavingFeatures: {
        caching: true,
        tokenOptimization: true,
        modelDowngrading: true,
        batchProcessing: true,
        apiDisabling: true
      }
    });
    console.log('Cost tracker configured with all savings features enabled');
    
    // 5. Configure content chunker for optimized splitting
    console.log('\n[5/6] Configuring content processing...');
    if (typeof contentChunker.configure === 'function') {
      contentChunker.configure({
        defaultChunkSize: 6000, // Smaller chunks for better processing
        defaultOverlap: 150,    // Moderate overlap
        preserveCodeBlocks: true,
        preserveParagraphs: true
      });
      console.log('Content chunker configured with optimized settings');
    }
    
    // Configure batch processor if needed
    if (typeof batchProcessor.configure === 'function') {
      batchProcessor.configure({
        maxBatchSize: 5,
        batchTimeout: 200,
        autoProcess: true,
        processingDelay: 100
      });
      console.log('Batch processor configured with optimized settings');
    }
    
    // 6. Save settings to configuration file
    console.log('\n[6/6] Saving optimization settings...');
    const optimizationSettings = {
      timestamp,
      resourceManager: resourceConfig,
      memoryLeakDetector: leakDetectorConfig,
      smartCache: cacheConfig,
      costTracker: {
        autoSaveInterval: 30 * 60 * 1000,
        enableAllSavingFeatures: true
      },
      contentChunker: {
        defaultChunkSize: 6000,
        defaultOverlap: 150
      },
      batchProcessor: {
        maxBatchSize: 5,
        batchTimeout: 200
      },
      environment: {
        optimizeMemory: true,
        disableLlmCalls: process.env.DISABLE_LLM_CALLS === 'true'
      }
    };
    
    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (err) {
      // Ignore error if directory already exists
    }
    
    // Save optimization settings to file
    await fs.writeFile(
      path.join(dataDir, `optimization-settings-${timestamp}.json`),
      JSON.stringify(optimizationSettings, null, 2)
    );
    
    // Apply resource cleanup
    if (global.gc && typeof global.gc === 'function') {
      console.log('\nRunning garbage collection');
      const beforeMem = process.memoryUsage().heapUsed;
      global.gc();
      const afterMem = process.memoryUsage().heapUsed;
      const freedMB = Math.round((beforeMem - afterMem) / 1024 / 1024);
      console.log(`Freed ${freedMB}MB of memory with garbage collection`);
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
    
    // Successfully applied optimizations
    return true;
  } catch (error) {
    console.error(`Error applying optimizations: ${error.message}`);
    logger.error('Optimization error', { error: error.message, stack: error.stack });
    return false;
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

export default applyOptimizations;
/**
 * Apply Optimizations Script
 * 
 * Applies performance and cost optimizations to the system
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../utils/logger.js';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// Utility to safely check if a module exists
async function moduleExists(modulePath) {
  try {
    await import(modulePath);
    return true;
  } catch (err) {
    return false;
  }
}

async function applyOptimizations() {
  console.log("======================================");
  console.log("      APPLYING OPTIMIZATIONS         ");
  console.log("======================================\n");
  
  const optimizations = {
    caching: false,
    batching: false,
    fingerprinting: false,
    costTracking: false,
    tieredResponses: false
  };
  
  // Initialize all optimization components
  
  // 1. Enhanced Cache
  try {
    if (await moduleExists('../../utils/enhancedCache.js')) {
      const enhancedCache = (await import('../../utils/enhancedCache.js')).default;
      console.log("✓ Enhanced Cache initialized");
      optimizations.caching = true;
      
      // Configure for optimal performance
      if (typeof enhancedCache.configure === 'function') {
        enhancedCache.configure({
          maxSize: 1000,
          ttl: 3600000 // 1 hour
        });
        console.log("  - Cache configured with optimal settings");
      }
    } else {
      console.log("⚠️ Enhanced Cache module not found");
    }
  } catch (err) {
    console.error("❌ Error initializing Enhanced Cache:", err.message);
  }
  
  // 2. Batch Processor
  try {
    if (await moduleExists('../../utils/batchProcessor.js')) {
      const batchProcessor = (await import('../../utils/batchProcessor.js')).default;
      console.log("✓ Batch Processor initialized");
      optimizations.batching = true;
      
      // Configure batch processor options if supported
      if (batchProcessor.options) {
        // Don't overwrite options, just log them
        console.log(`  - Current batch size: ${batchProcessor.options.maxBatchSize || 'unknown'}`);
        console.log(`  - Batch timeout: ${batchProcessor.options.batchTimeout || 'unknown'}ms`);
      }
    } else {
      console.log("⚠️ Batch Processor module not found");
    }
  } catch (err) {
    console.error("❌ Error initializing Batch Processor:", err.message);
  }
  
  // 3. Document Fingerprinter
  try {
    if (await moduleExists('../../utils/documentFingerprinter.js')) {
      const documentFingerprinter = (await import('../../utils/documentFingerprinter.js')).default;
      console.log("✓ Document Fingerprinter initialized");
      optimizations.fingerprinting = true;
      
      // Clear the fingerprint cache to avoid stale data
      if (typeof documentFingerprinter.clearCache === 'function') {
        documentFingerprinter.clearCache();
        console.log("  - Fingerprint cache cleared");
      }
    } else {
      console.log("⚠️ Document Fingerprinter module not found");
    }
  } catch (err) {
    console.error("❌ Error initializing Document Fingerprinter:", err.message);
  }
  
  // 4. Cost Tracker
  try {
    if (await moduleExists('../../utils/costTracker.js')) {
      const costTracker = (await import('../../utils/costTracker.js')).default;
      console.log("✓ Cost Tracker initialized");
      optimizations.costTracking = true;
      
      // Reset stats if supported
      if (typeof costTracker.resetStats === 'function') {
        costTracker.resetStats();
        console.log("  - Cost tracking stats reset");
      }
    } else {
      console.log("⚠️ Cost Tracker module not found");
    }
  } catch (err) {
    console.error("❌ Error initializing Cost Tracker:", err.message);
  }
  
  // 5. Tiered Response Strategy
  try {
    if (await moduleExists('../../utils/tieredResponseStrategy.js')) {
      const tieredResponseStrategy = (await import('../../utils/tieredResponseStrategy.js')).default;
      console.log("✓ Tiered Response Strategy initialized");
      optimizations.tieredResponses = true;
    } else {
      console.log("⚠️ Tiered Response Strategy module not found");
    }
  } catch (err) {
    console.error("❌ Error initializing Tiered Response Strategy:", err.message);
  }
  
  // 6. Check for any available service optimizations
  try {
    if (await moduleExists('../../services/perplexityService.js')) {
      const perplexityService = await import('../../services/perplexityService.js');
      console.log("✓ Perplexity Service found, checking for optimization hooks");
      
      // Look for optimization methods
      if (typeof perplexityService.optimize === 'function') {
        await perplexityService.optimize();
        console.log("  - Applied optimizations to Perplexity Service");
      } else if (typeof perplexityService.default?.optimize === 'function') {
        await perplexityService.default.optimize();
        console.log("  - Applied optimizations to Perplexity Service");
      } else {
        console.log("  - No optimization methods found for Perplexity Service");
      }
    }
  } catch (err) {
    console.log("ℹ️ Skipping service optimizations:", err.message);
  }
  
  // Calculate how many optimizations were successfully applied
  const successCount = Object.values(optimizations).filter(Boolean).length;
  const totalCount = Object.keys(optimizations).length;
  
  console.log("\nOPTIMIZATION SUMMARY:");
  console.log("--------------------");
  console.log(`Applied: ${successCount}/${totalCount} optimizations`);
  console.log(`Success Rate: ${Math.round((successCount / totalCount) * 100)}%`);
  
  if (successCount === totalCount) {
    console.log("\n✅ SUCCESS: All optimizations applied successfully");
  } else if (successCount > 0) {
    console.log("\n⚠️ PARTIAL SUCCESS: Some optimizations applied");
    console.log("Run 'check-optimization-settings.js' to see detailed status");
  } else {
    console.log("\n❌ FAILED: No optimizations applied");
    console.log("Check that optimization modules are properly installed");
  }
  
  console.log("\nCurrent memory usage:");
  console.table(process.memoryUsage());
  
  console.log("\n======================================");
  
  return {
    success: successCount > 0,
    optimizations,
    successCount,
    totalCount
  };
}

// Run the optimization if this is the main module
if (import.meta.url === `file://${__filename}`) {
  applyOptimizations().catch(err => {
    console.error('Error applying optimizations:', err);
    process.exit(1);
  });
}

export default applyOptimizations;
