/**
 * Claude Service for conversation processing and visualization generation
 */
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger.js');

class ClaudeService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = "claude-3-7-sonnet-20250219"; // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
    this.isConnected = false;
    this.lastUsed = null;
    this.client = null;
    
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
      
      this.isConnected = true;
      logger.info('Claude service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Claude service', { error: error.message });
      this.isConnected = false;
    }
  }

  /**
   * Get status of Claude service
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      service: 'claude',
      status: this.isConnected ? 'connected' : 'disconnected',
      lastUsed: this.lastUsed ? this.lastUsed.toISOString() : null,
      version: this.model,
      error: !this.isConnected ? 'API key not configured or service unavailable' : undefined
    };
  }

  /**
   * Process a conversation with Claude
   * @param {Array} messages - Array of message objects with role and content
   * @returns {Promise<Object>} Claude's response
   */
  async processConversation(messages) {
    if (!this.isConnected || !this.client) {
      throw new Error('Claude service is not connected');
    }
    
    try {
      // Transform messages format from our app to Claude's expected format
      const claudeMessages = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
      
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: claudeMessages,
      });
      
      this.lastUsed = new Date();
      
      return {
        response: response.content[0].text,
        modelUsed: this.model,
        tokens: {
          input: response.usage?.input_tokens || 0,
          output: response.usage?.output_tokens || 0
        }
      };
    } catch (error) {
      logger.error('Error in Claude conversation processing', { error: error.message });
      throw new Error(`Claude API error: ${error.message}`);
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
    if (!this.isConnected || !this.client) {
      throw new Error('Claude service is not connected');
    }
    
    try {
      const prompt = `
        Generate a ${type} visualization using the following data:
        ${JSON.stringify(data, null, 2)}
        ${title ? `The title should be: ${title}` : ''}
        ${description ? `Additional context: ${description}` : ''}
        
        Please provide a visualization in SVG format that best represents this data.
        The SVG should be complete and valid, with appropriate dimensions, styling, and responsive design.
        Include clear labels, a legend if appropriate, and ensure all data points are accurately represented.
        
        Return ONLY the SVG code without any additional explanation.
      `;
      
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });
      
      this.lastUsed = new Date();
      
      // Extract SVG code from the response
      const svgContent = response.content[0].text;
      
      // Basic validation that we got valid SVG
      if (!svgContent.includes('<svg') || !svgContent.includes('</svg>')) {
        throw new Error('Claude did not generate valid SVG visualization');
      }
      
      return {
        visualizationType: type,
        svg: svgContent,
        title: title || 'Data Visualization',
        description: description || '',
        rawData: data
      };
    } catch (error) {
      logger.error('Error in Claude visualization generation', { error: error.message });
      throw new Error(`Claude visualization error: ${error.message}`);
    }
  }
}

module.exports = new ClaudeService();