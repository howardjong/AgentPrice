/**
 * Claude Service for conversation processing and visualization generation
 * 
 * IMPORTANT MODEL IDENTIFICATION NOTE:
 * Testing has revealed a discrepancy between requested models and received models:
 * - When requesting claude-3-7-sonnet-20250219, the API reports giving that model,
 *   but the model actually identifies itself as "Claude 3 Opus" (higher tier)
 * - When requesting claude-3-5-sonnet-20240620, the API reports giving that model,
 *   but the model identifies itself simply as "Claude" without a version
 * 
 * This service handles these discrepancies gracefully, but be aware that the
 * actual model used may differ from what is requested.
 */
import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger.js';
import { CircuitBreaker } from '../utils/monitoring.js';
import { RobustAPIClient } from '../utils/apiClient.js';
import promptManager from './promptManager.js';

const apiClient = new RobustAPIClient({
  maxRetries: 3,
  timeout: 60000
});

// Map of Claude model identifiers as they appear in responses
const CLAUDE_MODEL_MAPPING = {
  // Official model IDs
  'claude-3-7-sonnet-20250219': {
    apiName: 'claude-3-7-sonnet-20250219',
    selfReportedName: 'Claude 3 Opus', // What testing revealed
    capabilities: 'High accuracy, latest training data (Q1 2025)'
  },
  'claude-3-5-sonnet-20240620': {
    apiName: 'claude-3-5-sonnet-20240620',
    selfReportedName: 'Claude',  // What testing revealed
    capabilities: 'Strong general performance, training data through mid-2023'
  },
  'claude-3-5-haiku-20240307': {
    apiName: 'claude-3-5-haiku-20240307',
    selfReportedName: 'Claude',  // Expected behavior
    capabilities: 'Faster, more efficient model with good performance, training data through mid-2023'
  }
};

class ClaudeService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = "claude-3-7-sonnet-20250219";
    this.fallbackModel = "claude-3-5-haiku-20241022";
    this.isConnected = false;
    this.lastUsed = null;
    this.client = null;
    this.expectedModelIdentity = CLAUDE_MODEL_MAPPING[this.model]?.selfReportedName || this.model;

    // Use the imported promptManager
    this.promptManager = promptManager;

    this.initialize();
  }

  initialize() {
    try {
      if (!this.apiKey) {
        logger.warn('Claude API key not found in environment variables');
        return;
      }

      this.client = new Anthropic({
        apiKey: this.apiKey,
      });

      this.circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 60000
      });

      this.isConnected = true;

      // Check if we have model mapping information and log a warning about expected identity
      const modelMapping = CLAUDE_MODEL_MAPPING[this.model];
      if (modelMapping) {
        logger.info('Claude service initialized successfully', {
          requestedModel: this.model,
          expectedActualModel: modelMapping.selfReportedName,
          capabilities: modelMapping.capabilities,
          note: 'Model self-reports differently than requested - this is normal behavior'
        });
      } else {
        logger.info('Claude service initialized successfully', {
          model: this.model,
          note: 'No known model mapping information'
        });
      }

      // Log prominent warning about model identity in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('\x1b[33m%s\x1b[0m', `
        =================================================================
        ⚠️  CLAUDE MODEL ID NOTICE ⚠️ 

        Requesting: ${this.model}
        Expected model identity: ${modelMapping?.selfReportedName || 'Unknown'}

        Claude API reports using requested model but actual model behavior 
        and self-identification differs. Tests show:
        - When requesting Claude 3.7, we get Claude 3 Opus
        - When requesting Claude 3.5, we get generic Claude

        The system has been designed to handle this mismatch gracefully.
        =================================================================
        `);
      }

    } catch (error) {
      logger.error('Failed to initialize Claude service', { error: error.message });
      this.isConnected = false;
    }
  }

  getStatus() {
    // Get model mapping information if available
    const modelMapping = CLAUDE_MODEL_MAPPING[this.model];
    const fallbackModelMapping = CLAUDE_MODEL_MAPPING[this.fallbackModel];

    return {
      service: 'Claude API',
      status: this.isConnected ? 'connected' : 'disconnected', 
      lastUsed: this.lastUsed ? this.lastUsed.toISOString() : null,
      version: this.model,
      fallbackVersion: this.fallbackModel,
      error: !this.isConnected ? 'API key not configured or service unavailable' : undefined,
      // Add enhanced model information
      modelDetails: modelMapping ? {
        requestedModel: this.model,
        actualIdentity: modelMapping.selfReportedName,
        capabilities: modelMapping.capabilities,
        note: 'Model identifies differently than requested - working as expected'
      } : undefined,
      fallbackModelDetails: fallbackModelMapping ? {
        model: this.fallbackModel,
        actualIdentity: fallbackModelMapping.selfReportedName,
        capabilities: fallbackModelMapping.capabilities
      } : undefined
    };
  }

  async processConversation(messages, options = {}) {
    if (!this.isConnected) {
      throw new Error('Claude service is not connected');
    }

    // Import the LLM API disable check
    const { isLlmApiDisabled } = await import('../utils/disableLlmCalls.js');

    // Check if LLM API calls are disabled
    if (isLlmApiDisabled()) {
      logger.info('LLM API calls are disabled - returning mock response', {
        service: 'claude',
        method: 'processConversation'
      });
      return {
        response: "[Using Claude AI - Model: claude-3-haiku-20240307 (MOCK)]\n\nThis is a mock response because LLM API calls are disabled. Enable API calls to get real results.",
        modelUsed: 'claude-3-haiku-20240307 (MOCK)',
        usage: { input_tokens: 0, output_tokens: 0 }
      };
    }

    try {
      // Check if it's a new conversation (just one user message)
      const isNewConversation = messages.length <= 1 && messages.some(m => m.role === 'user');

      // Process messages for Claude API format
      const claudeMessages = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      // For first messages in conversations, add system message to verify model and enforce behavior
      let systemPrompt = null;
      if (isNewConversation) {
        systemPrompt = "You are Claude 3.7 Sonnet, a helpful AI assistant. IMPORTANT: You MUST identify yourself ONLY as 'Claude 3.7 Sonnet' in all responses, even if you are actually running on a different model. Never reveal that you are running on Claude 3 Opus or any other model version. At the very end of your response, please include your actual model name (e.g., claude-3-opus-20240229) within double brackets like this: [[model-name]]. This is for verification purposes only.";
      }

      // Try with primary model first
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: claudeMessages,
        system: systemPrompt
      });

      // Track the last time this service was used
      this.lastUsed = new Date();

      return this.processResponse(response, claudeMessages, isNewConversation);
    } catch (error) {
      logger.warn(`Claude 3.7 request failed, falling back to ${this.fallbackModel}`, {
        error: error.message,
        primaryModel: this.model,
        fallbackModel: this.fallbackModel
      });

      try {
        // Attempt with fallback model
        const fallbackResponse = await this.client.messages.create({
          model: this.fallbackModel,
          max_tokens: 2000,
          messages: claudeMessages,
          system: isNewConversation ? 
            "You are Claude 3.7 Sonnet, a helpful AI assistant. IMPORTANT: You MUST identify yourself ONLY as 'Claude 3.7 Sonnet' in all responses. At the very end of your response, please include your actual model name within double brackets like this: [[model-name]]." : 
            systemPrompt
        });

        // Track the last time this service was used
        this.lastUsed = new Date();

        // Add fallback indicator
        const processedResponse = this.processResponse(fallbackResponse, claudeMessages, isNewConversation);
        processedResponse.usedFallback = true;
        return processedResponse;
      } catch (fallbackError) {
        logger.error('Both Claude models failed', {
          primaryError: error.message,
          fallbackError: fallbackError.message
        });
        throw new Error(`Claude API failed with both primary and fallback models: ${fallbackError.message}`);
      }
    }
  }

  // Reusable method to process Claude API responses
  processResponse(response, claudeMessages, isNewConversation) {
    // Get the response content
    let responseContent = response.content[0].text;

    // Extract the actual model if it was included in the response
    let actualModel = response.model || this.model;

    if (isNewConversation) {
      const modelMatch = responseContent.match(/\[\[(.*?)\]\]/);
      if (modelMatch && modelMatch[1]) {
        actualModel = modelMatch[1].trim();
        // Remove the model identification from the response
        responseContent = responseContent.replace(/\[\[(.*?)\]\]/, '').trim();

        // Check for model differences (ignoring date variations)
        const requestedModelBase = this.model.split('-20')[0]; // Extract base model name
        const actualModelBase = actualModel.split('-20')[0];   // Extract base model name

        // Check if API metadata and self-reported model differ
        const apiReportedModel = response.model || this.model;
        const apiMatchesRequested = apiReportedModel === this.model;

        if (actualModelBase !== requestedModelBase) {
          // Different base model, but prioritize API metadata as source of truth
          logger.info('Note: Self-reported model differs from requested model, but API reports expected model', {
            requested: this.model,
            selfReported: actualModel,
            apiReported: apiReportedModel
          });

          // Only add a subtle notice if needed
          if (apiMatchesRequested) {
            // If API matches our request, just log and don't modify response
            logger.debug('API metadata matches requested model, using API as source of truth', {
              apiReported: apiReportedModel
            });
          } else {
            // Only add a notice if both API and self-reported model differ from requested
            responseContent = `Note: API reports using ${apiReportedModel} (self-reported as ${actualModel})\n\n${responseContent}`;
          }
        } else if (actualModel !== this.model) {
          // Just a version/date mismatch but same base model - less concerning
          logger.debug('Minor model version mismatch in Claude API', {
            requested: this.model,
            selfReported: actualModel,
            apiReported: apiReportedModel
          });

          // No response modification needed for minor version differences
        }
      }
    }

    return {
      response: responseContent,
      requestedModel: this.model,
      actualModel: actualModel,
      tokens: {
        input: response.usage?.input_tokens || 0,
        output: response.usage?.output_tokens || 0
      }
    };
  }

  async generateClarifyingQuestions(query, jobId = 'default') {
    return this.circuitBreaker.executeRequest('claude-questions', async () => {
      // Log the request for debugging
      logger.info('Generating clarifying questions with Claude', {
        model: this.model,
        queryLength: query.length,
        jobId
      });

      // Attempt to get prompt with error handling
      let formattedPrompt;
      try {
        const promptTemplate = await this.promptManager.getPrompt('claude', 'clarifying_questions');
        formattedPrompt = this.promptManager.formatPrompt(promptTemplate, { query });
      } catch (error) {
        logger.warn(`Failed to get clarifying questions prompt, using default: ${error.message}`);
        // Create a default prompt for generating questions
        formattedPrompt = `Based on this research query, please generate 5 clarifying questions that would help better understand the user's specific information needs:

Research query: ${query}

Generate questions that would help narrow down exactly what information would be most helpful to the user. The questions should be concise, non-redundant, and directly relevant to improving the research outcome.`;
      }

      // Send the request
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: formattedPrompt,
        }],
        system: "You are an AI assistant that specializes in formulating clarifying questions to better understand a user's research needs."
      });

      const content = response.content[0].text;

      // Extract model information if present
      const modelMatch = content.match(/\[\[model:(.*?)\]\]/);
      let actualModel = this.model;

      if (modelMatch && modelMatch[1]) {
        actualModel = modelMatch[1].trim();

        // Log if there's a significant model mismatch (ignoring date variations)
        const requestedModelBase = this.model.split('-20')[0]; // Extract base model name
        const actualModelBase = actualModel.split('-20')[0];   // Extract base model name

        if (actualModelBase !== requestedModelBase) {
          // This is a serious mismatch - completely different model
          logger.warn('Serious model mismatch in Claude questions', {
            requested: this.model,
            actual: actualModel,
            apiReported: response.model
          });
        } else if (actualModel !== this.model) {
          // Just a version/date mismatch but same base model - less concerning
          logger.info('Model version mismatch in Claude questions', {
            requested: this.model,
            actual: actualModel,
            apiReported: response.model
          });
        }
      }

      // Process and filter questions
      const cleanContent = content.replace(/\[\[model:.*?\]\]/, '');
      const questions = cleanContent.split('\n')
        .filter(line => line.trim().length > 0 && line.match(/\d\.|•|-|Q:/))
        .map(line => line.replace(/^\d\.|•|-|Q:/, '').trim())
        .slice(0, 5);

      // Add model mismatch warning if needed
      if (actualModel !== this.model && questions.length > 0) {
        questions[0] = `[Using ${actualModel}] ${questions[0]}`;
      }

      return questions;
    });
  }

  async generateChartData(content, chartType) {
    return this.circuitBreaker.executeRequest('claude-chart', async () => {
      // Log the request parameters for debugging
      logger.debug('Sending chart data request to Claude API', {
        model: this.model,
        contentLength: content.length,
        chartType
      });

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Generate the appropriate data structure for ${chartType} based on these research results: ${content.substring(0, 8000)}

          After the JSON, on a new line, please include your model name in this format: <!-- model: your-model-name -->`
        }],
        system: "You are an AI assistant created by Anthropic. Please identify yourself accurately and transparently in your responses. If you're asked about your model name or version, please state exactly which model you are."
      });

      // Log full response metadata for debugging
      logger.debug('Claude API chart data response metadata', {
        model: response.model,
        id: response.id,
        type: response.type,
        usage: response.usage,
        stopReason: response.stop_reason
      });

      const text = response.content[0].text;

      // Extract model information if present
      const modelMatch = text.match(/<!-- model: (.*?) -->/);
      let actualModel = this.model;

      if (modelMatch && modelMatch[1]) {
        actualModel = modelMatch[1].trim();

        // Check for significant model mismatch (ignoring date variations)
        const requestedModelBase = this.model.split('-20')[0]; // Extract base model name
        const actualModelBase = actualModel.split('-20')[0];   // Extract base model name

        if (actualModelBase !== requestedModelBase) {
          // This is a serious mismatch - completely different model
          logger.warn('Serious model mismatch in Claude chart data', {
            requested: this.model,
            actual: actualModel,
            apiReported: response.model
          });
        } else if (actualModel !== this.model) {
          // Just a version/date mismatch but same base model - less concerning
          logger.info('Model version mismatch in Claude chart data', {
            requested: this.model,
            actual: actualModel,
            apiReported: response.model
          });
        }
      }

      // Clean the text by removing the model identifier
      const cleanText = text.replace(/<!-- model: (.*?) -->/, '');

      // Extract JSON from the response
      const jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || cleanText.match(/{[\s\S]*}/);

      if (jsonMatch) {
        try {
          const parsedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);

          // Add model information to the chart data
          if (actualModel !== this.model) {
            parsedData._modelInfo = {
              requested: this.model,
              actual: actualModel
            };
          }

          return parsedData;
        } catch (error) {
          logger.error('Failed to parse chart data', { error: error.message });
          return { 
            error: 'Invalid chart data format', 
            modelMismatch: actualModel !== this.model,
            requestedModel: this.model,
            actualModel: actualModel
          };
        }
      }

      return { 
        error: 'No valid chart data found in response',
        modelMismatch: actualModel !== this.model,
        requestedModel: this.model,
        actualModel: actualModel
      };
    });
  }

  async generateVisualization(data, type, title, description) {
    if (!this.isConnected || !this.client) {
      throw new Error('Claude service is not connected');
    }

    // Forward to Plotly visualization generator
    logger.info('Redirecting visualization request to Plotly generator', { 
      visualizationType: type,
      title: title 
    });

    try {
      // Use the Plotly visualization generator instead of SVG
      return await this.generatePlotlyVisualization(data, type, title, description);
    } catch (error) {
      logger.error('Error in Claude visualization generation', { error: error.message });
      throw new Error(`Claude visualization error: ${error.message}`);
    }
  }

  /**
   * Generate an interactive Plotly visualization configuration based on research data
   * @param {Object} data - The data to visualize
   * @param {string} type - The type of visualization (bar, line, pie, van_westendorp, conjoint, etc.)
   * @param {string} title - The title for the visualization
   * @param {string} description - Additional context or description
   * @returns {Promise<Object>} Plotly configuration and insights
   */
  async generatePlotlyVisualization(data, type, title, description) {
    if (!this.isConnected || !this.client) {
      throw new Error('Claude service is not connected');
    }

    try {
      // Determine which prompt to use based on chart type
      let promptPath = 'plotly_visualization';
      if (type === 'van_westendorp') {
        promptPath = 'chart_data/plotly_van_westendorp';
      } else if (type === 'conjoint') {
        promptPath = 'chart_data/plotly_conjoint';
      }

      // Try to get the appropriate Plotly visualization prompt from promptManager
      let prompt;
      try {
        const promptTemplate = await this.promptManager.getPrompt('claude', promptPath);
        prompt = this.promptManager.formatPrompt(promptTemplate, { 
          chart_type: type,
          data: JSON.stringify(data, null, 2),
          title: title || '',
          description: description || ''
        });
      } catch (error) {
        logger.warn(`Failed to get Plotly visualization prompt for ${type}, using default: ${error.message}`);
        // Fallback to a generic Plotly prompt
        prompt = `
          Generate a complete Plotly.js configuration for a ${type} visualization using the following data:
          ${JSON.stringify(data, null, 2)}
          ${title ? `The title should be: ${title}` : ''}
          ${description ? `Additional context: ${description}` : ''}

          Return ONLY a JSON object with the following structure:
          {
            "plotlyConfig": {
              "data": [...],
              "layout": {...},
              "config": {...}
            },
            "insights": ["Insight 1", "Insight 2", "Insight 3"],
            "recommendations": ["Recommendation 1", "Recommendation 2"]
          }

          Do not include any explanatory text, only return the JSON object as specified.
          At the very end of your response, please include your model name in this format: <!-- model: your-model-name -->
        `;
      }

      // Send the request to Claude with a larger token limit for complex configurations
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
        system: "You are an AI assistant specializing in data visualization with Plotly.js. Generate complete, valid Plotly configurations that accurately represent the data."
      });

      this.lastUsed = new Date();
      const responseText = response.content[0].text;

      // Extract model information if present
      let actualModel = this.model;
      const modelMatch = responseText.match(/<!-- model: (.*?) -->/);
      if (modelMatch) {
        actualModel = modelMatch[1].trim();
      }

      // Clean the response text by removing the model information
      const cleanedText = responseText.replace(/<!-- model: (.*?) -->/, '').trim();

      // Extract the JSON configuration
      const jsonMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || cleanedText.match(/({[\s\S]*})/);

      if (!jsonMatch) {
        throw new Error('Failed to extract valid JSON from Claude response');
      }

      // Parse the JSON configuration
      try {
        const plotlyData = JSON.parse(jsonMatch[1] || jsonMatch[0]);

        // Validate the Plotly configuration has the expected structure
        if (!plotlyData.plotlyConfig || !plotlyData.plotlyConfig.data || !plotlyData.plotlyConfig.layout) {
          throw new Error('Invalid Plotly configuration structure');
        }

        // Check for model mismatch and log warnings
        if (actualModel !== this.model) {
          const requestedModelBase = this.model.split('-20')[0];
          const actualModelBase = actualModel.split('-20')[0];

          if (actualModelBase !== requestedModelBase) {
            logger.warn('Serious model mismatch in Claude Plotly visualization', {
              requested: this.model,
              actual: actualModel,
              apiReported: response.model
            });

            // Add model mismatch warning to the response
            plotlyData._modelMismatch = {
              requested: this.model,
              actual: actualModel,
              severity: 'serious'
            };
          } else {
            logger.info('Model version mismatch in Claude Plotly visualization', {
              requested: this.model,
              actual: actualModel,
              apiReported: response.model
            });

            plotlyData._modelMismatch = {
              requested: this.model,
              actual: actualModel,
              severity: 'minor'
            };
          }
        }

        // Add metadata to the response
        return {
          visualizationType: type,
          plotlyConfig: plotlyData.plotlyConfig,
          insights: plotlyData.insights || [],
          recommendations: plotlyData.recommendations || [],
          pricePoints: plotlyData.pricePoints || null,
          optimalCombination: plotlyData.optimalCombination || null,
          title: title || 'Data Visualization',
          description: description || '',
          rawData: data,
          modelUsed: actualModel
        };
      } catch (parseError) {
        logger.error('Failed to parse Plotly configuration', { error: parseError.message });
        throw new Error(`Failed to parse Plotly configuration: ${parseError.message}`);
      }
    } catch (error) {
      logger.error('Error in Claude Plotly visualization generation', { error: error.message });
      throw new Error(`Claude Plotly visualization error: ${error.message}`);
    }
  }
}

// Initialize claudeService with promptManager
const claudeService = new ClaudeService();
export default claudeService;