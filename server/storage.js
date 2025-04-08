/**
 * Storage Interface Definition
 * 
 * This file defines the storage interface that all storage implementations must implement.
 * It provides a consistent API for database operations regardless of the underlying storage technology.
 * 
 * Note: This is a JavaScript-compatible version of the original TypeScript interface.
 */

/**
 * Factory function to create a storage instance based on environment configuration
 */
export async function createStorage(type = 'memory') {
  if (type === 'postgres') {
    // Dynamic import to avoid circular dependencies
    const pgStorageModule = await import('./pg-storage.js');
    const dbModule = await import('./db.js');
    return new pgStorageModule.PostgresStorage(dbModule.db);
  } else {
    // Default to memory storage
    const memoryModule = await import('./memory-storage.js');
    return new memoryModule.MemoryStorage();
  }
}

// Directly import MemoryStorage for initial instance
import { MemoryStorage } from './memory-storage.js';
export const storage = new MemoryStorage();

// Initialize the proper storage asynchronously
(async () => {
  try {
    const properStorage = await createStorage(process.env.STORAGE_TYPE);
    // Replace all methods in the storage instance with the proper ones
    Object.getOwnPropertyNames(Object.getPrototypeOf(properStorage))
      .filter(prop => typeof properStorage[prop] === 'function' && prop !== 'constructor')
      .forEach(method => {
        storage[method] = properStorage[method].bind(properStorage);
      });
    console.log(`Storage initialized with type: ${process.env.STORAGE_TYPE || 'memory'}`);
  } catch (error) {
    console.error('Failed to initialize storage:', error);
  }
})();