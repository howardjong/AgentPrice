/**
 * Anthropic service for Claude AI integration
 */
import { Anthropic } from '@anthropic-ai/sdk';
import logger from '../utils/logger.js';
import { CircuitBreaker } from '../utils/monitoring.js';

class AnthropicService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = 'claude-3-7-sonnet-20250219';
    this.isConnected = false;
    this.lastUsed = null;
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 300000
    });

    this.initialize();
  }

  initialize() {
    try {
      if (!this.apiKey) {
        logger.warn('Anthropic API key not found in environment variables');
        return;
      }

      this.client = new Anthropic({
        apiKey: this.apiKey
      });

      this.isConnected = true;
      logger.info('Anthropic service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Anthropic service', { error: error.message });
      this.isConnected = false;
    }
  }

  /**
   * Generate a response based on a query and context
   * @param {string} query - User query
   * @param {string} context - Context information
   * @returns {Promise<string>} Generated response
   */
  async generateResponse(query, context) {
    if (!this.isConnected) {
      throw new Error('Anthropic service is not connected');
    }

    try {
      return await this.circuitBreaker.executeRequest('claude-response', async () => {
        const systemPrompt = "You are a research assistant. Provide helpful and accurate responses based on the provided context.";

        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            { role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}` }
          ]
        });

        this.lastUsed = new Date();
        return response.content[0].text;
      });
    } catch (error) {
      logger.error('Error generating response', { error: error.message });
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  /**
   * Generate clarifying questions for a research topic
   * @param {string} query - User query
   * @returns {Promise<Array>} Array of clarifying questions
   */
  async generateClarifyingQuestions(query) {
    if (!this.isConnected) {
      throw new Error('Anthropic service is not connected');
    }

    try {
      return await this.circuitBreaker.executeRequest('claude-questions', async () => {
        const systemPrompt = "You are a researcher. Generate 3-5 clarifying questions that would help narrow down the research scope.";

        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            { role: 'user', content: `Research topic: ${query}\n\nGenerate clarifying questions:` }
          ]
        });

        this.lastUsed = new Date();

        // Parse the response to get individual questions
        const text = response.content[0].text;
        const questions = text.split('\n')
          .filter(line => line.trim().length > 0 && line.match(/\d\.|•|-|Q:/))
          .map(line => line.replace(/^\d\.|•|-|Q:/, '').trim());

        return questions.slice(0, 5); // Return max 5 questions
      });
    } catch (error) {
      logger.error('Error generating clarifying questions', { error: error.message });
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  /**
   * Generate chart data from research content
   * @param {string} content - Research content
   * @param {string} chartType - Type of chart to generate
   * @returns {Promise<Object>} Chart data
   */
  async generateChartData(content, chartType) {
    if (!this.isConnected) {
      throw new Error('Anthropic service is not connected');
    }

    try {
      return await this.circuitBreaker.executeRequest('claude-chart', async () => {
        const systemPrompt = `You are a data visualization expert. Extract relevant data from the content and create JSON data for a ${chartType} chart.`;

        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            { role: 'user', content: `Based on this content:\n${content}\n\nCreate a ${chartType} chart. Respond with JSON only.` }
          ]
        });

        this.lastUsed = new Date();

        // Extract JSON from the response
        const text = response.content[0].text;
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/{[\s\S]*}/);

        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[1] || jsonMatch[0]);
          } catch (parseError) {
            logger.error('Failed to parse JSON chart data', { error: parseError.message });
            return { error: 'Invalid chart data format' };
          }
        } else {
          return { error: 'No valid chart data found in response' };
        }
      });
    } catch (error) {
      logger.error('Error generating chart data', { error: error.message });
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  /**
   * Get status of Anthropic service
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      service: 'Claude API',
      status: this.isConnected ? 'connected' : 'disconnected',
      lastUsed: this.lastUsed ? this.lastUsed.toISOString() : null,
      version: this.model,
      error: !this.isConnected ? 'API key not configured or service unavailable' : undefined
    };
  }
}

const anthropicService = new AnthropicService();
export default anthropicService;