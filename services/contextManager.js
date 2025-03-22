
import redisClient from './redisClient.js';
import logger from '../utils/logger.js';
import { performance } from 'perf_hooks';

const CONTEXT_EXPIRY = 60 * 60 * 24; // 24 hours in seconds

class ContextManager {
  constructor() {
    this.prefix = 'context:';
  }
  
  async storeContext(sessionId, context) {
    try {
      const start = performance.now();
      const serialized = JSON.stringify(context);
      const key = `${this.prefix}${sessionId}`;
      
      await redisClient.getClient().set(
        key,
        serialized,
        'EX',
        CONTEXT_EXPIRY
      );
      
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
  
  async getContext(sessionId) {
    try {
      const start = performance.now();
      const key = `${this.prefix}${sessionId}`;
      const data = await redisClient.getClient().get(key);
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
  
  async deleteContext(sessionId) {
    try {
      const key = `${this.prefix}${sessionId}`;
      await redisClient.getClient().del(key);
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
  
  async listSessions(limit = 100, offset = 0) {
    try {
      const keys = await redisClient.getClient().keys(`${this.prefix}*`);
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
