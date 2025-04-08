/**
 * Memory Threshold Manager
 * 
 * Monitors memory usage and automatically triggers optimization
 * actions when memory exceeds defined thresholds.
 */

import { freemem, totalmem } from 'os';

// Default thresholds
const DEFAULT_THRESHOLDS = {
  WARNING: 70,    // Trigger warning at 70% usage
  ACTION: 80,     // Take action at 80% usage
  CRITICAL: 90    // Take aggressive action at 90% usage
};

// Default options
const DEFAULT_OPTIONS = {
  checkIntervalMs: 60000,    // Check every minute by default
  logIntervalMs: 300000,     // Log status every 5 minutes
  useSystemMemory: false,    // Whether to consider system-wide memory or just process
  autoOptimize: true,        // Whether to automatically optimize when thresholds are exceeded
  thresholds: DEFAULT_THRESHOLDS,
  debugMode: false,
  minTimeBetweenActionMs: 60000  // Minimum time between actions (1 minute)
};

/**
 * Memory Threshold Manager class
 */
class MemoryThresholdManager {
  constructor(memoryOptimization, options = {}) {
    this.memoryOptimization = memoryOptimization;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.thresholds = this.options.thresholds;
    this.isRunning = false;
    this.checkInterval = null;
    this.logInterval = null;
    this.lastActionTime = 0;
    this.eventListeners = {
      warning: [],
      action: [],
      critical: []
    };
    this.stats = {
      warningCount: 0,
      actionCount: 0,
      criticalCount: 0,
      lastWarningAt: null,
      lastActionAt: null,
      lastCriticalAt: null
    };
  }

  /**
   * Start monitoring memory usage
   */
  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.log('[INFO] Starting memory threshold monitoring');
    
    // Initial check
    this.checkMemoryUsage();
    
    // Set up regular checks
    this.checkInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.options.checkIntervalMs);
    
    // Set up regular logging if enabled
    if (this.options.logIntervalMs > 0) {
      this.logInterval = setInterval(() => {
        this.logMemoryStatus();
      }, this.options.logIntervalMs);
    }
  }
  
  /**
   * Stop monitoring memory usage
   */
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    if (this.logInterval) {
      clearInterval(this.logInterval);
      this.logInterval = null;
    }
    
    this.log('[INFO] Stopped memory threshold monitoring');
  }
  
  /**
   * Check current memory usage and take action if thresholds are exceeded
   */
  async checkMemoryUsage() {
    try {
      const memoryInfo = this.getMemoryInfo();
      const usagePercent = memoryInfo.usagePercent;
      
      if (this.options.debugMode) {
        this.log(`[DEBUG] Memory usage: ${usagePercent.toFixed(2)}%`);
      }
      
      // Check against thresholds from highest to lowest
      if (usagePercent >= this.thresholds.CRITICAL) {
        this.handleCriticalMemory(usagePercent, memoryInfo);
      } else if (usagePercent >= this.thresholds.ACTION) {
        this.handleActionMemory(usagePercent, memoryInfo);
      } else if (usagePercent >= this.thresholds.WARNING) {
        this.handleWarningMemory(usagePercent, memoryInfo);
      }
    } catch (error) {
      this.log(`[ERROR] Failed to check memory usage: ${error.message}`);
    }
  }
  
  /**
   * Handle warning level memory usage
   */
  handleWarningMemory(usagePercent, memoryInfo) {
    this.stats.warningCount++;
    this.stats.lastWarningAt = new Date();
    
    this.log(`[WARNING] Memory usage at ${usagePercent.toFixed(2)}% (warning threshold: ${this.thresholds.WARNING}%)`);
    
    // Trigger warning listeners
    this.triggerEvent('warning', { usagePercent, memoryInfo });
  }
  
  /**
   * Handle action level memory usage
   */
  async handleActionMemory(usagePercent, memoryInfo) {
    this.stats.actionCount++;
    this.stats.lastActionAt = new Date();
    
    this.log(`[ACTION] Memory usage at ${usagePercent.toFixed(2)}% (action threshold: ${this.thresholds.ACTION}%)`);
    
    // Trigger action listeners
    this.triggerEvent('action', { usagePercent, memoryInfo });
    
    // Take action if auto-optimize is enabled and minimum time between actions has passed
    if (this.options.autoOptimize && this.canTakeAction()) {
      this.lastActionTime = Date.now();
      this.log('[ACTION] Performing standard memory optimization...');
      
      try {
        const result = await this.memoryOptimization.performMemoryRelief(false);
        this.log(`[ACTION] Memory optimization complete. Freed ${result.reduction.heapMB.toFixed(2)} MB (${result.reduction.percent}%)`);
      } catch (error) {
        this.log(`[ERROR] Memory optimization failed: ${error.message}`);
      }
    }
  }
  
  /**
   * Handle critical level memory usage
   */
  async handleCriticalMemory(usagePercent, memoryInfo) {
    this.stats.criticalCount++;
    this.stats.lastCriticalAt = new Date();
    
    this.log(`[CRITICAL] Memory usage at ${usagePercent.toFixed(2)}% (critical threshold: ${this.thresholds.CRITICAL}%)`);
    
    // Trigger critical listeners
    this.triggerEvent('critical', { usagePercent, memoryInfo });
    
    // Take action if auto-optimize is enabled and minimum time between actions has passed
    if (this.options.autoOptimize && this.canTakeAction()) {
      this.lastActionTime = Date.now();
      this.log('[CRITICAL] Performing aggressive memory optimization...');
      
      try {
        const result = await this.memoryOptimization.performMemoryRelief(true);
        this.log(`[CRITICAL] Aggressive memory optimization complete. Freed ${result.reduction.heapMB.toFixed(2)} MB (${result.reduction.percent}%)`);
      } catch (error) {
        this.log(`[ERROR] Aggressive memory optimization failed: ${error.message}`);
      }
    }
  }
  
  /**
   * Check if enough time has passed since the last action
   */
  canTakeAction() {
    return (Date.now() - this.lastActionTime) >= this.options.minTimeBetweenActionMs;
  }
  
  /**
   * Get memory usage information
   */
  getMemoryInfo() {
    if (this.options.useSystemMemory) {
      return this.getSystemMemoryInfo();
    } else {
      return this.getProcessMemoryInfo();
    }
  }
  
  /**
   * Get process memory information
   */
  getProcessMemoryInfo() {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed;
    const heapTotal = memUsage.heapTotal;
    const usagePercent = (heapUsed / heapTotal) * 100;
    
    return {
      heapUsedBytes: heapUsed,
      heapTotalBytes: heapTotal,
      heapUsedMB: heapUsed / 1024 / 1024,
      heapTotalMB: heapTotal / 1024 / 1024,
      usagePercent,
      rssBytes: memUsage.rss,
      rssMB: memUsage.rss / 1024 / 1024,
      externalBytes: memUsage.external,
      externalMB: memUsage.external / 1024 / 1024
    };
  }
  
  /**
   * Get system-wide memory information
   */
  getSystemMemoryInfo() {
    const free = freemem();
    const total = totalmem();
    const used = total - free;
    const usagePercent = (used / total) * 100;
    
    return {
      freeBytes: free,
      totalBytes: total,
      usedBytes: used,
      freeMB: free / 1024 / 1024,
      totalMB: total / 1024 / 1024,
      usedMB: used / 1024 / 1024,
      usagePercent
    };
  }
  
  /**
   * Log detailed memory status
   */
  logMemoryStatus() {
    const memoryInfo = this.getMemoryInfo();
    const now = new Date().toISOString();
    
    let message = `[STATUS ${now}] Memory usage: ${memoryInfo.usagePercent.toFixed(2)}%`;
    
    if (this.options.useSystemMemory) {
      message += ` | System memory: ${memoryInfo.usedMB.toFixed(2)}/${memoryInfo.totalMB.toFixed(2)} MB`;
    } else {
      message += ` | Heap: ${memoryInfo.heapUsedMB.toFixed(2)}/${memoryInfo.heapTotalMB.toFixed(2)} MB | RSS: ${memoryInfo.rssMB.toFixed(2)} MB`;
    }
    
    message += ` | Events: ${this.stats.warningCount} warnings, ${this.stats.actionCount} actions, ${this.stats.criticalCount} critical`;
    
    this.log(message);
  }
  
  /**
   * Add event listener
   */
  addEventListener(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback);
      return true;
    }
    return false;
  }
  
  /**
   * Remove event listener
   */
  removeEventListener(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event]
        .filter(listener => listener !== callback);
      return true;
    }
    return false;
  }
  
  /**
   * Trigger event and call all registered listeners
   */
  triggerEvent(event, data) {
    if (this.eventListeners[event]) {
      for (const listener of this.eventListeners[event]) {
        try {
          listener(data);
        } catch (error) {
          this.log(`[ERROR] Event listener error for ${event}: ${error.message}`);
        }
      }
    }
  }
  
  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      thresholds: this.thresholds,
      currentUsage: this.getMemoryInfo()
    };
  }
  
  /**
   * Update thresholds
   */
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.log(`[INFO] Updated memory thresholds: warning=${this.thresholds.WARNING}%, action=${this.thresholds.ACTION}%, critical=${this.thresholds.CRITICAL}%`);
    return this.thresholds;
  }
  
  /**
   * Log message with timestamp
   */
  log(message) {
    if (typeof console !== 'undefined') {
      console.log(message);
    }
  }
}

export default MemoryThresholdManager;