
import redisClient from './redisService.js';
import logger from '../utils/logger.js';
import { performance } from 'perf_hooks';

const CONTEXT_EXPIRY = 60 * 60 * 24; // 24 hours in seconds

/**
 * Context Manager for handling user session context
 * Uses Redis or in-memory storage based on configuration
 */
class ContextManager {
  constructor() {
    this.prefix = 'context:';
  }
  
  /**
   * Store context data for a session
   * @param {string} sessionId - Unique session identifier
   * @param {Object} context - Context data to store
   * @returns {Promise<boolean>} - Success indicator
   */
  async storeContext(sessionId, context) {
    try {
      const start = performance.now();
      const serialized = JSON.stringify(context);
      const key = `${this.prefix}${sessionId}`;
      
      // Use Redis client (real or in-memory)
      const client = await redisClient.getClient();
      await client.set(key, serialized, 'EX', CONTEXT_EXPIRY);
      
      const duration = performance.now() - start;
      logger.debug(`Stored context for ${sessionId}`, { 
        sessionId, 
        contextSize: serialized.length,
        duration: `${duration.toFixed(2)}ms`
      });
      
      return true;
    } catch (error) {
      logger.error('Error storing context', { 
        sessionId, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Retrieve context data for a session
   * @param {string} sessionId - Unique session identifier
   * @returns {Promise<Object|null>} - Retrieved context or null if not found
   */
  async getContext(sessionId) {
    try {
      const start = performance.now();
      const key = `${this.prefix}${sessionId}`;
      
      // Use Redis client (real or in-memory)
      const client = await redisClient.getClient();
      const data = await client.get(key);
      
      const duration = performance.now() - start;
      
      if (duration > 100) {
        logger.warn('Slow context retrieval', { 
          sessionId, 
          duration: `${duration.toFixed(2)}ms`
        });
      }
      
      if (!data) {
        logger.debug('Context not found', { sessionId });
        return null;
      }
      
      logger.debug('Retrieved context', { 
        sessionId, 
        contextSize: data.length,
        duration: `${duration.toFixed(2)}ms`
      });
      
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error retrieving context', { 
        sessionId, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Update context data for a session using an updater function
   * @param {string} sessionId - Unique session identifier
   * @param {Function} updater - Function that takes current context and returns updated context
   * @returns {Promise<Object>} - Updated context
   */
  async updateContext(sessionId, updater) {
    try {
      // Get current context
      const context = await this.getContext(sessionId) || {};
      
      // Apply updater function
      const updatedContext = updater(context);
      
      // Store updated context
      await this.storeContext(sessionId, updatedContext);
      
      return updatedContext;
    } catch (error) {
      logger.error('Error updating context', { 
        sessionId, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Delete context data for a session
   * @param {string} sessionId - Unique session identifier
   * @returns {Promise<boolean>} - Success indicator
   */
  async deleteContext(sessionId) {
    try {
      const key = `${this.prefix}${sessionId}`;
      
      // Use Redis client (real or in-memory)
      const client = await redisClient.getClient();
      await client.del(key);
      
      logger.debug(`Deleted context for ${sessionId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting context', { 
        sessionId, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * List all active sessions
   * @param {number} limit - Maximum number of sessions to return
   * @param {number} offset - Starting offset for pagination
   * @returns {Promise<Array<string>>} - List of session IDs
   */
  async listSessions(limit = 100, offset = 0) {
    try {
      // Use Redis client (real or in-memory)
      const client = await redisClient.getClient();
      const keys = await client.keys(`${this.prefix}*`);
      
      const sessions = keys
        .map(key => key.substring(this.prefix.length))
        .slice(offset, offset + limit);
      
      return sessions;
    } catch (error) {
      logger.error('Error listing sessions', { error: error.message });
      throw error;
    }
  }
}

const contextManager = new ContextManager();
export default contextManager;
