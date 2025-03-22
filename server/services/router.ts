import { claudeService } from './claude';
import { perplexityService } from './perplexity';

// Keywords that indicate a research query
const RESEARCH_KEYWORDS = [
  'research', 'search', 'find', 'internet', 'web', 'recent', 'news',
  'latest', 'current', 'information', 'data', 'statistics', 'today',
  'this year', 'this month', 'what is', 'who is', 'where is', 'when did',
  'how does', 'why does', 'what are', 'definition of', 'examples of'
];

// Keywords that indicate a visualization query
const VISUALIZATION_KEYWORDS = [
  'chart', 'graph', 'plot', 'visualization', 'visualize', 'diagram',
  'bar chart', 'line chart', 'pie chart', 'histogram', 'scatter plot',
  'show me data', 'display data', 'visualize data', 'create a chart',
  'generate a graph', 'draw a chart'
];

export class ServiceRouter {
  /**
   * Determine the best service to use for a given message
   */
  determineService(message: string, explicitService?: string): 'claude' | 'perplexity' {
    // If service is explicitly specified, use that
    if (explicitService === 'claude' || explicitService === 'perplexity') {
      return explicitService;
    }
    
    const lowercaseMessage = message.toLowerCase();
    
    // Check for visualization keywords
    const isVisualizationQuery = VISUALIZATION_KEYWORDS.some(keyword => 
      lowercaseMessage.includes(keyword.toLowerCase())
    );
    
    if (isVisualizationQuery) {
      return 'claude';
    }
    
    // Check for research keywords
    const isResearchQuery = RESEARCH_KEYWORDS.some(keyword => 
      lowercaseMessage.includes(keyword.toLowerCase())
    );
    
    if (isResearchQuery) {
      return 'perplexity';
    }
    
    // Default to Claude for regular conversation
    return 'claude';
  }
  
  /**
   * Route the message to the appropriate service
   */
  async routeMessage(messages: { role: string; content: string }[], service?: string): Promise<{
    response: string;
    service: 'claude' | 'perplexity';
    visualizationData?: any;
    citations?: string[];
  }> {
    const lastMessage = messages[messages.length - 1];
    const determinedService = this.determineService(lastMessage.content, service as any);
    
    if (determinedService === 'perplexity') {
      const result = await perplexityService.performResearch(messages);
      return {
        response: result.response,
        service: 'perplexity',
        citations: result.citations
      };
    } else {
      const result = await claudeService.processConversation(messages);
      return {
        response: result.response,
        service: 'claude',
        visualizationData: result.visualizationData
      };
    }
  }
}

export const serviceRouter = new ServiceRouter();
