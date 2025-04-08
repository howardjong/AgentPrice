#!/usr/bin/env node

/**
 * Memory Optimization CLI Tool
 * 
 * This script offers a command-line interface to trigger memory optimization
 * and view memory usage statistics.
 * 
 * Uses ES module syntax for compatibility with the project's module system.
 */

import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Get the directory name using ES module standard pattern
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration with localhost fallback
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const MEMORY_STATUS_ENDPOINT = '/api/system/memory-status';
const MEMORY_RELIEF_ENDPOINT = '/api/system/memory-relief';

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();
const options = {
  aggressive: args.includes('--aggressive'),
  json: args.includes('--json'),
  save: args.includes('--save'),
  verbose: args.includes('--verbose')
};

// Help text
const helpText = `
Memory Optimization CLI Tool

Usage:
  node optimize-memory.js <command> [options]

Commands:
  status        Show current memory usage and optimization status
  optimize      Run memory optimization (relief) operations
  help          Show this help message

Options:
  --aggressive  Use aggressive optimization (more intensive)
  --json        Output in JSON format instead of human-readable text
  --save        Save results to a log file
  --verbose     Show more detailed information

Examples:
  node optimize-memory.js status
  node optimize-memory.js optimize --aggressive
`;

/**
 * Main function
 */
async function main() {
  if (!command || command === 'help') {
    console.log(helpText);
    return;
  }
  
  switch (command) {
    case 'status':
      await checkMemoryStatus();
      break;
    case 'optimize':
      await optimizeMemory();
      break;
    default:
      console.log(`Unknown command: ${command}`);
      console.log(helpText);
      process.exit(1);
  }
}

/**
 * Check and display memory status
 */
async function checkMemoryStatus() {
  try {
    const response = await fetch(`${SERVER_URL}${MEMORY_STATUS_ENDPOINT}`);
    const data = await response.json();
    
    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      
      if (options.save) {
        saveToFile('memory-status', data);
      }
      
      return;
    }
    
    // Human-readable format
    console.log('======================================');
    console.log('            MEMORY STATUS            ');
    console.log('======================================');
    
    console.log(`\nOverall status: ${data.optimization?.status || 'Unknown'}`);
    console.log(`Server uptime: ${formatUptime(data.optimization?.uptime || 0)}`);
    
    // Current memory usage
    if (data.currentUsage) {
      console.log('\nCURRENT MEMORY USAGE:');
      console.log(`  Heap Used: ${data.currentUsage.heapUsedMB} MB`);
      console.log(`  Heap Total: ${data.currentUsage.heapTotalMB} MB`);
      console.log(`  Usage: ${data.currentUsage.usagePercent}%`);
      console.log(`  RSS: ${data.currentUsage.rssMB} MB`);
      
      if (options.verbose && data.currentUsage.externalMB) {
        console.log(`  External: ${data.currentUsage.externalMB} MB`);
      }
    }
    
    // Resource manager info
    if (data.resourceManager && options.verbose) {
      console.log('\nRESOURCE MANAGER:');
      console.log(`  Active: ${data.resourceManager.isActive ? 'Yes' : 'No'}`);
      console.log(`  Connection pools: ${data.resourceManager.connectionPoolCount}`);
      console.log(`  Total connections: ${data.resourceManager.totalConnections}`);
      console.log(`  Active connections: ${data.resourceManager.activeConnections}`);
    }
    
    // Memory leak detector info
    if (data.memoryLeakDetector && options.verbose) {
      console.log('\nMEMORY LEAK DETECTOR:');
      console.log(`  Monitoring: ${data.memoryLeakDetector.isMonitoring ? 'Yes' : 'No'}`);
      console.log(`  Leaks detected: ${data.memoryLeakDetector.leaksDetected}`);
      
      if (data.memoryLeakDetector.lastCheckAt) {
        const lastCheck = new Date(data.memoryLeakDetector.lastCheckAt);
        console.log(`  Last check: ${lastCheck.toLocaleString()}`);
      }
    }
    
    console.log('\n======================================');
    
    if (options.save) {
      saveToFile('memory-status', data);
    }
  } catch (error) {
    console.error(`Error checking memory status: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Run memory optimization
 */
async function optimizeMemory() {
  try {
    const startTime = Date.now();
    
    console.log('======================================');
    console.log('          MEMORY OPTIMIZATION         ');
    console.log('======================================');
    
    console.log(`\nRunning ${options.aggressive ? 'aggressive' : 'standard'} memory optimization...`);
    
    // Get before status
    const beforeResponse = await fetch(`${SERVER_URL}${MEMORY_STATUS_ENDPOINT}`);
    const beforeData = await beforeResponse.json();
    const beforeHeapMB = beforeData.currentUsage?.heapUsedMB || 0;
    const beforeRssMB = beforeData.currentUsage?.rssMB || 0;
    
    console.log(`\nInitial heap usage: ${beforeHeapMB} MB`);
    
    // Request optimization
    const optimizeResponse = await fetch(`${SERVER_URL}${MEMORY_RELIEF_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        aggressive: options.aggressive
      })
    });
    
    const optimizeData = await optimizeResponse.json();
    
    if (options.json) {
      console.log(JSON.stringify(optimizeData, null, 2));
      
      if (options.save) {
        saveToFile('memory-optimization', optimizeData);
      }
      
      return;
    }
    
    // Get after status
    const afterResponse = await fetch(`${SERVER_URL}${MEMORY_STATUS_ENDPOINT}`);
    const afterData = await afterResponse.json();
    const afterHeapMB = afterData.currentUsage?.heapUsedMB || 0;
    const afterRssMB = afterData.currentUsage?.rssMB || 0;
    
    // Calculate reductions
    const heapReductionMB = beforeHeapMB - afterHeapMB;
    const heapReductionPct = beforeHeapMB > 0 ? Math.round((heapReductionMB / beforeHeapMB) * 100) : 0;
    const rssReductionMB = beforeRssMB - afterRssMB;
    const elapsedMs = Date.now() - startTime;
    
    // Display results
    console.log('\nRESULTS:');
    console.log(`  Status: ${optimizeData.status}`);
    console.log(`  Initial heap: ${beforeHeapMB} MB`);
    console.log(`  Final heap: ${afterHeapMB} MB`);
    console.log(`  Memory freed: ${heapReductionMB} MB (${heapReductionPct}%)`);
    
    if (options.verbose) {
      console.log(`  RSS reduction: ${rssReductionMB} MB`);
      console.log(`  Optimization time: ${elapsedMs}ms`);
    }
    
    if (optimizeData.details && options.verbose) {
      console.log('\nDETAILED RESULTS:');
      console.log(`  Before heap: ${optimizeData.details.before.heapUsedMB} MB`);
      console.log(`  After heap: ${optimizeData.details.after.heapUsedMB} MB`);
      console.log(`  Reduction: ${optimizeData.details.reduction.heapMB} MB (${optimizeData.details.reduction.percent}%)`);
    }
    
    console.log('\n======================================');
    
    if (options.save) {
      const combinedData = {
        before: beforeData,
        optimization: optimizeData,
        after: afterData,
        summary: {
          heapReductionMB,
          heapReductionPct,
          rssReductionMB,
          elapsedMs
        }
      };
      
      saveToFile('memory-optimization-full', combinedData);
    }
  } catch (error) {
    console.error(`Error optimizing memory: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Save data to a log file
 */
function saveToFile(prefix, data) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${prefix}-${timestamp}.json`;
    
    // Ensure logs directory exists
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const logsDir = join(scriptDir, 'logs');
    
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const filePath = join(logsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    console.log(`\nResults saved to: ${filePath}`);
  } catch (error) {
    console.error(`Error saving to file: ${error.message}`);
  }
}

/**
 * Format uptime in a human-readable format
 */
function formatUptime(seconds) {
  if (seconds < 60) {
    return `${Math.round(seconds)} seconds`;
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

// Run the main function
main().catch(error => {
  console.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});