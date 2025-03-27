/**
 * System Optimization Settings Check
 * 
 * This script checks the current configuration of all performance and cost-related utilities
 * to verify that our optimizations are applied.
 */

import logger from '../../utils/logger.js';
import costTracker from '../../utils/costTracker.js';
import smartCache from '../../utils/smartCache.js';
import resourceManager from '../../utils/resourceManager.js';
import memoryLeakDetector from '../../utils/memoryLeakDetector.js';
import { areLlmCallsDisabled } from '../../utils/disableLlmCalls.js';
import enhancedCache from '../../utils/enhancedCache.js';
import tokenOptimizer from '../../utils/tokenOptimizer.js';
import batchProcessor from '../../utils/batchProcessor.js';
import rateLimiter from '../../utils/rateLimiter.js';
import documentFingerprinter from '../../utils/documentFingerprinter.js';
import contentChunker from '../../utils/contentChunker.js';
import componentLoader from '../../utils/componentLoader.js';

// Silence the logger for this script
logger.level = 'silent';

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

// Check current memory usage
function checkCurrentMemoryUsage() {
  const memUsage = process.memoryUsage();
  return {
    heapUsed: formatMemory(memUsage.heapUsed),
    heapTotal: formatMemory(memUsage.heapTotal),
    rss: formatMemory(memUsage.rss),
    external: formatMemory(memUsage.external)
  };
}

console.log('=======================================================');
console.log('           SYSTEM OPTIMIZATION SETTINGS CHECK          ');
console.log('=======================================================\n');

// Check LLM API call settings
const llmCallsDisabled = areLlmCallsDisabled();
console.log('LLM API CALLS:');
console.log(`- Status: ${llmCallsDisabled ? '🟢 DISABLED (saving costs)' : '🔴 ENABLED (costs may be incurred)'}`);
console.log('-------------------------------------------------------\n');

// Check Cost Tracker settings
console.log('COST TRACKER:');
const costSavingFeatures = costTracker.costSavingFeatures;
console.log(`- Caching: ${costSavingFeatures.caching.enabled ? '🟢 ENABLED' : '🔴 DISABLED'} (Savings: $${costSavingFeatures.caching.savings.toFixed(4)})`);
console.log(`- Token Optimization: ${costSavingFeatures.tokenOptimization.enabled ? '🟢 ENABLED' : '🔴 DISABLED'} (Savings: $${costSavingFeatures.tokenOptimization.savings.toFixed(4)})`);
console.log(`- Model Downgrading: ${costSavingFeatures.modelDowngrading.enabled ? '🟢 ENABLED' : '🔴 DISABLED'} (Savings: $${costSavingFeatures.modelDowngrading.savings.toFixed(4)})`);
console.log(`- Batch Processing: ${costSavingFeatures.batchProcessing.enabled ? '🟢 ENABLED' : '🔴 DISABLED'} (Savings: $${costSavingFeatures.batchProcessing.savings.toFixed(4)})`);
console.log(`- API Disabling: ${costSavingFeatures.apiDisabling.enabled ? '🟢 ENABLED' : '🔴 DISABLED'} (Savings: $${costSavingFeatures.apiDisabling.savings.toFixed(4)})`);
console.log(`- Total Savings: $${costTracker.getTotalSavings().toFixed(4)}`);
console.log('-------------------------------------------------------\n');

// Check Smart Cache settings
const cacheStats = smartCache.getStats();
console.log('SMART CACHE:');
console.log(`- Cache Size: ${cacheStats.size}/${cacheStats.maxSize} (${cacheStats.utilization} utilized)`);
console.log(`- Hit Rate: ${cacheStats.hitRate} (Exact: ${cacheStats.exactHits}, Fuzzy: ${cacheStats.fuzzyHits}, Misses: ${cacheStats.misses})`);
console.log(`- Evictions: LRU=${cacheStats.evictions.lru}, Expired=${cacheStats.evictions.expired}, Memory=${cacheStats.evictions.memory}`);
console.log(`- Memory Mode: ${smartCache.lowMemoryMode ? '🟢 LOW MEMORY MODE' : '🔴 STANDARD MODE'}`);
console.log(`- Fuzzy Matching: ${smartCache.enableFuzzyMatch ? '🟢 ENABLED' : '🔴 DISABLED'} (Threshold: ${smartCache.fuzzyMatchThreshold})`);
console.log('-------------------------------------------------------\n');

// Check Enhanced Cache settings
console.log('ENHANCED CACHE:');
const enhancedCacheSettings = enhancedCache.getConfig ? enhancedCache.getConfig() : { 
  fingerprinting: true, 
  similarityMatching: true,
  timeToLive: enhancedCache.defaultTTL || 'Unknown' 
};
console.log(`- Document Fingerprinting: ${enhancedCacheSettings.fingerprinting ? '🟢 ENABLED' : '🔴 DISABLED'}`);
console.log(`- Similarity Matching: ${enhancedCacheSettings.similarityMatching ? '🟢 ENABLED' : '🔴 DISABLED'}`);
console.log(`- Default TTL: ${typeof enhancedCacheSettings.timeToLive === 'number' ? 
  (enhancedCacheSettings.timeToLive / (60 * 60 * 1000)) + ' hours' : 
  enhancedCacheSettings.timeToLive}`);
console.log('-------------------------------------------------------\n');

// Check Resource Manager settings
console.log('RESOURCE MANAGER:');
console.log(`- Status: ${resourceManager.isActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}`);
console.log(`- Heap Usage Threshold: ${resourceManager.options.heapUsageThreshold}MB`);
console.log(`- CPU Usage Threshold: ${resourceManager.options.cpuUsageThreshold}%`);
console.log(`- GC Interval: ${resourceManager.options.gcInterval / 1000}s`);
console.log(`- Aggressive GC: ${resourceManager.options.aggressiveGcEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}`);
console.log(`- Low Memory Mode: ${resourceManager.options.lowMemoryMode ? '🟢 ENABLED' : '🔴 DISABLED'}`);
console.log('-------------------------------------------------------\n');

// Check Memory Leak Detector settings
console.log('MEMORY LEAK DETECTOR:');
console.log(`- Status: ${memoryLeakDetector.isMonitoring ? '🟢 MONITORING' : '🔴 INACTIVE'}`);
console.log(`- Sample Interval: ${memoryLeakDetector.sampleInterval / 1000}s`);
console.log(`- Growth Threshold: ${memoryLeakDetector.growthThreshold}%`);
console.log(`- GC Trigger Threshold: ${memoryLeakDetector.gcTriggerThreshold}MB`);
console.log(`- Resource Saving Mode: ${memoryLeakDetector.resourceSavingMode ? '🟢 ENABLED' : '🔴 DISABLED'}`);
console.log('-------------------------------------------------------\n');

// Check Component Loader settings
console.log('COMPONENT LOADER:');
try {
  console.log(`- Lazy loading enabled: ${componentLoader.lazyLoadingEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}`);
  console.log(`- Cache components: ${componentLoader.cacheComponents ? '🟢 ENABLED' : '🔴 DISABLED'}`);
  console.log(`- Maximum cache age: ${formatDuration(componentLoader.maxCacheAge || 0)}`);
  console.log(`- Preload critical components: ${componentLoader.preloadCritical ? '🟢 ENABLED' : '🔴 DISABLED'}`);
} catch (err) {
  console.log(`- ❌ Error checking Component Loader: ${err.message}`);
}
console.log('-------------------------------------------------------\n');

// Check Token Optimizer settings
console.log('TOKEN OPTIMIZER:');
const patterns = tokenOptimizer.patterns || {};
console.log(`- Repetition Patterns: ${patterns.repetition ? patterns.repetition.length : 'Unknown'}`);
console.log(`- Verbose Phrase Patterns: ${patterns.verbosePhrases ? patterns.verbosePhrases.length : 'Unknown'}`);
console.log(`- Filler Word Patterns: ${patterns.fillerWords ? patterns.fillerWords.length : 'Unknown'}`);
console.log('-------------------------------------------------------\n');

// Check Batch Processor settings
console.log('BATCH PROCESSOR:');
console.log(`- Max Batch Size: ${batchProcessor.options ? batchProcessor.options.maxBatchSize : 'Unknown'}`);
console.log(`- Batch Timeout: ${batchProcessor.options ? batchProcessor.options.batchTimeout / 1000 + 's' : 'Unknown'}`);
console.log(`- Auto Processing: ${batchProcessor.options ? (batchProcessor.options.autoProcess ? '🟢 ENABLED' : '🔴 DISABLED') : 'Unknown'}`);
console.log('-------------------------------------------------------\n');

// Check Rate Limiter settings
console.log('RATE LIMITER:');
const rateLimiterStatus = rateLimiter.getStatus ? rateLimiter.getStatus() : { 
  activeRequests: 'Unknown', 
  queuedRequests: 'Unknown',
  isRateLimited: false
};
console.log(`- Requests Per Minute: ${rateLimiter.requestsPerMinute || 'Unknown'}`);
console.log(`- Cooldown Period: ${rateLimiter.cooldownPeriod ? rateLimiter.cooldownPeriod / 1000 + 's' : 'Unknown'}`);
console.log(`- Active Requests: ${rateLimiterStatus.activeRequests}`);
console.log(`- Queued Requests: ${rateLimiterStatus.queuedRequests}`);
console.log(`- Rate Limited: ${rateLimiterStatus.isRateLimited ? '🔴 YES' : '🟢 NO'}`);
console.log('-------------------------------------------------------\n');

// Check Document Fingerprinter settings
console.log('DOCUMENT FINGERPRINTER:');
console.log(`- Similarity Threshold: ${documentFingerprinter.similarityThreshold || 'Unknown'}`);
console.log(`- Hash Algorithm: ${documentFingerprinter.hashAlgorithm || 'Unknown'}`);
console.log(`- Max Cache Size: ${documentFingerprinter.maxCacheSize || 'Unknown'}`);
console.log('-------------------------------------------------------\n');

// Check Content Chunker settings
console.log('CONTENT CHUNKER:');
console.log(`- Default Chunk Size: ${contentChunker.options ? contentChunker.options.defaultChunkSize : 'Unknown'}`);
console.log(`- Default Overlap: ${contentChunker.options ? contentChunker.options.defaultOverlap : 'Unknown'}`);
console.log(`- Preserve Code Blocks: ${contentChunker.options ? (contentChunker.options.preserveCodeBlocks ? '🟢 YES' : '🔴 NO') : 'Unknown'}`);
console.log(`- Preserve Paragraphs: ${contentChunker.options ? (contentChunker.options.preserveParagraphs ? '🟢 YES' : '🔴 NO') : 'Unknown'}`);
console.log('-------------------------------------------------------\n');

// Check if optimizations are applied
console.log('OPTIMIZATION STATUS CHECK:');
try {
  const resourceManagerOptimized = 
    resourceManager.isActive && 
    resourceManager.options.heapUsageThreshold <= 75;
  
  const smartCacheOptimized = 
    cacheStats.maxSize && 
    cacheStats.maxSize <= 250 && 
    smartCache.lowMemoryMode;
  
  const memoryLeakDetectorOptimized = 
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

// Get current memory usage
const memUsage = process.memoryUsage();
console.log('\nCURRENT MEMORY USAGE:');
console.log(`- Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
console.log(`- Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
console.log(`- RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
console.log(`- External: ${Math.round(memUsage.external / 1024 / 1024)}MB`);
console.log('=======================================================');

process.exit(0);