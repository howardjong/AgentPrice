
/**
 * Memory Leak Analysis Test
 * Tests the memory leak detector by simulating different memory patterns
 */
import { setTimeout } from 'timers/promises';

// Import utilities
let memoryLeakDetector;

// Helper to create large objects that consume memory
const createLargeObjects = (count, size) => {
  const objects = [];
  for (let i = 0; i < count; i++) {
    // Create a large string that takes up memory
    const obj = {
      id: i,
      data: 'x'.repeat(size),
      timestamp: new Date()
    };
    objects.push(obj);
  }
  return objects;
};

// Test 1: Normal memory usage pattern
const testNormalUsage = async () => {
  console.log('Test 1: Normal memory usage pattern');
  
  // Create some objects
  let objects = [];
  
  // Add and remove objects in a balanced way
  for (let i = 0; i < 5; i++) {
    const newObjects = createLargeObjects(20, 1000);
    objects.push(...newObjects);
    console.log(`Added 20 objects, total: ${objects.length}`);
    
    // Wait 1 second between operations
    await setTimeout(1000);
    
    // Remove some objects
    const removed = objects.splice(0, 15);
    console.log(`Removed 15 objects, total: ${objects.length}`);
    
    // Explicitly null out removed objects to help GC
    removed.forEach((obj, index) => {
      removed[index] = null;
    });
    
    await setTimeout(1000);
  }
  
  // Cleanup all objects
  objects.forEach((obj, index) => {
    objects[index] = null;
  });
  objects = null;
  
  console.log('Normal usage test complete - memory should be stable');
  await setTimeout(2000);
};

// Test 2: Simulate a memory leak pattern
const testMemoryLeak = async () => {
  console.log('Test 2: Simulating a memory leak pattern');
  
  // Global array that will continuously grow
  const leakyArray = [];
  
  // Add objects without removing them
  for (let i = 0; i < 5; i++) {
    const newObjects = createLargeObjects(100, 10000);
    leakyArray.push(...newObjects);
    console.log(`Added 100 objects, total: ${leakyArray.length}`);
    
    // Wait to allow memory detector to take samples
    await setTimeout(1000);
  }
  
  console.log('Memory leak simulation complete - memory usage should have increased');
  await setTimeout(2000);
  
  // Now clean up to avoid actual memory issues
  while (leakyArray.length > 0) {
    leakyArray.splice(0, 100);
  }
  console.log('Cleaned up simulated leak');
};

// Test 3: Complex pattern with closures
const testComplexPattern = async () => {
  console.log('Test 3: Testing complex memory pattern with closures');
  
  const closures = [];
  
  // Create closures that reference large objects
  for (let i = 0; i < 3; i++) {
    const largeData = createLargeObjects(50, 5000);
    
    // Create a closure that captures the large data
    const closure = () => {
      return largeData.length;
    };
    
    closures.push(closure);
    console.log(`Created closure ${i+1} referencing 50 large objects`);
    await setTimeout(1000);
  }
  
  console.log('Complex pattern test complete');
  await setTimeout(2000);
};

// Main test sequence
const runTests = async () => {
  try {
    console.log('Importing memory leak detector...');
    const module = await import('../../utils/memoryLeakDetector.js');
    memoryLeakDetector = module.default;
    
    if (!memoryLeakDetector) {
      throw new Error('Memory leak detector not loaded correctly');
    }
    
    console.log('Starting memory leak detector...');
    // Configure with faster sampling for testing
    memoryLeakDetector.sampleInterval = 1000;
    memoryLeakDetector.growthThreshold = 5;
    memoryLeakDetector.consecutiveGrowthLimit = 3;
    memoryLeakDetector.start();
    
    // Wait for initial samples
    console.log('Collecting baseline samples...');
    await setTimeout(3000);
    
    // Run the test scenarios
    await testNormalUsage();
    await testMemoryLeak();
    await testComplexPattern();
    
    // Display final report
    console.log('\nFinal memory analysis report:');
    console.log(JSON.stringify(memoryLeakDetector.getReport(), null, 2));
    
    // Stop the detector
    memoryLeakDetector.stop();
    console.log('Memory leak analysis tests completed');
  } catch (error) {
    console.error('Error running memory leak tests:', error);
  }
};

// Run the tests
console.log('Starting memory leak analysis tests...');
runTests().catch(console.error);
