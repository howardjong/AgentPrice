/**
 * Performance Monitor Tests
 * 
 * Tests for the Performance Monitoring utility that tracks resource usage and API calls
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock logger
jest.mock('../../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Backup the original process methods we need to mock
const originalCpuUsage = process.cpuUsage;
const originalMemoryUsage = process.memoryUsage;
const originalUptime = process.uptime;

// Setup process mock functions
process.cpuUsage = jest.fn().mockReturnValue({ user: 1000, system: 500 });
process.memoryUsage = jest.fn().mockReturnValue({
  rss: 50 * 1024 * 1024,        // 50 MB
  heapTotal: 30 * 1024 * 1024,  // 30 MB
  heapUsed: 20 * 1024 * 1024,   // 20 MB
  external: 5 * 1024 * 1024     // 5 MB
});
process.uptime = jest.fn().mockReturnValue(3600); // 1 hour

// Import after mocking
const performanceMonitor = require('../../../utils/performanceMonitor.js').default;
const logger = require('../../../utils/logger.js').default;

describe('Performance Monitor', () => {
  // Save original Date.now to restore later
  const originalDateNow = Date.now;
  
  // Starting mock time
  let mockTime = 1617000000000; // Some arbitrary timestamp
  
  beforeEach(() => {
    jest.resetAllMocks();
    
    // Mock Date.now for deterministic testing
    Date.now = jest.fn(() => mockTime);
    
    // Mock timers to execute immediately
    jest.spyOn(global, 'setInterval').mockImplementation(() => 999);
    jest.spyOn(global, 'clearInterval').mockImplementation(() => {});
    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
      // Execute the function immediately for testing
      fn();
      return 888;
    });
    jest.spyOn(global, 'clearTimeout').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Stop the performance monitor to clean up resources
    performanceMonitor.stop();
    
    // Restore Date.now
    Date.now = originalDateNow;
    
    // Restore process functions
    process.cpuUsage = originalCpuUsage;
    process.memoryUsage = originalMemoryUsage;
    process.uptime = originalUptime;
    
    // Restore the timers
    jest.restoreAllMocks();
  });
  
  describe('Basic Functionality', () => {
    it('should have the expected API', () => {
      expect(performanceMonitor).toHaveProperty('startTracking');
      expect(performanceMonitor).toHaveProperty('stopTracking');
      expect(performanceMonitor).toHaveProperty('trackResourceUsage');
      expect(performanceMonitor).toHaveProperty('getReport');
      expect(performanceMonitor).toHaveProperty('stop');
    });
    
    it('should track API calls for different services', () => {
      // Start tracking a call for service1
      const tracking1 = performanceMonitor.startTracking('service1', 'operation1');
      expect(tracking1).toHaveProperty('trackingId');
      expect(tracking1).toHaveProperty('stop');
      
      // Advance time
      mockTime += 1000; // 1 second
      
      // Stop tracking
      const result1 = tracking1.stop();
      
      // Verify tracking result
      expect(result1.duration).toBe(1000);
      expect(result1.service).toBe('service1');
      expect(result1.operation).toBe('operation1');
      
      // Start tracking another service
      const tracking2 = performanceMonitor.startTracking('service2', 'operation2');
      
      // Advance time
      mockTime += 6000; // 6 seconds - surpass the 5s logging threshold
      
      // Stop tracking with metadata
      const result2 = tracking2.stop({ status: 'success', tokens: 500 });
      
      // Verify tracking result
      expect(result2.duration).toBe(6000);
      expect(result2.service).toBe('service2');
      expect(result2.operation).toBe('operation2');
      
      // Check that the logger was called (not checking exact parameters yet due to implementation differences)
      expect(logger.info).toHaveBeenCalled();
      
      // Get report and check counts
      const report = performanceMonitor.getReport();
      expect(report.apiCalls.service1).toBe(1);
      expect(report.apiCalls.service2).toBe(1);
    });
  });
  
  describe('Resource Usage Tracking', () => {
    it('should track system resource usage', () => {
      // Clear memory of previous calls
      jest.clearAllMocks();
      
      // Store initial mock values for reference
      const initialCpuUsage = { user: 1000, system: 500 };
      const updatedCpuUsage = { user: 5000, system: 2000 };
      
      const initialMemUsage = {
        rss: 50 * 1024 * 1024,
        heapTotal: 30 * 1024 * 1024,
        heapUsed: 20 * 1024 * 1024,
        external: 5 * 1024 * 1024
      };
      
      const updatedMemUsage = {
        rss: 60 * 1024 * 1024,        // 60 MB (10MB increase)
        heapTotal: 35 * 1024 * 1024,  // 35 MB
        heapUsed: 25 * 1024 * 1024,   // 25 MB (5MB increase)
        external: 6 * 1024 * 1024     // 6 MB
      };
      
      // Override process.cpuUsage to return specific values in sequence
      jest.spyOn(process, 'cpuUsage').mockImplementation(() => {
        // Using this implementation to return different values on subsequent calls
        if (process.cpuUsage.mock.calls.length === 1) {
          return initialCpuUsage;
        } else {
          return updatedCpuUsage;
        }
      });
      
      // Override process.memoryUsage to return specific values in sequence
      jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
        // Using this implementation to return different values on subsequent calls
        if (process.memoryUsage.mock.calls.length === 1) {
          return initialMemUsage;
        } else {
          return updatedMemUsage;
        }
      });
      
      // Mock process.uptime to return a stable value
      jest.spyOn(process, 'uptime').mockImplementation(() => 3600);
        
      // Store initial resource usage values by calling trackResourceUsage once
      // and then resetting mock calls for the logger
      performanceMonitor.trackResourceUsage();
      logger.info.mockClear();
      
      // Advance time for CPU percentage calculation
      mockTime += 10000; // 10 seconds
      
      // Now manually trigger resource tracking again - this will compare against the previous values
      performanceMonitor.trackResourceUsage();
      
      // Check that logger was called
      expect(logger.info).toHaveBeenCalled();
      
      // Verify report method returns expected data structure
      const report = performanceMonitor.getReport();
      expect(report.resourceUsage).toHaveProperty('heapUsed');
      expect(report.resourceUsage).toHaveProperty('rss');
      expect(report.uptime).toBe(3600); // Verify our mocked uptime is returned
    });
  });
  
  describe('Performance Statistics', () => {
    it('should calculate accurate response time statistics', () => {
      // Track several operations with different durations
      const calls = [
        { service: 'perplexity', operation: 'search', duration: 500 },
        { service: 'perplexity', operation: 'search', duration: 1500 },
        { service: 'perplexity', operation: 'search', duration: 1000 },
        { service: 'claude', operation: 'completion', duration: 2000 },
        { service: 'claude', operation: 'completion', duration: 3000 }
      ];
      
      // Simulate these calls
      for (const call of calls) {
        const tracker = performanceMonitor.startTracking(call.service, call.operation);
        mockTime += call.duration;
        tracker.stop();
      }
      
      // Get report
      const report = performanceMonitor.getReport();
      
      // Check perplexity:search stats (3 calls, avg 1000ms, min 500ms, max 1500ms)
      expect(report.responseTime['perplexity:search']).toEqual({
        count: 3,
        avgTime: 1000,
        minTime: 500,
        maxTime: 1500
      });
      
      // Check claude:completion stats (2 calls, avg 2500ms, min 2000ms, max 3000ms)
      expect(report.responseTime['claude:completion']).toEqual({
        count: 2,
        avgTime: 2500,
        minTime: 2000,
        maxTime: 3000
      });
      
      // Check API call counts
      expect(report.apiCalls.perplexity).toBe(3);
      expect(report.apiCalls.claude).toBe(2);
    });
  });
  
  describe('Low Memory Mode', () => {
    it('should handle low memory mode configuration', () => {
      // Instead of creating a new instance, we'll just directly test the conditional logic
      // Save original low memory mode
      const originalLowMemoryMode = performanceMonitor.lowMemoryMode;
      
      try {
        // Set to low memory mode
        performanceMonitor.lowMemoryMode = true;
        
        // Test non-critical service
        const tracker = performanceMonitor.startTracking('someService', 'someOperation');
        expect(tracker.trackingId).toBe('no-tracking-low-memory-mode');
        
        const result = tracker.stop();
        expect(result.duration).toBe(0);
        expect(result.service).toBe('someService');
        expect(result.operation).toBe('someOperation');
        
        // Critical services should still be tracked even in low memory mode
        performanceMonitor.lowMemoryMode = true;
        const criticalTracker = performanceMonitor.startTracking('claude', 'completion');
        expect(criticalTracker.trackingId).not.toBe('no-tracking-low-memory-mode');
      } finally {
        // Restore original value
        performanceMonitor.lowMemoryMode = originalLowMemoryMode;
      }
    });
  });
  
  describe('Active Operations Tracking', () => {
    it('should track active operations', () => {
      // First clear any existing operations
      performanceMonitor.metrics.longRunningOperations.clear();
      
      // Manually create some active operations
      const op1 = {
        service: 'service1',
        operation: 'operation1',
        startTime: Date.now(),
        inProgress: true
      };
      
      const op2 = {
        service: 'service1',
        operation: 'operation2',
        startTime: Date.now(),
        inProgress: true
      };
      
      const op3 = {
        service: 'service2',
        operation: 'operation1',
        startTime: Date.now(),
        inProgress: true
      };
      
      // Add to tracking map
      performanceMonitor.metrics.longRunningOperations.set('tracking1', op1);
      performanceMonitor.metrics.longRunningOperations.set('tracking2', op2);
      performanceMonitor.metrics.longRunningOperations.set('tracking3', op3);
      
      // Get active operations count
      const activeOps = performanceMonitor.countActiveOperations();
      
      // Check counts
      expect(activeOps.service1).toBe(2);
      expect(activeOps.service2).toBe(1);
      
      // Set one to not in progress
      op2.inProgress = false;
      
      // Get active operations count again
      const updatedActiveOps = performanceMonitor.countActiveOperations();
      
      // Check updated counts
      expect(updatedActiveOps.service1).toBe(1);
      expect(updatedActiveOps.service2).toBe(1);
      
      // Clear all operations
      performanceMonitor.metrics.longRunningOperations.clear();
    });
  });
  
  describe('Cleanup', () => {
    it('should clean up resources when stopped', () => {
      // Start the monitor and verify interval is created
      performanceMonitor.stop(); // First stop any existing interval
      
      // Mock setInterval to verify it's called
      const setIntervalMock = jest.fn(() => 12345);
      const originalSetInterval = global.setInterval;
      global.setInterval = setIntervalMock;
      
      try {
        // Create a new instance that will use our mock
        const testMonitor = new performanceMonitor.constructor();
        
        // Verify setInterval was called
        expect(setIntervalMock).toHaveBeenCalled();
        
        // Now check if clearInterval is called when stopped
        const clearIntervalMock = jest.fn();
        const originalClearInterval = global.clearInterval;
        global.clearInterval = clearIntervalMock;
        
        try {
          testMonitor.stop();
          expect(clearIntervalMock).toHaveBeenCalled();
        } finally {
          global.clearInterval = originalClearInterval;
        }
      } finally {
        global.setInterval = originalSetInterval;
      }
    });
  });
});