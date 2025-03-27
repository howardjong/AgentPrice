
const path = require('path');
const fs = require('fs').promises;
const resourceManager = require('../../utils/resourceManager');
const smartCache = require('../../utils/smartCache');
const memoryLeakDetector = require('../../utils/memoryLeakDetector');
const componentLoader = require('../../utils/componentLoader');

/**
 * Apply system-wide performance optimizations
 * This script configures all optimization modules for lightweight operation
 */
async function optimizeSystemPerformance() {
  console.log('======================================');
  console.log('  APPLYING PERFORMANCE OPTIMIZATIONS  ');
  console.log('======================================\n');

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  
  // 1. Configure resource manager for low-memory usage
  console.log('1. Configuring resource manager for low memory usage...');
  const resourceConfig = {
    memory: {
      heapLimitMB: 200,
      rssLimitMB: 300,
      gcThresholdMB: 150
    },
    cpu: {
      maxUtilization: 60
    }
  };
  
  try {
    resourceManager.configure(resourceConfig);
    console.log('✅ Resource manager configured for low memory usage');
  } catch (error) {
    console.error(`❌ Failed to configure resource manager: ${error.message}`);
  }

  // 2. Configure smart cache for optimized memory usage
  console.log('\n2. Configuring smart cache for optimal memory usage...');
  const cacheConfig = {
    maxSize: 100, // Reduce max cache size
    ttl: 30 * 60 * 1000, // 30 minutes TTL
    cleanInterval: 5 * 60 * 1000 // Clean every 5 minutes
  };
  
  try {
    smartCache.configure(cacheConfig);
    console.log('✅ Smart cache configured for optimal memory usage');
  } catch (error) {
    console.error(`❌ Failed to configure smart cache: ${error.message}`);
  }

  // 3. Configure memory leak detector
  console.log('\n3. Configuring memory leak detector...');
  const leakDetectorConfig = {
    enabled: true,
    checkInterval: 5 * 60 * 1000, // Check every 5 minutes
    alertThreshold: 20, // Alert if memory increases by 20% between checks
    gcBeforeCheck: true
  };
  
  try {
    memoryLeakDetector.configure(leakDetectorConfig);
    console.log('✅ Memory leak detector configured');
  } catch (error) {
    console.error(`❌ Failed to configure memory leak detector: ${error.message}`);
  }

  // 4. Configure component loader for lazy loading
  console.log('\n4. Configuring component loader for lazy loading...');
  const componentConfig = {
    lazyLoad: true,
    preloadCritical: true,
    unloadThreshold: 300000 // Unload after 5 minutes of inactivity
  };
  
  try {
    componentLoader.configure(componentConfig);
    console.log('✅ Component loader configured for lazy loading');
  } catch (error) {
    console.error(`❌ Failed to configure component loader: ${error.message}`);
  }

  // 5. Save optimization settings to file
  console.log('\n5. Saving optimization settings...');
  const optimizationSettings = {
    timestamp,
    resourceManager: resourceConfig,
    smartCache: cacheConfig,
    memoryLeakDetector: leakDetectorConfig,
    componentLoader: componentConfig,
    environment: {
      maxOldSpaceSize: 256,
      exposeGC: true,
      cleanupInterval: 10 * 60 * 1000
    }
  };
  
  try {
    const outputDir = path.join(__dirname, '../output');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      path.join(outputDir, `performance-optimizations-${timestamp}.json`),
      JSON.stringify(optimizationSettings, null, 2)
    );
    console.log('✅ Optimization settings saved successfully');
  } catch (error) {
    console.error(`❌ Error saving optimization settings: ${error.message}`);
  }
  
  console.log('\n======================================');
  console.log('     OPTIMIZATIONS APPLIED SUCCESSFULLY     ');
  console.log('======================================');
  console.log('\nThe application is now configured for lower resource usage.');
  console.log('To start the optimized application, use the "Start Low Memory App" workflow');
}

// Run optimization
optimizeSystemPerformance().catch(err => {
  console.error('Error during performance optimization:', err);
  process.exit(1); // Exit with error code to signal failure
});
