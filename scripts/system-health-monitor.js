/**
 * System Health Monitor
 * 
 * This script checks the health of the system, focusing on:
 * - Memory usage
 * - CPU load
 * - Redis connection
 * - Database connection (if applicable)
 * - Socket.IO server status
 * 
 * It can be run once with --once flag or continuously monitor with a specified interval.
 */

const os = require('os');
const fs = require('fs');
const util = require('util');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);

// Configuration
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MEMORY_WARNING_THRESHOLD = 80; // 80% memory usage
const MEMORY_CRITICAL_THRESHOLD = 90; // 90% memory usage
const CPU_WARNING_THRESHOLD = 50; // 50% CPU load
const CPU_CRITICAL_THRESHOLD = 70; // 70% CPU load

// Parse command line arguments
const args = process.argv.slice(2);
const runOnce = args.includes('--once');
const verbose = args.includes('--verbose');
const interval = args.includes('--interval') 
  ? parseInt(args[args.indexOf('--interval') + 1], 10) 
  : DEFAULT_INTERVAL_MS;

// Setup logging
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}
const logFile = path.join(logDir, `system-health-${new Date().toISOString().replace(/:/g, '-')}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

/**
 * Log a message to console and log file
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  if (level === 'ERROR') {
    console.error('\x1b[31m%s\x1b[0m', logMessage);
  } else if (level === 'WARNING') {
    console.warn('\x1b[33m%s\x1b[0m', logMessage);
  } else if (level === 'SUCCESS') {
    console.log('\x1b[32m%s\x1b[0m', logMessage);
  } else {
    console.log(logMessage);
  }
  
  logStream.write(logMessage + '\n');
}

/**
 * Check system memory usage
 */
async function checkMemory() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = Math.round((usedMem / totalMem) * 100);
  
  // Additional memory metrics from Node.js process
  const memoryUsage = process.memoryUsage();
  const heapUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const rss = Math.round(memoryUsage.rss / 1024 / 1024);
  
  let status = 'OK';
  let level = 'INFO';
  
  if (memUsagePercent >= MEMORY_CRITICAL_THRESHOLD) {
    status = 'CRITICAL';
    level = 'ERROR';
  } else if (memUsagePercent >= MEMORY_WARNING_THRESHOLD) {
    status = 'WARNING';
    level = 'WARNING';
  }
  
  const message = `Memory: ${status}, Usage: ${memUsagePercent}%, Free: ${Math.round(freeMem / 1024 / 1024)} MB, ` +
                 `Total: ${Math.round(totalMem / 1024 / 1024)} MB, Heap: ${heapUsed}/${heapTotal} MB, RSS: ${rss} MB`;
  
  log(message, level);
  
  return {
    status,
    memUsagePercent,
    freeMem,
    totalMem,
    heapUsed,
    heapTotal,
    rss
  };
}

/**
 * Check CPU load
 */
async function checkCpuLoad() {
  try {
    // Get system load averages
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    
    // Calculate load percentage (1 minute average)
    const loadPercentage = Math.round((loadAvg[0] / cpuCount) * 100);
    
    let status = 'OK';
    let level = 'INFO';
    
    if (loadPercentage >= CPU_CRITICAL_THRESHOLD) {
      status = 'CRITICAL';
      level = 'ERROR';
    } else if (loadPercentage >= CPU_WARNING_THRESHOLD) {
      status = 'WARNING';
      level = 'WARNING';
    }
    
    const message = `CPU: ${status}, Load: ${loadPercentage}%, 1m avg: ${loadAvg[0].toFixed(2)}, ` +
                   `5m avg: ${loadAvg[1].toFixed(2)}, 15m avg: ${loadAvg[2].toFixed(2)}, Cores: ${cpuCount}`;
    
    log(message, level);
    
    return {
      status,
      loadPercentage,
      loadAvg,
      cpuCount
    };
  } catch (error) {
    log(`Error checking CPU load: ${error.message}`, 'ERROR');
    return { status: 'ERROR', error: error.message };
  }
}

/**
 * Check Redis connection if available
 */
async function checkRedis() {
  try {
    // Try to dynamically require Redis
    let Redis;
    try {
      Redis = require('ioredis');
    } catch (e) {
      log('Redis module not found, skipping Redis check', 'INFO');
      return { status: 'SKIPPED', reason: 'Module not available' };
    }
    
    // Try to connect to Redis
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      enableReadyCheck: true
    });
    
    // Ping Redis with timeout
    const pingPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        redis.disconnect();
        reject(new Error('Redis ping timed out'));
      }, 2000);
      
      redis.ping()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timeout);
          reject(err);
        });
    });
    
    await pingPromise;
    
    log('Redis: OK, Connection successful', 'SUCCESS');
    redis.disconnect();
    
    return { status: 'OK' };
  } catch (error) {
    log(`Redis: ERROR, ${error.message}`, 'ERROR');
    return { status: 'ERROR', error: error.message };
  }
}

/**
 * Check database connection if available
 */
async function checkDatabase() {
  try {
    // Check if we can find pg module
    let pg;
    try {
      pg = require('pg');
    } catch (e) {
      try {
        // Try alternate postgres module
        pg = require('postgres');
      } catch (e2) {
        log('Database modules not found, skipping database check', 'INFO');
        return { status: 'SKIPPED', reason: 'Module not available' };
      }
    }
    
    // If no DATABASE_URL is set, skip the test
    if (!process.env.DATABASE_URL) {
      log('DATABASE_URL not set, skipping database check', 'INFO');
      return { status: 'SKIPPED', reason: 'DATABASE_URL not set' };
    }
    
    // Attempt database connection
    let client;
    try {
      // Handle both pg and postgres APIs
      if (pg.Pool) {
        // This is node-postgres (pg)
        const pool = new pg.Pool({
          connectionString: process.env.DATABASE_URL,
          connectionTimeoutMillis: 2000
        });
        client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        await pool.end();
      } else {
        // This is postgres
        client = pg(process.env.DATABASE_URL, { timeout: 2000 });
        const result = await client`SELECT NOW()`;
        await client.end();
      }
      
      log('Database: OK, Connection successful', 'SUCCESS');
      return { status: 'OK' };
    } catch (error) {
      log(`Database: ERROR, ${error.message}`, 'ERROR');
      return { status: 'ERROR', error: error.message };
    }
  } catch (error) {
    log(`Error checking database: ${error.message}`, 'ERROR');
    return { status: 'ERROR', error: error.message };
  }
}

/**
 * Check for active Socket.IO servers
 */
async function checkSocketIO() {
  try {
    const { stdout } = await execPromise('ps aux | grep socket.io | grep -v grep');
    
    const lines = stdout.trim().split('\n');
    const processCount = lines.length;
    
    if (processCount > 0) {
      log(`Socket.IO: OK, Found ${processCount} Socket.IO processes running`, 'SUCCESS');
      
      if (verbose) {
        lines.forEach((line, index) => {
          log(`Socket.IO Process ${index + 1}: ${line}`, 'INFO');
        });
      }
      
      return { status: 'OK', processCount, processes: lines };
    } else {
      log('Socket.IO: WARNING, No Socket.IO processes found', 'WARNING');
      return { status: 'WARNING', processCount: 0 };
    }
  } catch (error) {
    // If grep returns nothing, it will throw an error
    log('Socket.IO: WARNING, No Socket.IO processes found', 'WARNING');
    return { status: 'WARNING', processCount: 0 };
  }
}

/**
 * Run all health checks
 */
async function runHealthChecks() {
  log('Starting system health check...', 'INFO');
  
  try {
    const startTime = Date.now();
    
    // Run all checks in parallel
    const [memory, cpu, redis, database, socketIO] = await Promise.all([
      checkMemory(),
      checkCpuLoad(),
      checkRedis(),
      checkDatabase(),
      checkSocketIO()
    ]);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Determine overall status
    let overallStatus = 'OK';
    if (memory.status === 'CRITICAL' || cpu.status === 'CRITICAL' || 
        redis.status === 'ERROR' || database.status === 'ERROR') {
      overallStatus = 'CRITICAL';
    } else if (memory.status === 'WARNING' || cpu.status === 'WARNING' || 
               socketIO.status === 'WARNING') {
      overallStatus = 'WARNING';
    }
    
    const logLevel = overallStatus === 'CRITICAL' ? 'ERROR' : 
                    overallStatus === 'WARNING' ? 'WARNING' : 'SUCCESS';
    
    log(`Health check completed in ${duration}ms, Overall status: ${overallStatus}`, logLevel);
    
    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      duration,
      checks: {
        memory,
        cpu,
        redis,
        database,
        socketIO
      }
    };
  } catch (error) {
    log(`Error running health checks: ${error.message}`, 'ERROR');
    return {
      timestamp: new Date().toISOString(),
      overallStatus: 'ERROR',
      error: error.message
    };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('\n=== System Health Monitor ===');
  console.log(`Mode: ${runOnce ? 'Single run' : 'Continuous monitoring'}`);
  console.log(`Log file: ${logFile}`);
  
  if (runOnce) {
    // Run once and exit
    const result = await runHealthChecks();
    console.log('\nHealth check summary:');
    console.log(`Overall status: ${result.overallStatus}`);
    console.log(`Memory: ${result.checks.memory.memUsagePercent}%`);
    console.log(`CPU: ${result.checks.cpu.loadPercentage}%`);
    console.log('See log file for details');
    logStream.end();
    
    // Exit with appropriate code
    process.exit(result.overallStatus === 'OK' || result.overallStatus === 'WARNING' ? 0 : 1);
  } else {
    // Run continuously
    console.log(`Interval: ${interval / 1000} seconds`);
    console.log('\nPress Ctrl+C to stop monitoring\n');
    
    // Run immediately
    await runHealthChecks();
    
    // Then schedule recurring checks
    setInterval(runHealthChecks, interval);
  }
}

// Run the program
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});