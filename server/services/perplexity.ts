import axios from 'axios';
import { ServiceStatus } from '@shared/schema';

const DEFAULT_MODEL = 'sonar';
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
      // Get the main query from the last user message
      const userQuery = messages.filter(m => m.role === 'user').pop()?.content || '';
      console.log('Perplexity received query:', userQuery);
      
      // Validate messages format - must alternate between user and assistant
      const validatedMessages = this.validateMessages(messages);

      // Create a very explicit system message for web search
      const messagesWithSystemInstruction = [
        {
          role: 'system', 
          content: 'You are a research assistant with real-time internet access. ALWAYS search the web for current information before responding. Ensure your response includes CURRENT data and information. Add citations for all sources. Your primary goal is to provide up-to-date information.'
        },
        ...validatedMessages.filter(m => m.role !== 'system')
      ];

      // Enhanced query with time-specific instructions
      const lastMessageIndex = messagesWithSystemInstruction.length - 1;
      if (lastMessageIndex > 0 && messagesWithSystemInstruction[lastMessageIndex].role === 'user') {
        const currentQuery = messagesWithSystemInstruction[lastMessageIndex].content;
        messagesWithSystemInstruction[lastMessageIndex].content = 
          `${currentQuery}\n\nPlease provide the most up-to-date information available as of the current date. I need CURRENT information.`;
      }

      // Log the full request payload
      const requestPayload = {
        model: this.model,
        messages: messagesWithSystemInstruction,
        max_tokens: 1024,
        temperature: 0.2,
        top_p: 0.9,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: "day", // Most recent results only
        stream: false,
        frequency_penalty: 1,
        search_domain_filter: [], // Empty array allows searching all domains
        top_k: 15, // Increase number of search results to consider
        search_context_mode: "medium" // Medium search context mode for basic queries
      };
      
      console.log('Perplexity request payload:', JSON.stringify(requestPayload));

      const response = await axios.post(
        API_URL,
        requestPayload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Log extensive details about the response
      console.log('Perplexity response details:', {
        citations: response.data.citations || [],
        modelUsed: response.data.model,
        promptTokens: response.data.usage?.prompt_tokens,
        completionTokens: response.data.usage?.completion_tokens,
        responseFirstLine: response.data.choices[0].message.content.split('\n')[0]
      });

      // Log the entire citation list for debugging
      if (response.data.citations && response.data.citations.length > 0) {
        console.log('Citations from Perplexity:', response.data.citations);
      } else {
        console.warn('No citations returned from Perplexity');
      }

      const citations = response.data.citations || [];

      // Add explicit model information to the beginning of the response
      const originalResponse = response.data.choices[0].message.content;
      // Use the actual model from the response payload rather than the requested model
      const responseModel = response.data.model || this.model;
      const modelInfo = `[Using Perplexity AI - Model: ${responseModel}]\n\n`;
      const enhancedResponse = modelInfo + originalResponse;
      
      return {
        response: enhancedResponse,
        citations
      };
    } catch (error: any) {
      console.error('Error performing research with Perplexity:', error);
      
      // Safely access potential error properties with type checking
      const errorMessage = 
        (error && typeof error === 'object' && error.response && typeof error.response === 'object' && 
         error.response.data && typeof error.response.data === 'object' && 
         typeof error.response.data.message === 'string') 
          ? error.response.data.message 
          : (error && typeof error === 'object' && typeof error.message === 'string')
            ? error.message
            : 'Unknown error';
            
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
