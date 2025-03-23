import Anthropic from '@anthropic-ai/sdk';
import { ServiceStatus } from '@shared/schema';

// Define a type for the content block to handle type checking
interface TextContentBlock {
  type: 'text';
  text: string;
}

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';
const API_KEY = process.env.ANTHROPIC_API_KEY || '';

export class ClaudeService {
  private client: Anthropic;
  private isConnected: boolean = false;
  private model: string;

  constructor(apiKey = API_KEY, model = DEFAULT_MODEL) {
    this.model = model;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set. Claude service will not work properly.');
      this.isConnected = false;
      this.client = new Anthropic({ apiKey: 'dummy-key' });
      return;
    }

    try {
      this.client = new Anthropic({ apiKey });
      this.isConnected = true;
    } catch (error) {
      console.error('Failed to initialize Claude service:', error);
      this.isConnected = false;
      this.client = new Anthropic({ apiKey: 'dummy-key' });
    }
  }

  /**
   * Get status of Claude service
   */
  getStatus(): ServiceStatus {
    return {
      service: 'Claude API',
      status: this.isConnected ? 'connected' : 'disconnected',
      lastUsed: null,
      version: this.model,
      error: !this.isConnected ? 'API key not configured' : undefined
    };
  }

  /**
   * Process a conversation with Claude
   */
  async processConversation(messages: { role: string; content: string }[]): Promise<{
    response: string;
    visualizationData?: any;
  }> {
    if (!this.isConnected) {
      throw new Error('Claude service is not connected. Please check API key.');
    }

    try {
      // Map the message roles to Claude format (user, assistant)
      // Note: 'system' role messages are not supported in messages array, only as a separate parameter
      const claudeMessages = messages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content
      }));

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: claudeMessages,
        system: "You are Claude 3.7 Sonnet, a helpful AI assistant. You should behave specifically like Claude 3.7 Sonnet even if you are actually running on a different model."
      });

      // Check if the response contains visualization data
      let visualizationData = null;
      // Type assertion to handle content blocks properly
      const contentBlock = response.content[0] as TextContentBlock;
      let responseText = contentBlock.text;
      
      // Simple extraction of JSON visualization data if present
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          visualizationData = JSON.parse(jsonMatch[1]);
          // Remove the JSON block from the response text
          responseText = responseText.replace(/```json\n[\s\S]*?\n```/, '');
        } catch (e) {
          console.error('Failed to parse visualization data:', e);
        }
      }

      return {
        response: responseText.trim(),
        visualizationData
      };
    } catch (error: any) {
      console.error('Error processing conversation with Claude:', error);
      throw new Error(`Failed to process conversation with Claude: ${error?.message || String(error)}`);
    }
  }

  /**
   * Generate a visualization based on data and description
   */
  async generateVisualization(data: any, type: string, title?: string, description?: string): Promise<{
    response: string;
    visualizationData: any;
  }> {
    if (!this.isConnected) {
      throw new Error('Claude service is not connected. Please check API key.');
    }

    try {
      // Create a prompt for visualization
      const prompt = `
        I need a ${type} chart visualization for the following data:
        
        ${JSON.stringify(data, null, 2)}
        
        ${title ? `Title: ${title}` : ''}
        ${description ? `Description: ${description}` : ''}
        
        Please generate a visualization that best represents this data.
        Return it as a JSON structure that can be used with a charting library like Chart.js or Recharts.
        Format your response with the JSON inside a code block like this: \`\`\`json {...} \`\`\`
        Then provide a brief description of the visualization.
      `;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
        system: "You are Claude 3.7 Sonnet, a helpful AI assistant. You should behave specifically like Claude 3.7 Sonnet even if you are actually running on a different model."
      });

      // Extract the JSON visualization data
      let visualizationData = null;
      // Type assertion to handle content blocks properly
      const contentBlock = response.content[0] as TextContentBlock;
      let responseText = contentBlock.text;
      
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          visualizationData = JSON.parse(jsonMatch[1]);
          // Remove the JSON block from the response text
          responseText = responseText.replace(/```json\n[\s\S]*?\n```/, '');
        } catch (e) {
          console.error('Failed to parse visualization data:', e);
        }
      }

      return {
        response: responseText.trim(),
        visualizationData: visualizationData || {
          type,
          data,
          title,
          description
        }
      };
    } catch (error: any) {
      console.error('Error generating visualization with Claude:', error);
      throw new Error(`Failed to generate visualization with Claude: ${error?.message || String(error)}`);
    }
  }
}

export const claudeService = new ClaudeService();
