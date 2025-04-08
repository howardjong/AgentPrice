# Memory Optimization Guide

This document explains the memory optimization capabilities we've implemented to improve the performance and resource efficiency of the application.

## Overview

Our memory optimization system includes:

1. **Resource Manager**: Manages system resources and optimizes connection pools
2. **Memory Leak Detector**: Monitors memory growth to detect potential leaks
3. **Memory Relief Tool**: Provides on-demand memory optimization
4. **Health Check Integration**: Enhanced health endpoints with memory status
5. **CLI Utility**: Command-line tool to check and optimize memory usage

## Memory Management Components

### Resource Manager

The Resource Manager (`utils/resourceManager.js`) provides these capabilities:

- Connection pool management to prevent resource leaks
- Periodic cleanup of idle connections
- Memory usage monitoring
- Automatic resource optimization when thresholds are exceeded

### Memory Leak Detector

The Memory Leak Detector (`utils/memoryLeakDetector.js`) provides:

- Memory growth monitoring to detect potential leaks
- Baseline memory snapshot comparison
- Automatic garbage collection triggering when needed
- Alert mechanism for memory growth beyond thresholds

### Memory Optimization Module

The Memory Optimization module (`server/memory-optimization.js`) integrates the above components and provides:

- Initialization of memory optimization with configurable settings
- Memory relief operations to free up memory
- Memory status reporting
- Garbage collection operations (when available)

## Available Endpoints

The server exposes these memory-related endpoints:

### Memory Status Endpoint

```
GET /api/system/memory-status
```

Returns detailed information about current memory usage, including:
- Heap usage metrics
- Resource manager status
- Memory leak detection status
- Overall memory optimization status

Example response:
```json
{
  "status": "success",
  "currentUsage": {
    "heapUsedMB": 65,
    "heapTotalMB": 100,
    "rssMB": 120,
    "externalMB": 5,
    "usagePercent": 65
  },
  "resourceManager": {
    "isActive": true,
    "connectionPoolCount": 2,
    "totalConnections": 5,
    "activeConnections": 2
  },
  "memoryLeakDetector": {
    "isMonitoring": true,
    "leaksDetected": 0,
    "lastCheckAt": "2025-04-08T06:30:00.000Z"
  },
  "optimization": {
    "status": "normal",
    "uptime": 3600,
    "gcAvailable": true
  },
  "timestamp": "2025-04-08T06:35:00.000Z"
}
```

### Memory Relief Endpoint

```
POST /api/system/memory-relief
Body: { "aggressive": true|false }
```

Triggers memory optimization operations to free up memory. The `aggressive` parameter determines the intensity of the optimization.

Example response:
```json
{
  "status": "success",
  "message": "Memory relief operations completed successfully",
  "details": {
    "before": {
      "heapUsedMB": 85,
      "rssMB": 130
    },
    "after": {
      "heapUsedMB": 60,
      "rssMB": 120
    },
    "reduction": {
      "heapMB": 25,
      "rssMB": 10,
      "percent": 29
    },
    "timestamp": "2025-04-08T06:40:00.000Z"
  },
  "timestamp": "2025-04-08T06:40:00.000Z"
}
```

### Enhanced Health Endpoints

We've enhanced the existing health endpoints with memory optimization information:

```
GET /api/health
GET /api/assistant/health
```

These now include additional memory details and resource management status.

## Command-Line Utility

The `optimize-memory.js` script provides a CLI for memory management:

```bash
# Check memory status
node optimize-memory.js status

# Run memory optimization (standard)
node optimize-memory.js optimize

# Run aggressive memory optimization
node optimize-memory.js optimize --aggressive

# Get more detailed output
node optimize-memory.js status --verbose

# Output in JSON format
node optimize-memory.js status --json

# Save results to a log file
node optimize-memory.js optimize --save
```

## Memory Testing Script

A test script is available to validate memory optimization capabilities:

```bash
node tests/manual/test-memory-optimization.js
```

This script:
1. Checks the initial memory status
2. Allocates memory to simulate high usage
3. Tests standard memory relief
4. Allocates more memory
5. Tests aggressive memory relief
6. Reports the results

## Configuration Options

The memory optimization system can be configured with different settings:

```javascript
// Initialize with standard settings
memoryOptimization.initializeMemoryOptimization();

// Initialize with low memory mode
memoryOptimization.initializeMemoryOptimization({
  lowMemoryMode: true,
  gcInterval: 300000, // 5 minutes
  monitoringInterval: 60000 // 1 minute
});

// Initialize with aggressive settings
memoryOptimization.initializeMemoryOptimization({
  enableAggressive: true,
  lowMemoryMode: true,
  gcInterval: 60000 // 1 minute
});
```

## Best Practices

1. **Regular Monitoring**: Use the `/api/system/memory-status` endpoint or CLI tool to monitor memory usage.

2. **Proactive Relief**: Apply memory optimization when usage exceeds 70% of available heap:
   ```bash
   node optimize-memory.js optimize
   ```

3. **Aggressive Mode**: Use aggressive optimization only when memory usage is critical:
   ```bash
   node optimize-memory.js optimize --aggressive
   ```

4. **Regular GC**: If your Node.js runtime supports garbage collection, enable it with:
   ```bash
   node --expose-gc <script>
   ```

5. **Memory Leak Prevention**: Monitor the leak detection count regularly:
   ```bash
   node optimize-memory.js status | grep "Leaks detected"
   ```