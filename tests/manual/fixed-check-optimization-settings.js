/**
 * Optimization Settings Check
 * 
 * This script checks the current configuration of all performance-related utilities
 * to verify that our optimizations are applied.
 */

import logger from '../../utils/logger.js';

// Core optimization utilities
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

// Function to print status with appropriate emoji
function printStatus(name, status, details = '') {
  const statusEmoji = status ? '✅' : '❌';
  const statusText = status ? 'ACTIVE' : 'INACTIVE';
  console.log(`${statusEmoji} ${name}: ${statusText} ${details}`);
}

// Check if a component is optimized based on its properties
function isOptimized(component, requiredProps) {
  if (!component) return false;
  
  return requiredProps.every(prop => {
    const [path, expectedValue] = prop.split('=');
    const keys = path.split('.');
    
    // Navigate through the object path
    let value = component;
    for (const key of keys) {
      if (value === undefined || value === null) return false;
      value = value[key];
    }
    
    // If expectedValue is provided, check equality
    if (expectedValue !== undefined) {
      return String(value) === expectedValue;
    }
    
    // Otherwise just check if the value exists
    return value !== undefined && value !== null;
  });
}

console.log('=================================================');
console.log('      CHECKING OPTIMIZATION SETTINGS             ');
console.log('=================================================');

// Get current memory usage
const memoryUsage = process.memoryUsage();
console.log('\nCurrent Memory Usage:');
console.log(`- Heap Total: ${formatMemory(memoryUsage.heapTotal)}`);
console.log(`- Heap Used: ${formatMemory(memoryUsage.heapUsed)}`);
console.log(`- RSS: ${formatMemory(memoryUsage.rss)}`);
console.log(`- External: ${formatMemory(memoryUsage.external || 0)}`);

console.log('\n1. Checking Core Optimization Components');

// Check Resource Manager
try {
  const resourceManagerStatus = resourceManager.getStatus();
  printStatus('Resource Manager', resourceManagerStatus.isActive);
  console.log(`- Max Concurrent Requests: ${resourceManager.maxConcurrentRequests || 'Unknown'}`);
  console.log(`- Pool Size: ${resourceManager.poolSize || 'Unknown'}`);
  console.log(`- Memory Threshold: ${resourceManager.memoryThreshold || 'Unknown'}%`);
} catch (err) {
  console.log(`- ❌ Error checking Resource Manager: ${err.message}`);
}

// Check Smart Cache
try {
  const smartCacheStatus = smartCache.getStatus();
  printStatus('Smart Cache', smartCacheStatus.enabled);
  console.log(`- Cache Size: ${smartCache.size || 0} items`);
  console.log(`- Max Size: ${smartCache.maxSize || 0} items`);
  console.log(`- Low Memory Mode: ${smartCache.lowMemoryMode ? 'Enabled' : 'Disabled'}`);
  console.log(`- Compression: ${smartCache.compressionEnabled ? 'Enabled' : 'Disabled'}`);
} catch (err) {
  console.log(`- ❌ Error checking Smart Cache: ${err.message}`);
}

// Check Memory Leak Detector
try {
  const memoryLeakStatus = memoryLeakDetector.getStatus();
  printStatus('Memory Leak Detector', memoryLeakStatus.isMonitoring);
  console.log(`- Check Interval: ${formatDuration(memoryLeakDetector.checkInterval || 0)}`);
  console.log(`- Alert Threshold: ${memoryLeakDetector.alertThreshold || 0}% growth`);
  console.log(`- Heap Dump Enabled: ${memoryLeakDetector.heapDumpOnLeak ? 'Yes' : 'No'}`);
} catch (err) {
  console.log(`- ❌ Error checking Memory Leak Detector: ${err.message}`);
}

// Check Component Loader
try {
  const componentLoaderStatus = componentLoader.getStatus();
  printStatus('Component Loader', componentLoaderStatus.initialized);
  console.log(`- Lazy Loading: ${componentLoader.lazyLoadingEnabled ? 'Enabled' : 'Disabled'}`);
  console.log(`- Caching: ${componentLoader.cacheComponents ? 'Enabled' : 'Disabled'}`);
  console.log(`- Maximum cache age: ${formatDuration(componentLoader.maxCacheAge || 0)}`);
  console.log(`- Preload critical components: ${componentLoader.preloadCritical ? 'Yes' : 'No'}`);
} catch (err) {
  console.log(`- ❌ Error checking Component Loader: ${err.message}`);
}

console.log('\n2. Checking Cost Optimization Components');

// Check Cost Tracker
try {
  const costTrackerStatus = costTracker.getStatus();
  printStatus('Cost Tracker', costTrackerStatus.enabled);
  console.log(`- Total API Calls Tracked: ${costTracker.totalApiCalls || 0}`);
  console.log(`- Daily Budget: $${costTracker.dailyBudget || 0}`);
  console.log(`- Today's Usage: $${costTracker.todayUsage || 0}`);
  console.log(`- Budget Alerts: ${costTracker.budgetAlertsEnabled ? 'Enabled' : 'Disabled'}`);
} catch (err) {
  console.log(`- ❌ Error checking Cost Tracker: ${err.message}`);
}

// Check Token Optimizer
try {
  const tokenOptimizerStatus = tokenOptimizer.getStatus();
  printStatus('Token Optimizer', tokenOptimizerStatus.enabled);
  console.log(`- Tokens Saved: ${tokenOptimizer.tokensSaved || 0}`);
  console.log(`- Optimization Patterns: ${tokenOptimizer.patterns ? Object.keys(tokenOptimizer.patterns).length : 0}`);
  console.log(`- System Prompt Optimization: ${tokenOptimizer.optimizeSystemPrompts ? 'Enabled' : 'Disabled'}`);
} catch (err) {
  console.log(`- ❌ Error checking Token Optimizer: ${err.message}`);
}

// Check Tiered Response Strategy
try {
  const tieredResponseStatus = tieredResponseStrategy.getStatus();
  printStatus('Tiered Response Strategy', tieredResponseStatus.enabled);
  console.log(`- Default Tier: ${tieredResponseStrategy.defaultTier || 'standard'}`);
  console.log(`- Auto Downgrade: ${tieredResponseStrategy.autoDowngrade ? 'Enabled' : 'Disabled'}`);
  console.log(`- Current Tier: ${tieredResponseStrategy.currentTier || 'standard'}`);
} catch (err) {
  console.log(`- ❌ Error checking Tiered Response Strategy: ${err.message}`);
}

console.log('\n3. Checking Performance Optimization Components');

// Check Batch Processor
try {
  const batchProcessorStats = batchProcessor.getStats();
  printStatus('Batch Processor', true, `(${batchProcessorStats.processed || 0} processed items)`);
  console.log(`- Max Batch Size: ${batchProcessor.options?.maxBatchSize || 'Unknown'}`);
  console.log(`- Batch Window: ${formatDuration(batchProcessor.options?.batchWindowMs || 0)}`);
  console.log(`- Memory Aware: ${batchProcessor.options?.memoryAware ? 'Yes' : 'No'}`);
  console.log(`- Average Batch Size: ${batchProcessorStats.avgBatchSize || '0'}`);
} catch (err) {
  console.log(`- ❌ Error checking Batch Processor: ${err.message}`);
}

// Check Document Fingerprinter
try {
  const cacheSize = documentFingerprinter.getCacheSize();
  printStatus('Document Fingerprinter', true, `(${cacheSize} cached items)`);
  console.log(`- Similarity Threshold: ${documentFingerprinter.options?.similarityThreshold || 0.85}`);
  console.log(`- Truncation Enabled: ${documentFingerprinter.options?.enableTruncation ? 'Yes' : 'No'}`);
  console.log(`- Truncate Length: ${documentFingerprinter.options?.truncateLength || 1000} chars`);
} catch (err) {
  console.log(`- ❌ Error checking Document Fingerprinter: ${err.message}`);
}

// Check Content Chunker
try {
  const contentChunkerStatus = contentChunker.getStatus();
  printStatus('Content Chunker', contentChunkerStatus.enabled);
  console.log(`- Max Chunk Size: ${contentChunker.maxChunkSize || 'Unknown'} tokens`);
  console.log(`- Overlap Size: ${contentChunker.overlapSize || 'Unknown'} tokens`);
  console.log(`- Summary Generation: ${contentChunker.enableSummaries ? 'Enabled' : 'Disabled'}`);
} catch (err) {
  console.log(`- ❌ Error checking Content Chunker: ${err.message}`);
}

console.log('\n4. Optimization Status Summary');

// Overall optimization status checks
const resourceManagerOptimized = isOptimized(resourceManager, ['isActive', 'maxConcurrentRequests', 'poolSize', 'getStatus']);
const smartCacheOptimized = isOptimized(smartCache, ['maxSize', 'lowMemoryMode', 'getStatus']);
const memoryLeakDetectorOptimized = isOptimized(memoryLeakDetector, ['isMonitoring', 'checkInterval', 'getStatus']);
const componentLoaderOptimized = isOptimized(componentLoader, ['lazyLoadingEnabled', 'cacheComponents', 'getStatus']);
const costTrackerOptimized = isOptimized(costTracker, ['totalApiCalls', 'dailyBudget', 'getStatus']);
const tokenOptimizerOptimized = isOptimized(tokenOptimizer, ['tokensSaved', 'getStatus']);
const tieredResponseOptimized = isOptimized(tieredResponseStrategy, ['defaultTier', 'autoDowngrade', 'getStatus']);
const batchProcessorOptimized = isOptimized(batchProcessor, ['options', 'getStats']);
const documentFingerprinterOptimized = isOptimized(documentFingerprinter, ['options', 'getCacheSize']);
const contentChunkerOptimized = isOptimized(contentChunker, ['maxChunkSize', 'getStatus']);

// Print optimization summaries
console.log('Performance Optimization Status:');
console.log(`- Resource Manager: ${resourceManagerOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);
console.log(`- Smart Cache: ${smartCacheOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);
console.log(`- Memory Leak Detector: ${memoryLeakDetectorOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);
console.log(`- Component Loader: ${componentLoaderOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);

console.log('\nCost Optimization Status:');
console.log(`- Cost Tracker: ${costTrackerOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);
console.log(`- Token Optimizer: ${tokenOptimizerOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);
console.log(`- Tiered Response Strategy: ${tieredResponseOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);

console.log('\nProcess Optimization Status:');
console.log(`- Batch Processor: ${batchProcessorOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);
console.log(`- Document Fingerprinter: ${documentFingerprinterOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);
console.log(`- Content Chunker: ${contentChunkerOptimized ? '✅ Optimized' : '❌ Not Optimized'}`);

// Overall system health status
const totalComponents = 10;
const optimizedComponents = [
  resourceManagerOptimized, smartCacheOptimized, memoryLeakDetectorOptimized, componentLoaderOptimized,
  costTrackerOptimized, tokenOptimizerOptimized, tieredResponseOptimized,
  batchProcessorOptimized, documentFingerprinterOptimized, contentChunkerOptimized
].filter(Boolean).length;

const systemHealthPercentage = Math.round((optimizedComponents / totalComponents) * 100);

console.log('\n=================================================');
console.log(`System Optimization Health: ${systemHealthPercentage}%`);
console.log(`${optimizedComponents}/${totalComponents} components optimized`);
console.log('=================================================');

if (systemHealthPercentage === 100) {
  console.log('✅ All optimization systems are properly configured!');
} else if (systemHealthPercentage >= 80) {
  console.log('✅ Most optimization systems are properly configured.');
  console.log('⚠️ Consider fixing the non-optimized components for best performance.');
} else if (systemHealthPercentage >= 50) {
  console.log('⚠️ Some optimization systems are not properly configured.');
  console.log('⚠️ Run the apply-optimizations.js script to fix these issues.');
} else {
  console.log('❌ Many optimization systems are not properly configured.');
  console.log('❌ Run the apply-optimizations.js script to apply recommended optimizations.');
}

// Export for testing if needed
export default {
  checkOptimizations: () => ({
    systemHealthPercentage,
    optimizedComponents,
    totalComponents
  })
};