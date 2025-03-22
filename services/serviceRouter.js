/**
 * Service Router for intelligent routing between LLM services
 */
import logger from '../utils/logger.js';
import claudeService from './claudeService.js';
import perplexityService from './perplexityService.js';

class ServiceRouter {
  constructor() {
    logger.info('Service Router initialized');
    
    // Keywords that suggest the need for web research
    this.researchKeywords = [
      'search', 'research', 'find', 'latest', 'recent', 'news',
      'current', 'today', 'information about', 'data on',
      'search the web', 'look up', 'what is', 'who is'
    ];
    
    // Keywords that suggest the need for visualization
    this.visualizationKeywords = [
      'visualize', 'chart', 'graph', 'plot', 'diagram',
      'display', 'visualization', 'show me', 'create a chart',
      'generate a graph', 'data visualization'
    ];
  }

  /**
   * Determine the best service to use for a given message
   * @param {string} message - The user message to analyze
   * @param {string} [explicitService] - Optional explicitly requested service
   * @returns {string} The service to use ('claude' or 'perplexity')
   */
  determineService(message, explicitService) {
    // If a service is explicitly specified, use it
    if (explicitService) {
      logger.info(`Using explicitly requested service: ${explicitService}`);
      return explicitService.toLowerCase();
    }
    
    // Check if research is needed based on keywords
    const needsResearch = this.researchKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Check if visualization is needed based on keywords
    const needsVisualization = this.visualizationKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Make a decision based on the analysis
    if (needsResearch && !needsVisualization) {
      logger.info('Router determined research is needed, routing to Perplexity');
      return 'perplexity';
    } else {
      logger.info('Router determined general processing/visualization is needed, routing to Claude');
      return 'claude';
    }
  }

  /**
   * Route the message to the appropriate service
   * @param {Array} messages - Array of message objects with role and content
   * @param {string} [service] - Optional explicitly requested service
   * @returns {Promise<Object>} The response from the chosen service
   */
  async routeMessage(messages, service) {
    if (!messages || messages.length === 0) {
      logger.error('No messages provided for routing');
      return {
        status: 'error',
        message: 'No messages provided',
        error: 'Empty message array'
      };
    }
    
    // Get the last user message
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) {
      logger.error('No user message found in the conversation');
      return {
        status: 'error',
        message: 'No user message found',
        error: 'No user role in messages'
      };
    }
    
    // Determine which service to use
    const serviceToUse = service || this.determineService(lastUserMessage.content);
    
    try {
      if (serviceToUse === 'perplexity') {
        // Check if Perplexity service is available
        if (!perplexityService.isConnected) {
          logger.warn('Perplexity service not available, falling back to Claude');
          return claudeService.processConversation(messages);
        }
        logger.info('Routing message to Perplexity service');
        return perplexityService.performResearch(messages);
      } else {
        // Default to Claude
        logger.info('Routing message to Claude service');
        return claudeService.processConversation(messages);
      }
    } catch (error) {
      logger.error(`Error in service routing: ${error.message}`);
      return {
        status: 'error',
        message: `Service routing error: ${error.message}`,
        error: error.message
      };
    }
  }
}

// Create and export a singleton instance
const serviceRouter = new ServiceRouter();
export default serviceRouter;