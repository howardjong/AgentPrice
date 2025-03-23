/**
 * Claude Service for conversation processing and visualization generation
 */
import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger.js';
import { CircuitBreaker } from '../utils/monitoring.js';
import { RobustAPIClient } from '../utils/apiClient.js';

const apiClient = new RobustAPIClient({
  maxRetries: 3,
  timeout: 60000
});

class ClaudeService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = "claude-3-7-sonnet-20250219";
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

      this.circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 60000
      });

      this.isConnected = true;
      logger.info('Claude service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Claude service', { error: error.message });
      this.isConnected = false;
    }
  }

  getStatus() {
    return {
      service: 'Claude API',
      status: this.isConnected ? 'connected' : 'disconnected', 
      lastUsed: this.lastUsed ? this.lastUsed.toISOString() : null,
      version: this.model,
      error: !this.isConnected ? 'API key not configured or service unavailable' : undefined
    };
  }

  async processConversation(messages) {
    if (!this.isConnected || !this.client) {
      throw new Error('Claude service is not connected');
    }

    return await this.circuitBreaker.executeRequest('claude-conversation', async () => {
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
        systemPrompt = "You are Claude 3.7 Sonnet, a helpful AI assistant. You should behave specifically like Claude 3.7 Sonnet even if you are actually running on a different model. At the very end of your response, please include your actual model name (e.g., claude-3-opus-20240229) within double brackets like this: [[model-name]]. This is for verification purposes only.";
      }
      
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: claudeMessages,
        system: systemPrompt
      });

      // Track the last time this service was used
      this.lastUsed = new Date();
      
      // Get the response content
      let responseContent = response.content[0].text;
      
      // Extract the actual model if it was included in the response
      let actualModel = this.model;
      
      if (isNewConversation) {
        const modelMatch = responseContent.match(/\[\[(.*?)\]\]/);
        if (modelMatch && modelMatch[1]) {
          actualModel = modelMatch[1].trim();
          // Remove the model identification from the response
          responseContent = responseContent.replace(/\[\[(.*?)\]\]/, '').trim();
          
          // Log if there's a model mismatch
          if (actualModel !== this.model) {
            logger.warn('Model mismatch in Claude API', {
              requested: this.model,
              actual: actualModel,
              apiReported: response.model
            });
            
            // Add a prominent model mismatch notice at the beginning of the response
            responseContent = `⚠️ MODEL MISMATCH WARNING: The system is using ${actualModel} instead of the requested ${this.model}. We've instructed the model to behave like Claude 3.7 Sonnet regardless.\n\n${responseContent}`;
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
    });
  }

  async generateClarifyingQuestions(query) {
    return this.circuitBreaker.executeRequest('claude-questions', async () => {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Generate 5 clarifying questions for deep research on: "${query}". After listing the questions, add your model name on a new line in this format: [[model:your-model-name]]`
        }],
        system: "You are Claude 3.7 Sonnet, a helpful AI assistant. You should behave specifically like Claude 3.7 Sonnet even if you are actually running on a different model."
      });

      const content = response.content[0].text;
      
      // Extract model information if present
      const modelMatch = content.match(/\[\[model:(.*?)\]\]/);
      let actualModel = this.model;
      
      if (modelMatch && modelMatch[1]) {
        actualModel = modelMatch[1].trim();
        
        // Log if there's a model mismatch
        if (actualModel !== this.model) {
          logger.warn('Model mismatch in Claude questions', {
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
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Generate the appropriate data structure for ${chartType} based on these research results: ${content.substring(0, 8000)}`
        }]
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/{[\s\S]*}/);

      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } catch (error) {
          logger.error('Failed to parse chart data', { error: error.message });
          return { error: 'Invalid chart data format' };
        }
      }
      return { error: 'No valid chart data found in response' };
    });
  }

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
        
        At the very end of your SVG, please include your model name as a comment like this: <!-- model: your-model-name -->
      `;
      
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });
      
      this.lastUsed = new Date();
      
      // Extract SVG code from the response
      let svgContent = response.content[0].text;
      
      // Basic validation that we got valid SVG
      if (!svgContent.includes('<svg') || !svgContent.includes('</svg>')) {
        throw new Error('Claude did not generate valid SVG visualization');
      }
      
      // Check for model information in the SVG comment
      let actualModel = this.model;
      const modelMatch = svgContent.match(/<!-- model: (.*?) -->/);
      if (modelMatch && modelMatch[1]) {
        actualModel = modelMatch[1].trim();
        
        // Remove the model identification from the SVG
        svgContent = svgContent.replace(/<!-- model: (.*?) -->/, '');
        
        // Log if there's a model mismatch
        if (actualModel !== this.model) {
          logger.warn('Model mismatch in Claude visualization', {
            requested: this.model,
            actual: actualModel,
            apiReported: response.model
          });
          
          // Add a comment at the top of the SVG indicating the model mismatch
          svgContent = svgContent.replace(/<svg/, `<!-- ⚠️ Using ${actualModel} instead of ${this.model} -->\n<svg`);
        }
      }
      
      return {
        visualizationType: type,
        svg: svgContent,
        title: title || 'Data Visualization',
        description: description || '',
        rawData: data,
        modelUsed: actualModel
      };
    } catch (error) {
      logger.error('Error in Claude visualization generation', { error: error.message });
      throw new Error(`Claude visualization error: ${error.message}`);
    }
  }
}

const claudeService = new ClaudeService();
export default claudeService;