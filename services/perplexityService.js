import CircuitBreaker from '../utils/circuitBreaker.js';
import logger from '../utils/logger.js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Initialize circuit breaker for API calls
const circuitBreaker = new CircuitBreaker('perplexity', {
  failureThreshold: 3,
  resetTimeout: 30000
});

// Set up Perplexity API configuration
const PERPLEXITY_API_URL = 'https://api.perplexity.ai';

// Default model configuration
const DEFAULT_MODEL = 'sonar';
const SONAR_MODELS = {
  small: 'llama-3.1-sonar-small-128k-online',
  large: 'llama-3.1-sonar-large-128k-online', 
  deepResearch: 'sonar-deep-research'
};

const perplexityService = {
  /**
   * Performs deep research using Perplexity API
   * @param {string} query - The research query
   * @param {string} jobId - Unique identifier for the job
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Research results
   */
  async performDeepResearch(query, jobId, options = {}) {
    const modelToUse = options.wantsDeepResearch ? SONAR_MODELS.deepResearch : DEFAULT_MODEL;

    try {
      logger.info(`Starting ${modelToUse} research for: "${query}"`, { jobId });

      const requestData = {
        model: modelToUse,
        query: query,
        focus: options.focus || 'internet',
        follow_up_questions: options.followUpQuestions !== false,
        temperature: options.temperature || 0.7
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
      };

      const response = await circuitBreaker.execute(async () => {
        const result = await axios.post(`${PERPLEXITY_API_URL}/chat/completions`, requestData, { headers });
        return result.data;
      });

      // Process response data
      const content = response.answer || response.text || '';
      const sources = this.extractSources(response);

      logger.info(`Completed research for "${query}" using ${modelToUse}`, { jobId });

      return {
        content,
        sources,
        modelUsed: modelToUse,
        requestedModel: modelToUse,
        rawResponse: response
      };
    } catch (error) {
      logger.error(`Error during research: ${error.message}`, { jobId });
      throw error;
    }
  },

  /**
   * Processes a web search query using standard search model
   * @param {string} query - The search query
   * @param {Object} options - Additional options for the query
   * @returns {Promise<Object>} - Search results
   */
  async processWebQuery(query, options = {}) {
    try {
      const model = options.model || DEFAULT_MODEL;
      logger.info(`Processing web query: "${query}" with model ${model}`);

      // Format request data according to the updated Perplexity API format
      const requestData = {
        model: model,
        messages: [
          { role: "user", content: query }
        ],
        temperature: options.temperature || 0.7
      };

      // Add optional parameters
      if (options.maxTokens) {
        requestData.max_tokens = options.maxTokens;
      }

      if (options.systemPrompt) {
        // Add system message before user message
        requestData.messages.unshift({ role: "system", content: options.systemPrompt });
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
      };

      const response = await circuitBreaker.execute(async () => {
        const result = await axios.post(`${PERPLEXITY_API_URL}/chat/completions`, requestData, { headers });
        return result.data;
      });

      // Extract content from the new API response format
      const content = response.choices?.[0]?.message?.content || '';
      
      // Extract citations from the response
      const citations = this.extractSources(response);

      // Return both the simplified format for backward compatibility
      // and the complete response for advanced processing
      const result = {
        content,
        citations,
        model: response.model || model,
        // Include the raw response for access to additional data
        rawResponse: response
      };
      
      return result;
    } catch (error) {
      logger.error(`Error during web query: ${error.message}`);
      throw error;
    }
  },

  /**
   * Conducts comprehensive deep research with follow-up questions
   * @param {string} query - The research query
   * @param {Object} options - Research configuration options
   * @returns {Promise<Object>} - Research results
   */
  async conductDeepResearch(query, options = {}) {
    const requestId = options.requestId || uuidv4();
    // For deep research, we prefer the deep research model
    const model = options.model || SONAR_MODELS.deepResearch;
    const maxTokens = options.maxTokens || 4096; // Larger token limit for deep research
    
    // Create a more detailed system prompt for deep research
    const systemPrompt = options.systemPrompt || 
      'You are an expert research assistant. Conduct a comprehensive analysis of this topic. ' +
      'Include key insights, varied perspectives, and cite your sources. Organize your findings ' +
      'clearly with section headings. Focus on providing substantive, detailed, and accurate information.';
      
    logger.info(`Starting deep research with Perplexity [${requestId}]`, { 
      model, 
      query,
      domainFilter: options.domainFilter || 'none', 
      recencyFilter: options.recencyFilter || 'month'
    });
    
    try {
      // For deep research, we'll make multiple API calls to get more comprehensive results
      
      // Initial broad query
      const initialResults = await this.processWebQuery(query, {
        model,
        maxTokens,
        temperature: 0.2,
        systemPrompt,
        domainFilter: options.domainFilter || [],
        recencyFilter: options.recencyFilter || 'month'
      });
      
      // Generate follow-up questions based on initial results
      const followUpResponse = await this.processWebQuery(
        `Based on the following research, what are 3-5 important follow-up questions that would help expand and deepen the research?\n\n${initialResults.content}`,
        {
          model: SONAR_MODELS.small, // Use smaller model for this intermediate step
          maxTokens: 1024,
          temperature: 0.7, // Higher temperature for more diverse questions
          systemPrompt: 'Generate specific, targeted follow-up research questions. Be concise and focus on gaps in the initial research.'
        }
      );
      
      // Extract follow-up questions (simple extraction, could be improved with better parsing)
      const followUpContent = followUpResponse.content;
      let followUpQuestions = [];
      
      // Basic extraction of numbered items
      const questionMatches = followUpContent.match(/\d+\.\s+(.*?)(?=\d+\.|$)/gs);
      if (questionMatches && questionMatches.length > 0) {
        followUpQuestions = questionMatches.map(q => q.replace(/^\d+\.\s+/, '').trim());
      } else {
        // Fallback to line-by-line
        followUpQuestions = followUpContent.split('\n')
          .filter(line => line.trim().length > 10 && line.trim().includes('?'))
          .map(line => line.trim())
          .slice(0, 3); // Limit to 3 questions
      }
      
      logger.info(`Generated ${followUpQuestions.length} follow-up questions for deep research [${requestId}]`);
      
      // Research follow-up questions (limited to 2 for cost/time efficiency)
      const followUpLimit = Math.min(2, followUpQuestions.length);
      const followUpResearch = await Promise.all(
        followUpQuestions.slice(0, followUpLimit).map(async (question) => {
          try {
            const result = await this.processWebQuery(question, {
              model,
              maxTokens: Math.floor(maxTokens / 2), // Shorter responses for follow-ups
              temperature: 0.2,
              systemPrompt: 'Focus specifically on this aspect of the research topic. Be concise but thorough.',
              domainFilter: options.domainFilter || [],
              recencyFilter: options.recencyFilter || 'month'
            });
            return { question, result };
          } catch (error) {
            logger.error(`Error processing follow-up question [${requestId}]`, {
              error: error.message,
              question
            });
            return { question, error: error.message };
          }
        })
      );
      
      // Synthesize all findings into a cohesive report
      const researchMaterial = [
        `Initial research on "${query}":\n${initialResults.content}`,
        ...followUpResearch
          .filter(item => !item.error)
          .map(item => `Follow-up on "${item.question}":\n${item.result.content}`)
      ].join('\n\n');
      
      const synthesisPrompt = `Synthesize the following research materials into a comprehensive report. 
Organize with clear section headings, maintain factual accuracy, and cite sources appropriately.
      
${researchMaterial}`;
      
      const synthesisResponse = await this.processWebQuery(synthesisPrompt, {
        model,
        maxTokens: maxTokens,
        temperature: 0.2,
        systemPrompt: 'You are creating a final comprehensive research report. Organize the information logically, eliminate redundancy, and ensure all key insights are preserved with proper citation.'
      });
      
      // Combine all citations from each step
      const allCitations = [
        ...initialResults.citations || [],
        ...followUpResearch
          .filter(item => !item.error && item.result.citations)
          .flatMap(item => item.result.citations),
        ...synthesisResponse.citations || []
      ];
      
      // Remove duplicate citations
      const uniqueCitations = allCitations.filter((citation, index, self) => 
        index === self.findIndex(c => c === citation)
      );
      
      logger.info(`Deep research completed successfully [${requestId}]`, {
        citationsCount: uniqueCitations.length,
        followUpQuestionsCount: followUpQuestions.length,
        processedFollowUpCount: followUpResearch.length
      });
      
      return {
        content: synthesisResponse.content,
        citations: uniqueCitations,
        followUpQuestions,
        model,
        requestId
      };
    } catch (error) {
      logger.error(`Error conducting deep research [${requestId}]`, {
        error: error.message
      });
      throw new Error(`Deep research failed: ${error.message}`);
    }
  },

  /**
   * Extracts sources from the Perplexity API response
   * @param {Object} response - The API response
   * @returns {Array} - Extracted sources
   */
  extractSources(response) {
    try {
      // Check for direct citations array in the new API format
      if (response.citations && Array.isArray(response.citations)) {
        // Direct citations in the new format or 
        return response.citations;
      }
      
      // Handle content-based extraction for new API response format
      if (response.choices && response.choices[0]?.message?.content) {
        const content = response.choices[0].message.content;
        
        // Extract URLs from markdown-style references [number](url)
        const urlMatches = content.match(/\[\d+\]\s*\((https?:\/\/[^\s)]+)\)/g) || [];
        const urls = urlMatches.map(match => {
          const url = match.match(/\((https?:\/\/[^\s)]+)\)/);
          return url ? url[1] : null;
        }).filter(Boolean);
        
        // Extract numbered references like [1], [2], etc. with associated text
        const referenceMatches = content.match(/\[\d+\]\s+[^\[]+/g) || [];
        const references = referenceMatches.map(ref => ref.trim());
        
        if (urls.length > 0 || references.length > 0) {
          return [...urls, ...references];
        }
      }
      
      // Handle other possible formats as fallback
      if (response.references && Array.isArray(response.references)) {
        return response.references.map(ref => ref.url || ref.title || '');
      } else if (response.links && Array.isArray(response.links)) {
        return response.links;
      }
      
      return [];
    } catch (err) {
      logger.warn('Error extracting sources from response:', err);
      return [];
    }
  },

  /**
   * Get the status of the Perplexity service
   * @returns {Object} - Service status
   */
  getStatus() {
    return {
      status: circuitBreaker.getState() === 'closed' ? 'connected' : 'disconnected',
      circuitState: circuitBreaker.getState(),
      defaultModel: DEFAULT_MODEL,
      availableModels: SONAR_MODELS
    };
  }
};

// Define convenient exports and aliases for compatibility with various code paths
const exports = {
  ...perplexityService,
  performDeepResearch: perplexityService.performDeepResearch,
  processWebQuery: perplexityService.processWebQuery,
  conductDeepResearch: perplexityService.conductDeepResearch,
  extractSources: perplexityService.extractSources,
  getStatus: perplexityService.getStatus
};

export default exports;