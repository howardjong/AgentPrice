
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
    this.stats = {
      totalLoaded: 0,
      loadErrors: 0,
      reused: 0
    };
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
      loadTimes: loadTimeStats
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
}

const componentLoader = new ComponentLoader();
export default componentLoader;
/**
 * Component Loader Utility
 * Provides lazy loading for service components to reduce memory usage
 */
import logger from './logger.js';

class ComponentLoader {
  constructor() {
    this.components = new Map();
    this.loadedComponents = new Set();
    this.loadTimes = new Map();
  }
  
  /**
   * Register a component for lazy loading
   * @param {string} name - Component name
   * @param {Function} factory - Factory function to create the component
   * @param {Object} options - Configuration options
   */
  register(name, factory, options = {}) {
    this.components.set(name, {
      factory,
      instance: null,
      options: {
        lazy: options.lazy !== false,
        singleton: options.singleton !== false,
        timeout: options.timeout || 30 * 60 * 1000, // Default unload after 30 minutes
        critical: options.critical || false,
        ...options
      }
    });
    
    logger.debug(`Component '${name}' registered for ${options.lazy !== false ? 'lazy' : 'immediate'} loading`);
    
    // If not lazy, initialize immediately
    if (options.lazy === false) {
      this.get(name);
    }
    
    return this;
  }
  
  /**
   * Get or create a component instance
   * @param {string} name - Component name
   * @returns {Object} The component instance
   */
  get(name) {
    if (!this.components.has(name)) {
      throw new Error(`Component '${name}' is not registered`);
    }
    
    const component = this.components.get(name);
    
    // If already instantiated and singleton, return the instance
    if (component.instance && component.options.singleton) {
      this.updateLastAccess(name);
      return component.instance;
    }
    
    // Create new instance
    const startTime = Date.now();
    try {
      const instance = component.factory();
      
      // If singleton, store the instance
      if (component.options.singleton) {
        component.instance = instance;
        this.loadedComponents.add(name);
      }
      
      // Record load time
      const loadTime = Date.now() - startTime;
      this.loadTimes.set(name, loadTime);
      
      logger.debug(`Component '${name}' loaded in ${loadTime}ms`);
      this.updateLastAccess(name);
      
      return instance;
    } catch (error) {
      logger.error(`Error loading component '${name}'`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Update the last access time for a component
   * @param {string} name - Component name
   */
  updateLastAccess(name) {
    const component = this.components.get(name);
    if (component) {
      component.lastAccess = Date.now();
    }
  }
  
  /**
   * Unload non-critical components to free memory
   * @param {Array<string>} exclude - Components to exclude from unloading
   * @returns {number} Number of components unloaded
   */
  unloadInactive(exclude = []) {
    const now = Date.now();
    let unloaded = 0;
    
    for (const [name, component] of this.components.entries()) {
      // Skip if explicitly excluded
      if (exclude.includes(name)) continue;
      
      // Skip critical components
      if (component.options.critical) continue;
      
      // Skip if no instance
      if (!component.instance) continue;
      
      // Skip if still in use
      const lastAccess = component.lastAccess || 0;
      if (now - lastAccess < component.options.timeout) continue;
      
      // Unload the component
      this.unload(name);
      unloaded++;
    }
    
    if (unloaded > 0) {
      logger.info(`Unloaded ${unloaded} inactive components`);
    }
    
    return unloaded;
  }
  
  /**
   * Unload a specific component
   * @param {string} name - Component name
   * @returns {boolean} True if unloaded, false if not found or critical
   */
  unload(name) {
    if (!this.components.has(name)) return false;
    
    const component = this.components.get(name);
    
    // Cannot unload critical components
    if (component.options.critical) {
      logger.warn(`Cannot unload critical component '${name}'`);
      return false;
    }
    
    // If it has a destroy method, call it
    if (component.instance && typeof component.instance.destroy === 'function') {
      try {
        component.instance.destroy();
      } catch (error) {
        logger.error(`Error destroying component '${name}'`, { error: error.message });
      }
    }
    
    // Remove the instance
    component.instance = null;
    this.loadedComponents.delete(name);
    
    logger.debug(`Component '${name}' unloaded`);
    return true;
  }
  
  /**
   * Get statistics about loaded components
   * @returns {Object} Component statistics
   */
  getStats() {
    const stats = {
      registered: this.components.size,
      loaded: this.loadedComponents.size,
      loadTimes: {},
      critical: 0
    };
    
    // Count critical components and collect load times
    for (const [name, component] of this.components.entries()) {
      if (component.options.critical) {
        stats.critical++;
      }
      
      const loadTime = this.loadTimes.get(name);
      if (loadTime) {
        stats.loadTimes[name] = `${loadTime}ms`;
      }
    }
    
    return stats;
  }
  
  /**
   * Preload specific components
   * @param {Array<string>} names - Component names to preload
   */
  preload(names) {
    const preloaded = [];
    
    for (const name of names) {
      if (!this.components.has(name)) {
        logger.warn(`Cannot preload unknown component '${name}'`);
        continue;
      }
      
      if (!this.loadedComponents.has(name)) {
        this.get(name);
        preloaded.push(name);
      }
    }
    
    if (preloaded.length > 0) {
      logger.info(`Preloaded ${preloaded.length} components: ${preloaded.join(', ')}`);
    }
    
    return preloaded;
  }
}

const componentLoader = new ComponentLoader();
export default componentLoader;
