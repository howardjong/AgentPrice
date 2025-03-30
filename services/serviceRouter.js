/**
 * Service Router
 * 
 * Intelligently routes requests between Claude and Perplexity services based on the request type,
 * need for internet-connected information, and current service health.
 */

const claudeService = require('./claudeService');
const perplexityService = require('./perplexityService');
const jobManager = require('./jobManager');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const costTracker = require('../utils/costTracker');

// Default model selections
const MODELS = {
  // Claude models
  claude: {
    default: 'claude-3-7-sonnet-20250219', // Latest model as of knowledge cutoff
    highQuality: 'claude-3-7-sonnet-20250219',
    standard: 'claude-3-7-sonnet-20250219',
    fast: 'claude-3-7-haiku-20250219',
  },
  // Perplexity models
  perplexity: {
    default: perplexityService.SONAR_MODELS.small,
    highQuality: perplexityService.SONAR_MODELS.large,
    standard: perplexityService.SONAR_MODELS.small,
    fast: perplexityService.SONAR_MODELS.small,
  }
};

// Configure routing rules
const ROUTING_CONFIG = {
  // Default behavior - prioritize low cost
  defaultRoutingStrategy: 'cost-optimized',
  
  // Weighting factors for intelligent routing
  routingFactors: {
    needsInternetInfo: 0.9, // High weight for internet-connected info
    isResearch: 0.8,        // High weight for research tasks
    isVisualizing: 0.7,     // High weight for visualization tasks
    isConversational: 0.5,  // Medium weight for conversational context
    isAnalyzing: 0.6,       // Medium-high weight for analysis
  },
  
  // Feature support by service
  serviceCapabilities: {
    claude: {
      internetAccess: false,
      multimodal: true,
      visualization: true,
      longContext: true,
      conversationMemory: true
    },
    perplexity: {
      internetAccess: true,
      multimodal: false,
      visualization: false,
      longContext: true,
      conversationMemory: true
    }
  },
  
  // Cost tier multipliers
  costTierMultipliers: {
    fast: 0.5,       // Fastest, cheapest option
    standard: 1.0,   // Standard pricing
    highQuality: 1.5 // Higher quality, higher cost
  }
};

/**
 * Analyze request to determine the best service to use
 * @param {Object} request - The request to analyze
 * @param {Object} options - Routing options
 * @returns {Object} - Analysis results with service recommendation
 */
function analyzeRequest(request, options = {}) {
  const routingStrategy = options.routingStrategy || ROUTING_CONFIG.defaultRoutingStrategy;
  const requestType = request.type || 'text';
  const features = request.features || {};
  
  // Starting scores
  let scores = {
    claude: 0,
    perplexity: 0
  };
  
  // Check for forced routing
  if (options.forceService) {
    logger.info(`Forcing service selection to ${options.forceService}`);
    return {
      selectedService: options.forceService,
      reason: 'Forced service selection',
      scores
    };
  }
  
  // Apply basic feature requirements
  
  // If internet info needed, strongly prefer Perplexity
  if (features.needsInternetInfo) {
    scores.perplexity += ROUTING_CONFIG.routingFactors.needsInternetInfo;
    
    // If it's a research task, further boost Perplexity
    if (features.isResearch) {
      scores.perplexity += ROUTING_CONFIG.routingFactors.isResearch;
    }
  }
  
  // If visualization is needed, prefer Claude
  if (features.isVisualizing) {
    scores.claude += ROUTING_CONFIG.routingFactors.isVisualizing;
  }
  
  // If it has images, must use Claude
  if (requestType === 'multimodal') {
    scores.claude = 1; // Force Claude for multimodal
    scores.perplexity = 0;
  }
  
  // Apply routing strategy adjustments
  if (routingStrategy === 'cost-optimized') {
    // In cost-optimized mode, give small boost to the generally cheaper option
    scores.perplexity += 0.1;
  } else if (routingStrategy === 'quality-optimized') {
    // In quality-optimized mode, give boost to Claude for general tasks
    if (!features.needsInternetInfo) {
      scores.claude += 0.2;
    }
  }
  
  // Select service with highest score
  const selectedService = scores.claude > scores.perplexity ? 'claude' : 'perplexity';
  let reason = `Selected based on request analysis (${selectedService} score: ${scores[selectedService].toFixed(2)})`;
  
  // Handle special cases with mandatory routing
  if (requestType === 'multimodal') {
    reason = 'Multimodal requests require Claude';
  } else if (features.needsInternetInfo && features.isResearch) {
    reason = 'Research with internet access requires Perplexity';
  }
  
  return {
    selectedService,
    reason,
    scores
  };
}

/**
 * Process a text or query request through the appropriate service
 * @param {string} text - The text or query to process
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Response from the selected service
 */
async function processText(text, options = {}) {
  const requestId = options.requestId || uuidv4();
  const startTime = Date.now();
  
  try {
    // Determine if the request needs internet information
    const needsInternetInfo = options.needsInternetInfo || false;
    
    // Analyze request to select appropriate service
    const analysis = analyzeRequest(
      { 
        type: 'text',
        features: {
          needsInternetInfo,
          isResearch: options.isResearch || false,
          isVisualizing: options.isVisualizing || false
        }
      }, 
      {
        routingStrategy: options.routingStrategy,
        forceService: options.forceService
      }
    );
    
    const selectedService = analysis.selectedService;
    
    logger.info(`Routing text request to ${selectedService}`, {
      requestId,
      reason: analysis.reason,
      needsInternetInfo,
      textLength: text.length
    });
    
    // Select appropriate model based on quality tier
    const qualityTier = options.qualityTier || 'standard';
    const model = options.model || MODELS[selectedService][qualityTier] || MODELS[selectedService].default;
    
    // Set default max tokens based on request length
    const defaultMaxTokens = text.length > 4000 ? 2048 : 1024;
    const maxTokens = options.maxTokens || defaultMaxTokens;
    
    // Route to appropriate service
    let response;
    
    if (selectedService === 'claude') {
      response = await claudeService.processText(text, {
        model,
        maxTokens,
        temperature: options.temperature || 0.7
      });
    } else {
      // For Perplexity, use web query if internet info needed, otherwise conversation
      if (needsInternetInfo) {
        response = await perplexityService.processWebQuery(text, {
          model,
          maxTokens,
          temperature: options.temperature || 0.2,
          systemPrompt: options.systemPrompt,
          recencyFilter: options.recencyFilter || 'month',
          domainFilter: options.domainFilter || []
        });
      } else {
        // For non-internet queries, set up a simple conversation with Perplexity
        response = await perplexityService.processConversation([
          { role: 'user', content: text }
        ], {
          model,
          maxTokens,
          temperature: options.temperature || 0.5,
          systemPrompt: options.systemPrompt,
          webSearch: false
        });
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Track service usage for analytics
    costTracker.trackRouterUsage({
      service: selectedService,
      model,
      routingReason: analysis.reason,
      duration,
      requestType: 'text'
    });
    
    // Add routing metadata to response
    return {
      ...response,
      _routingMetadata: {
        service: selectedService,
        model,
        routingReason: analysis.reason,
        duration
      }
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Error processing text request [${requestId}]`, {
      error: error.message,
      duration
    });
    throw new Error(`Text processing failed: ${error.message}`);
  }
}

/**
 * Process a conversational exchange through the appropriate service
 * @param {Array} messages - Conversation history
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Response from the selected service
 */
async function processConversation(messages, options = {}) {
  const requestId = options.requestId || uuidv4();
  const startTime = Date.now();
  
  try {
    // Determine if the conversation needs internet information
    const needsInternetInfo = options.needsInternetInfo || false;
    
    // Get the last user message to analyze
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    const lastUserContent = lastUserMessage ? lastUserMessage.content : '';
    
    // Analyze request to select appropriate service
    const analysis = analyzeRequest(
      { 
        type: 'conversation',
        features: {
          needsInternetInfo,
          isResearch: options.isResearch || false,
          isConversational: true,
          isVisualizing: options.isVisualizing || false
        }
      }, 
      {
        routingStrategy: options.routingStrategy,
        forceService: options.forceService
      }
    );
    
    const selectedService = analysis.selectedService;
    
    logger.info(`Routing conversation to ${selectedService}`, {
      requestId,
      reason: analysis.reason,
      needsInternetInfo,
      messagesCount: messages.length
    });
    
    // Select appropriate model based on quality tier
    const qualityTier = options.qualityTier || 'standard';
    const model = options.model || MODELS[selectedService][qualityTier] || MODELS[selectedService].default;
    
    // Route to appropriate service
    let response;
    
    if (selectedService === 'claude') {
      response = await claudeService.processConversation(messages, {
        model,
        maxTokens: options.maxTokens || 1024,
        temperature: options.temperature || 0.7,
        systemPrompt: options.systemPrompt
      });
    } else {
      response = await perplexityService.processConversation(messages, {
        model,
        maxTokens: options.maxTokens || 1024,
        temperature: options.temperature || 0.5,
        systemPrompt: options.systemPrompt,
        webSearch: needsInternetInfo,
        recencyFilter: options.recencyFilter || 'month',
        domainFilter: options.domainFilter || []
      });
    }
    
    const duration = Date.now() - startTime;
    
    // Track service usage for analytics
    costTracker.trackRouterUsage({
      service: selectedService,
      model,
      routingReason: analysis.reason,
      duration,
      requestType: 'conversation'
    });
    
    // Add routing metadata to response
    return {
      ...response,
      _routingMetadata: {
        service: selectedService,
        model,
        routingReason: analysis.reason,
        duration
      }
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Error processing conversation [${requestId}]`, {
      error: error.message,
      duration
    });
    throw new Error(`Conversation processing failed: ${error.message}`);
  }
}

/**
 * Process a multimodal request (text + images) with Claude
 * @param {Array} content - Array of content objects with type and data
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Claude's response
 */
async function processMultimodal(content, options = {}) {
  const requestId = options.requestId || uuidv4();
  const startTime = Date.now();
  
  try {
    // Multimodal requests always go to Claude
    logger.info(`Routing multimodal request to Claude`, {
      requestId,
      contentTypes: content.map(item => item.type).join(',')
    });
    
    // Select appropriate model based on quality tier
    const qualityTier = options.qualityTier || 'standard';
    const model = options.model || MODELS.claude[qualityTier] || MODELS.claude.default;
    
    const response = await claudeService.processMultimodal(content, {
      model,
      maxTokens: options.maxTokens || 1024,
      temperature: options.temperature || 0.7
    });
    
    const duration = Date.now() - startTime;
    
    // Track service usage for analytics
    costTracker.trackRouterUsage({
      service: 'claude',
      model,
      routingReason: 'Multimodal requires Claude',
      duration,
      requestType: 'multimodal'
    });
    
    // Add routing metadata to response
    return {
      ...response,
      _routingMetadata: {
        service: 'claude',
        model,
        routingReason: 'Multimodal requires Claude',
        duration
      }
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Error processing multimodal request [${requestId}]`, {
      error: error.message,
      duration
    });
    throw new Error(`Multimodal processing failed: ${error.message}`);
  }
}

/**
 * Conduct deep research on a topic
 * This is handled as a background job due to longer processing time
 * @param {string} query - The research query
 * @param {Object} options - Research configuration options
 * @returns {Promise<Object>} - Job information for tracking progress
 */
async function conductDeepResearch(query, options = {}) {
  const requestId = options.requestId || uuidv4();
  
  try {
    logger.info(`Starting deep research job [${requestId}]`, { 
      query,
      asyncMode: true
    });
    
    // Enqueue as a job for background processing
    const jobId = await jobManager.enqueueJob('deep-research', {
      query,
      options: {
        ...options,
        requestId,
        // Deep research always uses Perplexity's internet capabilities
        model: options.model || MODELS.perplexity.highQuality,
        // Apply rate limiting to prevent overloading the API
        shouldRateLimit: true
      }
    });
    
    return {
      jobId,
      requestId,
      status: 'queued',
      message: 'Deep research job has been queued for processing',
      estimatedTime: '30-90 seconds'
    };
  } catch (error) {
    logger.error(`Error starting deep research job [${requestId}]`, {
      error: error.message
    });
    throw new Error(`Deep research job failed to start: ${error.message}`);
  }
}

/**
 * Get status of a deep research job
 * @param {string} jobId - The job ID
 * @returns {Promise<Object>} - Current job status
 */
async function getResearchStatus(jobId) {
  try {
    return await jobManager.getJobStatus(jobId);
  } catch (error) {
    logger.error(`Error checking research job status`, {
      error: error.message,
      jobId
    });
    throw new Error(`Failed to get research job status: ${error.message}`);
  }
}

/**
 * Get health status of all services
 * @returns {Object} - Health status information for all services
 */
function getHealthStatus() {
  const claudeHealth = claudeService.getHealthStatus();
  const perplexityHealth = perplexityService.getHealthStatus();
  
  // Calculate overall health score
  const servicesUp = [
    claudeHealth.status === 'available', 
    perplexityHealth.status === 'available'
  ].filter(Boolean).length;
  
  const healthScore = (servicesUp / 2) * 100;
  
  return {
    overall: {
      status: healthScore > 50 ? 'operational' : 'degraded',
      healthScore,
      timestamp: new Date().toISOString()
    },
    services: {
      claude: claudeHealth,
      perplexity: perplexityHealth
    }
  };
}

module.exports = {
  processText,
  processConversation,
  processMultimodal,
  conductDeepResearch,
  getResearchStatus,
  getHealthStatus,
  analyzeRequest,
  MODELS,
  ROUTING_CONFIG
};