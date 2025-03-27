
/**
 * Memory leak detection utility
 * Monitors heap usage patterns to detect potential memory leaks
 */
import logger from './logger.js';

class MemoryLeakDetector {
  constructor(options = {}) {
    this.sampleInterval = options.sampleInterval || 60000; // 1 minute
    this.growthThreshold = options.growthThreshold || 10; // 10% growth threshold
    this.consecutiveGrowthLimit = options.consecutiveGrowthLimit || 5;
    this.samples = [];
    this.consecutiveGrowths = 0;
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.gcTriggerThreshold = options.gcTriggerThreshold || 100; // MB
    this.lastGcTime = Date.now();
    
    // Minimum time between forced GCs (15 minutes)
    this.minGcInterval = options.minGcInterval || 15 * 60 * 1000;
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
      external: memoryUsage.external,
      rss: memoryUsage.rss
    };
    
    this.samples.push(sample);
    
    // Keep only the last 60 samples (1 hour with default interval)
    if (this.samples.length > 60) {
      this.samples.shift();
    }
    
    // Analyze for potential leaks if we have enough samples
    if (this.samples.length >= 3) {
      this.analyzeMemoryGrowth();
    }
    
    // Check if we should suggest a garbage collection
    this.checkForGarbageCollection();
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
