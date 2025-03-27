
/**
 * Resource Manager
 * Manages and optimizes system resource usage
 */
import logger from './logger.js';
import memoryLeakDetector from './memoryLeakDetector.js';
import performanceMonitor from './performanceMonitor.js';

class ResourceManager {
  constructor(options = {}) {
    this.options = {
      heapUsageThreshold: options.heapUsageThreshold || 80, // Reduced to 80MB
      cpuUsageThreshold: options.cpuUsageThreshold || 60, // Lower CPU threshold
      gcInterval: options.gcInterval || 10 * 60 * 1000, // 10 minutes (increased)
      monitoringInterval: options.monitoringInterval || 5 * 60 * 1000, // 5 minutes (increased)
      cleanupInterval: options.cleanupInterval || 20 * 60 * 1000, // 20 minutes (increased)
      aggressiveGcEnabled: options.aggressiveGcEnabled || true, // Enable aggressive GC
      lowMemoryMode: options.lowMemoryMode || false, // Low memory mode option
      ...options
    };
    
    this.isActive = false;
    this.intervals = {
      monitoring: null,
      cleanup: null
    };
    
    // Resource usage history - keep minimal history
    this.usageHistory = [];
    this.maxHistoryEntries = 5;
    
    // Bind methods
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.monitorResources = this.monitorResources.bind(this);
    this.runCleanup = this.runCleanup.bind(this);
    this.forceCleanup = this.forceCleanup.bind(this);
    this.configure = this.configure.bind(this);
  }
  
  /**
   * Configure resource manager with new options
   * @param {Object} config - Configuration options
   */
  configure(config = {}) {
    // Update memory options
    if (config.memory) {
      if (config.memory.heapLimitMB) {
        this.options.heapUsageThreshold = config.memory.heapLimitMB;
      }
      if (config.memory.gcThresholdMB) {
        this.options.gcThreshold = config.memory.gcThresholdMB;
      }
    }
    
    // Update CPU options
    if (config.cpu && config.cpu.maxUtilization) {
      this.options.cpuUsageThreshold = config.cpu.maxUtilization;
    }
    
    // Update intervals
    if (config.gcInterval) {
      this.options.gcInterval = config.gcInterval;
    }
    if (config.monitoringInterval) {
      this.options.monitoringInterval = config.monitoringInterval;
    }
    if (config.cleanupInterval) {
      this.options.cleanupInterval = config.cleanupInterval;
    }
    
    logger.info('Resource manager configured', {
      heapUsageThreshold: `${this.options.heapUsageThreshold}MB`,
      cpuUsageThreshold: `${this.options.cpuUsageThreshold}%`,
      gcInterval: `${this.options.gcInterval / 1000}s`,
      monitoringInterval: `${this.options.monitoringInterval / 1000}s`,
      cleanupInterval: `${this.options.cleanupInterval / 1000}s`
    });
    
    // Restart if active
    if (this.isActive) {
      this.stop();
      this.start();
    }
    
    return this;
  }
  
  /**
   * Start resource management
   */
  start() {
    if (this.isActive) return;
    
    logger.info('Starting resource manager');
    this.isActive = true;
    
    // Start memory leak detection
    memoryLeakDetector.start();
    
    // Set up regular resource monitoring
    this.intervals.monitoring = setInterval(
      this.monitorResources, 
      this.options.monitoringInterval
    );
    
    // Set up periodic cleanup
    this.intervals.cleanup = setInterval(
      this.runCleanup,
      this.options.cleanupInterval
    );
    
    // Run initial monitoring
    this.monitorResources();
  }
  
  /**
   * Stop resource management
   */
  stop() {
    if (!this.isActive) return;
    
    logger.info('Stopping resource manager');
    this.isActive = false;
    
    // Stop memory leak detection
    memoryLeakDetector.stop();
    
    // Clear intervals
    Object.keys(this.intervals).forEach(key => {
      if (this.intervals[key]) {
        clearInterval(this.intervals[key]);
        this.intervals[key] = null;
      }
    });
  }
  
  /**
   * Optimize connection pools based on available system resources
   * @param {Object} options - Connection optimization options
   * @returns {Object} Optimization results
   */
  optimizeConnections(options = {}) {
    const defaults = {
      minPoolSize: 2,
      maxPoolSize: 10,
      timeout: 30000,
      idleTimeout: 60000
    };
    
    const config = { ...defaults, ...options };
    
    // Get current resource usage
    const memUsage = process.memoryUsage();
    const cpuUsage = performanceMonitor?.getReport()?.cpuUsage || 50; // Default to 50% if no data
    
    // Calculate optimal pool size based on resources
    // For CPU-intensive operations, limit connections when CPU is high
    const cpuFactor = Math.max(0.3, 1 - (cpuUsage / 100));
    
    // For memory-intensive operations, limit connections when memory is high
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memoryFactor = Math.max(0.3, 1 - (heapUsedMB / this.options.heapUsageThreshold));
    
    // Combined factor (weighted average)
    const resourceFactor = (cpuFactor * 0.4) + (memoryFactor * 0.6);
    
    // Calculate optimal pool size
    const optimalPoolSize = Math.max(
      config.minPoolSize,
      Math.floor(config.maxPoolSize * resourceFactor)
    );
    
    // Calculate optimal timeout based on resource pressure
    const optimalTimeout = Math.max(
      5000, // minimum 5 seconds
      Math.floor(config.timeout * resourceFactor)
    );
    
    // Calculate optimal idle timeout
    const optimalIdleTimeout = Math.max(
      10000, // minimum 10 seconds
      Math.floor(config.idleTimeout * resourceFactor)
    );
    
    const result = {
      poolSize: optimalPoolSize,
      timeout: optimalTimeout,
      idleTimeout: optimalIdleTimeout,
      resourceFactor
    };
    
    logger.info('Connection pools optimized', result);
    
    return result;
  }
  
  /**
   * Monitor system resources
   */
  monitorResources() {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const rssMB = Math.round(memUsage.rss / 1024 / 1024);
      
      // Get current CPU usage from performance monitor
      const perfReport = performanceMonitor.getReport();
      
      logger.debug('Resource management check', {
        heapUsedMB: `${heapUsedMB}MB`,
        rssMB: `${rssMB}MB`,
        activeOperations: perfReport.activeOperations
      });
      
      // Check if we're above thresholds
      if (heapUsedMB > this.options.heapUsageThreshold) {
        logger.warn('High memory usage detected', {
          heapUsedMB: `${heapUsedMB}MB`,
          threshold: `${this.options.heapUsageThreshold}MB`
        });
        
        // Force cleanup if significantly above threshold
        if (heapUsedMB > this.options.heapUsageThreshold * 1.5) {
          this.forceCleanup();
        }
      }
    } catch (error) {
      logger.error('Error in resource monitoring', { error: error.message });
    }
  }
  
  /**
   * Run regular cleanup operations
   */
  runCleanup() {
    try {
      logger.debug('Running scheduled resource cleanup');
      
      // Suggest garbage collection
      if (global.gc && typeof global.gc === 'function') {
        const beforeMem = process.memoryUsage();
        global.gc();
        const afterMem = process.memoryUsage();
        
        const freedMB = Math.round((beforeMem.heapUsed - afterMem.heapUsed) / 1024 / 1024);
        
        logger.info('Garbage collection completed', {
          freedMemory: `${freedMB}MB`,
          currentHeapUsed: `${Math.round(afterMem.heapUsed / 1024 / 1024)}MB`
        });
      }
    } catch (error) {
      logger.error('Error in cleanup operation', { error: error.message });
    }
  }
  
  /**
   * Force immediate cleanup
   */
  forceCleanup() {
    logger.warn('Forcing immediate resource cleanup');
    
    try {
      // Clear module caches selectively
      this.clearRequireCache();
      
      // Force garbage collection if available
      if (global.gc && typeof global.gc === 'function') {
        global.gc();
        logger.info('Forced garbage collection completed');
      }
      
      // Run memory leak detection
      memoryLeakDetector.takeSample();
    } catch (error) {
      logger.error('Error in forced cleanup', { error: error.message });
    }
  }
  
  /**
   * Selectively clear require cache for non-essential modules
   */
  clearRequireCache() {
    const essentialModules = [
      'express',
      'http',
      'fs',
      'path',
      'process',
      'logger',
      'utils/logger'
    ];
    
    try {
      let cleared = 0;
      
      // Only clear cache for non-essential modules
      Object.keys(require.cache).forEach(modulePath => {
        // Skip essential modules
        if (essentialModules.some(essential => modulePath.includes(essential))) {
          return;
        }
        
        // Skip node_modules (risky to clear)
        if (modulePath.includes('node_modules')) {
          return;
        }
        
        // Clear module from cache
        delete require.cache[modulePath];
        cleared++;
      });
      
      logger.debug(`Cleared ${cleared} modules from require cache`);
    } catch (error) {
      logger.error('Error clearing require cache', { error: error.message });
    }
  }
  
  /**
   * Get current resource usage
   */
  getResourceUsage() {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      uptime: `${Math.round(process.uptime() / 60)} minutes`
    };
  }

  /**
   * Get status of the resource manager
   * @returns {Object} Status information
   */
  getStatus() {
    const memUsage = process.memoryUsage();
    
    return {
      status: this.isActive ? 'ACTIVE' : 'INACTIVE',
      memoryUsage: {
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
      },
      thresholds: {
        heapUsage: `${this.options.heapUsageThreshold}MB`,
        cpuUsage: `${this.options.cpuUsageThreshold}%`
      },
      intervals: {
        monitoring: `${this.options.monitoringInterval / 1000}s`,
        cleanup: `${this.options.cleanupInterval / 1000}s`,
        gc: `${this.options.gcInterval / 1000}s`
      },
      settings: {
        aggressiveGcEnabled: this.options.aggressiveGcEnabled,
        lowMemoryMode: this.options.lowMemoryMode
      },
      uptime: `${Math.round(process.uptime() / 60)} minutes`
    };
  }
}

// Create and export singleton instance
const resourceManager = new ResourceManager();
export default resourceManager;
