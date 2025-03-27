
/**
 * System Performance Dashboard
 * This tool provides real-time monitoring of system performance and resource usage
 */
import logger from '../../utils/logger.js';
import performanceMonitor from '../../utils/performanceMonitor.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Configuration
const REPORT_INTERVAL = 60000; // 1 minute
const LOG_FILE = path.join(process.cwd(), 'performance-metrics.log');
const METRICS_RETENTION = 60; // Keep 60 snapshots (1 hour at 1 minute intervals)

// Global metrics storage
const metricsHistory = [];

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Get system metrics
 * @returns {Object} System metrics
 */
function getSystemMetrics() {
  const osUptime = os.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercentage = (usedMem / totalMem) * 100;
  
  // CPU load (average across all cores)
  const cpuLoad = os.loadavg()[0] / os.cpus().length * 100;
  
  return {
    timestamp: new Date().toISOString(),
    cpu: {
      load: cpuLoad.toFixed(2) + '%',
      cores: os.cpus().length
    },
    memory: {
      total: formatBytes(totalMem),
      used: formatBytes(usedMem),
      free: formatBytes(freeMem),
      percentage: memPercentage.toFixed(2) + '%'
    },
    system: {
      uptime: `${Math.floor(osUptime / 3600)}h ${Math.floor((osUptime % 3600) / 60)}m`,
      platform: os.platform(),
      arch: os.arch()
    }
  };
}

/**
 * Get application performance metrics
 * @returns {Object} Application metrics
 */
function getAppMetrics() {
  // Get process memory usage
  const memUsage = process.memoryUsage();
  
  // Get performance metrics from monitor
  const perfReport = performanceMonitor.getReport();
  
  return {
    process: {
      memoryUsage: {
        rss: formatBytes(memUsage.rss),
        heapTotal: formatBytes(memUsage.heapTotal),
        heapUsed: formatBytes(memUsage.heapUsed),
        external: formatBytes(memUsage.external)
      },
      uptime: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`
    },
    performance: perfReport
  };
}

/**
 * Generate and log a performance report
 */
function generateReport() {
  try {
    // Get metrics
    const systemMetrics = getSystemMetrics();
    const appMetrics = getAppMetrics();
    
    // Combined metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      system: systemMetrics,
      application: appMetrics
    };
    
    // Add to history and trim if needed
    metricsHistory.push(metrics);
    if (metricsHistory.length > METRICS_RETENTION) {
      metricsHistory.shift();
    }
    
    // Log to console
    console.log('\n======================================');
    console.log('    SYSTEM PERFORMANCE DASHBOARD');
    console.log('======================================');
    console.log(`Time: ${new Date().toLocaleTimeString()}`);
    console.log(`System Uptime: ${systemMetrics.system.uptime}`);
    console.log(`App Uptime: ${appMetrics.process.uptime}`);
    console.log('\n-- RESOURCE USAGE --');
    console.log(`CPU Load: ${systemMetrics.cpu.load} (${systemMetrics.cpu.cores} cores)`);
    console.log(`Memory: ${systemMetrics.memory.used} / ${systemMetrics.memory.total} (${systemMetrics.memory.percentage})`);
    console.log(`Process Memory: ${appMetrics.process.memoryUsage.heapUsed} / ${appMetrics.process.memoryUsage.heapTotal}`);
    
    // Show API call stats if available
    if (appMetrics.performance && appMetrics.performance.apiCalls) {
      console.log('\n-- API CALLS --');
      const apiCalls = appMetrics.performance.apiCalls;
      for (const [service, count] of Object.entries(apiCalls)) {
        console.log(`${service}: ${count} calls`);
      }
    }
    
    // Show response time stats if available
    if (appMetrics.performance && appMetrics.performance.responseTime) {
      console.log('\n-- RESPONSE TIMES --');
      const responseTimes = appMetrics.performance.responseTime;
      for (const [endpoint, stats] of Object.entries(responseTimes)) {
        if (stats.count > 0) {
          console.log(`${endpoint}: avg ${stats.avgTime}ms (${stats.count} calls)`);
        }
      }
    }
    
    // Show active operations if any
    if (appMetrics.performance && appMetrics.performance.activeOperations) {
      const activeOps = appMetrics.performance.activeOperations;
      const totalActive = Object.values(activeOps).reduce((sum, count) => sum + count, 0);
      
      if (totalActive > 0) {
        console.log('\n-- ACTIVE OPERATIONS --');
        for (const [service, count] of Object.entries(activeOps)) {
          console.log(`${service}: ${count} operations`);
        }
      }
    }
    
    console.log('======================================\n');
    
    // Log to file
    fs.appendFileSync(LOG_FILE, JSON.stringify(metrics) + '\n');
    
    // Log to application logger
    logger.info('Performance snapshot', { 
      cpu: systemMetrics.cpu.load,
      memory: systemMetrics.memory.percentage,
      heapUsed: appMetrics.process.memoryUsage.heapUsed
    });
    
  } catch (error) {
    logger.error('Error generating performance report', { error: error.message });
  }
}

/**
 * Start the dashboard
 */
function startDashboard() {
  console.log('Starting System Performance Dashboard');
  console.log(`Reports will be generated every ${REPORT_INTERVAL / 1000} seconds`);
  console.log(`Metrics are being logged to: ${LOG_FILE}`);
  
  // Generate initial report
  generateReport();
  
  // Set up interval for regular reports
  const intervalId = setInterval(generateReport, REPORT_INTERVAL);
  
  // Return control function
  return {
    stop: () => {
      clearInterval(intervalId);
      console.log('System Performance Dashboard stopped');
    },
    getMetricsHistory: () => [...metricsHistory],
    generateReport
  };
}

// If run directly
if (process.argv[1] === import.meta.url) {
  const dashboard = startDashboard();
  
  // Handle Ctrl+C to stop gracefully
  process.on('SIGINT', () => {
    dashboard.stop();
    process.exit(0);
  });
}

export { startDashboard, generateReport };
