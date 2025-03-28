/**
 * Generate Optimization Metrics Report
 *
 * This script generates comprehensive metrics on the system's optimization status,
 * with detailed information on each component's configuration and performance.
 */

import fs from 'fs/promises';
import path from 'path';
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

// Import test suite
import testSuite from './component-test-suite.js';

/**
 * Format bytes to human readable format
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Format milliseconds to human readable format
 * @param {number} ms - Milliseconds to format
 * @returns {string} Formatted string
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60 * 1000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 60 * 60 * 1000) return `${(ms / 1000 / 60).toFixed(1)}m`;
  return `${(ms / 1000 / 60 / 60).toFixed(1)}h`;
}

/**
 * Get general system metrics
 * @returns {Object} System metrics
 */
function getSystemMetrics() {
  const memoryUsage = process.memoryUsage();
  
  return {
    timestamp: new Date().toISOString(),
    memory: {
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      rss: memoryUsage.rss,
      external: memoryUsage.external || 0,
      formattedHeapUsed: formatBytes(memoryUsage.heapUsed),
      formattedRSS: formatBytes(memoryUsage.rss)
    },
    uptime: process.uptime(),
    formattedUptime: formatDuration(process.uptime() * 1000)
  };
}

/**
 * Get detailed metrics for all optimization components
 * @returns {Object} Component metrics
 */
async function getComponentMetrics() {
  // Core optimization metrics
  const resourceManagerMetrics = (() => {
    try {
      const status = resourceManager.getStatus();
      return {
        isActive: status.isActive || false,
        maxConcurrentRequests: resourceManager.maxConcurrentRequests || 0,
        poolSize: resourceManager.poolSize || 0,
        memoryThreshold: resourceManager.memoryThreshold || 0,
        cpuThreshold: resourceManager.cpuThreshold || 0,
        monitoringInterval: resourceManager.monitoringInterval || 0,
        formattedMonitoringInterval: formatDuration(resourceManager.monitoringInterval || 0),
        connectionMetrics: status.connectionMetrics || {}
      };
    } catch (error) {
      return { error: error.message };
    }
  })();
  
  const smartCacheMetrics = (() => {
    try {
      const status = smartCache.getStatus();
      return {
        enabled: status.enabled || false,
        size: smartCache.size || 0,
        maxSize: smartCache.maxSize || 0,
        hitRate: smartCache.hitRate || 0,
        missRate: smartCache.missRate || 0,
        lowMemoryMode: smartCache.lowMemoryMode || false,
        compressionEnabled: smartCache.compressionEnabled || false,
        ttl: smartCache.defaultTTL || 0,
        formattedTTL: formatDuration(smartCache.defaultTTL || 0),
        evictions: smartCache.evictions || 0
      };
    } catch (error) {
      return { error: error.message };
    }
  })();
  
  const memoryLeakDetectorMetrics = (() => {
    try {
      const status = memoryLeakDetector.getStatus();
      return {
        isMonitoring: status.isMonitoring || false,
        checkInterval: memoryLeakDetector.checkInterval || 0,
        formattedCheckInterval: formatDuration(memoryLeakDetector.checkInterval || 0),
        growthThreshold: memoryLeakDetector.alertThreshold || 0,
        leaksDetected: memoryLeakDetector.leaksDetected || 0,
        heapDumpEnabled: memoryLeakDetector.heapDumpOnLeak || false,
        lastCheckAt: memoryLeakDetector.lastCheckAt || null
      };
    } catch (error) {
      return { error: error.message };
    }
  })();
  
  const componentLoaderMetrics = (() => {
    try {
      const status = componentLoader.getStatus();
      return {
        initialized: status.initialized || false,
        lazyLoadingEnabled: componentLoader.lazyLoadingEnabled || false,
        cacheEnabled: componentLoader.cacheComponents || false,
        maxCacheAge: componentLoader.maxCacheAge || 0,
        formattedMaxCacheAge: formatDuration(componentLoader.maxCacheAge || 0),
        loadedComponents: componentLoader.loadedComponentCount || 0,
        preloadCritical: componentLoader.preloadCritical || false
      };
    } catch (error) {
      return { error: error.message };
    }
  })();
  
  // Cost optimization metrics
  const costTrackerMetrics = (() => {
    try {
      const status = costTracker.getStatus();
      return {
        enabled: status.enabled || false,
        totalApiCalls: costTracker.totalApiCalls || 0,
        dailyBudget: costTracker.dailyBudget || 0,
        todayUsage: costTracker.todayUsage || 0,
        budgetUtilization: costTracker.dailyBudget ? (costTracker.todayUsage / costTracker.dailyBudget) * 100 : 0,
        formattedBudgetUtilization: `${((costTracker.todayUsage / costTracker.dailyBudget) * 100 || 0).toFixed(1)}%`,
        alertsEnabled: costTracker.budgetAlertsEnabled || false,
        alertThreshold: costTracker.alertThreshold || 0,
        costByModel: status.costByModel || {},
        costByService: status.costByService || {}
      };
    } catch (error) {
      return { error: error.message };
    }
  })();
  
  const tokenOptimizerMetrics = (() => {
    try {
      const status = tokenOptimizer.getStatus();
      return {
        enabled: status.enabled || false,
        tokensSaved: tokenOptimizer.tokensSaved || 0,
        costSaved: tokenOptimizer.costSaved || 0,
        optimizationRate: tokenOptimizer.optimizationRate || 0,
        formattedOptimizationRate: `${(tokenOptimizer.optimizationRate || 0).toFixed(1)}%`,
        systemPromptsOptimized: tokenOptimizer.optimizeSystemPrompts || false,
        patterns: tokenOptimizer.patterns || {},
        numberOfPatterns: Object.keys(tokenOptimizer.patterns || {}).length
      };
    } catch (error) {
      return { error: error.message };
    }
  })();
  
  const tieredResponseMetrics = (() => {
    try {
      const status = tieredResponseStrategy.getStatus();
      return {
        enabled: status.enabled || false,
        defaultTier: tieredResponseStrategy.defaultTier || 'standard',
        currentTier: tieredResponseStrategy.currentTier || 'standard',
        autoDowngrade: tieredResponseStrategy.autoDowngrade || false,
        downgradeTrigger: tieredResponseStrategy.downgradeTrigger || 0,
        tiersAvailable: Object.keys(tieredResponseStrategy.costMultipliers || {}),
        requestsProcessed: tieredResponseStrategy.requestsProcessed || 0,
        downgrades: tieredResponseStrategy.downgrades || 0
      };
    } catch (error) {
      return { error: error.message };
    }
  })();
  
  // Performance optimization metrics
  const batchProcessorMetrics = (() => {
    try {
      const stats = batchProcessor.getStats();
      return {
        active: true,
        maxBatchSize: batchProcessor.options?.maxBatchSize || 0,
        batchWindow: batchProcessor.options?.batchWindowMs || 0,
        formattedBatchWindow: formatDuration(batchProcessor.options?.batchWindowMs || 0),
        memoryAware: batchProcessor.options?.memoryAware || false,
        processed: stats.processed || 0,
        batches: stats.batches || 0,
        averageBatchSize: stats.avgBatchSize || 0,
        activeBatches: stats.activeBatches || 0,
        maxConcurrentBatches: stats.maxConcurrentBatches || 0
      };
    } catch (error) {
      return { error: error.message };
    }
  })();
  
  const documentFingerprinterMetrics = (() => {
    try {
      const cacheSize = documentFingerprinter.getCacheSize();
      return {
        active: true,
        similarityThreshold: documentFingerprinter.options?.similarityThreshold || 0.85,
        truncationEnabled: documentFingerprinter.options?.enableTruncation || false,
        truncateLength: documentFingerprinter.options?.truncateLength || 1000,
        cacheSize,
        maxCacheSize: documentFingerprinter.options?.maxCacheSize || 0,
        cacheUtilization: documentFingerprinter.options?.maxCacheSize ? 
          (cacheSize / documentFingerprinter.options.maxCacheSize) * 100 : 0,
        formattedCacheUtilization: `${((cacheSize / (documentFingerprinter.options?.maxCacheSize || 1)) * 100).toFixed(1)}%`,
        duplicatesDetected: documentFingerprinter.duplicatesDetected || 0
      };
    } catch (error) {
      return { error: error.message };
    }
  })();
  
  const contentChunkerMetrics = (() => {
    try {
      const status = contentChunker.getStatus();
      return {
        enabled: status.enabled || false,
        defaultChunkSize: contentChunker.options?.defaultChunkSize || 0,
        maxChunkSize: contentChunker.maxChunkSize || 0,
        defaultOverlap: contentChunker.options?.defaultOverlap || 0,
        overlapSize: contentChunker.overlapSize || 0,
        preserveCodeBlocks: contentChunker.options?.preserveCodeBlocks || false,
        maintainSemanticBoundaries: contentChunker.options?.maintainSemanticBoundaries || false,
        enableSummaries: contentChunker.enableSummaries || false,
        patterns: {
          sectionPatterns: contentChunker.sectionPatterns?.length || 0,
          blockBoundaries: contentChunker.blockBoundaries?.length || 0,
          total: (contentChunker.sectionPatterns?.length || 0) + (contentChunker.blockBoundaries?.length || 0)
        }
      };
    } catch (error) {
      return { error: error.message };
    }
  })();
  
  return {
    core: {
      resourceManager: resourceManagerMetrics,
      smartCache: smartCacheMetrics,
      memoryLeakDetector: memoryLeakDetectorMetrics,
      componentLoader: componentLoaderMetrics
    },
    cost: {
      costTracker: costTrackerMetrics,
      tokenOptimizer: tokenOptimizerMetrics,
      tieredResponseStrategy: tieredResponseMetrics
    },
    performance: {
      batchProcessor: batchProcessorMetrics,
      documentFingerprinter: documentFingerprinterMetrics,
      contentChunker: contentChunkerMetrics
    }
  };
}

/**
 * Calculate cost savings metrics
 * @returns {Object} Cost savings metrics
 */
function calculateCostSavings() {
  // Get total API costs and savings data
  const totalApiCalls = costTracker.totalApiCalls || 0;
  const tokensSaved = tokenOptimizer.tokensSaved || 0;
  const costSaved = tokenOptimizer.costSaved || 0;
  
  // Average token cost (approximate)
  const avgTokenCost = 0.000004; // $0.000004 per token (approximate)
  
  // Calculate optimization impact
  const estimatedTokensWithoutOptimization = tokensSaved > 0 ? 
    totalApiCalls * (tokensSaved / totalApiCalls + 1) : 
    totalApiCalls;
  
  const optimizationImpact = estimatedTokensWithoutOptimization > 0 ? 
    (tokensSaved / estimatedTokensWithoutOptimization) * 100 : 
    0;
  
  // Calculate tiered strategy impact
  const tieredImpact = tieredResponseStrategy.downgrades || 0;
  const downgradeSavings = tieredResponseStrategy.costSaved || 0;
  
  // Project monthly savings
  const dailyRate = costSaved + downgradeSavings;
  const projectedMonthlySavings = dailyRate * 30;
  
  return {
    tokens: {
      totalProcessed: totalApiCalls,
      tokensSaved,
      optimizationRate: optimizationImpact,
      formattedOptimizationRate: `${optimizationImpact.toFixed(1)}%`
    },
    costs: {
      savedFromTokens: costSaved,
      savedFromDowngrades: downgradeSavings,
      totalSaved: costSaved + downgradeSavings,
      projectedMonthlySavings,
      formattedMonthlySavings: `$${projectedMonthlySavings.toFixed(2)}`
    },
    tieredStrategy: {
      downgrades: tieredImpact,
      downgradeSavings,
      currentTier: tieredResponseStrategy.currentTier || 'standard'
    }
  };
}

/**
 * Generate comprehensive metrics report
 * @param {boolean} saveToFile - Whether to save the report to a file
 * @returns {Object} Complete metrics report
 */
async function generateMetricsReport(saveToFile = true) {
  // Get optimization tests results
  const testResults = await testSuite.runTestSuite(false);
  
  // Get system and component metrics
  const systemMetrics = getSystemMetrics();
  const componentMetrics = await getComponentMetrics();
  const costSavings = calculateCostSavings();
  
  // Compile complete report
  const report = {
    timestamp: systemMetrics.timestamp,
    system: systemMetrics,
    optimizationStatus: testResults.summary,
    components: componentMetrics,
    costSavings,
    testResults: testResults.results
  };
  
  // Display summary to console
  console.log('=================================================');
  console.log('     OPTIMIZATION METRICS REPORT                 ');
  console.log('=================================================');
  
  console.log(`\nGenerated: ${systemMetrics.timestamp}`);
  console.log(`System Uptime: ${systemMetrics.formattedUptime}`);
  console.log(`Memory Usage: ${systemMetrics.memory.formattedHeapUsed} / ${systemMetrics.memory.formattedRSS}`);
  
  console.log('\nOptimization Health:');
  console.log(`- Status: ${testResults.summary.percentOptimized}% optimized`);
  console.log(`- Components: ${testResults.summary.optimizedCount}/${testResults.summary.totalCount} optimized`);
  
  console.log('\nCost Optimization:');
  console.log(`- Tokens Saved: ${costSavings.tokens.tokensSaved} (${costSavings.tokens.formattedOptimizationRate})`);
  console.log(`- Cost Saved: $${costSavings.costs.totalSaved.toFixed(4)}`);
  console.log(`- Projected Monthly Savings: ${costSavings.costs.formattedMonthlySavings}`);
  
  console.log('\nActive Optimization Components:');
  const componentsStatus = {
    'Resource Manager': componentMetrics.core.resourceManager.isActive || false,
    'Smart Cache': componentMetrics.core.smartCache.enabled || false,
    'Memory Leak Detector': componentMetrics.core.memoryLeakDetector.isMonitoring || false,
    'Component Loader': componentMetrics.core.componentLoader.initialized || false,
    'Cost Tracker': componentMetrics.cost.costTracker.enabled || false,
    'Token Optimizer': componentMetrics.cost.tokenOptimizer.enabled || false,
    'Tiered Response Strategy': componentMetrics.cost.tieredResponseStrategy.enabled || false,
    'Batch Processor': componentMetrics.performance.batchProcessor.active || false,
    'Document Fingerprinter': componentMetrics.performance.documentFingerprinter.active || false,
    'Content Chunker': componentMetrics.performance.contentChunker.enabled || false
  };
  
  Object.entries(componentsStatus).forEach(([name, active]) => {
    console.log(`- ${name}: ${active ? '✅ ACTIVE' : '❌ INACTIVE'}`);
  });
  
  // Save report to file if requested
  if (saveToFile) {
    try {
      const dataDir = path.join(process.cwd(), 'data', 'metrics');
      
      // Ensure directory exists
      try {
        await fs.mkdir(dataDir, { recursive: true });
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
      }
      
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filePath = path.join(dataDir, `optimization-metrics-${timestamp}.json`);
      
      await fs.writeFile(filePath, JSON.stringify(report, null, 2));
      console.log(`\nMetrics report saved to ${filePath}`);
      
      // Generate human-readable report
      const humanFilePath = path.join(dataDir, `optimization-metrics-${timestamp}.txt`);
      let humanReport = `OPTIMIZATION METRICS REPORT\n`;
      humanReport += `=========================\n\n`;
      humanReport += `Generated: ${systemMetrics.timestamp}\n`;
      humanReport += `System Uptime: ${systemMetrics.formattedUptime}\n`;
      humanReport += `Memory Usage: ${systemMetrics.memory.formattedHeapUsed} / ${systemMetrics.memory.formattedRSS}\n\n`;
      
      humanReport += `OPTIMIZATION HEALTH\n`;
      humanReport += `------------------\n`;
      humanReport += `Status: ${testResults.summary.percentOptimized}% optimized\n`;
      humanReport += `Components: ${testResults.summary.optimizedCount}/${testResults.summary.totalCount} optimized\n\n`;
      
      humanReport += `COST OPTIMIZATION\n`;
      humanReport += `----------------\n`;
      humanReport += `Tokens Saved: ${costSavings.tokens.tokensSaved} (${costSavings.tokens.formattedOptimizationRate})\n`;
      humanReport += `Cost Saved: $${costSavings.costs.totalSaved.toFixed(4)}\n`;
      humanReport += `Projected Monthly Savings: ${costSavings.costs.formattedMonthlySavings}\n\n`;
      
      humanReport += `COMPONENT STATUS\n`;
      humanReport += `--------------\n`;
      Object.entries(componentsStatus).forEach(([name, active]) => {
        humanReport += `${name}: ${active ? 'ACTIVE' : 'INACTIVE'}\n`;
      });
      
      await fs.writeFile(humanFilePath, humanReport);
      console.log(`Human-readable metrics report saved to ${humanFilePath}`);
    } catch (error) {
      console.error('Error saving metrics report:', error);
    }
  }
  
  return report;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateMetricsReport().catch(error => {
    console.error('Error generating metrics report:', error);
    process.exit(1);
  });
}

export default {
  getSystemMetrics,
  getComponentMetrics,
  calculateCostSavings,
  generateMetricsReport
};