/**
 * Comprehensive Optimization Component Test Suite
 *
 * This test suite provides a unified and reliable way to check
 * the optimization status of all system components.
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
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

/**
 * Component Test Configuration
 *
 * Define the required properties and states for each component
 * to be considered "optimized"
 */
const componentsConfig = {
  resourceManager: {
    name: 'Resource Manager',
    requiredProperties: [
      'isActive',
      'maxConcurrentRequests',
      'poolSize',
      'getStatus'
    ],
    validationFn: (component) => {
      // If getStatus exists, check for active flag in response
      if (typeof component.getStatus === 'function') {
        try {
          const status = component.getStatus();
          return status && status.isActive === true;
        } catch (e) {
          return false;
        }
      }
      return false;
    },
    configurationFn: async () => {
      // Configure for optimal settings
      resourceManager.configure({
        maxConcurrentRequests: 10,
        memoryThreshold: 80,
        cpuThreshold: 60,
        monitoringInterval: 300000, // 5 minutes
        cleanupInterval: 1200000,   // 20 minutes
        enableActiveMonitoring: true
      });
      
      resourceManager.optimizeConnections({
        poolSize: 7,
        timeout: 22425,
        idleTimeout: 44850,
        resourceFactor: 0.7475
      });
      
      return resourceManager;
    }
  },
  
  smartCache: {
    name: 'Smart Cache',
    requiredProperties: [
      'maxSize',
      'lowMemoryMode',
      'getStatus'
    ],
    validationFn: (component) => {
      if (typeof component.getStatus === 'function') {
        try {
          const status = component.getStatus();
          return status && status.enabled === true;
        } catch (e) {
          return false;
        }
      }
      return false;
    },
    configurationFn: async () => {
      smartCache.configure({
        maxSize: 1000,
        memoryLimitMB: 50,
        enableFuzzyMatch: true,
        defaultTTL: 0
      });
      
      smartCache.optimizeForMemory({
        memoryPressure: process.memoryUsage().heapUsed / 1024 / 1024 / 100,
        cacheSize: smartCache.size || 0,
        maxSize: smartCache.maxSize || 1000
      });
      
      return smartCache;
    }
  },
  
  memoryLeakDetector: {
    name: 'Memory Leak Detector',
    requiredProperties: [
      'isMonitoring',
      'checkInterval',
      'getStatus'
    ],
    validationFn: (component) => {
      if (typeof component.getStatus === 'function') {
        try {
          const status = component.getStatus();
          return status && status.isMonitoring === true;
        } catch (e) {
          return false;
        }
      }
      return false;
    },
    configurationFn: async () => {
      memoryLeakDetector.configure({
        checkInterval: 300000, // 5 minutes
        growthThreshold: 25,   // 25% growth triggers alert
        gcTriggerThreshold: 70, // 70MB heap triggers GC
        resourceSavingMode: true,
        enableMonitoring: true
      });
      
      return memoryLeakDetector;
    }
  },
  
  componentLoader: {
    name: 'Component Loader',
    requiredProperties: [
      'lazyLoadingEnabled',
      'cacheComponents',
      'getStatus'
    ],
    validationFn: (component) => {
      if (typeof component.getStatus === 'function') {
        try {
          const status = component.getStatus();
          return status && status.initialized === true;
        } catch (e) {
          return false;
        }
      }
      return false;
    },
    configurationFn: async () => {
      componentLoader.configure({
        lazyLoad: true,
        preloadCritical: true,
        unloadThreshold: 1800000, // 30 minutes
        enableCache: true
      });
      
      return componentLoader;
    }
  },
  
  costTracker: {
    name: 'Cost Tracker',
    requiredProperties: [
      'totalApiCalls',
      'dailyBudget',
      'getStatus'
    ],
    validationFn: (component) => {
      if (typeof component.getStatus === 'function') {
        try {
          const status = component.getStatus();
          return status && status.enabled === true;
        } catch (e) {
          return false;
        }
      }
      return false;
    },
    configurationFn: async () => {
      costTracker.configure({
        dailyBudget: 10.0,        // $10 daily budget
        alertThreshold: 0.8,      // Alert at 80% of budget
        detailedTracking: true,   // Track per model and service
        enableHistoricalData: true
      });
      
      costTracker.resetDailyUsage();
      
      return costTracker;
    }
  },
  
  tokenOptimizer: {
    name: 'Token Optimizer',
    requiredProperties: [
      'tokensSaved',
      'getStatus'
    ],
    validationFn: (component) => {
      if (typeof component.getStatus === 'function') {
        try {
          const status = component.getStatus();
          return status && status.enabled === true;
        } catch (e) {
          return false;
        }
      }
      return false;
    },
    configurationFn: async () => {
      tokenOptimizer.configure({
        optimizeSystemPrompts: true,
        aggressiveMode: false,
        enabledFeatures: [
          'removeDuplicates',
          'simplifyPhrases',
          'removeFillers',
          'shortenUrls'
        ]
      });
      
      return tokenOptimizer;
    }
  },
  
  tieredResponseStrategy: {
    name: 'Tiered Response Strategy',
    requiredProperties: [
      'defaultTier',
      'autoDowngrade',
      'getStatus'
    ],
    validationFn: (component) => {
      if (typeof component.getStatus === 'function') {
        try {
          const status = component.getStatus();
          return status && status.enabled === true;
        } catch (e) {
          return false;
        }
      }
      return false;
    },
    configurationFn: async () => {
      tieredResponseStrategy.configure({
        defaultTier: 'standard',
        costMultipliers: {
          minimal: 0.5,
          standard: 1.0,
          premium: 2.0
        },
        autoDowngrade: true,
        downgradeTrigger: 0.8 // Downgrade at 80% of budget
      });
      
      return tieredResponseStrategy;
    }
  },
  
  batchProcessor: {
    name: 'Batch Processor',
    requiredProperties: [
      'options',
      'getStats'
    ],
    validationFn: (component) => {
      if (typeof component.getStats === 'function') {
        try {
          const stats = component.getStats();
          return stats !== undefined;
        } catch (e) {
          return false;
        }
      }
      return false;
    },
    configurationFn: async () => {
      batchProcessor.configure({
        maxBatchSize: 10,
        batchWindowMs: 100,
        memoryAware: true,
        priorityLevels: 3
      });
      
      batchProcessor.resetStats();
      
      return batchProcessor;
    }
  },
  
  documentFingerprinter: {
    name: 'Document Fingerprinter',
    requiredProperties: [
      'options',
      'getCacheSize'
    ],
    validationFn: (component) => {
      return typeof component.getCacheSize === 'function';
    },
    configurationFn: async () => {
      documentFingerprinter.configure({
        similarityThreshold: 0.85,
        enableTruncation: true,
        truncateLength: 1000,
        hashAlgorithm: 'simhash',
        maxCacheSize: 500
      });
      
      documentFingerprinter.clearCache();
      
      return documentFingerprinter;
    }
  },
  
  contentChunker: {
    name: 'Content Chunker',
    requiredProperties: [
      'maxChunkSize',
      'getStatus'
    ],
    validationFn: (component) => {
      if (typeof component.getStatus === 'function') {
        try {
          const status = component.getStatus();
          return status && status.enabled === true;
        } catch (e) {
          return false;
        }
      }
      return false;
    },
    configurationFn: async () => {
      contentChunker.configure({
        defaultChunkSize: 8000,
        defaultOverlap: 200,
        preserveCodeBlocks: true,
        maintainSemanticBoundaries: true,
        enableSummaries: false
      });
      
      return contentChunker;
    }
  }
};

/**
 * Test a single component for optimization status
 * @param {string} componentKey - Key of the component to test
 * @returns {Object} Test results
 */
async function testComponent(componentKey) {
  const config = componentsConfig[componentKey];
  if (!config) {
    return {
      name: componentKey,
      optimized: false,
      error: 'Component configuration not found'
    };
  }
  
  const component = eval(componentKey); // Use the imported component
  if (!component) {
    return {
      name: config.name,
      optimized: false,
      error: 'Component not found'
    };
  }
  
  try {
    // Test for required properties
    const hasRequiredProps = config.requiredProperties.every(prop => {
      const propValue = component[prop];
      return propValue !== undefined && propValue !== null;
    });
    
    // Run custom validation function
    const passesValidation = config.validationFn ? config.validationFn(component) : true;
    
    // Determine optimization status
    const optimized = hasRequiredProps && passesValidation;
    
    return {
      name: config.name,
      optimized,
      hasRequiredProps,
      passesValidation,
      requiredProperties: config.requiredProperties
    };
  } catch (error) {
    return {
      name: config.name,
      optimized: false,
      error: error.message
    };
  }
}

/**
 * Apply optimizations to a specific component
 * @param {string} componentKey - Key of the component to optimize
 * @returns {Object} Optimization results
 */
async function optimizeComponent(componentKey) {
  const config = componentsConfig[componentKey];
  if (!config || !config.configurationFn) {
    return {
      name: config?.name || componentKey,
      success: false,
      error: 'No configuration function available'
    };
  }
  
  try {
    // Run the configuration function
    await config.configurationFn();
    
    // Test if the component is now optimized
    const testResult = await testComponent(componentKey);
    
    return {
      name: config.name,
      success: testResult.optimized,
      testResult
    };
  } catch (error) {
    return {
      name: config.name,
      success: false,
      error: error.message
    };
  }
}

/**
 * Run a full optimization test suite on all components
 * @param {boolean} applyOptimizations - Whether to apply optimizations to failed components
 * @returns {Object} Test results
 */
async function runTestSuite(applyOptimizations = false) {
  const results = {};
  const componentKeys = Object.keys(componentsConfig);
  
  console.log('=================================================');
  console.log('     OPTIMIZATION COMPONENT TEST SUITE           ');
  console.log('=================================================');
  
  // Get current memory usage
  const memoryUsage = process.memoryUsage();
  console.log('\nCurrent Memory Usage:');
  console.log(`- Heap Total: ${formatMemory(memoryUsage.heapTotal)}`);
  console.log(`- Heap Used: ${formatMemory(memoryUsage.heapUsed)}`);
  console.log(`- RSS: ${formatMemory(memoryUsage.rss)}`);
  console.log(`- External: ${formatMemory(memoryUsage.external || 0)}`);
  
  // Test each component
  for (const key of componentKeys) {
    const result = await testComponent(key);
    results[key] = result;
    
    const status = result.optimized ? '✅ OPTIMIZED' : '❌ NOT OPTIMIZED';
    console.log(`\n${status} - ${result.name}`);
    
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    } else {
      if (!result.hasRequiredProps) {
        console.log(`  Missing required properties: ${result.requiredProperties.join(', ')}`);
      }
      if (!result.passesValidation) {
        console.log('  Failed custom validation');
      }
    }
    
    // Apply optimizations if requested and component is not optimized
    if (applyOptimizations && !result.optimized) {
      console.log(`  Applying optimizations to ${result.name}...`);
      const optimizeResult = await optimizeComponent(key);
      
      if (optimizeResult.success) {
        console.log(`  ✅ Successfully optimized ${result.name}`);
        results[key] = optimizeResult.testResult;
      } else {
        console.log(`  ❌ Failed to optimize: ${optimizeResult.error || 'Unknown error'}`);
      }
    }
  }
  
  // Calculate overall optimization status
  const optimizedCount = Object.values(results).filter(r => r.optimized).length;
  const totalCount = componentKeys.length;
  const percentOptimized = Math.round((optimizedCount / totalCount) * 100);
  
  console.log('\n=================================================');
  console.log(`System Optimization Health: ${percentOptimized}%`);
  console.log(`${optimizedCount}/${totalCount} components optimized`);
  console.log('=================================================');
  
  if (percentOptimized === 100) {
    console.log('✅ All optimization systems are properly configured!');
  } else if (percentOptimized >= 80) {
    console.log('✅ Most optimization systems are properly configured.');
    console.log('⚠️ Consider fixing the non-optimized components for best performance.');
  } else if (percentOptimized >= 50) {
    console.log('⚠️ Some optimization systems are not properly configured.');
    console.log('⚠️ Run with --fix flag to apply recommended optimizations.');
  } else {
    console.log('❌ Many optimization systems are not properly configured.');
    console.log('❌ Run with --fix flag to apply recommended optimizations.');
  }
  
  return {
    timestamp: new Date().toISOString(),
    memoryUsage: {
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      rss: memoryUsage.rss,
      external: memoryUsage.external
    },
    results,
    summary: {
      optimizedCount,
      totalCount,
      percentOptimized
    }
  };
}

/**
 * Main function to run the test suite
 */
async function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix');
  const shouldSave = args.includes('--save');
  
  const results = await runTestSuite(shouldFix);
  
  if (shouldSave) {
    try {
      const resultsDir = path.join(process.cwd(), 'data', 'test-results');
      
      // Ensure directory exists
      try {
        await fs.mkdir(resultsDir, { recursive: true });
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
      }
      
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filePath = path.join(resultsDir, `optimization-test-${timestamp}.json`);
      
      await fs.writeFile(filePath, JSON.stringify(results, null, 2));
      console.log(`\nTest results saved to ${filePath}`);
    } catch (error) {
      console.error('Error saving test results:', error);
    }
  }
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Error running test suite:', error);
    process.exit(1);
  });
}

export default {
  testComponent,
  optimizeComponent,
  runTestSuite
};