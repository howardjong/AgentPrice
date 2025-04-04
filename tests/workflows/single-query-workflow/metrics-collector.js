/**
 * Workflow Test Metrics Collector
 * 
 * This module collects and analyzes metrics from workflow test runs,
 * providing consistent measurement across test variants and modes.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class MetricsCollector {
  constructor(options = {}) {
    this.metrics = {
      test: {
        startTime: Date.now(),
        endTime: null,
        duration: 0,
        variant: options.variant || 'basic',
        mode: options.useRealAPIs ? 'realAPI' : 'mock',
        query: options.query || ''
      },
      stages: {},
      apiCalls: {},
      memory: this.captureMemoryUsage(),
      errors: []
    };

    this.outputDir = options.outputDir || path.join(process.cwd(), 'test-results', 'single-query-workflow');
  }

  /**
   * Start timing a specific stage of the workflow
   */
  startStage(stageName) {
    if (!this.metrics.stages[stageName]) {
      this.metrics.stages[stageName] = {};
    }

    this.metrics.stages[stageName].start = Date.now();
    return this;
  }

  /**
   * End timing for a specific stage and calculate duration
   */
  endStage(stageName) {
    if (this.metrics.stages[stageName]) {
      this.metrics.stages[stageName].end = Date.now();
      this.metrics.stages[stageName].duration = 
        this.metrics.stages[stageName].end - this.metrics.stages[stageName].start;
    }
    return this;
  }

  /**
   * Record an API call to a specific service
   */
  recordApiCall(service, operation, details = {}) {
    if (!this.metrics.apiCalls[service]) {
      this.metrics.apiCalls[service] = {};
    }

    if (!this.metrics.apiCalls[service][operation]) {
      this.metrics.apiCalls[service][operation] = {
        count: 0,
        totalDuration: 0,
        details: []
      };
    }

    const entry = this.metrics.apiCalls[service][operation];
    entry.count++;

    if (details.duration) {
      entry.totalDuration += details.duration;
    }

    if (Object.keys(details).length > 0) {
      entry.details.push({
        timestamp: Date.now(),
        ...details
      });
    }

    return this;
  }

  /**
   * Record an error that occurred during testing
   */
  recordError(stage, error) {
    this.metrics.errors.push({
      stage,
      timestamp: Date.now(),
      message: error.message || String(error),
      stack: error.stack,
      code: error.code
    });
    return this;
  }

  /**
   * Record token usage for a specific API call
   */
  recordTokenUsage(service, model, promptTokens, completionTokens, cost = null) {
    if (!this.metrics.tokenUsage) {
      this.metrics.tokenUsage = [];
    }

    this.metrics.tokenUsage.push({
      timestamp: Date.now(),
      service,
      model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      cost
    });

    return this;
  }

  /**
   * Capture current memory usage
   */
  captureMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    return {
      rss: memoryUsage.rss,              // Resident Set Size - total memory allocated
      heapTotal: memoryUsage.heapTotal,  // Total size of allocated heap
      heapUsed: memoryUsage.heapUsed,    // Actual memory used during execution
      external: memoryUsage.external,    // Memory used by C++ objects bound to JS
      arrayBuffers: memoryUsage.arrayBuffers // Memory used by ArrayBuffers and SharedArrayBuffers
    };
  }

  /**
   * Update memory metrics at the end of the test
   */
  updateMemoryMetrics() {
    this.metrics.memoryEnd = this.captureMemoryUsage();
    this.metrics.memoryDelta = {
      rss: this.metrics.memoryEnd.rss - this.metrics.memory.rss,
      heapTotal: this.metrics.memoryEnd.heapTotal - this.metrics.memory.heapTotal,
      heapUsed: this.metrics.memoryEnd.heapUsed - this.metrics.memory.heapUsed
    };
    return this;
  }

  /**
   * Complete metrics collection and calculate final results
   */
  complete() {
    this.metrics.test.endTime = Date.now();
    this.metrics.test.duration = this.metrics.test.endTime - this.metrics.test.startTime;
    this.updateMemoryMetrics();

    // Calculate stage percentages of total time
    const totalDuration = this.metrics.test.duration;
    Object.keys(this.metrics.stages).forEach(stageName => {
      const stage = this.metrics.stages[stageName];
      if (stage.duration) {
        stage.percentOfTotal = (stage.duration / totalDuration) * 100;
      }
    });

    // Generate summary statistics
    this.metrics.summary = {
      totalDuration: this.metrics.test.duration,
      stageCount: Object.keys(this.metrics.stages).length,
      apiCallCount: this.getTotalApiCalls(),
      errorCount: this.metrics.errors.length,
      success: this.metrics.errors.length === 0,
      timestamp: new Date().toISOString()
    };

    if (this.metrics.tokenUsage) {
      this.metrics.summary.totalTokens = this.metrics.tokenUsage.reduce(
        (sum, usage) => sum + usage.totalTokens, 0
      );
    }

    return this.metrics;
  }

  /**
   * Get total API calls across all services
   */
  getTotalApiCalls() {
    let total = 0;

    Object.keys(this.metrics.apiCalls).forEach(service => {
      Object.keys(this.metrics.apiCalls[service]).forEach(operation => {
        total += this.metrics.apiCalls[service][operation].count;
      });
    });

    return total;
  }

  /**
   * Save metrics to a file
   */
  async saveMetrics(customFilename = null) {
    try {
      // Ensure output directory exists
      await fs.mkdir(this.outputDir, { recursive: true });

      const variant = this.metrics.test.variant;
      const mode = this.metrics.test.mode;
      const timestamp = new Date().toISOString().replace(/:/g, '-');

      const filename = customFilename || 
        `${variant}-${mode}-${timestamp}.json`;

      const filePath = path.join(this.outputDir, filename);

      await fs.writeFile(
        filePath,
        JSON.stringify(this.metrics, null, 2)
      );

      return {
        path: filePath,
        filename
      };
    } catch (error) {
      console.error('Failed to save metrics:', error);
      return null;
    }
  }
}

module.exports = MetricsCollector;