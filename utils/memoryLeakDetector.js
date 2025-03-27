
/**
 * Memory leak detection utility
 * Monitors heap usage patterns to detect potential memory leaks
 */
import logger from './logger.js';

class MemoryLeakDetector {
  constructor(options = {}) {
    this.sampleInterval = options.sampleInterval || 180000; // 3 minutes (increased from 1 minute)
    this.growthThreshold = options.growthThreshold || 15; // 15% growth threshold (more tolerant)
    this.consecutiveGrowthLimit = options.consecutiveGrowthLimit || 3;
    this.maxSamples = options.maxSamples || 20; // Limit sample history size
    this.samples = [];
    this.consecutiveGrowths = 0;
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.gcTriggerThreshold = options.gcTriggerThreshold || 80; // MB (reduced threshold)
    this.lastGcTime = Date.now();
    this.isLowMemoryMode = options.isLowMemoryMode || false;
    
    // Minimum time between forced GCs (10 minutes)
    this.minGcInterval = options.minGcInterval || 10 * 60 * 1000;
    
    // Resource-saving mode for lightweight operation
    this.resourceSavingMode = options.resourceSavingMode || false;
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
    const memoryUsage = process.memoryUsage();
    const sample = {
      timestamp: Date.now(),
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      // Only store essential metrics in resource-saving mode
      ...(this.resourceSavingMode ? {} : {
        external: memoryUsage.external,
        rss: memoryUsage.rss
      })
    };
    
    this.samples.push(sample);
    
    // Keep only the limited number of samples to reduce memory footprint
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
    
    // Only analyze if we have enough samples and not in resource-saving mode
    if (this.samples.length >= 3 && (!this.resourceSavingMode || this.samples.length % 2 === 0)) {
      this.analyzeMemoryGrowth();
    }
    
    // Check if we should suggest a garbage collection
    // Skip every other check in resource-saving mode
    if (!this.resourceSavingMode || this.samples.length % 2 === 0) {
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
}

const memoryLeakDetector = new MemoryLeakDetector();
export default memoryLeakDetector;
