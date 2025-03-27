
/**
 * Batch Processor for LLM API Calls
 * 
 * Processes multiple requests in batches to reduce API costs and improve throughput.
 */
import logger from './logger.js';
import { setTimeout as sleep } from 'timers/promises';

class BatchProcessor {
  constructor(options = {}) {
    this.options = {
      // Maximum batch size
      maxBatchSize: options.maxBatchSize || 5,
      // Wait time to collect items in a batch (ms)
      batchWindowMs: options.batchWindowMs || 100,
      // Maximum wait time for batch processing (ms)
      maxBatchWaitMs: options.maxBatchWaitMs || 2000,
      // Process in strict FIFO order
      strictOrdering: options.strictOrdering !== false,
      // Track memory usage to avoid OOM
      memoryAware: options.memoryAware !== false,
      // Memory threshold for processing (MB)
      memoryThresholdMB: options.memoryThresholdMB || 500
    };
    
    // Batches by processor name
    this.batches = new Map();
    
    // Statistics
    this.stats = {
      processed: 0,
      batched: 0,
      singleItems: 0,
      batchSizes: [],
      processingTimes: [],
      failedBatches: 0,
      createdAt: Date.now()
    };
    
    // Set up memory monitoring if enabled
    if (this.options.memoryAware) {
      this.memoryCheckInterval = setInterval(() => this.checkMemoryUsage(), 30000);
    }
  }
  
  /**
   * Process an item through a batch
   * @param {string} processorName - Name of the processor
   * @param {any} item - Item to process
   * @param {Function} processorFn - Function to process items
   * @param {Object} options - Processing options
   * @returns {Promise<any>} Processing result
   */
  async process(processorName, item, processorFn, options = {}) {
    // Get or create batch for this processor
    let batch = this.batches.get(processorName);
    
    // Create new batch if none exists
    if (!batch) {
      batch = {
        items: [],
        results: new Map(),
        processingPromise: null,
        batchTimer: null,
        lastProcessed: Date.now(),
        isProcessing: false
      };
      
      this.batches.set(processorName, batch);
    }
    
    // Create a unique ID for this item
    const itemId = `${processorName}:${Date.now()}:${Math.random().toString(36).substring(2, 10)}`;
    
    // Create a promise for this item's result
    let resolveItem, rejectItem;
    const resultPromise = new Promise((resolve, reject) => {
      resolveItem = resolve;
      rejectItem = reject;
    });
    
    // Add item to batch
    batch.items.push({
      id: itemId,
      data: item,
      resolve: resolveItem,
      reject: rejectItem,
      options,
      timestamp: Date.now()
    });
    
    logger.debug(`Item ${itemId} added to batch ${processorName} (size: ${batch.items.length})`);
    
    // Check if we need to process the batch now
    if (batch.items.length >= this.options.maxBatchSize) {
      this.processNow(processorName, processorFn);
    } else if (!batch.batchTimer) {
      // Start a timer to process this batch
      batch.batchTimer = setTimeout(() => {
        this.processNow(processorName, processorFn);
      }, this.options.batchWindowMs);
    }
    
    // Start failsafe timer to avoid stuck batches
    const failsafeTimer = setTimeout(() => {
      // If the item is still in batch and hasn't been processed
      if (batch.items.some(i => i.id === itemId) && !batch.results.has(itemId)) {
        // Process the batch if not already processing
        if (!batch.isProcessing) {
          this.processNow(processorName, processorFn);
        }
      }
    }, this.options.maxBatchWaitMs);
    
    // Wait for result
    try {
      const result = await resultPromise;
      clearTimeout(failsafeTimer);
      return result;
    } catch (error) {
      clearTimeout(failsafeTimer);
      throw error;
    }
  }
  
  /**
   * Process batch immediately
   * @param {string} processorName - Name of the processor
   * @param {Function} processorFn - Function to process items
   * @returns {Promise<any>} Processing result
   */
  async processNow(processorName, processorFn) {
    const batch = this.batches.get(processorName);
    
    if (!batch || batch.items.length === 0 || batch.isProcessing) {
      return;
    }
    
    // Clear any pending timer
    if (batch.batchTimer) {
      clearTimeout(batch.batchTimer);
      batch.batchTimer = null;
    }
    
    // Mark as processing
    batch.isProcessing = true;
    
    // Get items to process in this batch
    const itemsToProcess = [...batch.items];
    batch.items = [];
    
    const startTime = Date.now();
    const batchSize = itemsToProcess.length;
    
    logger.debug(`Processing batch ${processorName} with ${batchSize} items`);
    
    // Process batch
    try {
      // If batch size is 1, process directly without batching
      if (batchSize === 1) {
        const item = itemsToProcess[0];
        this.stats.singleItems++;
        
        try {
          const result = await processorFn(item.data, item.options);
          item.resolve(result);
          batch.results.set(item.id, result);
        } catch (error) {
          item.reject(error);
        }
      } else {
        // Process as a batch
        this.stats.batched += batchSize;
        
        // Extract data from items
        const batchData = itemsToProcess.map(item => item.data);
        
        // Combine options (use first item's options as base)
        const batchOptions = {
          ...itemsToProcess[0].options,
          _isBatch: true,
          _batchSize: batchSize,
          _batchItems: itemsToProcess.map(item => ({
            id: item.id,
            options: item.options
          }))
        };
        
        // Process the batch
        const batchResults = await processorFn(batchData, batchOptions);
        
        // Distribute results to individual items
        for (let i = 0; i < itemsToProcess.length; i++) {
          const item = itemsToProcess[i];
          const result = Array.isArray(batchResults) ? batchResults[i] : batchResults;
          
          item.resolve(result);
          batch.results.set(item.id, result);
        }
      }
      
      // Update statistics
      const processingTime = Date.now() - startTime;
      this.stats.processed += batchSize;
      this.stats.batchSizes.push(batchSize);
      this.stats.processingTimes.push(processingTime);
      
      // Keep stats arrays from growing too large
      if (this.stats.batchSizes.length > 100) {
        this.stats.batchSizes = this.stats.batchSizes.slice(-100);
        this.stats.processingTimes = this.stats.processingTimes.slice(-100);
      }
      
      logger.debug(`Batch ${processorName} processed in ${processingTime}ms`);
    } catch (error) {
      // Batch processing failed
      logger.error(`Batch ${processorName} processing failed`, { error: error.message });
      this.stats.failedBatches++;
      
      // Reject all items in batch
      for (const item of itemsToProcess) {
        item.reject(error);
      }
    } finally {
      // Cleanup
      batch.isProcessing = false;
      batch.lastProcessed = Date.now();
      
      // Clear old results after 5 minutes
      setTimeout(() => {
        for (const item of itemsToProcess) {
          batch.results.delete(item.id);
        }
      }, 300000);
      
      // Check if there are more items waiting to be processed
      if (batch.items.length > 0) {
        // Process next batch after a short delay
        setTimeout(() => {
          this.processNow(processorName, processorFn);
        }, 50);
      }
    }
  }
  
  /**
   * Check memory usage and adjust batch size if needed
   * @returns {Object} Memory usage info
   */
  checkMemoryUsage() {
    if (!this.options.memoryAware) return null;
    
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      // If memory usage is high, reduce batch size temporarily
      if (heapUsedMB > this.options.memoryThresholdMB) {
        const oldBatchSize = this.options.maxBatchSize;
        this.options.maxBatchSize = Math.max(1, Math.floor(this.options.maxBatchSize / 2));
        
        logger.warn('Reducing batch size due to high memory usage', {
          heapUsedMB,
          oldBatchSize,
          newBatchSize: this.options.maxBatchSize
        });
        
        // Restore batch size after some time
        setTimeout(() => {
          this.options.maxBatchSize = oldBatchSize;
          logger.info('Restored original batch size', { batchSize: oldBatchSize });
        }, 120000);
      }
      
      return { heapUsedMB };
    } catch (error) {
      logger.error('Error checking memory usage', { error: error.message });
      return null;
    }
  }
  
  /**
   * Get batch processor statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const avgBatchSize = this.stats.batchSizes.length > 0 
      ? this.stats.batchSizes.reduce((a, b) => a + b, 0) / this.stats.batchSizes.length 
      : 0;
    
    const avgProcessingTime = this.stats.processingTimes.length > 0
      ? this.stats.processingTimes.reduce((a, b) => a + b, 0) / this.stats.processingTimes.length
      : 0;
    
    return {
      processed: this.stats.processed,
      batched: this.stats.batched,
      singleItems: this.stats.singleItems,
      activeBatches: this.batches.size,
      avgBatchSize: avgBatchSize.toFixed(2),
      avgProcessingTime: `${avgProcessingTime.toFixed(2)}ms`,
      failedBatches: this.stats.failedBatches,
      uptime: `${Math.round((Date.now() - this.stats.createdAt) / 1000 / 60)} minutes`,
      currentBatchSizes: Array.from(this.batches.entries()).map(([name, batch]) => ({
        processor: name,
        queuedItems: batch.items.length,
        isProcessing: batch.isProcessing
      }))
    };
  }
  
  /**
   * Reset processor statistics
   */
  resetStats() {
    this.stats = {
      processed: 0,
      batched: 0,
      singleItems: 0,
      batchSizes: [],
      processingTimes: [],
      failedBatches: 0,
      createdAt: Date.now()
    };
    
    logger.info('Batch processor statistics reset');
  }
  
  /**
   * Stop all batch processing and cleanup
   */
  shutdown() {
    // Clear memory check interval
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    
    // Clear all batch timers
    for (const [name, batch] of this.batches.entries()) {
      if (batch.batchTimer) {
        clearTimeout(batch.batchTimer);
        batch.batchTimer = null;
      }
      
      // Reject any pending items
      for (const item of batch.items) {
        item.reject(new Error('Batch processor shutting down'));
      }
      
      logger.info(`Cleaned up batch ${name} during shutdown`);
    }
    
    // Clear batches
    this.batches.clear();
    
    logger.info('Batch processor shut down');
  }
}

// Create and export singleton instance
const batchProcessor = new BatchProcessor();
export default batchProcessor;
/**
 * Batch Processor
 * 
 * Processes operations in batches to reduce API calls and improve efficiency
 */
import logger from './logger.js';

class BatchProcessor {
  constructor(options = {}) {
    this.options = {
      maxBatchSize: options.maxBatchSize || 10, // Maximum batch size
      batchTimeout: options.batchTimeout || 100, // Max wait time in ms
      autoProcess: options.autoProcess !== false, // Auto-process batches
      processingDelay: options.processingDelay || 50, // Delay between processing batches
      ...options
    };
    
    this.batches = new Map(); // Map of batch types to batch queues
    this.batchTimers = new Map(); // Map of batch types to timeout timers
    this.activeProcessing = new Set(); // Set of batch types currently being processed
    this.stats = {
      processed: 0,
      totalItems: 0,
      activeBatches: 0,
      errors: 0
    };
    
    // Bind methods to ensure correct this context
    this.add = this.add.bind(this);
    this.processBatch = this.processBatch.bind(this);
    this.getStats = this.getStats.bind(this);
  }
  
  /**
   * Add an item to a batch
   * @param {string} batchType - Type of batch
   * @param {any} item - Item to add to batch
   * @param {function} processFn - Function to process the batch
   * @returns {Promise} A promise that resolves when the item is processed
   */
  add(batchType, item, processFn) {
    // Create a promise for this item
    let resolveItem, rejectItem;
    const itemPromise = new Promise((resolve, reject) => {
      resolveItem = resolve;
      rejectItem = reject;
    });
    
    // Initialize batch if it doesn't exist
    if (!this.batches.has(batchType)) {
      this.batches.set(batchType, []);
    }
    
    // Get the batch
    const batch = this.batches.get(batchType);
    
    // Add item to batch with resolve/reject handlers
    batch.push({
      item,
      resolve: resolveItem,
      reject: rejectItem,
      timestamp: Date.now()
    });
    
    // Update stats
    this.stats.totalItems++;
    this.stats.activeBatches = this.batches.size;
    
    // Process immediately if batch is full
    if (batch.length >= this.options.maxBatchSize) {
      this.processBatch(batchType, processFn);
    } 
    // Otherwise set a timer to process the batch
    else if (this.options.autoProcess && !this.batchTimers.has(batchType)) {
      const timerId = setTimeout(() => {
        this.processBatch(batchType, processFn);
      }, this.options.batchTimeout);
      
      this.batchTimers.set(batchType, timerId);
    }
    
    return itemPromise;
  }
  
  /**
   * Process a batch of items
   * @param {string} batchType - Type of batch to process
   * @param {function} processFn - Function to process the batch 
   * @returns {Promise<void>}
   */
  async processBatch(batchType, processFn) {
    // Clear any pending timer
    if (this.batchTimers.has(batchType)) {
      clearTimeout(this.batchTimers.get(batchType));
      this.batchTimers.delete(batchType);
    }
    
    // Get the batch
    const batch = this.batches.get(batchType) || [];
    if (batch.length === 0) {
      return;
    }
    
    // Replace the batch with an empty array
    this.batches.set(batchType, []);
    
    // Mark as processing
    this.activeProcessing.add(batchType);
    
    try {
      // Extract items for processing
      const items = batch.map(entry => entry.item);
      
      logger.debug(`Processing batch of ${items.length} items`, {
        batchType,
        batchSize: items.length
      });
      
      // Process the batch
      const results = await processFn(items);
      
      // Make sure results match items
      if (Array.isArray(results) && results.length === batch.length) {
        // Resolve each item with its result
        batch.forEach((entry, index) => {
          entry.resolve(results[index]);
        });
      } else {
        // If results don't match items, resolve all with the same result
        batch.forEach(entry => {
          entry.resolve(results);
        });
      }
      
      // Update stats
      this.stats.processed += batch.length;
    } catch (error) {
      logger.error(`Batch processing error for ${batchType}`, {
        error: error.message,
        batchSize: batch.length
      });
      
      // Reject all items in the batch
      batch.forEach(entry => {
        entry.reject(error);
      });
      
      // Update error stats
      this.stats.errors++;
    } finally {
      // Remove from active processing
      this.activeProcessing.delete(batchType);
      
      // Update active batches stat
      this.stats.activeBatches = this.batches.size;
    }
  }
  
  /**
   * Force process all batches immediately
   * @param {function} defaultProcessFn - Default processing function if none provided
   * @returns {Promise<void>}
   */
  async processAll(defaultProcessFn) {
    // Process each batch type
    const batchTypes = [...this.batches.keys()];
    
    logger.info(`Force processing ${batchTypes.length} batch types`, {
      batchTypes: batchTypes.join(', ')
    });
    
    // Process each batch type sequentially to avoid overwhelming the system
    for (const batchType of batchTypes) {
      // Clear any pending timer
      if (this.batchTimers.has(batchType)) {
        clearTimeout(this.batchTimers.get(batchType));
        this.batchTimers.delete(batchType);
      }
      
      await this.processBatch(batchType, defaultProcessFn);
      
      // Add a small delay between processing batches
      await new Promise(resolve => setTimeout(resolve, this.options.processingDelay));
    }
  }
  
  /**
   * Get batch processing statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      processed: this.stats.processed,
      totalItems: this.stats.totalItems,
      activeBatches: this.stats.activeBatches,
      errors: this.stats.errors,
      pendingItems: [...this.batches.values()].reduce((sum, batch) => sum + batch.length, 0),
      processingTypes: [...this.activeProcessing]
    };
  }
  
  /**
   * Clear all batches and timers
   */
  clear() {
    // Clear all timers
    for (const timerId of this.batchTimers.values()) {
      clearTimeout(timerId);
    }
    
    // Clear collections
    this.batchTimers.clear();
    this.activeProcessing.clear();
    
    // Reject all pending items
    for (const [batchType, batch] of this.batches.entries()) {
      batch.forEach(entry => {
        entry.reject(new Error('Batch processing cancelled'));
      });
      this.batches.set(batchType, []);
    }
    
    logger.info('Batch processor cleared');
  }
}

// Create singleton instance
const batchProcessor = new BatchProcessor();
export default batchProcessor;
