// #!/usr/bin/env node

/**
 * Aggressive Memory Relief Script
 * 
 * This script performs aggressive memory cleanup operations to reduce memory pressure
 * in a Node.js application. It uses the garbage collector (--expose-gc) to force
 * memory cleanup and implements additional optimizations.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Print a header
console.log('==============================================');
console.log('     AGGRESSIVE MEMORY RELIEF UTILITY');
console.log('==============================================\n');

// Log initial memory usage
console.log('Initial memory usage:');
console.table(process.memoryUsage());

// Force garbage collection if --expose-gc flag is used
function forceGarbageCollection() {
  if (global.gc) {
    console.log('\nForcing garbage collection...');
    global.gc();
    console.log('Garbage collection complete.');
    console.table(process.memoryUsage());
  } else {
    console.log('\nGarbage collection not available. Run with --expose-gc flag.');
  }
}

// Clear module cache for non-essential modules
function clearModuleCache() {
  console.log('\nClearing module cache for non-essential modules...');

  const essentialModules = [
    'fs', 'path', 'os', 'child_process', 'events', 'stream',
    'util', 'assert', 'http', 'net', 'url', 'querystring'
  ];

  let clearedCount = 0;

  for (const moduleId in require.cache) {
    // Skip essential modules and node_modules core files
    const isEssential = essentialModules.some(name => 
      moduleId.endsWith(`/${name}.js`) || moduleId.includes(`/node_modules/${name}/`)
    );

    const isNodeCore = moduleId.includes('/node_modules/') && 
      !moduleId.includes('/node_modules/redis/') && 
      !moduleId.includes('/node_modules/bull/');

    if (!isEssential && !isNodeCore && !moduleId.includes('node:')) {
      delete require.cache[moduleId];
      clearedCount++;
    }
  }

  console.log(`Cleared ${clearedCount} modules from cache.`);
}

// Clean temporary files
function cleanTempFiles() {
  console.log('\nCleaning temporary files...');

  const tempDirs = [
    path.join(process.cwd(), 'tests', 'output'),
    path.join(process.cwd(), 'uploads', 'temp')
  ];

  for (const dir of tempDirs) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        let deletedCount = 0;

        for (const file of files) {
          // Skip .gitkeep files
          if (file === '.gitkeep') continue;

          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);

          // Delete files older than 1 hour
          const oneHourAgo = Date.now() - (60 * 60 * 1000);
          if (stats.mtimeMs < oneHourAgo) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        }

        console.log(`Cleaned ${deletedCount} files from ${dir}`);
      }
    } catch (error) {
      console.error(`Error cleaning directory ${dir}: ${error.message}`);
    }
  }
}

// Compact memory (Linux-specific)
function compactMemory() {
  if (process.platform === 'linux') {
    console.log('\nCompacting memory (Linux-specific)...');

    exec('cat /proc/self/oom_score', (error, stdout) => {
      if (!error) {
        console.log(`Current OOM score: ${stdout.trim()}`);
      }

      // Check if we have permission to adjust memory settings
      exec('echo 1 > /proc/self/oom_adj', (error) => {
        if (error) {
          console.log('No permission to adjust OOM settings. Running without memory compaction.');
          return;
        }

        // Try to compact memory using Linux specific methods
        exec('sync && echo 1 > /proc/sys/vm/drop_caches', (error) => {
          if (error) {
            console.log('Memory compaction not available (requires root privileges)');
          } else {
            console.log('Memory compaction completed');
          }
        });
      });
    });
  } else {
    console.log('\nMemory compaction not available on this platform');
  }
}

// Run optimizations
async function runOptimizations() {
  try {
    // First run - clear node caches and trigger GC
    clearModuleCache();
    forceGarbageCollection();

    // Second - clean up temporary files
    cleanTempFiles();
    forceGarbageCollection();

    // Third - attempt platform-specific optimizations
    compactMemory();

    // Final GC run
    setTimeout(() => {
      forceGarbageCollection();

      console.log('\n==============================================');
      console.log('     MEMORY RELIEF COMPLETE');
      console.log('==============================================');
      console.log('Final memory usage:');
      console.table(process.memoryUsage());
    }, 1000);
  } catch (error) {
    console.error('Error during optimization:', error);
  }
}

// Execute the optimization
runOptimizations();