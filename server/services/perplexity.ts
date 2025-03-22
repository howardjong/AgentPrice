import axios from 'axios';
import { ServiceStatus } from '@shared/schema';

const DEFAULT_MODEL = 'llama-3.1-sonar-small-128k-online';
const API_KEY = process.env.PERPLEXITY_API_KEY || '';
const API_URL = 'https://api.perplexity.ai/chat/completions';

export class PerplexityService {
  private apiKey: string;
  private isConnected: boolean = false;
  private model: string;

  constructor(apiKey = API_KEY, model = DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;

    if (!apiKey) {
      console.error('PERPLEXITY_API_KEY is not set. Perplexity service will not work properly.');
      this.isConnected = false;
      return;
    }

    this.isConnected = true;
  }

  /**
   * Get status of Perplexity service
   */
  getStatus(): ServiceStatus {
    return {
      service: 'Perplexity API',
      status: this.isConnected ? 'connected' : 'disconnected',
      lastUsed: null,
      version: this.model,
      error: !this.isConnected ? 'API key not configured' : undefined
    };
  }

  /**
   * Perform research using Perplexity
   */
  async performResearch(messages: { role: string; content: string }[]): Promise<{
    response: string;
    citations: string[];
  }> {
    if (!this.isConnected) {
      throw new Error('Perplexity service is not connected. Please check API key.');
    }

    try {
      // Validate messages format - must alternate between user and assistant
      const validatedMessages = this.validateMessages(messages);

      const response = await axios.post(
        API_URL,
        {
          model: this.model,
          messages: validatedMessages,
          max_tokens: 1024,
          temperature: 0.2,
          top_p: 0.9,
          return_images: false,
          return_related_questions: false,
          search_recency_filter: "month",
          stream: false,
          frequency_penalty: 1
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const citations = response.data.citations || [];

      return {
        response: response.data.choices[0].message.content,
        citations
      };
    } catch (error) {
      console.error('Error performing research with Perplexity:', error);
      
      const errorMessage = error.response?.data?.message || error.message;
      throw new Error(`Failed to perform research with Perplexity: ${errorMessage}`);
    }
  }

  /**
   * Validate messages format for Perplexity API
   * Must alternate between user and assistant, ending with user
   */
  private validateMessages(messages: { role: string; content: string }[]): { role: string; content: string }[] {
    // If we only have one message, ensure it's from the user
    if (messages.length === 1) {
      return [{ role: 'user', content: messages[0].content }];
    }

    // Make a copy to avoid modifying the original array
    const processedMessages = [...messages];
    
    // Add a system message at the beginning if not present
    if (processedMessages[0].role !== 'system') {
      processedMessages.unshift({
        role: 'system',
        content: 'You are a research assistant powered by Perplexity. Be precise and concise.'
      });
    }
    
    // Ensure the last message is from the user
    if (processedMessages[processedMessages.length - 1].role !== 'user') {
      console.warn('Last message must be from user. Removing trailing assistant messages.');
      const lastUserIndex = [...processedMessages].reverse().findIndex(m => m.role === 'user');
      if (lastUserIndex !== -1) {
        processedMessages.splice(processedMessages.length - lastUserIndex);
      }
    }
    
    return processedMessages;
  }
}

export const perplexityService = new PerplexityService();
