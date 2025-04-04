
/**
 * Metrics Collector for Workflow Testing
 * 
 * Provides standardized metrics collection for workflow tests.
 */

import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

class MetricsCollector {
  constructor(options = {}) {
    this.metrics = {
      test: {
        variant: options.variant || 'basic',
        variantName: options.variantName || 'Basic Test',
        timestamp: new Date().toISOString(),
        duration: 0
      },
      stages: {},
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        cpuCores: os.cpus().length,
        memory: {
          total: os.totalmem(),
          free: os.freemem()
        }
      },
      performance: {},
      errors: []
    };
    
    this.startTime = null;
    this.currentStage = null;
    this.stageStartTime = null;
    this.options = options;
  }
  
  /**
   * Start the overall test timer
   */
  startTest() {
    this.startTime = performance.now();
    this.metrics.startTime = new Date().toISOString();
    
    // Capture initial memory usage
    this.captureMemoryUsage('start');
  }
  
  /**
   * Record test completion
   */
  endTest() {
    if (!this.startTime) return;
    
    const endTime = performance.now();
    this.metrics.test.duration = endTime - this.startTime;
    this.metrics.endTime = new Date().toISOString();
    
    // Capture final memory usage
    this.captureMemoryUsage('end');
  }
  
  /**
   * Start timing a specific stage
   * @param {string} stageName - Name of the stage (e.g., 'research', 'dataExtraction')
   */
  startStage(stageName) {
    if (this.currentStage) {
      this.endStage();
    }
    
    this.currentStage = stageName;
    this.stageStartTime = performance.now();
    
    this.metrics.stages[stageName] = this.metrics.stages[stageName] || {
      startTime: new Date().toISOString(),
      count: 0,
      duration: 0,
      memory: {}
    };
    
    this.metrics.stages[stageName].count++;
    
    // Capture memory at stage start
    this.captureMemoryUsage(`stage:${stageName}:start`);
  }
  
  /**
   * End timing the current stage
   */
  endStage() {
    if (!this.currentStage || !this.stageStartTime) return;
    
    const stageName = this.currentStage;
    const endTime = performance.now();
    const duration = endTime - this.stageStartTime;
    
    this.metrics.stages[stageName].duration += duration;
    this.metrics.stages[stageName].endTime = new Date().toISOString();
    
    // Capture memory at stage end
    this.captureMemoryUsage(`stage:${stageName}:end`);
    
    this.currentStage = null;
    this.stageStartTime = null;
  }
  
  /**
   * Record an API call
   * @param {string} service - Service name (e.g., 'perplexity', 'claude')
   * @param {string} operation - Operation name (e.g., 'query', 'deepResearch')
   * @param {number} duration - Duration in milliseconds
   * @param {object} details - Additional details about the call
   */
  recordApiCall(service, operation, duration, details = {}) {
    this.metrics.apiCalls = this.metrics.apiCalls || {};
    this.metrics.apiCalls[service] = this.metrics.apiCalls[service] || {};
    this.metrics.apiCalls[service][operation] = this.metrics.apiCalls[service][operation] || {
      count: 0,
      totalDuration: 0,
      calls: []
    };
    
    const call = {
      timestamp: new Date().toISOString(),
      duration,
      ...details
    };
    
    this.metrics.apiCalls[service][operation].count++;
    this.metrics.apiCalls[service][operation].totalDuration += duration;
    this.metrics.apiCalls[service][operation].calls.push(call);
  }
  
  /**
   * Record an error that occurred during the test
   * @param {string} stage - Stage where the error occurred
   * @param {Error} error - The error object
   * @param {object} context - Additional context about the error
   */
  recordError(stage, error, context = {}) {
    this.metrics.errors.push({
      stage,
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      ...context
    });
  }
  
  /**
   * Capture current memory usage
   * @param {string} label - Label for the memory capture
   */
  captureMemoryUsage(label) {
    this.metrics.performance[label] = {
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage()
    };
  }
  
  /**
   * Add custom metric
   * @param {string} category - Metric category
   * @param {string} name - Metric name
   * @param {any} value - Metric value
   */
  addCustomMetric(category, name, value) {
    this.metrics.custom = this.metrics.custom || {};
    this.metrics.custom[category] = this.metrics.custom[category] || {};
    this.metrics.custom[category][name] = value;
  }
  
  /**
   * Save metrics to file
   * @param {string} outputDir - Directory to save the metrics
   * @param {string} filename - Optional filename override
   */
  async saveMetrics(outputDir, filename) {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const variant = this.metrics.test.variant;
      const actualFilename = filename || `${variant}-test-metrics-${timestamp}.json`;
      
      await fs.mkdir(outputDir, { recursive: true });
      const filePath = path.join(outputDir, actualFilename);
      
      await fs.writeFile(filePath, JSON.stringify(this.metrics, null, 2));
      return filePath;
    } catch (error) {
      console.error('Failed to save metrics:', error);
      return null;
    }
  }
  
  /**
   * Get a summary of the test metrics
   */
  getSummary() {
    return {
      variant: this.metrics.test.variant,
      variantName: this.metrics.test.variantName,
      duration: this.metrics.test.duration,
      stages: Object.keys(this.metrics.stages).map(stage => ({
        name: stage,
        duration: this.metrics.stages[stage].duration,
        count: this.metrics.stages[stage].count
      })),
      apiCalls: this.metrics.apiCalls ? this.summarizeApiCalls() : {},
      errors: this.metrics.errors.length,
      timestamp: this.metrics.startTime
    };
  }
  
  /**
   * Create a summary of API calls
   */
  summarizeApiCalls() {
    if (!this.metrics.apiCalls) return {};
    
    const summary = {};
    Object.keys(this.metrics.apiCalls).forEach(service => {
      summary[service] = {};
      Object.keys(this.metrics.apiCalls[service]).forEach(operation => {
        const data = this.metrics.apiCalls[service][operation];
        summary[service][operation] = {
          count: data.count,
          totalDuration: data.totalDuration,
          avgDuration: data.totalDuration / data.count
        };
      });
    });
    
    return summary;
  }
  
  /**
   * Get full metrics data
   */
  getMetrics() {
    return this.metrics;
  }
}

export default MetricsCollector;
