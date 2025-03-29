/**
 * Run All Optimization Tests
 *
 * This script runs all optimization tests and generates reports
 * to ensure the system is fully optimized for cost and performance.
 */

import { fileURLToPath } from 'url';
import path from 'path';
import logger from '../../utils/logger.js';

// Import our test modules
import testSuite from './component-test-suite.js';
import applyOptimizations from './apply-optimizations.js';
import generateMetrics from './generate-metrics.js';

/**
 * Print a divider for console output
 * @param {string} title - Title text to display
 */
function printDivider(title) {
  console.log('\n=================================================');
  console.log(`     ${title.toUpperCase()}                       `);
  console.log('=================================================\n');
}

/**
 * Main function to run all tests and generate reports
 * @param {Object} options - Options for the test run
 */
async function runAllTests(options = {}) {
  const { 
    fixIssues = false,
    generateReport = true,
    detailedOutput = true 
  } = options;
  
  printDivider('Optimization Test Suite');
  
  // Step 1: Run initial tests to check status
  console.log('Running initial optimization tests...');
  const initialResults = await testSuite.runTestSuite(false);
  
  // Step 2: Apply optimizations if requested
  if (fixIssues) {
    printDivider('Applying Optimizations');
    console.log('Applying optimizations to components...');
    await applyOptimizations.applyAllOptimizations();
    
    // Run tests again to verify fixes
    printDivider('Verifying Optimizations');
    console.log('Running tests to verify optimizations...');
    const verificationResults = await testSuite.runTestSuite(false);
    
    // Log improvement
    const improvement = verificationResults.summary.percentOptimized - initialResults.summary.percentOptimized;
    console.log(`\nOptimization Status Improvement: ${improvement >= 0 ? '+' : ''}${improvement}%`);
    console.log(`Before: ${initialResults.summary.optimizedCount}/${initialResults.summary.totalCount} components optimized (${initialResults.summary.percentOptimized}%)`);
    console.log(`After: ${verificationResults.summary.optimizedCount}/${verificationResults.summary.totalCount} components optimized (${verificationResults.summary.percentOptimized}%)`);
  }
  
  // Step 3: Generate detailed metrics report
  if (generateReport) {
    printDivider('Generating Metrics Report');
    console.log('Generating detailed metrics report...');
    await generateMetrics.generateMetricsReport(true);
  }
  
  printDivider('Test Run Complete');
  
  // If detailed output is requested, show component configurations
  if (detailedOutput) {
    printDivider('Component Configurations');
    
    const componentMetrics = await generateMetrics.getComponentMetrics();
    
    // Output core optimization components
    console.log('CORE OPTIMIZATION COMPONENTS:');
    console.log('--------------------------');
    
    console.log('Resource Manager:');
    console.log(`- Active: ${componentMetrics.core.resourceManager.isActive ? 'Yes' : 'No'}`);
    console.log(`- Max Concurrent Requests: ${componentMetrics.core.resourceManager.maxConcurrentRequests}`);
    console.log(`- Pool Size: ${componentMetrics.core.resourceManager.poolSize}`);
    console.log(`- Memory Threshold: ${componentMetrics.core.resourceManager.memoryThreshold}%\n`);
    
    console.log('Smart Cache:');
    console.log(`- Enabled: ${componentMetrics.core.smartCache.enabled ? 'Yes' : 'No'}`);
    console.log(`- Cache Size: ${componentMetrics.core.smartCache.size} / ${componentMetrics.core.smartCache.maxSize} items`);
    console.log(`- Low Memory Mode: ${componentMetrics.core.smartCache.lowMemoryMode ? 'Enabled' : 'Disabled'}`);
    console.log(`- Hit Rate: ${componentMetrics.core.smartCache.hitRate}%\n`);
    
    console.log('Memory Leak Detector:');
    console.log(`- Monitoring: ${componentMetrics.core.memoryLeakDetector.isMonitoring ? 'Yes' : 'No'}`);
    console.log(`- Check Interval: ${componentMetrics.core.memoryLeakDetector.formattedCheckInterval}`);
    console.log(`- Growth Threshold: ${componentMetrics.core.memoryLeakDetector.growthThreshold}%`);
    console.log(`- Leaks Detected: ${componentMetrics.core.memoryLeakDetector.leaksDetected}\n`);
    
    console.log('Component Loader:');
    console.log(`- Initialized: ${componentMetrics.core.componentLoader.initialized ? 'Yes' : 'No'}`);
    console.log(`- Lazy Loading: ${componentMetrics.core.componentLoader.lazyLoadingEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`- Caching: ${componentMetrics.core.componentLoader.cacheEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`- Loaded Components: ${componentMetrics.core.componentLoader.loadedComponents}\n`);
    
    // Output cost optimization components
    console.log('COST OPTIMIZATION COMPONENTS:');
    console.log('---------------------------');
    
    console.log('Cost Tracker:');
    console.log(`- Enabled: ${componentMetrics.cost.costTracker.enabled ? 'Yes' : 'No'}`);
    console.log(`- API Calls Tracked: ${componentMetrics.cost.costTracker.totalApiCalls}`);
    console.log(`- Daily Budget: $${componentMetrics.cost.costTracker.dailyBudget}`);
    console.log(`- Today's Usage: $${componentMetrics.cost.costTracker.todayUsage} (${componentMetrics.cost.costTracker.formattedBudgetUtilization})\n`);
    
    console.log('Token Optimizer:');
    console.log(`- Enabled: ${componentMetrics.cost.tokenOptimizer.enabled ? 'Yes' : 'No'}`);
    console.log(`- Tokens Saved: ${componentMetrics.cost.tokenOptimizer.tokensSaved}`);
    console.log(`- Optimization Rate: ${componentMetrics.cost.tokenOptimizer.formattedOptimizationRate}`);
    console.log(`- Patterns: ${componentMetrics.cost.tokenOptimizer.numberOfPatterns}\n`);
    
    console.log('Tiered Response Strategy:');
    console.log(`- Enabled: ${componentMetrics.cost.tieredResponseStrategy.enabled ? 'Yes' : 'No'}`);
    console.log(`- Default Tier: ${componentMetrics.cost.tieredResponseStrategy.defaultTier}`);
    console.log(`- Current Tier: ${componentMetrics.cost.tieredResponseStrategy.currentTier}`);
    console.log(`- Auto Downgrade: ${componentMetrics.cost.tieredResponseStrategy.autoDowngrade ? 'Enabled' : 'Disabled'}`);
    console.log(`- Tiers Available: ${componentMetrics.cost.tieredResponseStrategy.tiersAvailable.join(', ')}\n`);
    
    // Output performance optimization components
    console.log('PERFORMANCE OPTIMIZATION COMPONENTS:');
    console.log('----------------------------------');
    
    console.log('Batch Processor:');
    console.log(`- Active: ${componentMetrics.performance.batchProcessor.active ? 'Yes' : 'No'}`);
    console.log(`- Max Batch Size: ${componentMetrics.performance.batchProcessor.maxBatchSize}`);
    console.log(`- Batch Window: ${componentMetrics.performance.batchProcessor.formattedBatchWindow}`);
    console.log(`- Memory Aware: ${componentMetrics.performance.batchProcessor.memoryAware ? 'Yes' : 'No'}`);
    console.log(`- Processed Items: ${componentMetrics.performance.batchProcessor.processed}\n`);
    
    console.log('Document Fingerprinter:');
    console.log(`- Active: ${componentMetrics.performance.documentFingerprinter.active ? 'Yes' : 'No'}`);
    console.log(`- Similarity Threshold: ${componentMetrics.performance.documentFingerprinter.similarityThreshold}`);
    console.log(`- Cache Size: ${componentMetrics.performance.documentFingerprinter.cacheSize} / ${componentMetrics.performance.documentFingerprinter.maxCacheSize}`);
    console.log(`- Duplicates Detected: ${componentMetrics.performance.documentFingerprinter.duplicatesDetected}\n`);
    
    console.log('Content Chunker:');
    console.log(`- Enabled: ${componentMetrics.performance.contentChunker.enabled ? 'Yes' : 'No'}`);
    console.log(`- Max Chunk Size: ${componentMetrics.performance.contentChunker.maxChunkSize} characters`);
    console.log(`- Overlap Size: ${componentMetrics.performance.contentChunker.overlapSize} characters`);
    console.log(`- Summary Generation: ${componentMetrics.performance.contentChunker.enableSummaries ? 'Enabled' : 'Disabled'}`);
    console.log(`- Patterns: ${componentMetrics.performance.contentChunker.patterns.total}\n`);
  }
  
  // Final recommendations
  const finalResults = fixIssues ? 
    await testSuite.runTestSuite(false) : 
    initialResults;
    
  printDivider('Recommendations');
  
  if (finalResults.summary.percentOptimized === 100) {
    console.log('✅ All optimization systems are properly configured!');
    console.log('Your system is fully optimized for both cost and performance.');
  } else if (finalResults.summary.percentOptimized >= 80) {
    console.log('✅ Most optimization systems are properly configured.');
    console.log('⚠️ Consider fixing these remaining components for optimal performance:');
    
    // List non-optimized components
    Object.entries(finalResults.results)
      .filter(([_, result]) => !result.optimized)
      .forEach(([key, result]) => {
        console.log(`- ${result.name}: Missing ${result.requiredProperties.join(', ')}`);
      });
  } else {
    console.log('⚠️ Several optimization systems need configuration.');
    console.log('❌ Run this script with --fix flag to apply recommended optimizations.');
  }
  
  // Return the final results
  return {
    initialResults,
    finalResults: fixIssues ? await testSuite.runTestSuite(false) : initialResults,
    metrics: await generateMetrics.getComponentMetrics(),
    systemMetrics: generateMetrics.getSystemMetrics(),
    costSavings: generateMetrics.calculateCostSavings()
  };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {
    fixIssues: args.includes('--fix'),
    generateReport: !args.includes('--no-report'),
    detailedOutput: !args.includes('--simple')
  };
  
  runAllTests(options).catch(error => {
    console.error('Error running tests:', error);
    process.exit(1);
  });
}

export default runAllTests;