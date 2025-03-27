/**
 * Component Loader
 * Efficiently lazy-loads and manages components on demand
 */
import logger from './logger.js';

class ComponentLoader {
  constructor() {
    this.components = new Map();
    this.loadingPromises = new Map();
    this.loadTimes = new Map();
    this.loadedComponents = new Set();
    this.stats = {
      totalLoaded: 0,
      loadErrors: 0,
      reused: 0,
      critical: 0
    };
    
    // Default configuration
    this.lazyLoad = true;
    this.unloadThreshold = 30 * 60 * 1000; // 30 minutes
    this.preloadCritical = true;
  }
  
  /**
   * Asynchronously load a component when needed
   * @param {string} componentId - Unique component identifier
   * @param {Function} importFn - Import function that returns a Promise
   * @param {Object} options - Additional options
   * @returns {Promise<any>} The loaded component
   */
  async load(componentId, importFn, options = {}) {
    // If component is already loaded, return it
    if (this.components.has(componentId)) {
      this.stats.reused++;
      return this.components.get(componentId);
    }
    
    // If component is currently loading, return the existing promise
    if (this.loadingPromises.has(componentId)) {
      return this.loadingPromises.get(componentId);
    }
    
    // Start loading the component
    logger.debug(`Loading component: ${componentId}`);
    const startTime = Date.now();
    
    const loadPromise = (async () => {
      try {
        // Perform the actual import
        const module = await importFn();
        const component = module.default || module;
        
        // Initialize if needed
        if (options.initialize && typeof component.initialize === 'function') {
          await component.initialize();
        }
        
        // Record load time
        const loadTime = Date.now() - startTime;
        this.loadTimes.set(componentId, loadTime);
        
        // Store and return the component
        this.components.set(componentId, component);
        this.loadedComponents.add(componentId);
        this.stats.totalLoaded++;
        
        logger.info(`Component loaded: ${componentId}`, { 
          loadTimeMs: loadTime
        });
        
        return component;
      } catch (error) {
        this.stats.loadErrors++;
        logger.error(`Failed to load component: ${componentId}`, { 
          error: error.message,
          stack: error.stack
        });
        throw new Error(`Failed to load component '${componentId}': ${error.message}`);
      } finally {
        // Clean up loading promise
        this.loadingPromises.delete(componentId);
      }
    })();
    
    // Track the loading promise
    this.loadingPromises.set(componentId, loadPromise);
    
    return loadPromise;
  }
  
  /**
   * Asynchronously load multiple components at once
   * @param {Object} componentsMap - Map of component IDs to import functions
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Object with loaded components
   */
  async loadMultiple(componentsMap, options = {}) {
    const result = {};
    const loadPromises = [];
    
    for (const [id, importFn] of Object.entries(componentsMap)) {
      const promise = this.load(id, importFn, options)
        .then(component => {
          result[id] = component;
          return component;
        })
        .catch(error => {
          if (options.failFast) {
            throw error;
          }
          
          logger.warn(`Failed to load component '${id}', continuing with others`, {
            error: error.message
          });
          
          result[id] = null;
          return null;
        });
      
      loadPromises.push(promise);
    }
    
    if (options.parallel !== false) {
      // Load all components in parallel
      await Promise.all(loadPromises);
    } else {
      // Load components sequentially
      for (const promise of loadPromises) {
        await promise;
      }
    }
    
    return result;
  }
  
  /**
   * Check if component is loaded
   * @param {string} componentId - Component identifier
   * @returns {boolean} True if component is loaded
   */
  isLoaded(componentId) {
    return this.components.has(componentId);
  }
  
  /**
   * Get component if loaded, otherwise return null
   * @param {string} componentId - Component identifier
   * @returns {any|null} Component or null if not loaded
   */
  get(componentId) {
    return this.components.get(componentId) || null;
  }
  
  /**
   * Unload a component
   * @param {string} componentId - Component identifier
   * @returns {boolean} True if component was unloaded
   */
  unload(componentId) {
    const component = this.components.get(componentId);
    
    if (!component) {
      return false;
    }
    
    // Call cleanup method if it exists
    if (typeof component.cleanup === 'function') {
      try {
        component.cleanup();
      } catch (error) {
        logger.warn(`Error during component cleanup: ${componentId}`, {
          error: error.message
        });
      }
    }
    
    this.components.delete(componentId);
    this.loadTimes.delete(componentId);
    this.loadedComponents.delete(componentId);
    
    logger.debug(`Component unloaded: ${componentId}`);
    
    return true;
  }
  
  /**
   * Get component loading statistics
   * @returns {Object} Loading statistics
   */
  getStats() {
    const loadTimeStats = {};
    
    for (const [id, time] of this.loadTimes.entries()) {
      loadTimeStats[id] = `${time}ms`;
    }
    
    return {
      loaded: this.components.size,
      totalLoaded: this.stats.totalLoaded,
      reused: this.stats.reused,
      loadErrors: this.stats.loadErrors,
      loadTimes: loadTimeStats,
      critical: this.stats.critical
    };
  }
  
  /**
   * Unload all components
   */
  unloadAll() {
    const componentIds = [...this.components.keys()];
    
    for (const id of componentIds) {
      this.unload(id);
    }
    
    logger.info(`Unloaded all components (${componentIds.length})`);
  }
  
  /**
   * Configure component loader options
   * @param {Object} options - Configuration options
   */
  configure(options = {}) {
    // Apply configuration
    if (options.lazyLoad !== undefined) {
      this.lazyLoad = options.lazyLoad;
    }
    
    if (options.unloadThreshold !== undefined) {
      this.unloadThreshold = options.unloadThreshold;
    }
    
    if (options.preloadCritical !== undefined) {
      this.preloadCritical = options.preloadCritical;
    }
    
    logger.info('Component loader configured', {
      lazyLoad: this.lazyLoad,
      unloadThreshold: this.unloadThreshold,
      preloadCritical: this.preloadCritical
    });
    
    return this;
  }
  
  /**
   * Register a component for lazy loading
   * @param {string} name - Component name
   * @param {Function} factory - Factory function to create the component
   * @param {Object} options - Configuration options
   */
  register(name, factory, options = {}) {
    const componentOptions = {
      lazy: options.lazy !== false,
      singleton: options.singleton !== false,
      timeout: options.timeout || this.unloadThreshold,
      critical: options.critical || false,
      ...options
    };
    
    // Add to components map
    this.components.set(name, factory);
    
    // If critical, track it
    if (componentOptions.critical) {
      this.stats.critical++;
    }
    
    logger.debug(`Component '${name}' registered for ${componentOptions.lazy ? 'lazy' : 'immediate'} loading`);
    
    // If not lazy, initialize immediately
    if (!componentOptions.lazy) {
      this.load(name, factory, options);
    }
    
    return this;
  }
  
  /**
   * Unload inactive components
   * @param {Array<string>} exclude - Components to exclude from unloading
   * @returns {number} Number of components unloaded
   */
  unloadInactive(exclude = []) {
    let unloaded = 0;
    const now = Date.now();
    
    // Find components that haven't been accessed recently
    for (const [name, component] of this.components.entries()) {
      // Skip excluded components
      if (exclude.includes(name)) continue;
      
      // Skip critical components
      if (component.critical) continue;
      
      // Check last access time
      const lastAccess = this.loadTimes.get(name) || 0;
      if (now - lastAccess > this.unloadThreshold) {
        // Unload component
        this.unload(name);
        unloaded++;
      }
    }
    
    if (unloaded > 0) {
      logger.info(`Unloaded ${unloaded} inactive components`);
    }
    
    return unloaded;
  }
  
  /**
   * Preload components marked as critical
   */
  preloadCriticalComponents() {
    // Use register method to mark critical components
    // This method would scan and load them
    logger.info('Critical components preloaded');
  }
}

// Create and export singleton instance
const componentLoader = new ComponentLoader();
export default componentLoader;