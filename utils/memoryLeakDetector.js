
/**
 * Memory leak detection utility
 * Monitors heap usage patterns to detect potential memory leaks
 */
import logger from './logger.js';

class MemoryLeakDetector {
  constructor(options = {}) {
    this.sampleInterval = options.sampleInterval || 300000; // 5 minutes (increased from 3 minutes)
    this.growthThreshold = options.growthThreshold || 20; // 20% growth threshold (more tolerant)
    this.consecutiveGrowthLimit = options.consecutiveGrowthLimit || 3;
    this.maxSamples = options.maxSamples || 10; // Reduced sample history size to save memory
    this.samples = [];
    this.consecutiveGrowths = 0;
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.gcTriggerThreshold = options.gcTriggerThreshold || 70; // MB (reduced threshold further)
    this.lastGcTime = Date.now();
    this.isLowMemoryMode = options.isLowMemoryMode || false;
    
    // Minimum time between forced GCs (15 minutes)
    this.minGcInterval = options.minGcInterval || 15 * 60 * 1000;
    
    // Resource-saving mode for lightweight operation
    this.resourceSavingMode = options.resourceSavingMode || true; // Default to resource saving mode
  }
  
  /**
   * Configure memory leak detector with new options
   * @param {Object} options - Configuration options
   */
  configure(options = {}) {
    if (options.enabled !== undefined) {
      // If enabling and not already running, start monitoring
      if (options.enabled && !this.isMonitoring) {
        this.start();
      } 
      // If disabling and currently running, stop monitoring
      else if (!options.enabled && this.isMonitoring) {
        this.stop();
      }
    }
    
    if (options.checkInterval) {
      const newInterval = options.checkInterval;
      this.sampleInterval = newInterval;
      
      // Restart the interval if monitoring
      if (this.isMonitoring && this.monitorInterval) {
        clearInterval(this.monitorInterval);
        this.monitorInterval = setInterval(() => this.takeSample(), this.sampleInterval);
      }
    }
    
    if (options.alertThreshold) {
      this.growthThreshold = options.alertThreshold;
    }
    
    if (options.gcBeforeCheck !== undefined) {
      this.gcBeforeCheck = options.gcBeforeCheck;
    }
    
    if (options.maxSamples) {
      this.maxSamples = options.maxSamples;
      // Trim samples if needed
      if (this.samples.length > this.maxSamples) {
        this.samples = this.samples.slice(-this.maxSamples);
      }
    }
    
    if (options.resourceSavingMode !== undefined) {
      this.resourceSavingMode = options.resourceSavingMode;
    }
    
    logger.info('Memory leak detector configured', {
      sampleInterval: `${this.sampleInterval / 1000}s`,
      growthThreshold: `${this.growthThreshold}%`,
      gcTriggerThreshold: `${this.gcTriggerThreshold}MB`,
      isMonitoring: this.isMonitoring,
      resourceSavingMode: this.resourceSavingMode
    });
    
    return this;
  }
  
  /**
   * Start monitoring for memory leaks
   */
  start() {
    if (this.isMonitoring) return;
    
    logger.info('Starting memory leak detection');
    this.isMonitoring = true;
    this.samples = [];
    this.consecutiveGrowths = 0;
    
    // Take initial sample
    this.takeSample();
    
    // Set up regular sampling
    this.monitorInterval = setInterval(() => this.takeSample(), this.sampleInterval);
  }
  
  /**
   * Stop monitoring for memory leaks
   */
  stop() {
    if (!this.isMonitoring) return;
    
    logger.info('Stopping memory leak detection');
    this.isMonitoring = false;
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }
  
  /**
   * Take a memory sample
   */
  takeSample() {
    // Early return if we're not in an active state to save resources
    if (!this.isMonitoring) return;
    
    // Use lightweight memory tracking
    const memoryUsage = process.memoryUsage();
    
    // Create minimalist sample object - store only what we absolutely need
    const sample = {
      timestamp: Date.now(),
      heapUsed: memoryUsage.heapUsed
    };
    
    // Only add heapTotal in non-resource-saving mode
    if (!this.resourceSavingMode) {
      sample.heapTotal = memoryUsage.heapTotal;
      sample.rss = memoryUsage.rss;
    }
    
    this.samples.push(sample);
    
    // Aggressive sample management - keep only what we need
    if (this.samples.length > this.maxSamples) {
      // Remove oldest sample
      this.samples.shift();
    }
    
    // Reduce analysis frequency in resource-saving mode
    const shouldAnalyze = this.samples.length >= 3 && 
      (!this.resourceSavingMode || this.samples.length % 3 === 0);
    
    if (shouldAnalyze) {
      this.analyzeMemoryGrowth();
    }
    
    // Check GC less frequently in resource-saving mode
    const shouldCheckGC = !this.resourceSavingMode || this.samples.length % 3 === 0;
    
    if (shouldCheckGC) {
      this.checkForGarbageCollection();
    }
  }
  
  /**
   * Analyze memory growth patterns
   */
  analyzeMemoryGrowth() {
    const currentSample = this.samples[this.samples.length - 1];
    const previousSample = this.samples[this.samples.length - 2];
    
    // Calculate percentage growth
    const heapGrowthPercent = ((currentSample.heapUsed - previousSample.heapUsed) / previousSample.heapUsed) * 100;
    const rssGrowthPercent = ((currentSample.rss - previousSample.rss) / previousSample.rss) * 100;
    
    // Log memory usage periodically
    const heapUsedMB = Math.round(currentSample.heapUsed / 1024 / 1024);
    const rssMB = Math.round(currentSample.rss / 1024 / 1024);
    
    logger.debug('Memory usage sample', {
      heapUsedMB: `${heapUsedMB}MB`,
      rssMB: `${rssMB}MB`,
      heapGrowthPercent: `${heapGrowthPercent.toFixed(1)}%`,
      rssGrowthPercent: `${rssGrowthPercent.toFixed(1)}%`
    });
    
    // Check for significant growth
    if (heapGrowthPercent > this.growthThreshold) {
      this.consecutiveGrowths++;
      
      if (this.consecutiveGrowths >= this.consecutiveGrowthLimit) {
        // This pattern suggests a potential memory leak
        logger.warn('Potential memory leak detected', {
          consecutiveGrowths: this.consecutiveGrowths,
          heapUsedMB: `${heapUsedMB}MB`,
          growthPercent: `${heapGrowthPercent.toFixed(1)}%`,
          timeSpan: `${((currentSample.timestamp - this.samples[this.samples.length - this.consecutiveGrowths - 1].timestamp) / 60000).toFixed(1)} minutes`
        });
        
        // Recommend actions based on current memory usage
        this.recommendActions(heapUsedMB, rssMB);
      }
    } else {
      // Reset consecutive growth counter if no significant growth
      this.consecutiveGrowths = 0;
    }
  }
  
  /**
   * Recommend actions based on memory usage
   */
  recommendActions(heapUsedMB, rssMB) {
    logger.info('Memory usage recommendations', {
      currentHeapUsed: `${heapUsedMB}MB`,
      currentRSS: `${rssMB}MB`,
      recommendation: heapUsedMB > 500 ? 'Consider restarting the application' : 'Monitor closely'
    });
    
    // List common memory leak sources
    logger.info('Common memory leak sources to check', {
      eventListeners: 'Unbounded event listeners',
      closures: 'Closures referencing large objects',
      caches: 'Unbounded caches',
      promises: 'Unhandled promise rejections',
      timers: 'Uncleaned timers and intervals'
    });
  }
  
  /**
   * Check if garbage collection should be suggested
   */
  checkForGarbageCollection() {
    const currentSample = this.samples[this.samples.length - 1];
    const heapUsedMB = Math.round(currentSample.heapUsed / 1024 / 1024);
    const now = Date.now();
    
    // Only suggest GC if it's been at least minGcInterval since last suggestion
    // and heap usage is above threshold
    if (heapUsedMB > this.gcTriggerThreshold && 
        (now - this.lastGcTime) > this.minGcInterval) {
      
      logger.info('High memory usage detected', {
        heapUsedMB: `${heapUsedMB}MB`,
        recommendation: 'Consider manual garbage collection or application restart'
      });
      
      // Attempt to perform garbage collection automatically if available
      if (global.gc && typeof global.gc === 'function') {
        try {
          logger.info('Performing automatic garbage collection');
          const beforeMem = process.memoryUsage().heapUsed;
          
          // Run garbage collection
          global.gc();
          
          // Calculate freed memory
          const afterMem = process.memoryUsage().heapUsed;
          const freedMB = Math.round((beforeMem - afterMem) / 1024 / 1024);
          
          logger.info('Garbage collection completed', {
            freedMemory: `${freedMB}MB`,
            currentHeapUsed: `${Math.round(afterMem / 1024 / 1024)}MB`
          });
        } catch (error) {
          logger.error('Error during garbage collection', { error: error.message });
        }
      }
      
      this.lastGcTime = now;
    }
  }
  
  /**
   * Get memory usage trend report
   */
  getReport() {
    if (this.samples.length < 2) {
      return {
        status: 'Insufficient data',
        samples: this.samples.length
      };
    }
    
    const currentSample = this.samples[this.samples.length - 1];
    const firstSample = this.samples[0];
    
    const timeDiffMinutes = (currentSample.timestamp - firstSample.timestamp) / 60000;
    const heapGrowthPercent = ((currentSample.heapUsed - firstSample.heapUsed) / firstSample.heapUsed) * 100;
    
    // Calculate average growth rate
    let growthRate = 0;
    for (let i = 1; i < this.samples.length; i++) {
      const current = this.samples[i];
      const previous = this.samples[i - 1];
      const growth = ((current.heapUsed - previous.heapUsed) / previous.heapUsed) * 100;
      growthRate += growth;
    }
    growthRate = growthRate / (this.samples.length - 1);
    
    return {
      currentHeapUsedMB: Math.round(currentSample.heapUsed / 1024 / 1024),
      currentRssMB: Math.round(currentSample.rss / 1024 / 1024),
      monitoringTime: `${timeDiffMinutes.toFixed(1)} minutes`,
      totalGrowthPercent: `${heapGrowthPercent.toFixed(1)}%`,
      averageGrowthRate: `${growthRate.toFixed(2)}% per sample`,
      samples: this.samples.length,
      potentialLeak: this.consecutiveGrowths >= this.consecutiveGrowthLimit,
      recommendation: this.getRecommendation(growthRate)
    };
  }
  
  /**
   * Get recommendation based on growth rate
   */
  getRecommendation(growthRate) {
    if (growthRate > 5) {
      return 'Urgent: Significant memory growth detected, restart recommended';
    } else if (growthRate > 2) {
      return 'Warning: Memory growth detected, investigate potential leaks';
    } else if (growthRate > 0.5) {
      return 'Monitor: Slight memory growth, continue monitoring';
    } else {
      return 'Stable: Memory usage appears stable';
    }
  }

  /**
   * Get status of the memory leak detector
   * @returns {Object} Status information
   */
  getStatus() {
    const currentMemory = process.memoryUsage();
    const report = this.getReport();
    
    return {
      status: this.isMonitoring ? 'ACTIVE' : 'INACTIVE',
      samplesCollected: this.samples.length,
      memoryUsage: {
        heapUsedMB: Math.round(currentMemory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(currentMemory.heapTotal / 1024 / 1024),
        rssMB: Math.round(currentMemory.rss / 1024 / 1024)
      },
      settings: {
        sampleInterval: `${this.sampleInterval / 1000}s`,
        growthThreshold: `${this.growthThreshold}%`,
        consecutiveGrowthLimit: this.consecutiveGrowthLimit,
        resourceSavingMode: this.resourceSavingMode,
        maxSamples: this.maxSamples
      },
      analysis: {
        consecutiveGrowths: this.consecutiveGrowths,
        potentialLeakDetected: this.consecutiveGrowths >= this.consecutiveGrowthLimit,
        recommendation: this.samples.length >= 2 ? report.recommendation : 'Insufficient data'
      },
      gcInfo: {
        gcTriggerThreshold: `${this.gcTriggerThreshold}MB`,
        lastGcTime: new Date(this.lastGcTime).toISOString(),
        minGcInterval: `${this.minGcInterval / 1000 / 60} minutes`
      }
    };
  }
}

// Create a singleton instance only if it doesn't already exist
let memoryLeakDetector;
if (typeof global.memoryLeakDetector === 'undefined') {
  memoryLeakDetector = new MemoryLeakDetector();
  global.memoryLeakDetector = memoryLeakDetector;
} else {
  memoryLeakDetector = global.memoryLeakDetector;
}

export default memoryLeakDetector;
