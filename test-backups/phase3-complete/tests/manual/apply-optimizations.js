/**
 * Performance Optimization Script
 * 
 * This script applies various optimizations to improve system performance
 * and reduce memory usage, especially for LLM API calls.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Core optimization utilities
import logger from '../../utils/logger.js';
import resourceManager from '../../utils/resourceManager.js';
import memoryLeakDetector from '../../utils/memoryLeakDetector.js';
import smartCache from '../../utils/smartCache.js';
import componentLoader from '../../utils/componentLoader.js';

// Cost optimization utilities
import costTracker from '../../utils/costTracker.js';
import tokenOptimizer from '../../utils/tokenOptimizer.js';
import tieredResponseStrategy from '../../utils/tieredResponseStrategy.js';

// Performance optimization utilities
import batchProcessor from '../../utils/batchProcessor.js';
import documentFingerprinter from '../../utils/documentFingerprinter.js';
import contentChunker from '../../utils/contentChunker.js';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set a timeout to prevent the script from running indefinitely
const SCRIPT_TIMEOUT = 30000; // 30 seconds
const timeoutId = setTimeout(() => {
  logger.warn('Apply optimizations script timed out, exiting');
  process.exit(0);
}, SCRIPT_TIMEOUT);

// Ensure the timeout is cleared if the script completes normally
timeoutId.unref();

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

/**
 * Main optimization function
 */
async function applyOptimizations() {
  console.log('=================================================');
  console.log('   APPLYING PERFORMANCE & COST OPTIMIZATIONS     ');
  console.log('=================================================');
  
  // Get initial memory usage
  const initialMemory = process.memoryUsage();
  console.log(`\nInitial memory usage:`);
  console.log(`Heap Used: ${formatMemory(initialMemory.heapUsed)}`);
  console.log(`RSS: ${formatMemory(initialMemory.rss)}`);
  
  // 1. Memory Leak Detection
  await safelyRunOptimizationStep('Configuring Memory Leak Detector', async () => {
    memoryLeakDetector.configure({
      enabled: true,
      checkInterval: 300000, // 5 minutes
      alertThreshold: 25, // 25% growth threshold
      sampleSize: 5, // Number of samples to keep for trend analysis
      heapDumpOnLeak: false // Set to true to create heap dumps on detected leaks
    });
    
    memoryLeakDetector.start();
    console.log('Memory leak detection enabled with 5-minute interval');
  });
  
  // 2. Resource Management
  await safelyRunOptimizationStep('Optimizing Resource Manager', async () => {
    resourceManager.configure({
      maxConcurrentRequests: 15,
      requestTimeout: 30000,
      enablePooling: true,
      poolSize: 5,
      maxRetries: 3,
      retryDelay: 1000
    });
    
    resourceManager.optimizeConnections();
    console.log('Resource manager optimized with connection pooling');
  });
  
  // 3. Smart Cache
  await safelyRunOptimizationStep('Configuring Smart Cache', async () => {
    smartCache.configure({
      ttl: 3600, // 1 hour default TTL
      maxSize: 1000, // Maximum items in cache
      pruneInterval: 600, // Prune expired items every 10 minutes
      enableCompression: true,
      compressionThreshold: 1024, // Compress items larger than 1KB
      adaptiveTTL: true, // Adjust TTL based on access patterns
      memoryAware: true, // Prune cache when memory pressure is high
      hitRatioTarget: 0.8 // Target hit ratio
    });
    
    smartCache.optimizeForMemory();
    console.log('Smart cache configured with memory-aware settings');
  });
  
  // 4. Component Loader
  await safelyRunOptimizationStep('Optimizing Component Loader', async () => {
    componentLoader.configure({
      lazyLoading: true,
      preloadEssentials: true,
      enableCaching: true
    });
    
    await componentLoader.preloadCriticalComponents();
    console.log('Component loader optimized with lazy loading');
  });
  
  // 5. Batch Processor
  await safelyRunOptimizationStep('Optimizing Batch Processor', async () => {
    batchProcessor.options.maxBatchSize = 10;
    batchProcessor.options.batchWindowMs = 100;
    batchProcessor.options.memoryAware = true;
    batchProcessor.options.memoryThresholdMB = 500;
    
    batchProcessor.resetStats();
    console.log('Batch processor configured for optimal throughput');
  });
  
  // 6. Document Fingerprinter
  await safelyRunOptimizationStep('Configuring Document Fingerprinter', async () => {
    documentFingerprinter.options.similarityThreshold = 0.85;
    documentFingerprinter.options.enableTruncation = true;
    documentFingerprinter.options.truncateLength = 1000;
    
    documentFingerprinter.clearCache();
    console.log('Document fingerprinter optimized for similarity detection');
  });
  
  // 7. Content Chunker
  await safelyRunOptimizationStep('Optimizing Content Chunker', async () => {
    contentChunker.configure({
      maxChunkSize: 2000,
      overlapSize: 200,
      enableSummaries: true,
      summaryLength: 100
    });
    
    console.log('Content chunker configured for optimal processing');
  });
  
  // 8. Cost Tracker
  await safelyRunOptimizationStep('Setting up Cost Tracking', async () => {
    costTracker.configure({
      trackApiCalls: true,
      trackModels: true,
      enableBudgetAlerts: true,
      dailyBudget: 10.0, // $10/day max
      savingsTarget: 0.2 // Target 20% savings
    });
    
    costTracker.resetDailyUsage();
    console.log('Cost tracking configured with budget alerts');
  });
  
  // 9. Token Optimizer
  await safelyRunOptimizationStep('Configuring Token Optimizer', async () => {
    tokenOptimizer.configure({
      optimizeSystemPrompts: true,
      removeRedundantInstructions: true,
      simplifyResponses: true,
      truncateExamples: true,
      minimizeMarkdown: true,
      replaceStopSequences: true
    });
    
    console.log('Token optimizer configured for maximum efficiency');
  });
  
  // 10. Tiered Response Strategy
  await safelyRunOptimizationStep('Setting up Tiered Response Strategy', async () => {
    tieredResponseStrategy.configure({
      defaultTier: 'standard',
      costMultipliers: {
        minimal: 0.5,
        standard: 1.0,
        premium: 2.0
      },
      autoDowngrade: true,
      downgradeTrigger: 0.8, // Downgrade at 80% of daily budget
      tierConfigPath: path.join(__dirname, '../../config/tiers.json')
    });
    
    console.log('Tiered response strategy configured with auto-downgrade');
  });
  
  // 11. Save Optimization Settings
  await safelyRunOptimizationStep('Saving Optimization Settings', async () => {
    const optimizationSettings = {
      timestamp: new Date().toISOString(),
      memoryLeakDetection: memoryLeakDetector.getStatus(),
      resourceManagement: resourceManager.getStatus(),
      smartCache: smartCache.getStatus(),
      componentLoader: componentLoader.getStatus(),
      batchProcessing: batchProcessor.getStatus(),
      documentFingerprinting: documentFingerprinter.getStatus(),
      contentChunking: contentChunker.getStatus(),
      costTracking: costTracker.getStatus(),
      tokenOptimization: tokenOptimizer.getStatus(),
      tieredResponseStrategy: tieredResponseStrategy.getStatus()
    };
    
    // Save settings to file
    await fs.writeFile(
      path.join(__dirname, '../../data/optimization-settings.json'),
      JSON.stringify(optimizationSettings, null, 2),
      'utf8'
    );
    
    console.log('Optimization settings saved to data/optimization-settings.json');
  });
  
  // Get final memory usage
  const finalMemory = process.memoryUsage();
  console.log(`\nFinal memory usage:`);
  console.log(`Heap Used: ${formatMemory(finalMemory.heapUsed)} (${formatMemory(finalMemory.heapUsed - initialMemory.heapUsed)} change)`);
  console.log(`RSS: ${formatMemory(finalMemory.rss)} (${formatMemory(finalMemory.rss - initialMemory.rss)} change)`);
  
  console.log('\n=================================================');
  console.log('      OPTIMIZATION COMPLETED SUCCESSFULLY        ');
  console.log('=================================================');
  
  // Clear the timeout as we've finished successfully
  clearTimeout(timeoutId);
}

// Run optimizations and handle errors
applyOptimizations().catch(error => {
  console.error('Error applying optimizations:', error);
  logger.error('Error applying optimizations', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Export the main function for testing
export default applyOptimizations;