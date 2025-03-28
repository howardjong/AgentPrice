
#!/usr/bin/env node
/**
 * Aggressive Memory Relief Script
 * 
 * This script implements aggressive memory optimization strategies
 * to reduce memory pressure in the application.
 */

// Enable garbage collection explicitly
if (!global.gc) {
  console.error('This script must be run with --expose-gc flag');
  console.error('Example: node --expose-gc scripts/aggressive-memory-relief.js');
  process.exit(1);
}

// Import required modules
const fs = require('fs').promises;
const path = require('path');

// Current memory usage
function getMemoryUsage() {
  const memoryData = process.memoryUsage();
  return {
    heapTotal: Math.round(memoryData.heapTotal / (1024 * 1024)),
    heapUsed: Math.round(memoryData.heapUsed / (1024 * 1024)),
    rss: Math.round(memoryData.rss / (1024 * 1024)),
    external: Math.round(memoryData.external / (1024 * 1024))
  };
}

// Display memory usage
function logMemoryUsage(label) {
  const usage = getMemoryUsage();
  console.log(`\n${label}:`);
  console.log(`Heap Used: ${usage.heapUsed} MB`);
  console.log(`Heap Total: ${usage.heapTotal} MB`);
  console.log(`RSS: ${usage.rss} MB`);
  console.log(`External: ${usage.external} MB`);
}

// Force garbage collection multiple times
function forceGarbageCollection(iterations = 3) {
  console.log(`\n🧹 Running garbage collection (${iterations} iterations)...`);
  
  for (let i = 0; i < iterations; i++) {
    try {
      global.gc();
      // Add small delay between GC calls
      const startTime = Date.now();
      while (Date.now() - startTime < 100) {
        // Spin wait to allow event loop to process
      }
    } catch (error) {
      console.error('Error during garbage collection:', error);
    }
  }
}

// Clear all non-essential module caches to free memory
function clearModuleCaches() {
  console.log('\n🗑️ Clearing module caches...');
  
  // Get a list of all cached modules
  const cachedModules = Object.keys(require.cache);
  let clearedCount = 0;
  
  // Preserve essential system modules
  const essentialModules = [
    'fs', 'path', 'os', 'util', 'events', 'stream',
    'http', 'https', 'net', 'crypto', 'buffer', 'url'
  ];
  
  // Clear non-essential module caches
  for (const modulePath of cachedModules) {
    // Skip essential modules and node_modules for safety
    const isEssential = essentialModules.some(name => 
      modulePath.includes(`/node_modules/${name}/`) || 
      modulePath.includes(`\\node_modules\\${name}\\`) ||
      modulePath.endsWith(`/${name}.js`) ||
      modulePath.endsWith(`\\${name}.js`)
    );
    
    // Only clear caches for application's own modules
    // Skip node_modules to prevent breaking imports
    const isApplicationModule = !modulePath.includes('node_modules') && 
                               (modulePath.includes('/utils/') || 
                                modulePath.includes('/services/') ||
                                modulePath.includes('/middlewares/'));
    
    if (!isEssential && isApplicationModule) {
      delete require.cache[modulePath];
      clearedCount++;
    }
  }
  
  console.log(`Cleared ${clearedCount} module caches`);
}

// Clean temporary files in data directory
async function cleanTempFiles() {
  console.log('\n🧽 Cleaning temporary files...');
  
  try {
    // Metrics files in data/metrics older than 2 days
    const metricsDir = path.join(process.cwd(), 'data', 'metrics');
    const files = await fs.readdir(metricsDir).catch(() => []);
    
    let deletedCount = 0;
    const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(metricsDir, file);
        const stats = await fs.stat(filePath).catch(() => null);
        
        if (stats && stats.mtimeMs < twoDaysAgo) {
          await fs.unlink(filePath).catch(err => console.error(`Failed to delete ${file}:`, err));
          deletedCount++;
        }
      }
    }
    
    if (deletedCount > 0) {
      console.log(`Deleted ${deletedCount} old metric files`);
    } else {
      console.log('No old temporary files to clean');
    }
  } catch (error) {
    console.error('Error cleaning temporary files:', error);
  }
}

// Apply memory optimizations to global configuration
async function applyMemoryOptimizations() {
  console.log('\n⚙️ Applying memory optimizations to configuration...');
  
  try {
    const configPath = path.join(process.cwd(), 'data', 'optimization-settings.json');
    
    let config = {};
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      config = JSON.parse(configData);
    } catch (error) {
      // File doesn't exist or is invalid, create new config
      config = {
        memory: {
          lowMemoryMode: false,
          aggressiveGcEnabled: false,
          gcInterval: 300000, // 5 minutes
          maxCacheSize: 1000,
          enableFuzzyMatch: true
        }
      };
    }
    
    // Update configuration with aggressive memory settings
    config.memory = {
      ...config.memory,
      lowMemoryMode: true,
      aggressiveGcEnabled: true,
      gcInterval: 60000, // 1 minute
      maxCacheSize: 100, // Drastically reduce cache size
      enableFuzzyMatch: false, // Disable memory-intensive fuzzy matching
    };
    
    // Save updated configuration
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('Updated optimization settings with aggressive memory settings');
  } catch (error) {
    console.error('Error applying memory optimizations:', error);
  }
}

// Main function to run all optimizations
async function main() {
  console.log('======================================');
  console.log('   AGGRESSIVE MEMORY RELIEF UTILITY   ');
  console.log('======================================');
  
  // Log initial memory usage
  logMemoryUsage('Initial memory usage');
  
  // Run a first pass of garbage collection
  forceGarbageCollection(2);
  
  // Clean module caches
  clearModuleCaches();
  
  // Apply memory optimizations to configuration
  await applyMemoryOptimizations();
  
  // Clean temporary files
  await cleanTempFiles();
  
  // Run final garbage collection passes
  forceGarbageCollection(3);
  
  // Log final memory usage
  logMemoryUsage('Final memory usage');
  
  console.log('\n✅ Aggressive memory relief completed');
}

// Run the main function
main().catch(error => {
  console.error('Error in memory relief script:', error);
  process.exit(1);
});
