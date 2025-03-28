
#!/usr/bin/env node
/**
 * System Status Monitor
 * 
 * This script provides a comprehensive overview of the system status,
 * including memory usage, API service status, and optimization settings.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Color formatting for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m'
};

/**
 * Format bytes into human-readable string
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Check if a module exists
 */
function moduleExists(modulePath) {
  try {
    require.resolve(path.resolve(process.cwd(), modulePath));
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get system memory usage
 */
async function getSystemMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const percentUsed = Math.round((used / total) * 100);
  
  return {
    total: formatBytes(total),
    free: formatBytes(free),
    used: formatBytes(used),
    percentUsed,
    raw: { total, free, used }
  };
}

/**
 * Get Node.js process memory usage
 */
function getProcessMemory() {
  const mem = process.memoryUsage();
  
  return {
    heapTotal: formatBytes(mem.heapTotal),
    heapUsed: formatBytes(mem.heapUsed),
    rss: formatBytes(mem.rss),
    external: formatBytes(mem.external),
    arrayBuffers: formatBytes(mem.arrayBuffers || 0),
    percentHeapUsed: Math.round((mem.heapUsed / mem.heapTotal) * 100),
    raw: mem
  };
}

/**
 * Check optimization settings
 */
async function getOptimizationSettings() {
  try {
    const settingsPath = path.join(process.cwd(), 'data', 'optimization-settings.json');
    const data = await fs.readFile(settingsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { error: 'Unable to read optimization settings', details: error.message };
  }
}

/**
 * Check API service status
 */
async function getApiServiceStatus() {
  const services = {
    circuitBreaker: moduleExists('utils/circuitBreaker.js'),
    costTracker: moduleExists('utils/costTracker.js'),
    apiClient: moduleExists('utils/apiClient.js'),
    perplexityService: moduleExists('services/perplexityService.js'),
    anthropicService: moduleExists('services/anthropicService.js'),
  };
  
  // Try to get more detailed status from optimization modules if they exist
  let detailedStatus = {};
  
  if (services.circuitBreaker) {
    try {
      const CircuitBreaker = require(path.resolve(process.cwd(), 'utils/circuitBreaker.js'));
      if (CircuitBreaker.getInstance && typeof CircuitBreaker.getInstance === 'function') {
        const instance = CircuitBreaker.getInstance();
        if (instance && instance.getStatus) {
          detailedStatus.circuitBreaker = instance.getStatus();
        }
      }
    } catch (error) {
      detailedStatus.circuitBreaker = { error: 'Error getting circuit breaker status' };
    }
  }
  
  if (services.costTracker) {
    try {
      const costTracker = require(path.resolve(process.cwd(), 'utils/costTracker.js'));
      if (costTracker && costTracker.getStatus) {
        detailedStatus.costTracker = costTracker.getStatus();
      }
    } catch (error) {
      detailedStatus.costTracker = { error: 'Error getting cost tracker status' };
    }
  }
  
  return {
    services,
    detailed: detailedStatus
  };
}

/**
 * Check test migration status
 */
async function getTestMigrationStatus() {
  try {
    const jestConfig = moduleExists('jest.config.js');
    const vitestConfig = moduleExists('vitest.config.js');
    
    // Get progress file if it exists
    let migrationProgress = null;
    try {
      const progressPath = path.join(process.cwd(), 'tests', 'MIGRATION_PROGRESS.md');
      const progressContent = await fs.readFile(progressPath, 'utf8');
      
      // Extract summary stats using regex
      const totalMatch = progressContent.match(/Total tests: (\d+)/);
      const migratedMatch = progressContent.match(/Migrated: (\d+) \((\d+)%\)/);
      const pendingMatch = progressContent.match(/Pending: (\d+)/);
      
      migrationProgress = {
        total: totalMatch ? parseInt(totalMatch[1]) : null,
        migrated: migratedMatch ? parseInt(migratedMatch[1]) : null,
        percentage: migratedMatch ? parseInt(migratedMatch[2]) : null,
        pending: pendingMatch ? parseInt(pendingMatch[1]) : null,
      };
    } catch (error) {
      migrationProgress = { error: 'Unable to read migration progress' };
    }
    
    return {
      jestConfigured: jestConfig,
      vitestConfigured: vitestConfig,
      progress: migrationProgress
    };
  } catch (error) {
    return { error: 'Error getting test migration status' };
  }
}

/**
 * Print a section header
 */
function printSectionHeader(title) {
  console.log('\n' + colors.bright + colors.blue + '═══════════════════════════════════════════════════' + colors.reset);
  console.log(colors.bright + colors.white + '  ' + title + colors.reset);
  console.log(colors.bright + colors.blue + '═══════════════════════════════════════════════════' + colors.reset);
}

/**
 * Print memory status
 */
function printMemoryStatus(sysMemory, procMemory) {
  printSectionHeader('MEMORY USAGE');
  
  // Process memory
  console.log(colors.bright + colors.cyan + '  Node.js Process:' + colors.reset);
  console.log(`    Heap Total:     ${procMemory.heapTotal}`);
  
  // Color code heap usage percentage
  let heapColor = colors.green;
  if (procMemory.percentHeapUsed > 70) heapColor = colors.yellow;
  if (procMemory.percentHeapUsed > 85) heapColor = colors.red;
  
  console.log(`    Heap Used:      ${procMemory.heapUsed} (${heapColor}${procMemory.percentHeapUsed}%${colors.reset})`);
  console.log(`    RSS:            ${procMemory.rss}`);
  console.log(`    External:       ${procMemory.external}`);
  
  // System memory
  console.log(colors.bright + colors.cyan + '\n  System Memory:' + colors.reset);
  console.log(`    Total:          ${sysMemory.total}`);
  console.log(`    Used:           ${sysMemory.used}`);
  console.log(`    Free:           ${sysMemory.free}`);
  
  // Color code system memory percentage
  let sysMemColor = colors.green;
  if (sysMemory.percentUsed > 70) sysMemColor = colors.yellow;
  if (sysMemory.percentUsed > 85) sysMemColor = colors.red;
  
  console.log(`    Usage:          ${sysMemColor}${sysMemory.percentUsed}%${colors.reset}`);
}

/**
 * Print test migration status
 */
function printTestMigrationStatus(testStatus) {
  printSectionHeader('TEST MIGRATION STATUS');
  
  console.log(`  Jest Config:      ${testStatus.jestConfigured ? colors.green + '✓' + colors.reset : colors.red + '✗' + colors.reset}`);
  console.log(`  Vitest Config:    ${testStatus.vitestConfigured ? colors.green + '✓' + colors.reset : colors.red + '✗' + colors.reset}`);
  
  if (testStatus.progress && !testStatus.progress.error) {
    const progress = testStatus.progress;
    
    // Progress bar
    const barLength = 30;
    const filledLength = Math.round(barLength * (progress.percentage / 100));
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    console.log(colors.bright + colors.cyan + '\n  Migration Progress:' + colors.reset);
    console.log(`    Total Tests:     ${progress.total}`);
    console.log(`    Migrated:        ${progress.migrated}`);
    console.log(`    Pending:         ${progress.pending}`);
    console.log(`\n    [${bar}] ${progress.percentage}%`);
  } else if (testStatus.progress && testStatus.progress.error) {
    console.log(colors.bright + colors.red + '\n  Migration Progress: Error' + colors.reset);
    console.log(`    ${testStatus.progress.error}`);
  } else {
    console.log(colors.bright + colors.yellow + '\n  Migration Progress: Unknown' + colors.reset);
  }
}

/**
 * Print optimization status
 */
function printOptimizationStatus(optimizationSettings, apiStatus) {
  printSectionHeader('SYSTEM OPTIMIZATION STATUS');
  
  if (optimizationSettings.error) {
    console.log(colors.bright + colors.red + '  Error: ' + colors.reset + optimizationSettings.error);
    return;
  }
  
  // Print optimization settings
  console.log(colors.bright + colors.cyan + '  Performance Optimizations:' + colors.reset);
  if (optimizationSettings.performance) {
    for (const [key, value] of Object.entries(optimizationSettings.performance)) {
      const statusColor = value ? colors.green : colors.red;
      console.log(`    ${key.padEnd(20)}: ${statusColor}${value ? 'Enabled' : 'Disabled'}${colors.reset}`);
    }
  } else {
    console.log('    No performance optimizations found');
  }
  
  // Print service status
  console.log(colors.bright + colors.cyan + '\n  API Services:' + colors.reset);
  for (const [service, available] of Object.entries(apiStatus.services)) {
    const statusColor = available ? colors.green : colors.red;
    console.log(`    ${service.padEnd(20)}: ${statusColor}${available ? 'Available' : 'Unavailable'}${colors.reset}`);
  }
  
  // Print circuit breaker status if available
  if (apiStatus.detailed.circuitBreaker && !apiStatus.detailed.circuitBreaker.error) {
    const cb = apiStatus.detailed.circuitBreaker;
    console.log(colors.bright + colors.cyan + '\n  Circuit Breaker:' + colors.reset);
    
    if (cb.circuits) {
      const openCircuits = Object.values(cb.circuits).filter(c => c.state === 'OPEN').length;
      const halfOpenCircuits = Object.values(cb.circuits).filter(c => c.state === 'HALF_OPEN').length;
      const closedCircuits = Object.values(cb.circuits).filter(c => c.state === 'CLOSED').length;
      
      console.log(`    Open:            ${openCircuits > 0 ? colors.red + openCircuits + colors.reset : openCircuits}`);
      console.log(`    Half-Open:       ${halfOpenCircuits > 0 ? colors.yellow + halfOpenCircuits + colors.reset : halfOpenCircuits}`);
      console.log(`    Closed:          ${colors.green + closedCircuits + colors.reset}`);
    } else {
      console.log(`    Status:          ${cb.status || 'Unknown'}`);
    }
  }
  
  // Print cost tracker status if available
  if (apiStatus.detailed.costTracker && !apiStatus.detailed.costTracker.error) {
    const ct = apiStatus.detailed.costTracker;
    console.log(colors.bright + colors.cyan + '\n  Cost Tracker:' + colors.reset);
    
    if (ct.enabled) {
      console.log(`    Status:          ${colors.green}Active${colors.reset}`);
      if (ct.costTracking) {
        console.log(`    Total Cost:      $${ct.costTracking.totalCost.toFixed(4)}`);
        console.log(`    Total Savings:   $${ct.costTracking.totalSavings.toFixed(4)}`);
        console.log(`    Total Calls:     ${ct.costTracking.totalCalls}`);
      }
    } else {
      console.log(`    Status:          ${colors.red}Inactive${colors.reset}`);
    }
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n' + colors.bright + colors.white + colors.bgBlue + ' SYSTEM STATUS REPORT ' + colors.reset);
    console.log(`Generated: ${new Date().toISOString()}\n`);
    
    // Get system and process memory
    const sysMemory = await getSystemMemory();
    const procMemory = getProcessMemory();
    
    // Get test migration status
    const testStatus = await getTestMigrationStatus();
    
    // Get optimization settings
    const optimizationSettings = await getOptimizationSettings();
    
    // Get API service status
    const apiStatus = await getApiServiceStatus();
    
    // Print status sections
    printMemoryStatus(sysMemory, procMemory);
    printTestMigrationStatus(testStatus);
    printOptimizationStatus(optimizationSettings, apiStatus);
    
    console.log('\n' + colors.bright + colors.white + colors.bgGreen + ' STATUS REPORT COMPLETE ' + colors.reset + '\n');
  } catch (error) {
    console.error(colors.red + 'Error generating system status:' + colors.reset, error);
    process.exit(1);
  }
}

main();
