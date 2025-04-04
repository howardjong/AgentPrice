/**
 * Testing Helper Utilities
 * 
 * This module provides reusable testing functions that can be used
 * in both manual tests and automated test suites.
 */

/**
 * Create mock service implementations
 * @param {Object} options - Configuration options for mock services
 * @returns {Object} - Object containing mock service implementations
 */
export function createMockServices(options = {}) {
  const defaultConfig = {
    shouldFail: false,
    delay: 0,
    verbose: true
  };
  
  const config = { ...defaultConfig, ...options };
  
  // Helper to simulate API delay
  const simulateDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Helper to optionally log operations
  const log = (...args) => {
    if (config.verbose) {
      console.log(...args);
    }
  };
  
  // Mock Claude AI service
  const claudeService = {
    processText: async (prompt, options = {}) => {
      log(`[MOCK] Claude processing text: "${prompt.slice(0, 50)}..."`);
      
      if (config.delay) {
        await simulateDelay(config.delay);
      }
      
      if (config.shouldFail) {
        throw new Error('Simulated Claude API error');
      }
      
      return {
        content: `Mock response for: ${prompt.slice(0, 30)}...`,
        usage: { total_tokens: Math.floor(prompt.length / 4) + 50 }
      };
    },
    
    processConversation: async (messages, options = {}) => {
      const lastMessage = messages[messages.length - 1];
      log(`[MOCK] Claude processing conversation, last message: "${lastMessage.content.slice(0, 50)}..."`);
      
      if (config.delay) {
        await simulateDelay(config.delay);
      }
      
      if (config.shouldFail) {
        throw new Error('Simulated Claude API error');
      }
      
      return {
        content: `Mock conversation response for: ${lastMessage.content.slice(0, 30)}...`,
        response: `Mock conversation response for: ${lastMessage.content.slice(0, 30)}...`,
        usage: { total_tokens: Math.floor(JSON.stringify(messages).length / 10) + 100 }
      };
    },
    
    generateClarifyingQuestions: async (query) => {
      log(`[MOCK] Claude generating questions for: "${query}"`);
      
      if (config.delay) {
        await simulateDelay(config.delay);
      }
      
      if (config.shouldFail) {
        throw new Error('Simulated Claude API error');
      }
      
      return [
        "What is your current situation?",
        "What have you tried so far?",
        "What are your primary goals?",
        "What constraints are you working with?"
      ];
    },
    
    generateChartData: async (query) => {
      log(`[MOCK] Claude generating chart data for: "${query}"`);
      
      if (config.delay) {
        await simulateDelay(config.delay);
      }
      
      if (config.shouldFail) {
        throw new Error('Simulated Claude API error');
      }
      
      return {
        data: {
          x: [2020, 2021, 2022, 2023, 2024, 2025],
          y: [10, 15, 22, 30, 42, 55]
        },
        insights: [
          "The trend shows consistent growth over time",
          "The rate of increase is accelerating each year",
          "Projected growth for 2025 shows the largest year-over-year increase"
        ]
      };
    }
  };
  
  // Mock Perplexity research service
  const perplexityService = {
    researchTopic: async (query) => {
      log(`[MOCK] Perplexity researching: "${query}"`);
      
      if (config.delay) {
        await simulateDelay(config.delay);
      }
      
      if (config.shouldFail) {
        throw new Error('Simulated Perplexity API error');
      }
      
      // Generate different responses based on query content
      if (query.includes('trends') || query.includes('future')) {
        return "Future trends analysis shows several key developments including artificial intelligence integration, increased automation, and emphasis on sustainability across industries.";
      } else if (query.includes('history') || query.includes('background')) {
        return "Historical analysis reveals gradual evolution from early prototypes to modern implementations, with significant acceleration in development occurring post-2010.";
      } else {
        return `Comprehensive research results for query: "${query}" would include multiple perspectives, statistical data, and expert insights from relevant fields.`;
      }
    },
    
    getCitations: async (query) => {
      log(`[MOCK] Perplexity getting citations for: "${query}"`);
      
      if (config.delay) {
        await simulateDelay(config.delay);
      }
      
      if (config.shouldFail) {
        throw new Error('Simulated Perplexity API error');
      }
      
      return [
        { title: "Example Research Paper", url: "https://example.com/research", date: "2023" },
        { title: "Industry Analysis Report", url: "https://example.com/analysis", date: "2024" },
        { title: "Expert Commentary", url: "https://example.com/expert", date: "2024" }
      ];
    }
  };
  
  // Mock logger
  const logger = {
    level: 'info',
    info: config.verbose ? console.log : () => {},
    error: console.error,
    warn: config.verbose ? console.warn : () => {},
    debug: config.verbose ? console.debug : () => {}
  };
  
  return {
    claudeService,
    perplexityService,
    logger
  };
}

/**
 * Run performance benchmarks on service operations
 * @param {Object} service - The service to benchmark
 * @param {string} operation - Name of the operation to test
 * @param {Array} testCases - Array of test inputs
 * @returns {Object} - Performance metrics
 */
export async function benchmarkServiceOperation(service, operation, testCases) {
  if (!service || typeof service[operation] !== 'function') {
    throw new Error(`Invalid service or operation: ${operation}`);
  }
  
  const results = {
    operation,
    totalRuns: testCases.length,
    timings: [],
    averageMs: 0,
    minMs: Infinity,
    maxMs: 0,
    errors: 0
  };
  
  for (const testCase of testCases) {
    const start = performance.now();
    try {
      await service[operation](testCase);
      const end = performance.now();
      const duration = end - start;
      
      results.timings.push(duration);
      results.minMs = Math.min(results.minMs, duration);
      results.maxMs = Math.max(results.maxMs, duration);
    } catch (error) {
      results.errors++;
    }
  }
  
  // Calculate average (excluding errors)
  if (results.timings.length > 0) {
    const sum = results.timings.reduce((acc, time) => acc + time, 0);
    results.averageMs = sum / results.timings.length;
  }
  
  return results;
}

/**
 * Validate workflow output against expected format
 * @param {any} output - The workflow output to validate
 * @param {Object} schema - Simple validation schema
 * @returns {boolean} - True if valid, throws error otherwise
 */
export function validateWorkflowOutput(output, schema) {
  // Check required fields
  for (const [field, config] of Object.entries(schema)) {
    // Check if field exists
    if (config.required && (output[field] === undefined || output[field] === null)) {
      throw new Error(`Missing required field: ${field}`);
    }
    
    // Check field type
    if (output[field] !== undefined && config.type) {
      let typeValid = false;
      
      switch (config.type) {
        case 'string':
          typeValid = typeof output[field] === 'string';
          break;
        case 'number':
          typeValid = typeof output[field] === 'number';
          break;
        case 'boolean':
          typeValid = typeof output[field] === 'boolean';
          break;
        case 'array':
          typeValid = Array.isArray(output[field]);
          break;
        case 'object':
          typeValid = typeof output[field] === 'object' && !Array.isArray(output[field]);
          break;
      }
      
      if (!typeValid) {
        throw new Error(`Invalid type for field '${field}': expected ${config.type}`);
      }
    }
    
    // Check array minimum length
    if (config.type === 'array' && config.minItems && output[field].length < config.minItems) {
      throw new Error(`Array field '${field}' has fewer items than required (${output[field].length} < ${config.minItems})`);
    }
    
    // Check string minimum length
    if (config.type === 'string' && config.minLength && output[field].length < config.minLength) {
      throw new Error(`String field '${field}' is shorter than required (${output[field].length} < ${config.minLength})`);
    }
  }
  
  return true;
}

export default {
  createMockServices,
  benchmarkServiceOperation,
  validateWorkflowOutput
};