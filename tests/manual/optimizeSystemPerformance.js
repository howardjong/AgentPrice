
/**
 * System Performance Optimization Script
 * Runs various optimizations to reduce memory and CPU usage
 */
const resourceManager = require('../../utils/resourceManager.js').default;
const smartCache = require('../../utils/smartCache.js').default;
const memoryLeakDetector = require('../../utils/memoryLeakDetector.js').default;
const performanceMonitor = require('../../utils/performanceMonitor.js').default;
const componentLoader = require('../../utils/componentLoader.js').default;
const logger = require('../../utils/logger.js').default;

// Enable resource saving mode where available
function enableResourceSavingModes() {
  console.log('======================================');
  console.log('    SYSTEM PERFORMANCE OPTIMIZATION');
  console.log('======================================\n');
  
  console.log('1. Adjusting memory settings...');
  
  // Configure memory leak detector for lower resource usage
  if (memoryLeakDetector) {
    memoryLeakDetector.resourceSavingMode = true;
    memoryLeakDetector.sampleInterval = 300000; // 5 minutes
    memoryLeakDetector.maxSamples = 12; // Keep fewer samples
    console.log('  ✅ Memory leak detector optimized');
  }
  
  // Configure smart cache for lower memory usage
  if (smartCache) {
    smartCache.maxSize = Math.floor(smartCache.maxSize * 0.6); // 60% of original size
    smartCache.lowMemoryMode = true;
    smartCache.defaultTTL = 2 * 60 * 60 * 1000; // 2 hours TTL
    console.log('  ✅ Smart cache optimized');
    
    // Force cache cleanup
    const removed = smartCache.removeExpiredItems();
    console.log(`     - Removed ${removed} expired cache items`);
  }
  
  // Start resource manager
  if (resourceManager) {
    resourceManager.start();
    console.log('  ✅ Resource manager activated');
  }
  
  console.log('\n2. Checking for memory leaks...');
  // Force a memory leak check
  if (memoryLeakDetector && memoryLeakDetector.takeSample) {
    memoryLeakDetector.takeSample();
    const report = memoryLeakDetector.getReport();
    console.log(`  Memory status: ${report.recommendation || 'No issues detected'}`);
    console.log(`  Current heap usage: ${report.currentHeapUsedMB || 'Unknown'}MB`);
  }
  
  console.log('\n3. Optimizing background processes...');
  // Collect performance stats
  if (performanceMonitor) {
    const perfReport = performanceMonitor.getReport();
    console.log('  Current system resource usage:');
    console.log(`  - Heap used: ${perfReport.resourceUsage.heapUsed}`);
    console.log(`  - RSS: ${perfReport.resourceUsage.rss}`);
    console.log(`  - Active operations: ${Object.keys(perfReport.activeOperations).length}`);
  }
  
  console.log('\n4. Running memory cleanup...');
  // Force garbage collection if available
  if (global.gc && typeof global.gc === 'function') {
    const before = process.memoryUsage();
    global.gc();
    const after = process.memoryUsage();
    
    const freedMB = Math.round((before.heapUsed - after.heapUsed) / 1024 / 1024);
    console.log(`  ✅ Garbage collection freed ${freedMB}MB of memory`);
    console.log(`  - Current heap usage: ${Math.round(after.heapUsed / 1024 / 1024)}MB`);
  } else {
    console.log('  ⚠️ Garbage collection not available (run with --expose-gc for better results)');
  }
  
  console.log('\n======================================');
  console.log('    OPTIMIZATION RECOMMENDATIONS');
  console.log('======================================');
  console.log('1. Start application with lower memory settings:');
  console.log('   - Set OPTIMIZE_MEMORY=true in environment');
  console.log('   - Run with Node.js flag: --max-old-space-size=256');
  console.log('\n2. Reduce API calls and background operations:');
  console.log('   - Set DISABLE_LLM_CALLS=true for development');
  console.log('   - Use CACHE_TTL=7200 for shorter cache lifetimes');
  console.log('\n3. Regular maintenance:');
  console.log('   - Restart the application weekly');
  console.log('   - Run this optimization script daily');
  console.log('======================================');
}

// Run the optimization
enableResourceSavingModes();
