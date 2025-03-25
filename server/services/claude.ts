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
        system: "You are an AI assistant created by Anthropic. Please identify yourself accurately and transparently in your responses. If you're asked about your model name or version, please state exactly which model you are."
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
    svg: string;
    visualizationType: string;
    title: string;
    description: string;
    modelUsed: string;
    rawData?: any;
  }> {
    if (!this.isConnected) {
      throw new Error('Claude service is not connected. Please check API key.');
    }

    try {
      // Create a prompt for visualization - attempt to use special prompts for specific chart types
      let prompt: string;
      
      // Check if we're dealing with a specialized visualization type (van_westendorp or conjoint)
      if (type === 'van_westendorp' || type === 'conjoint') {
        // In TypeScript implementation we use a more targeted prompt for specialized visualizations
        if (type === 'van_westendorp') {
          prompt = `
            Generate a Van Westendorp Price Sensitivity visualization using the following data:
            ${JSON.stringify(data, null, 2)}
            ${title ? `The title should be: ${title}` : ''}
            ${description ? `Additional context: ${description}` : ''}
            
            The Van Westendorp Price Sensitivity Meter should show:
            1. Too Expensive (Red Line)
            2. Expensive but Reasonable (Orange Line)
            3. Good Value (Green Line)
            4. Too Cheap (Blue Line)
            
            Your visualization should identify key price points:
            - Optimal Price Point (OPP): Intersection of "Too Cheap" and "Too Expensive"
            - Point of Marginal Cheapness (PMC): Intersection of "Too Cheap" and "Expensive but Reasonable"
            - Point of Marginal Expensiveness (PME): Intersection of "Too Expensive" and "Good Value"
            - Range of Acceptable Prices: The range between PMC and PME
            
            Please provide a visualization in SVG format that best represents this data.
            The SVG should be complete and valid, with appropriate dimensions, styling, and responsive design.
            Include clear labels, a legend, and ensure all data points are accurately represented.
            
            Return ONLY the SVG code without any additional explanation.
            
            At the very end of your SVG, please include your model name as a comment like this: <!-- model: your-model-name -->
          `;
        } else { // conjoint
          prompt = `
            Generate a Conjoint Analysis visualization using the following data:
            ${JSON.stringify(data, null, 2)}
            ${title ? `The title should be: ${title}` : ''}
            ${description ? `Additional context: ${description}` : ''}
            
            For the Conjoint Analysis visualization:
            1. Create a horizontal bar chart showing the relative importance or utility scores for each attribute and level
            2. Organize by attributes (feature categories) and their levels (specific options)
            3. Use consistent color coding for each attribute category
            4. Sort attributes by importance (highest impact attributes at the top)
            5. Include a clear legend with attribute categories
            
            The visualization should clearly show:
            - Which product attributes have the strongest impact on customer preference
            - The relative importance of different attribute levels within each attribute category
            - The overall importance ranking of attributes
            
            Please provide a visualization in SVG format that best represents this data.
            The SVG should be complete and valid, with appropriate dimensions, styling, and responsive design.
            Include clear labels, a legend, and ensure all data points are accurately represented.
            
            Return ONLY the SVG code without any additional explanation.
            
            At the very end of your SVG, please include your model name as a comment like this: <!-- model: your-model-name -->
          `;
        }
      } else {
        // Generic visualization prompt for standard chart types
        prompt = `
          Generate a ${type} visualization using the following data:
          ${JSON.stringify(data, null, 2)}
          ${title ? `The title should be: ${title}` : ''}
          ${description ? `Additional context: ${description}` : ''}
          
          Please provide a visualization in SVG format that best represents this data.
          The SVG should be complete and valid, with appropriate dimensions, styling, and responsive design.
          Include clear labels, a legend if appropriate, and ensure all data points are accurately represented.
          
          For the visualization:
          1. Use appropriate colors to distinguish between different data categories or series
          2. Include proper axis labels and scales
          3. Ensure text elements are readable and properly sized
          4. Add a title at the top of the visualization
          5. Include hover states or tooltips if possible for interactive elements
          
          Return ONLY the SVG code without any additional explanation.
          
          At the very end of your SVG, please include your model name as a comment like this: <!-- model: your-model-name -->
        `;
      }

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
        system: "You are an AI assistant created by Anthropic. Please identify yourself accurately and transparently in your responses. If you're asked about your model name or version, please state exactly which model you are."
      });

      // Extract SVG code from the response
      // Type assertion to handle content blocks properly
      const contentBlock = response.content[0] as TextContentBlock;
      let svgContent = contentBlock.text;

      // Basic validation that we got valid SVG
      if (!svgContent.includes('<svg') || !svgContent.includes('</svg>')) {
        throw new Error('Claude did not generate valid SVG visualization');
      }

      // Extract model information if present
      let actualModel = this.model;
      const modelMatch = svgContent.match(/<!-- model: (.*?) -->/);
      if (modelMatch && modelMatch[1]) {
        actualModel = modelMatch[1].trim();
        // Remove the model identification from the SVG
        svgContent = svgContent.replace(/<!-- model: (.*?) -->/, '');
        
        // Check for significant model mismatch (ignoring date variations)
        const requestedModelBase = this.model.split('-20')[0]; // Extract base model name
        const actualModelBase = actualModel.split('-20')[0];   // Extract base model name

        if (actualModelBase !== requestedModelBase) {
          // This is a serious mismatch - completely different model
          console.warn('Serious model mismatch in Claude visualization', {
            requested: this.model,
            actual: actualModel,
          });

          // Add a prominent warning comment at the top of the SVG
          svgContent = svgContent.replace(/<svg/, `<!-- ⚠️ SERIOUS MODEL MISMATCH: Using ${actualModel} instead of ${this.model} -->\n<svg`);
        } else if (actualModel !== this.model) {
          // Just a version/date mismatch but same base model - less concerning
          console.info('Model version mismatch in Claude visualization', {
            requested: this.model,
            actual: actualModel,
          });

          // Add a subtle comment at the top of the SVG
          svgContent = svgContent.replace(/<svg/, `<!-- Note: Using Claude ${actualModelBase} (version may differ from ${this.model}) -->\n<svg`);
        }
      }

      return {
        svg: svgContent,
        visualizationType: type,
        title: title || 'Data Visualization',
        description: description || '',
        modelUsed: actualModel,
        rawData: data
      };
    } catch (error: any) {
      console.error('Error generating visualization with Claude:', error);
      throw new Error(`Failed to generate visualization with Claude: ${error?.message || String(error)}`);
    }
  }
}

export const claudeService = new ClaudeService();
