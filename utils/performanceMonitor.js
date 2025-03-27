
/**
 * Performance monitoring utility to track resource usage and API calls
 */
import logger from './logger.js';

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiCalls: new Map(),
      responseTime: new Map(),
      resourceUsage: {
        lastCpuUsage: process.cpuUsage(),
        lastMemUsage: process.memoryUsage(),
        lastTimestamp: Date.now()
      },
      longRunningOperations: new Map()
    };
    
    // Track metrics every minute
    this.metricInterval = setInterval(() => this.trackResourceUsage(), 60000);
  }
  
  /**
   * Start tracking an API call or operation
   * @param {string} service - Service name (e.g., 'perplexity', 'claude')
   * @param {string} operation - Operation name
   * @returns {Object} Tracking object with stop method
   */
  startTracking(service, operation) {
    const startTime = Date.now();
    const trackingId = `${service}:${operation}:${startTime}:${Math.random().toString(36).substring(2, 10)}`;
    
    // Add to long-running operations map
    this.metrics.longRunningOperations.set(trackingId, {
      service,
      operation,
      startTime,
      inProgress: true
    });
    
    return {
      trackingId,
      stop: (metadata = {}) => this.stopTracking(trackingId, metadata)
    };
  }
  
  /**
   * Stop tracking an operation and record metrics
   * @param {string} trackingId - Tracking ID from startTracking
   * @param {Object} metadata - Additional metadata to store
   */
  stopTracking(trackingId, metadata = {}) {
    const operation = this.metrics.longRunningOperations.get(trackingId);
    if (!operation) return;
    
    const endTime = Date.now();
    const duration = endTime - operation.startTime;
    
    // Mark as completed
    operation.inProgress = false;
    operation.duration = duration;
    operation.endTime = endTime;
    operation.metadata = metadata;
    
    // Update API call counts
    const serviceKey = operation.service;
    this.metrics.apiCalls.set(
      serviceKey, 
      (this.metrics.apiCalls.get(serviceKey) || 0) + 1
    );
    
    // Update response time tracking
    const responseTimeKey = `${operation.service}:${operation.operation}`;
    if (!this.metrics.responseTime.has(responseTimeKey)) {
      this.metrics.responseTime.set(responseTimeKey, {
        count: 0,
        totalTime: 0,
        min: Infinity,
        max: 0
      });
    }
    
    const respMetrics = this.metrics.responseTime.get(responseTimeKey);
    respMetrics.count++;
    respMetrics.totalTime += duration;
    respMetrics.min = Math.min(respMetrics.min, duration);
    respMetrics.max = Math.max(respMetrics.max, duration);
    
    // Log operation completion
    if (duration > 5000) {
      // Only log significant operations (> 5 seconds)
      logger.info(`Operation ${operation.operation} completed`, {
        service: operation.service,
        duration: `${duration}ms`,
        ...metadata
      });
    }
    
    // Remove from in-progress after a delay
    setTimeout(() => {
      this.metrics.longRunningOperations.delete(trackingId);
    }, 60000);
    
    return {
      duration,
      service: operation.service,
      operation: operation.operation
    };
  }
  
  /**
   * Track resource usage
   */
  trackResourceUsage() {
    const currentTime = Date.now();
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    
    // Calculate CPU usage percentage
    const userDiff = cpuUsage.user - this.metrics.resourceUsage.lastCpuUsage.user;
    const sysDiff = cpuUsage.system - this.metrics.resourceUsage.lastCpuUsage.system;
    const elapsed = currentTime - this.metrics.resourceUsage.lastTimestamp;
    
    // Convert microseconds to percentage (1 core = 100%)
    const cpuPercentage = (userDiff + sysDiff) / (elapsed * 1000) * 100;
    
    // Calculate memory growth
    const heapDiff = memUsage.heapUsed - this.metrics.resourceUsage.lastMemUsage.heapUsed;
    const rssGrowth = memUsage.rss - this.metrics.resourceUsage.lastMemUsage.rss;
    
    // Update last values
    this.metrics.resourceUsage.lastCpuUsage = cpuUsage;
    this.metrics.resourceUsage.lastMemUsage = memUsage;
    this.metrics.resourceUsage.lastTimestamp = currentTime;
    
    // Log resource usage
    logger.info('System resource usage', {
      cpu: `${cpuPercentage.toFixed(1)}%`,
      memory: {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapDiff: `${(heapDiff / 1024 / 1024).toFixed(1)}MB`,
        rssGrowth: `${(rssGrowth / 1024 / 1024).toFixed(1)}MB`
      },
      activeOperations: this.countActiveOperations()
    });
  }
  
  /**
   * Count active operations by service
   * @returns {Object} Count of active operations by service
   */
  countActiveOperations() {
    const counts = {};
    
    for (const [, operation] of this.metrics.longRunningOperations.entries()) {
      if (operation.inProgress) {
        counts[operation.service] = (counts[operation.service] || 0) + 1;
      }
    }
    
    return counts;
  }
  
  /**
   * Get performance report
   * @returns {Object} Performance metrics and statistics
   */
  getReport() {
    // Calculate average response times
    const responseTimeStats = {};
    for (const [key, metrics] of this.metrics.responseTime.entries()) {
      responseTimeStats[key] = {
        count: metrics.count,
        avgTime: metrics.count > 0 ? Math.round(metrics.totalTime / metrics.count) : 0,
        minTime: metrics.min === Infinity ? 0 : metrics.min,
        maxTime: metrics.max
      };
    }
    
    // API call counts
    const apiCallCounts = {};
    for (const [key, count] of this.metrics.apiCalls.entries()) {
      apiCallCounts[key] = count;
    }
    
    return {
      apiCalls: apiCallCounts,
      responseTime: responseTimeStats,
      resourceUsage: {
        heapUsed: `${Math.round(this.metrics.resourceUsage.lastMemUsage.heapUsed / 1024 / 1024)}MB`,
        rss: `${Math.round(this.metrics.resourceUsage.lastMemUsage.rss / 1024 / 1024)}MB`
      },
      activeOperations: this.countActiveOperations(),
      uptime: process.uptime()
    };
  }
  
  /**
   * Stop the monitor and clean up
   */
  stop() {
    if (this.metricInterval) {
      clearInterval(this.metricInterval);
      this.metricInterval = null;
    }
  }
}

const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;
