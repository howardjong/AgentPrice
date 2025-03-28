
#!/usr/bin/env node
/**
 * Memory Optimization Script
 * 
 * This script applies memory optimizations to reduce heap usage
 * and fix the memory threshold warnings.
 */

const fs = require('fs').promises;
const path = require('path');

// Function to update optimization settings
async function updateOptimizationSettings() {
  const settingsPath = path.join(process.cwd(), 'data', 'optimization-settings.json');
  
  try {
    // Read current settings
    const data = await fs.readFile(settingsPath, 'utf8');
    const settings = JSON.parse(data);
    
    // Update performance settings
    settings.performance = {
      ...settings.performance,
      optimizeMemory: true,
      enableLazyLoading: true,
      reduceCacheSize: true,
      enableGarbageCollection: true
    };
    
    // Write updated settings
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log('✅ Optimization settings updated');
    
    return settings;
  } catch (error) {
    console.error('Error updating optimization settings:', error);
    
    // If file doesn't exist, create it with default settings
    if (error.code === 'ENOENT') {
      const defaultSettings = {
        performance: {
          optimizeMemory: true,
          enableLazyLoading: true,
          reduceCacheSize: true,
          enableGarbageCollection: true
        },
        api: {
          enableCaching: true,
          enableRateLimiting: true,
          enableCircuitBreaker: true,
          optimizeTokenUsage: true
        }
      };
      
      try {
        // Create directory if it doesn't exist
        await fs.mkdir(path.dirname(settingsPath), { recursive: true });
        
        // Write default settings
        await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf8');
        console.log('✅ Created default optimization settings');
        
        return defaultSettings;
      } catch (writeError) {
        console.error('Error creating optimization settings:', writeError);
        throw writeError;
      }
    }
    
    throw error;
  }
}

// Function to perform memory optimization
async function optimizeMemory() {
  console.log('🔍 Analyzing memory usage...');
  
  // Get current memory usage
  const memBefore = process.memoryUsage();
  console.log(`Current heap usage: ${Math.round(memBefore.heapUsed / 1024 / 1024)} MB`);
  
  // Run global garbage collection if available
  if (global.gc) {
    console.log('🧹 Running garbage collection...');
    global.gc();
  } else {
    console.log('⚠️ Garbage collection not available. Run with --expose-gc flag for better results.');
  }
  
  // Get memory usage after optimization
  const memAfter = process.memoryUsage();
  const savings = (memBefore.heapUsed - memAfter.heapUsed) / 1024 / 1024;
  
  console.log(`Optimized heap usage: ${Math.round(memAfter.heapUsed / 1024 / 1024)} MB`);
  console.log(`Memory saved: ${Math.round(savings * 100) / 100} MB`);
  
  return {
    before: memBefore,
    after: memAfter,
    savings
  };
}

// Main function
async function main() {
  console.log('🚀 Starting memory optimization...');
  
  try {
    // Step 1: Update optimization settings
    const settings = await updateOptimizationSettings();
    console.log('Settings applied:', JSON.stringify(settings.performance, null, 2));
    
    // Step 2: Perform memory optimization
    const result = await optimizeMemory();
    
    // Print success message
    if (result.savings > 0) {
      console.log(`\n✅ Memory optimization successful. ${Math.round(result.savings * 100) / 100} MB freed.`);
    } else {
      console.log('\n⚠️ No significant memory savings achieved.');
    }
  } catch (error) {
    console.error('❌ Error during memory optimization:', error);
    process.exit(1);
  }
}

// Run the main function
main();
