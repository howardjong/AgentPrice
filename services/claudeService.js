/**
 * Claude Service for conversation processing and visualization generation
 */
import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger.js';
import config from '../config/config.js';

class ClaudeService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.model = config.apis.claude.model;
    
    try {
      if (config.apis.claude.apiKey) {
        this.client = new Anthropic({
          apiKey: config.apis.claude.apiKey,
        });
        this.isConnected = true;
        logger.info('Claude service initialized successfully');
      } else {
        logger.warn('ANTHROPIC_API_KEY is not set. Claude service will not work properly.');
      }
    } catch (error) {
      logger.error(`Failed to initialize Claude service: ${error.message}`);
    }
  }

  /**
   * Get status of Claude service
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      service: "Claude API",
      status: this.isConnected ? 'connected' : 'disconnected',
      lastUsed: this.lastUsed || null,
      version: "claude-3-7-sonnet-20250219", // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
      error: this.isConnected ? undefined : 'API key not configured'
    };
  }

  /**
   * Process a conversation with Claude
   * @param {Array} messages - Array of message objects with role and content
   * @returns {Promise<Object>} Claude's response
   */
  async processConversation(messages) {
    try {
      if (!this.isConnected) {
        throw new Error("Claude service is not properly configured");
      }

      logger.info(`Processing conversation with Claude using model: ${this.model}`);
      this.lastUsed = new Date().toISOString();

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: config.apis.claude.maxTokens,
        messages: messages,
      });

      logger.info('Claude conversation processed successfully');
      return {
        status: 'success',
        message: response.content[0].text,
        usage: {
          prompt_tokens: response.usage?.input_tokens || 0,
          completion_tokens: response.usage?.output_tokens || 0,
        }
      };
    } catch (error) {
      logger.error(`Claude conversation error: ${error.message}`);
      return {
        status: 'error',
        message: `Error processing conversation: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Generate a visualization based on data and description
   * @param {Object} data - Data to visualize
   * @param {string} type - Type of visualization (chart, graph, etc.)
   * @param {string} title - Optional title for the visualization
   * @param {string} description - Optional description of what to visualize
   * @returns {Promise<Object>} Generated visualization data
   */
  async generateVisualization(data, type, title, description) {
    try {
      if (!this.isConnected) {
        throw new Error("Claude service is not properly configured");
      }

      logger.info(`Generating ${type} visualization with Claude`);
      this.lastUsed = new Date().toISOString();

      // Create a prompt for Claude to generate the visualization
      const prompt = `
      Generate a ${type} visualization based on the following data:
      
      Data: ${JSON.stringify(data)}
      ${title ? `Title: ${title}` : ''}
      ${description ? `Description: ${description}` : ''}
      
      Please respond with clean, valid JSON that can be used with a charting library.
      The JSON should have a structure like this:
      {
        "type": "${type}",
        "data": [ ... ],
        "labels": [ ... ],
        "title": "${title || 'Chart Title'}",
        "description": "${description || 'Chart Description'}"
      }
      
      Only respond with the JSON. No explanations or other text.
      `;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: config.apis.claude.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0].text;
      
      // Parse the JSON response
      // Use a try/catch to handle potential JSON parsing issues
      try {
        // Extract JSON from the response if it's wrapped in backticks or other text
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                         content.match(/```([\s\S]*?)```/) || 
                         [null, content];
        
        const jsonString = jsonMatch[1].trim();
        const visualizationData = JSON.parse(jsonString);
        
        logger.info('Visualization generated successfully');
        return {
          status: 'success',
          visualizationData
        };
      } catch (jsonError) {
        logger.error(`Failed to parse visualization JSON: ${jsonError.message}`);
        return {
          status: 'error',
          message: 'Failed to parse visualization data',
          content,
          error: jsonError.message
        };
      }
    } catch (error) {
      logger.error(`Visualization generation error: ${error.message}`);
      return {
        status: 'error',
        message: `Error generating visualization: ${error.message}`,
        error: error.message
      };
    }
  }
}

// Create and export a singleton instance
const claudeService = new ClaudeService();
export default claudeService;