/**
 * Memory Pressure Simulator
 * 
 * This script simulates memory pressure by allocating memory blocks over time
 * to test the memory threshold manager's automatic optimization capabilities.
 * 
 * Uses ES module syntax for compatibility with the project's module system.
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Configuration
const BASE_URL = 'http://localhost:5000';
const MEMORY_STATUS_ENDPOINT = '/api/system/memory-status';
const CHECK_INTERVAL = 5000; // 5 seconds
const ALLOC_INTERVAL = 3000; // 3 seconds between allocations
const BLOCK_SIZE = 250000; // Size of each allocation (approximately 1MB)
const MAX_BLOCKS = 100; // Maximum number of blocks to allocate (100MB)
const TARGET_USAGE = 85; // Target memory usage percentage

// Global state
const memoryBlocks = [];
let isRunning = true;
let allocationIntervalId = null;
let statusCheckIntervalId = null;

/**
 * Format memory value in MB
 */
function formatMemory(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Get current memory status from the server
 */
async function getMemoryStatus() {
  try {
    const response = await axios.get(`${BASE_URL}${MEMORY_STATUS_ENDPOINT}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting memory status: ${error.message}`);
    return null;
  }
}

/**
 * Print memory status
 */
function printStatus(status) {
  if (!status) return;
  
  console.log('\n=== Memory Status ===');
  console.log(`Heap Used: ${status.currentUsage?.heapUsedMB || 0} MB`);
  console.log(`Heap Total: ${status.currentUsage?.heapTotalMB || 0} MB`);
  console.log(`Usage: ${status.currentUsage?.usagePercent || 0}%`);
  
  if (status.thresholdManager) {
    console.log('\nThreshold Manager:');
    console.log(`- Active: ${status.thresholdManager.isActive ? 'Yes' : 'No'}`);
    console.log(`- Warning Threshold: ${status.thresholdManager.thresholds?.WARNING || 0}%`);
    console.log(`- Action Threshold: ${status.thresholdManager.thresholds?.ACTION || 0}%`);
    console.log(`- Critical Threshold: ${status.thresholdManager.thresholds?.CRITICAL || 0}%`);
    console.log('\nEvents:');
    console.log(`- Warnings: ${status.thresholdManager.stats?.warningCount || 0}`);
    console.log(`- Actions: ${status.thresholdManager.stats?.actionCount || 0}`);
    console.log(`- Critical: ${status.thresholdManager.stats?.criticalCount || 0}`);
  }
  
  console.log('\nOptimization Status:', status.optimization?.status);
  console.log('Auto-optimize Enabled:', status.optimization?.autoOptimizeEnabled ? 'Yes' : 'No');
}

/**
 * Allocate a memory block
 */
function allocateMemory() {
  // Generate random data with UUID to ensure uniqueness (prevent optimization)
  const block = new Array(BLOCK_SIZE).fill().map(() => uuidv4());
  memoryBlocks.push(block);
  
  console.log(`Allocated block ${memoryBlocks.length}/${MAX_BLOCKS} (approx. ${formatMemory(block.length * 36)})`);
  
  // Stop allocation if we've reached the maximum
  if (memoryBlocks.length >= MAX_BLOCKS) {
    console.log('Maximum memory allocation reached. Stopping allocation.');
    stopAllocation();
  }
}

/**
 * Start memory allocation
 */
function startAllocation() {
  if (allocationIntervalId) return;
  
  console.log('Starting memory allocation...');
  allocationIntervalId = setInterval(allocateMemory, ALLOC_INTERVAL);
}

/**
 * Stop memory allocation
 */
function stopAllocation() {
  if (allocationIntervalId) {
    clearInterval(allocationIntervalId);
    allocationIntervalId = null;
    console.log('Memory allocation stopped.');
  }
}

/**
 * Check memory status and control allocation
 */
async function checkAndControlMemory() {
  try {
    const status = await getMemoryStatus();
    if (!status) return;
    
    printStatus(status);
    
    const usage = status.currentUsage?.usagePercent || 0;
    
    // Control allocation based on memory usage
    if (usage < TARGET_USAGE - 10) {
      // Resume allocation if below target
      if (!allocationIntervalId) {
        console.log(`Memory usage (${usage}%) below target. Resuming allocation.`);
        startAllocation();
      }
    } else if (usage >= TARGET_USAGE) {
      // Pause allocation if at or above target
      if (allocationIntervalId) {
        console.log(`Memory usage (${usage}%) at or above target. Pausing allocation.`);
        stopAllocation();
      }
    }
    
    // Report memory optimization events
    if (status.thresholdManager?.stats) {
      const stats = status.thresholdManager.stats;
      if (stats.actionCount > 0) {
        console.log(`Memory relief actions detected: ${stats.actionCount}`);
      }
      if (stats.criticalCount > 0) {
        console.log(`Critical memory conditions detected: ${stats.criticalCount}`);
      }
    }
  } catch (error) {
    console.error(`Error checking memory: ${error.message}`);
  }
}

/**
 * Start memory pressure simulation
 */
async function startSimulation() {
  console.log('====================================');
  console.log('  MEMORY PRESSURE SIMULATION START  ');
  console.log('====================================');
  console.log(`Target memory usage: ${TARGET_USAGE}%`);
  
  // Initial memory check
  const initialStatus = await getMemoryStatus();
  if (initialStatus) {
    console.log('\nInitial Memory Status:');
    printStatus(initialStatus);
    
    // Check if threshold manager is active
    if (!initialStatus.thresholdManager?.isActive) {
      console.warn('\nWARNING: Memory threshold manager is not active. Automatic optimization may not work.');
    }
  }
  
  // Start periodic memory status checks
  statusCheckIntervalId = setInterval(checkAndControlMemory, CHECK_INTERVAL);
  
  // Start memory allocation
  startAllocation();
  
  // Set up cleanup on exit
  process.on('SIGINT', () => {
    console.log('\nSimulation interrupted. Cleaning up...');
    stopSimulation();
    process.exit(0);
  });
}

/**
 * Stop memory pressure simulation
 */
function stopSimulation() {
  isRunning = false;
  
  // Stop allocation
  stopAllocation();
  
  // Stop status checks
  if (statusCheckIntervalId) {
    clearInterval(statusCheckIntervalId);
    statusCheckIntervalId = null;
  }
  
  // Clear memory blocks
  if (memoryBlocks.length > 0) {
    console.log(`Clearing ${memoryBlocks.length} memory blocks...`);
    memoryBlocks.length = 0;
  }
  
  console.log('====================================');
  console.log('  MEMORY PRESSURE SIMULATION END    ');
  console.log('====================================');
}

// Start the simulation
startSimulation().catch(error => {
  console.error('Error running memory pressure simulation:', error);
  stopSimulation();
});