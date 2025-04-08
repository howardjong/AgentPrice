# Memory Optimization System

This document explains how to use the memory optimization tools in this project.

## Overview

We've implemented a comprehensive memory management system that includes:

1. **Automatic threshold-based memory optimization** - Automatically triggers memory relief when memory usage exceeds configurable thresholds
2. **Memory relief API endpoints** - Allow manual triggering of memory optimization
3. **Memory status monitoring** - Provides detailed memory usage information
4. **CLI tool for memory management** - Command-line interface for memory operations
5. **Test utilities** - Scripts to test memory optimization and simulate memory pressure

## Memory Thresholds

The memory optimization system monitors memory usage and automatically triggers optimization when these thresholds are hit:

- **Warning Threshold (70%)** - Logs a warning when memory usage exceeds this level
- **Action Threshold (80%)** - Automatically triggers standard memory optimization 
- **Critical Threshold (90%)** - Triggers aggressive memory optimization with more intensive cleanup

## Using the CLI Tool

The `optimize-memory.js` script provides a command-line interface for memory management:

```bash
# Check memory status
node optimize-memory.js status

# Run standard memory optimization
node optimize-memory.js optimize

# Run aggressive memory optimization (more intensive)
node optimize-memory.js optimize --aggressive

# Get more detailed output
node optimize-memory.js status --verbose

# Output in JSON format
node optimize-memory.js status --json

# Save results to a log file
node optimize-memory.js optimize --save
```

## Memory API Endpoints

The following API endpoints are available for memory management:

### Memory Status Endpoint

```
GET /api/system/memory-status
```

Returns detailed information about current memory usage.

### Memory Relief Endpoint

```
POST /api/system/memory-relief
Body: { "aggressive": true|false }
```

Triggers memory optimization operations. The `aggressive` parameter determines the intensity of the optimization.

### Memory Threshold Configuration Endpoint

```
POST /api/system/memory-thresholds
Body: { "warning": number, "action": number, "critical": number }
```

Updates the memory threshold settings. All values are optional but must be between 0 and 100.

## Test Scripts

### Memory Optimization Test

Tests the memory optimization and relief capabilities by making requests to the memory endpoints:

```bash
node tests/manual/test-memory-optimization.js
```

This script will:
1. Check initial memory status
2. Allocate memory for testing
3. Run standard optimization
4. Allocate more memory
5. Run aggressive optimization
6. Report results

### Memory Pressure Simulator

Simulates memory pressure by allocating memory blocks over time to test the automatic threshold-based optimization:

```bash
node tests/manual/simulate-memory-pressure.js
```

This script will:
1. Gradually allocate memory until it reaches a target usage percentage (85% by default)
2. Periodically check memory status
3. Automatically pause/resume allocation based on memory usage
4. Report when optimization actions occur

## Configuration Options

When initializing the memory optimization system, you can provide these options:

```javascript
// Initialize with custom settings
initializeMemoryOptimization({
  // Enable/disable automatic optimization when thresholds are exceeded
  autoOptimize: true,
  
  // Set memory mode (affects default thresholds)
  lowMemoryMode: false,
  
  // Configure custom memory thresholds (percentages)
  memoryThresholds: {
    WARNING: 70,
    ACTION: 80,
    CRITICAL: 90
  },
  
  // Enable more aggressive optimizations from the start
  enableAggressive: false,
  
  // Intervals for various operations (milliseconds)
  gcInterval: 300000,      // 5 minutes between GC runs
  monitoringInterval: 60000 // 1 minute between memory checks
})
```

## Troubleshooting Memory Issues

If your application is experiencing memory issues:

1. **Check Current Memory Status**:
   ```bash
   node optimize-memory.js status --verbose
   ```

2. **Run Manual Optimization**:
   ```bash
   node optimize-memory.js optimize --aggressive
   ```

3. **Lower Memory Thresholds**:
   Use the `/api/system/memory-thresholds` endpoint to set lower thresholds:
   ```bash
   curl -X POST http://localhost:5000/api/system/memory-thresholds \
     -H "Content-Type: application/json" \
     -d '{"warning": 60, "action": 70, "critical": 80}'
   ```

4. **Test for Memory Leaks**:
   Run the memory pressure simulator to see if memory is properly released:
   ```bash
   node tests/manual/simulate-memory-pressure.js
   ```

5. **Check Memory Leak Detection**:
   Look for leak detection in the memory status:
   ```bash
   node optimize-memory.js status | grep "leaksDetected"
   ```