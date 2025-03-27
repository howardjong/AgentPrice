
/**
 * Component Loader Test
 * Tests the lazy component loading functionality
 */
import { setTimeout } from 'timers/promises';

// Import utilities
let componentLoader;

// Mock components for testing
const createMockComponent = (name, delay = 100, shouldFail = false) => {
  return async () => {
    console.log(`Loading component ${name}...`);
    
    // Simulate network/processing delay
    await setTimeout(delay);
    
    if (shouldFail) {
      throw new Error(`Mock failure loading component ${name}`);
    }
    
    const component = {
      name,
      initialize: async () => {
        console.log(`Initializing component ${name}...`);
        await setTimeout(100);
        console.log(`Component ${name} initialized`);
      },
      cleanup: () => {
        console.log(`Cleaning up component ${name}...`);
      },
      doWork: () => {
        return `${name} is working!`;
      }
    };
    
    return { default: component };
  };
};

// Test 1: Load components sequentially
const testSequentialLoading = async () => {
  console.log('\nTest 1: Sequential Component Loading');
  
  try {
    // Define import functions for three components
    const componentA = createMockComponent('A', 300);
    const componentB = createMockComponent('B', 200);
    const componentC = createMockComponent('C', 100);
    
    console.log('Loading components sequentially...');
    const startTime = Date.now();
    
    // Load one by one
    const a = await componentLoader.load('componentA', componentA, { initialize: true });
    console.log(`Component A result: ${a.doWork()}`);
    
    const b = await componentLoader.load('componentB', componentB, { initialize: true });
    console.log(`Component B result: ${b.doWork()}`);
    
    const c = await componentLoader.load('componentC', componentC, { initialize: true });
    console.log(`Component C result: ${c.doWork()}`);
    
    const duration = Date.now() - startTime;
    console.log(`Sequential loading completed in ${duration}ms`);
    console.log('Component stats:', componentLoader.getStats());
  } catch (error) {
    console.error('Error in sequential loading test:', error);
  }
};

// Test 2: Load components in parallel
const testParallelLoading = async () => {
  console.log('\nTest 2: Parallel Component Loading');
  
  try {
    // Unload previous components
    componentLoader.unloadAll();
    
    // Define import functions
    const componentD = createMockComponent('D', 300);
    const componentE = createMockComponent('E', 200);
    const componentF = createMockComponent('F', 100);
    
    console.log('Loading components in parallel...');
    const startTime = Date.now();
    
    // Load all at once
    const components = await componentLoader.loadMultiple({
      componentD,
      componentE,
      componentF
    }, { initialize: true });
    
    const duration = Date.now() - startTime;
    
    Object.entries(components).forEach(([id, component]) => {
      console.log(`${id} result: ${component.doWork()}`);
    });
    
    console.log(`Parallel loading completed in ${duration}ms`);
    console.log('Component stats:', componentLoader.getStats());
  } catch (error) {
    console.error('Error in parallel loading test:', error);
  }
};

// Test 3: Error handling
const testErrorHandling = async () => {
  console.log('\nTest 3: Error Handling');
  
  try {
    // Unload previous components
    componentLoader.unloadAll();
    
    // Define import functions
    const componentG = createMockComponent('G', 100);
    const componentH = createMockComponent('H', 100, true); // This one will fail
    const componentI = createMockComponent('I', 100);
    
    console.log('Loading components with one failure...');
    
    // Try loading the failing component
    try {
      await componentLoader.load('componentH', componentH);
      console.log('Component H loaded (this should not happen)');
    } catch (error) {
      console.log(`Caught error as expected: ${error.message}`);
    }
    
    // Load multiple with failFast: false
    console.log('Loading multiple components with error tolerance...');
    const results = await componentLoader.loadMultiple({
      componentG,
      componentH,
      componentI
    }, { failFast: false });
    
    console.log('Results with error tolerance:');
    Object.entries(results).forEach(([id, component]) => {
      if (component) {
        console.log(`${id}: Loaded successfully - ${component.doWork()}`);
      } else {
        console.log(`${id}: Failed to load`);
      }
    });
    
    console.log('Component stats after error handling:', componentLoader.getStats());
  } catch (error) {
    console.error('Unexpected error in error handling test:', error);
  }
};

// Test 4: Component reuse
const testComponentReuse = async () => {
  console.log('\nTest 4: Component Reuse');
  
  try {
    // Unload previous components
    componentLoader.unloadAll();
    
    // Define import functions
    const componentJ = createMockComponent('J', 300);
    
    // First load
    console.log('First load of component J...');
    const startTime1 = Date.now();
    const j1 = await componentLoader.load('componentJ', componentJ, { initialize: true });
    const duration1 = Date.now() - startTime1;
    console.log(`First load completed in ${duration1}ms: ${j1.doWork()}`);
    
    // Second load (should be instant)
    console.log('Second load of component J (should reuse)...');
    const startTime2 = Date.now();
    const j2 = await componentLoader.load('componentJ', componentJ);
    const duration2 = Date.now() - startTime2;
    console.log(`Second load completed in ${duration2}ms: ${j2.doWork()}`);
    
    // Verify it's the same instance
    console.log(`Same instance: ${j1 === j2}`);
    
    console.log('Component stats after reuse test:', componentLoader.getStats());
  } catch (error) {
    console.error('Error in component reuse test:', error);
  }
};

// Main test sequence
const runTests = async () => {
  try {
    console.log('Importing component loader...');
    const module = await import('../../utils/componentLoader.js');
    componentLoader = module.default;
    
    if (!componentLoader) {
      throw new Error('Component loader not loaded correctly');
    }
    
    // Run the test scenarios
    await testSequentialLoading();
    await testParallelLoading();
    await testErrorHandling();
    await testComponentReuse();
    
    // Final cleanup
    componentLoader.unloadAll();
    console.log('\nComponent loader tests completed');
  } catch (error) {
    console.error('Error running component loader tests:', error);
  }
};

// Run the tests
console.log('Starting component loader tests...');
runTests().catch(console.error);
