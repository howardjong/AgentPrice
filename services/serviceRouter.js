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
  determineService(message, explicitService, options = {}) {
    // If deep research is confirmed, use Perplexity with deep research settings
    if (options.confirmDeepResearch) {
      return { 
        service: 'perplexity',
        mode: 'deep',
        estimatedTime: '15-30 minutes'
      };
    }

    // If a service is explicitly specified, use it (but verify it's available)
    if (explicitService) {
      const requestedService = explicitService.toLowerCase();
      
      // Check if explicitly requesting Perplexity but it's not available
      if (requestedService === 'perplexity' && !perplexityService.isConnected) {
        logger.warn('User explicitly requested Perplexity but service is not available, falling back to Claude');
        return 'claude';
      }
      
      logger.info(`Using explicitly requested service: ${requestedService}`);
      return requestedService;
    }
    
    // First check if Perplexity is available at all before deciding
    if (!perplexityService.isConnected) {
      logger.info('Perplexity service not available, automatically routing to Claude');
      return 'claude';
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
      logger.info('Research query detected, should confirm deep research');
      return {
        service: 'needs_confirmation',
        suggestedAction: 'deep_research',
        message: 'This query may benefit from deep, comprehensive research which can take up to 30 minutes. Would you like to proceed with in-depth research?'
      };
    } else {
      logger.info('Router determined general processing/visualization is needed, routing to Claude');
      return {
        service: 'claude',
        mode: 'default'
      };
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
      // Validate service parameter before using it
      const validatedService = typeof serviceToUse === 'object' ? 
        serviceToUse.service || 'claude' : 
        serviceToUse || 'claude';
        
      if (validatedService === 'perplexity') {
        // Check if Perplexity service is available
        if (!perplexityService.isConnected) {
          logger.warn('Perplexity service not available, falling back to Claude with research instructions');
          
          // Prepare enhanced messages for Claude to handle research request
          const enhancedMessages = [...messages];
          
          // Find the last user message to enhance
          const lastUserIndex = enhancedMessages.findLastIndex(m => m.role === 'user');
          
          if (lastUserIndex !== -1) {
            // Add a note about Perplexity service being unavailable
            enhancedMessages[lastUserIndex].content = 
              `${enhancedMessages[lastUserIndex].content}\n\n[Note: This is a research question, but real-time internet search is currently unavailable. Please provide the most accurate information you have as of your training data.]`;
            
            // Add a system message at the beginning with research instructions
            enhancedMessages.unshift({
              role: 'system',
              content: 'You are acting as a research assistant. The user is asking for information that would ideally be researched with real-time internet access, but that capability is currently unavailable. Please:\n1. Provide the most accurate information you have from your training data\n2. Clearly state when information might be outdated or when you're uncertain\n3. Suggest follow-up questions the user could ask to narrow down or clarify their research\n4. If applicable, suggest reliable sources the user could consult for more up-to-date information'
            });
          }
          
          // Use Claude with enhanced research-focused instructions
          logger.info('Using Claude with research-focused instructions');
          return claudeService.processConversation(enhancedMessages);
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
      
      // If Perplexity fails, fall back to Claude with an explanation
      if (serviceToUse === 'perplexity') {
        logger.info('Perplexity service failed, falling back to Claude with explanation');
        
        // Create a modified message array for Claude
        const fallbackMessages = [...messages];
        const lastUserIndex = fallbackMessages.findLastIndex(m => m.role === 'user');
        
        if (lastUserIndex !== -1) {
          // Add a note about the fallback
          fallbackMessages[lastUserIndex].content = 
            `${fallbackMessages[lastUserIndex].content}\n\n[Note: The research service encountered an error. Providing information based on available knowledge.]`;
        }
        
        // Add a system message explaining the situation
        fallbackMessages.unshift({
          role: 'system',
          content: 'The user requested information that would normally be researched with real-time internet access, but that service encountered an error. Please provide your best response based on your training data, acknowledging any limitations in the currency of your information.'
        });
        
        try {
          return claudeService.processConversation(fallbackMessages);
        } catch (claudeError) {
          logger.error(`Fallback to Claude also failed: ${claudeError.message}`);
          return {
            status: 'error',
            message: 'Both services failed to process the request',
            error: `Original error: ${error.message}. Claude fallback error: ${claudeError.message}`
          };
        }
      }
      
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