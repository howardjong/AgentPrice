/**
 * Test Component Loader
 * 
 * This test demonstrates how the component loader optimizes memory usage
 * by lazy loading components and unloading inactive ones.
 */

import componentLoader from '../../utils/componentLoader.js';
import logger from '../../utils/logger.js';

// Simulate heavy components with factory functions that return a Promise
// to match the expected API of componentLoader
async function createHeavyComponent(name, size = 1000) {
  // Create a component with simulated memory usage
  const component = {
    name,
    // Simulate memory usage with large arrays
    data: new Array(size * 1000).fill(0).map(() => Math.random().toString(36)),
    
    process() {
      logger.debug(`Component ${name} processing data (${this.data.length} items)`);
      return `Processed by ${name}`;
    },
    
    cleanup() {
      logger.debug(`Component ${name} cleanup called`);
      this.data = null;
    }
  };
  
  logger.debug(`Component ${name} created with ${size}K items`);
  return component;
}

// Factory function wrappers that return async functions
const componentFactories = {
  'component1': () => createHeavyComponent('Component1', 1),
  'component2': () => createHeavyComponent('Component2', 2),
  'component3': () => createHeavyComponent('Component3', 3),
  'component4': () => createHeavyComponent('Component4', 4),
  'component5': () => createHeavyComponent('Component5', 5)
};

// Configure component loader for testing
componentLoader.configure({
  lazyLoad: true,
  unloadThreshold: 5000, // 5 seconds (for demo)
  preloadCritical: false
});

async function runComponentTest() {
  console.log('\n======================================');
  console.log('       COMPONENT LOADER TEST          ');
  console.log('======================================\n');
  
  console.log('Registering components...');
  
  // Clear any existing components first
  componentLoader.unloadAll();
  
  // Register components
  for (const [name, factory] of Object.entries(componentFactories)) {
    componentLoader.register(name, async () => {
      return await factory();
    }, {
      critical: name === 'component1', // Only Component1 is critical
      lazy: true
    });
  }
  
  // Log initial state
  console.log('\nInitial state:');
  const initialStats = componentLoader.getStats();
  console.log(`- Registered components: ${Object.keys(componentFactories).length}`);
  console.log(`- Currently loaded: ${initialStats.loaded}`);
  
  console.log('\nLoading components sequentially to demonstrate lazy loading...');
  
  // Load component 1
  console.log('\n1. Loading component1...');
  const comp1 = await componentLoader.get('component1');
  if (comp1) {
    const result = comp1.process();
    console.log(`   Result: ${result}`);
  } else {
    console.log('   Component not loaded, loading now...');
    const loadedComp1 = await componentLoader.load('component1', 
      async () => await componentFactories['component1']());
    const result = loadedComp1.process();
    console.log(`   Result: ${result}`);
  }
  
  // Check stats
  let stats = componentLoader.getStats();
  console.log(`Components loaded: ${stats.loaded}`);
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Load component 2
  console.log('\n2. Loading component2...');
  const comp2 = await componentLoader.load('component2', 
    async () => await componentFactories['component2']());
  const result2 = comp2.process();
  console.log(`   Result: ${result2}`);
  
  // Check stats
  stats = componentLoader.getStats();
  console.log(`Components loaded: ${stats.loaded}`);
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Load component 3
  console.log('\n3. Loading component3...');
  const comp3 = await componentLoader.load('component3', 
    async () => await componentFactories['component3']());
  const result3 = comp3.process();
  console.log(`   Result: ${result3}`);
  
  // Check stats
  stats = componentLoader.getStats();
  console.log(`Components loaded: ${stats.loaded}`);
  
  console.log('\nWaiting for unload threshold (6 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  // Manually check components
  console.log('\nAfter waiting:');
  console.log('Component1 still loaded:', componentLoader.isLoaded('component1'));
  console.log('Component2 still loaded:', componentLoader.isLoaded('component2'));
  console.log('Component3 still loaded:', componentLoader.isLoaded('component3'));
  
  // Force unload of inactive components
  console.log('\nForcing unload of inactive components...');
  const unloaded = componentLoader.unloadInactive(['component1']); // Keep component1
  console.log(`Unloaded ${unloaded} components`);
  
  // Final stats after forced unload
  stats = componentLoader.getStats();
  console.log('\nFinal state:');
  console.log(`Components still loaded: ${stats.loaded}`);
  
  // Verify remaining components
  console.log('Component1 still loaded after force unload:', componentLoader.isLoaded('component1'));
  console.log('Component2 still loaded after force unload:', componentLoader.isLoaded('component2'));
  console.log('Component3 still loaded after force unload:', componentLoader.isLoaded('component3'));
  
  console.log('\n======================================');
  console.log('          TEST COMPLETE              ');
  console.log('======================================');
}

runComponentTest().catch(error => {
  console.error('Error running component test:', error);
});