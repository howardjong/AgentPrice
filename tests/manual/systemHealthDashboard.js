
/**
 * System Health Dashboard
 * A comprehensive view of system performance and resource usage
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import os from 'os';

// Import utilities - some may be lazily loaded
let performanceMonitor;
let memoryLeakDetector;
let smartCache;

// Helper to format numbers
const formatNumber = (num) => {
  return new Intl.NumberFormat().format(num);
};

// Format memory size
const formatMemorySize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

// Dashboard state
const state = {
  isRunning: true,
  refreshRate: 5000, // milliseconds
  startTime: Date.now(),
  lastProcessCpuUsage: process.cpuUsage(),
  lastRefreshTime: Date.now(),
  history: {
    cpu: [],
    memory: [],
    requests: []
  },
  serviceStatus: {
    performanceMonitor: 'Loading...',
    memoryLeakDetector: 'Not loaded',
    smartCache: 'Not loaded'
  }
};

// Clear screen
const clearScreen = () => {
  process.stdout.write('\x1b[2J\x1b[0f');
};

// Draw horizontal line
const drawLine = (char = '─') => {
  const width = process.stdout.columns || 80;
  console.log(char.repeat(width));
};

// Center text
const centerText = (text, width = process.stdout.columns || 80) => {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
};

// Create a simple bar chart
const createBarChart = (value, max, width = 20, char = '█') => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const filledWidth = Math.round((percentage / 100) * width);
  const emptyWidth = width - filledWidth;
  
  let color = colors.green;
  if (percentage > 75) color = colors.red;
  else if (percentage > 50) color = colors.yellow;
  
  return `${color}${char.repeat(filledWidth)}${colors.dim}${char.repeat(emptyWidth)}${colors.reset} ${percentage.toFixed(1)}%`;
};

// Display header
const displayHeader = () => {
  clearScreen();
  console.log(colors.bright + colors.blue + centerText('SYSTEM HEALTH DASHBOARD') + colors.reset);
  console.log(centerText(`Runtime: ${formatUptime(Date.now() - state.startTime)} | ${new Date().toISOString()}`));
  drawLine();
};

// Format uptime
const formatUptime = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
};

// Display system information
const displaySystemInfo = () => {
  const cpuUsage = getCpuUsage();
  const memUsage = process.memoryUsage();
  
  console.log(colors.bright + '■ SYSTEM RESOURCES' + colors.reset);
  
  // CPU Information
  const cpus = os.cpus();
  console.log(`  CPU: ${cpus[0].model} (${cpus.length} cores)`);
  console.log(`  Load: ${createBarChart(cpuUsage, 100)} `);
  
  // Memory Information
  const heapUsedPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  console.log(`  Memory Used: ${formatMemorySize(memUsage.rss)} (RSS) | ${formatMemorySize(memUsage.heapUsed)} (Heap)`);
  console.log(`  Heap Usage: ${createBarChart(heapUsedPercentage, 100)} (${formatMemorySize(memUsage.heapUsed)}/${formatMemorySize(memUsage.heapTotal)})`);
  
  // Store history for trends
  state.history.cpu.push(cpuUsage);
  state.history.memory.push(memUsage.heapUsed);
  
  // Keep history at max 100 points
  if (state.history.cpu.length > 100) state.history.cpu.shift();
  if (state.history.memory.length > 100) state.history.memory.shift();
};

// Get CPU usage percentage
const getCpuUsage = () => {
  const cpuUsage = process.cpuUsage();
  const now = Date.now();
  
  // Calculate CPU usage percentage
  const userDiff = cpuUsage.user - state.lastProcessCpuUsage.user;
  const sysDiff = cpuUsage.system - state.lastProcessCpuUsage.system;
  const elapsed = now - state.lastRefreshTime;
  
  // Convert microseconds to percentage (1 core = 100%)
  const cpuPercentage = (userDiff + sysDiff) / (elapsed * 10); // Adjusted for clearer visualization
  
  // Update state for next calculation
  state.lastProcessCpuUsage = cpuUsage;
  state.lastRefreshTime = now;
  
  return cpuPercentage;
};

// Display performance monitor stats
const displayPerformanceStats = async () => {
  if (!performanceMonitor) {
    try {
      const module = await import('../../utils/performanceMonitor.js');
      performanceMonitor = module.default;
      state.serviceStatus.performanceMonitor = 'Active';
    } catch (err) {
      state.serviceStatus.performanceMonitor = 'Failed to load';
      return;
    }
  }
  
  console.log(colors.bright + '■ PERFORMANCE METRICS' + colors.reset);
  
  try {
    const report = performanceMonitor.getReport();
    
    // API Calls
    console.log('  API Calls:');
    const apiCalls = report.apiCalls || {};
    Object.entries(apiCalls).forEach(([key, count]) => {
      console.log(`    ${key}: ${colors.cyan}${count}${colors.reset}`);
    });
    
    // Response Times
    console.log('  Response Times:');
    const responseTimes = report.responseTime || {};
    Object.entries(responseTimes).forEach(([key, metrics]) => {
      console.log(`    ${key}: Avg ${colors.yellow}${metrics.avgTime}ms${colors.reset} (${metrics.count} calls)`);
    });
    
    // Active Operations
    console.log('  Active Operations:');
    const activeOps = report.activeOperations || {};
    const hasActiveOps = Object.keys(activeOps).length > 0;
    
    if (hasActiveOps) {
      Object.entries(activeOps).forEach(([key, count]) => {
        console.log(`    ${key}: ${colors.magenta}${count} active${colors.reset}`);
      });
    } else {
      console.log('    None');
    }
  } catch (err) {
    console.log(`  ${colors.red}Error getting performance report: ${err.message}${colors.reset}`);
  }
};

// Display memory leak detector stats
const displayMemoryLeakStats = async () => {
  if (!memoryLeakDetector) {
    try {
      const module = await import('../../utils/memoryLeakDetector.js');
      memoryLeakDetector = module.default;
      memoryLeakDetector.start();
      state.serviceStatus.memoryLeakDetector = 'Active';
    } catch (err) {
      state.serviceStatus.memoryLeakDetector = 'Failed to load';
      return;
    }
  }
  
  console.log(colors.bright + '■ MEMORY LEAK DETECTION' + colors.reset);
  
  try {
    const report = memoryLeakDetector.getReport();
    
    if (report.samples < 2) {
      console.log(`  ${colors.yellow}Collecting samples... (${report.samples} so far)${colors.reset}`);
      return;
    }
    
    const statusColor = report.potentialLeak ? colors.red : 
                        report.averageGrowthRate > 2 ? colors.yellow : colors.green;
    
    console.log(`  Status: ${statusColor}${report.potentialLeak ? 'POTENTIAL LEAK DETECTED' : 'No leak detected'}${colors.reset}`);
    console.log(`  Current Heap: ${formatMemorySize(report.currentHeapUsedMB * 1024 * 1024)}`);
    console.log(`  Growth Rate: ${statusColor}${report.averageGrowthRate}/sample${colors.reset}`);
    console.log(`  Recommendation: ${report.recommendation}`);
  } catch (err) {
    console.log(`  ${colors.red}Error getting memory leak report: ${err.message}${colors.reset}`);
  }
};

// Display cache stats
const displayCacheStats = async () => {
  if (!smartCache) {
    try {
      const module = await import('../../utils/smartCache.js');
      smartCache = module.default;
      state.serviceStatus.smartCache = 'Active';
    } catch (err) {
      state.serviceStatus.smartCache = 'Failed to load';
      return;
    }
  }
  
  console.log(colors.bright + '■ CACHE METRICS' + colors.reset);
  
  try {
    const stats = smartCache.getStats();
    
    console.log(`  Cache Size: ${stats.size}/${stats.maxSize} (${stats.utilization})`);
    console.log(`  Hit Rate: ${colors.cyan}${stats.hitRate}${colors.reset} (${stats.exactHits + stats.fuzzyHits} hits, ${stats.misses} misses)`);
    console.log(`  Estimated Size: ${formatMemorySize(stats.estimatedSizeKB * 1024)}`);
    console.log(`  Evictions: LRU: ${stats.evictions.lru}, Expired: ${stats.evictions.expired}, Manual: ${stats.evictions.manual}`);
  } catch (err) {
    console.log(`  ${colors.red}Error getting cache stats: ${err.message}${colors.reset}`);
  }
};

// Display service status
const displayServiceStatus = () => {
  console.log(colors.bright + '■ MONITORING SERVICES' + colors.reset);
  
  Object.entries(state.serviceStatus).forEach(([service, status]) => {
    const statusColor = status === 'Active' ? colors.green : 
                       status === 'Loading...' ? colors.yellow : colors.red;
    console.log(`  ${service}: ${statusColor}${status}${colors.reset}`);
  });
};

// Draw simple trend graph
const drawTrend = (data, label, width = 40, height = 1) => {
  if (!data || data.length === 0) return;
  
  // Calculate min and max values
  const max = Math.max(...data);
  const min = Math.min(...data);
  
  // Normalize the data
  const normalized = data.map(val => {
    return Math.floor(((val - min) / (max - min || 1)) * height);
  });
  
  // Generate sparkline
  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  let sparkline = '';
  
  // Show only the most recent points to fit the width
  const recentData = normalized.slice(-width);
  
  recentData.forEach(val => {
    const charIndex = Math.min(chars.length - 1, val);
    sparkline += chars[charIndex];
  });
  
  const trend = recentData[recentData.length - 1] - recentData[0];
  const trendIcon = trend > 0 ? '↗' : trend < 0 ? '↘' : '→';
  const trendColor = trend > 0 ? colors.red : trend < 0 ? colors.green : colors.blue;
  
  console.log(`  ${label}: ${sparkline} ${trendColor}${trendIcon}${colors.reset}`);
};

// Display trends
const displayTrends = () => {
  if (state.history.cpu.length < 2) return;
  
  console.log(colors.bright + '■ RESOURCE TRENDS' + colors.reset);
  drawTrend(state.history.cpu, 'CPU Usage', 40, 7);
  drawTrend(state.history.memory, 'Memory', 40, 7);
};

// Display filesystem stats
const displayFilesystemStats = () => {
  console.log(colors.bright + '■ FILE SYSTEM' + colors.reset);
  
  try {
    // Check log file sizes
    const logFiles = ['combined.log', 'error.log'].map(file => {
      try {
        const stats = fs.statSync(file);
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime
        };
      } catch (err) {
        return {
          name: file,
          error: err.message
        };
      }
    });
    
    logFiles.forEach(file => {
      if (file.error) {
        console.log(`  ${file.name}: ${colors.red}${file.error}${colors.reset}`);
      } else {
        console.log(`  ${file.name}: ${formatMemorySize(file.size)} (Modified: ${file.modified.toISOString()})`);
      }
    });
    
    // Check tmp directory size
    console.log(`  Temp Files: ${countTempFiles()} files`);
  } catch (err) {
    console.log(`  ${colors.red}Error checking filesystem: ${err.message}${colors.reset}`);
  }
};

// Count temp files
const countTempFiles = () => {
  try {
    const tempDir = os.tmpdir();
    return fs.readdirSync(tempDir).length;
  } catch (err) {
    return 'unknown';
  }
};

// Main dashboard rendering function
const renderDashboard = async () => {
  if (!state.isRunning) return;
  
  displayHeader();
  displaySystemInfo();
  console.log();
  await displayPerformanceStats();
  console.log();
  await displayMemoryLeakStats();
  console.log();
  await displayCacheStats();
  console.log();
  displayServiceStatus();
  console.log();
  displayTrends();
  console.log();
  displayFilesystemStats();
  console.log();
  
  drawLine();
  console.log(centerText('Press Q to quit, R to refresh immediately'));
};

// Initialize keyboard input
const initKeyboardInput = () => {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  
  process.stdin.on('keypress', (str, key) => {
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
      cleanup();
      process.exit();
    } else if (key.name === 'r') {
      renderDashboard();
    }
  });
};

// Cleanup before exit
const cleanup = () => {
  state.isRunning = false;
  console.log('\nShutting down health dashboard...');
  
  // Stop monitoring services
  if (memoryLeakDetector) {
    try {
      memoryLeakDetector.stop();
    } catch (err) {
      // Ignore
    }
  }
  
  if (smartCache) {
    try {
      smartCache.destroy();
    } catch (err) {
      // Ignore
    }
  }
  
  // Reset terminal
  process.stdout.write('\x1b[0m');
  console.log('Dashboard terminated.');
};

// Start the dashboard
const startDashboard = async () => {
  // Handle exit
  process.on('SIGINT', () => {
    cleanup();
    process.exit();
  });
  
  initKeyboardInput();
  await renderDashboard();
  
  // Schedule regular updates
  const updateInterval = setInterval(async () => {
    if (state.isRunning) {
      await renderDashboard();
    } else {
      clearInterval(updateInterval);
    }
  }, state.refreshRate);
};

// Start the dashboard
console.log('Starting system health dashboard...');
startDashboard().catch(err => {
  console.error('Error starting dashboard:', err);
  process.exit(1);
});
