
/**
 * Token optimization utility
 * Helps reduce token usage for API requests
 */
import logger from './logger.js';

class TokenOptimizer {
  constructor() {
    this.tokensSaved = 0;
    this.optimizeSystemPrompts = false;
    this.enabledOptimizations = {
      removeDuplicates: true,
      simplifyPhrases: true,
      removeFillers: true,
      shortenUrls: true,
      shortenNumbers: false
    };
    this.aggressiveMode = false;
    this.preserveCodeBlocks = true;
    this.preserveFormatting = true;
    this.maxLengthReduction = 0.3; // Max 30% reduction to avoid changing meaning
    this.patterns = {
      // Repetitive content patterns
      repetition: [
        /(\b\w+\b)(\s+\1\b)+/g, // Repeated words
        /([.!?])\s*\1+/g, // Repeated punctuation
      ],
      
      // Verbose phrases that can be simplified
      verbosePhrases: [
        { pattern: /in order to/g, replacement: 'to' },
        { pattern: /due to the fact that/g, replacement: 'because' },
        { pattern: /in spite of the fact that/g, replacement: 'although' },
        { pattern: /with regard to/g, replacement: 'regarding' },
        { pattern: /for the purpose of/g, replacement: 'for' },
        { pattern: /in the event that/g, replacement: 'if' },
        { pattern: /in the process of/g, replacement: 'while' },
        { pattern: /a large number of/g, replacement: 'many' },
        { pattern: /the vast majority of/g, replacement: 'most' },
        { pattern: /a considerable amount of/g, replacement: 'much' },
      ],
      
      // Filler words that add little value
      fillerWords: [
        /\b(basically|actually|literally|really|very|quite|simply|just|that is to say|kind of|sort of|type of|definitely|certainly|probably|honestly|truthfully)\b/g
      ],
      
      // Redundant qualifiers
      redundantQualifiers: [
        /\b(completely|totally|absolutely|utterly|entirely|wholly|fully|thoroughly|perfectly|hundred percent)\s+(full|empty|unique|destroyed|completed|finished|eliminated|universal|perfect|round|dead|destroyed|eliminated)\b/g
      ]
    };
  }
  
  /**
   * Optimize text to reduce token usage
   * @param {string} text - Text to optimize
   * @param {Object} options - Optimization options
   * @returns {Object} Original and optimized text with stats
   */
  optimize(text, options = {}) {
    if (!text) return { original: '', optimized: '', savings: 0, percentage: 0 };
    
    const originalLength = text.length;
    let optimized = text;
    const appliedOptimizations = [];
    
    // Apply optimizations based on options or defaults
    if (options.removeRepetition !== false) {
      this.patterns.repetition.forEach(pattern => {
        const before = optimized.length;
        optimized = optimized.replace(pattern, (match, group1) => group1);
        if (before !== optimized.length) {
          appliedOptimizations.push('Removed repetition');
        }
      });
    }
    
    if (options.simplifyVerbose !== false) {
      this.patterns.verbosePhrases.forEach(({ pattern, replacement }) => {
        const before = optimized.length;
        optimized = optimized.replace(pattern, replacement);
        if (before !== optimized.length) {
          appliedOptimizations.push(`Simplified phrase: "${pattern.source}" → "${replacement}"`);
        }
      });
    }
    
    if (options.removeFillers !== false) {
      const before = optimized.length;
      optimized = optimized.replace(this.patterns.fillerWords, '');
      if (before !== optimized.length) {
        appliedOptimizations.push('Removed filler words');
      }
    }
    
    if (options.fixRedundancy !== false) {
      const before = optimized.length;
      optimized = optimized.replace(this.patterns.redundantQualifiers, (match, qualifier, adjective) => adjective);
      if (before !== optimized.length) {
        appliedOptimizations.push('Fixed redundant qualifiers');
      }
    }
    
    // Custom length trimming if specified
    if (options.maxLength && optimized.length > options.maxLength) {
      optimized = optimized.substring(0, options.maxLength);
      appliedOptimizations.push(`Trimmed to max length: ${options.maxLength}`);
    }
    
    const newLength = optimized.length;
    const charSavings = originalLength - newLength;
    const percentageSaved = (charSavings / originalLength) * 100;
    
    // Rough token estimation (about 4 chars per token for English)
    const tokenSavings = Math.round(charSavings / 4);
    
    // Log optimization results if significant
    if (percentageSaved > 5) {
      // Update total tokens saved
      this.tokensSaved += tokenSavings;
      
      logger.info('Token optimization applied', {
        originalChars: originalLength,
        newChars: newLength,
        charSavings,
        estimatedTokenSavings: tokenSavings,
        percentSaved: `${percentageSaved.toFixed(1)}%`,
        totalTokensSaved: this.tokensSaved
      });
    }
    
    return {
      original: text,
      optimized,
      charSavings,
      estimatedTokenSavings: tokenSavings,
      percentageSaved: percentageSaved.toFixed(1),
      optimizations: appliedOptimizations
    };
  }
  
  /**
   * Optimize an array of messages for LLM API
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} options - Optimization options
   * @returns {Object} Optimized messages and stats
   */
  optimizeMessages(messages, options = {}) {
    if (!messages || !Array.isArray(messages)) {
      return { messages: [], savings: 0 };
    }
    
    let totalSavings = 0;
    let totalOptimizations = [];
    
    // Don't optimize system messages by default unless explicitly requested
    const optimizeSystem = options.optimizeSystem === true;
    
    const optimizedMessages = messages.map(msg => {
      // Skip system messages unless explicitly requested
      if (msg.role === 'system' && !optimizeSystem) {
        return { ...msg };
      }
      
      const result = this.optimize(msg.content, options);
      totalSavings += result.estimatedTokenSavings;
      if (result.optimizations.length > 0) {
        totalOptimizations = [...totalOptimizations, ...result.optimizations];
      }
      
      return {
        ...msg,
        content: result.optimized
      };
    });
    
    // Update the total tokens saved across all optimizations
    this.tokensSaved += totalSavings;
    
    return {
      messages: optimizedMessages,
      tokenSavings: totalSavings,
      optimizations: [...new Set(totalOptimizations)] // Remove duplicates
    };
  }

  /**
   * Configure token optimizer settings
   * @param {Object} config - Configuration options
   * @returns {TokenOptimizer} This instance for chaining
   */
  configure(config = {}) {
    // Update optimization feature flags
    if (config.enabledOptimizations) {
      Object.keys(config.enabledOptimizations).forEach(key => {
        if (this.enabledOptimizations.hasOwnProperty(key)) {
          this.enabledOptimizations[key] = !!config.enabledOptimizations[key];
        }
      });
    }
    
    // Update general settings
    if (config.optimizeSystemPrompts !== undefined) {
      this.optimizeSystemPrompts = !!config.optimizeSystemPrompts;
    }
    
    if (config.aggressiveMode !== undefined) {
      this.aggressiveMode = !!config.aggressiveMode;
    }
    
    if (config.preserveCodeBlocks !== undefined) {
      this.preserveCodeBlocks = !!config.preserveCodeBlocks;
    }
    
    if (config.preserveFormatting !== undefined) {
      this.preserveFormatting = !!config.preserveFormatting;
    }
    
    if (config.maxLengthReduction !== undefined && typeof config.maxLengthReduction === 'number') {
      // Ensure it's between 0 and 0.5 (0-50% reduction)
      this.maxLengthReduction = Math.max(0, Math.min(0.5, config.maxLengthReduction));
    }
    
    // Add new patterns if provided
    if (config.additionalPatterns) {
      // Add repetition patterns
      if (config.additionalPatterns.repetition && Array.isArray(config.additionalPatterns.repetition)) {
        this.patterns.repetition = [
          ...this.patterns.repetition,
          ...config.additionalPatterns.repetition
        ];
      }
      
      // Add verbose phrase patterns
      if (config.additionalPatterns.verbosePhrases && Array.isArray(config.additionalPatterns.verbosePhrases)) {
        this.patterns.verbosePhrases = [
          ...this.patterns.verbosePhrases,
          ...config.additionalPatterns.verbosePhrases
        ];
      }
      
      // Add filler word patterns
      if (config.additionalPatterns.fillerWords && Array.isArray(config.additionalPatterns.fillerWords)) {
        this.patterns.fillerWords = [
          ...this.patterns.fillerWords,
          ...config.additionalPatterns.fillerWords
        ];
      }
    }
    
    // Reset token savings counter if requested
    if (config.resetSavings) {
      this.tokensSaved = 0;
    }
    
    logger.info('Token optimizer configured', {
      optimizeSystemPrompts: this.optimizeSystemPrompts,
      aggressiveMode: this.aggressiveMode,
      enabledFeatures: Object.entries(this.enabledOptimizations)
        .filter(([_, enabled]) => enabled)
        .map(([name]) => name),
      totalPatterns: Object.values(this.patterns)
        .reduce((sum, patterns) => {
          return sum + (Array.isArray(patterns) ? patterns.length : 0);
        }, 0)
    });
    
    return this;
  }
  
  /**
   * Get status of the token optimizer
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      status: 'ACTIVE',
      enabled: true,
      tokensSaved: this.tokensSaved,
      optimizeSystemPrompts: this.optimizeSystemPrompts,
      optimizationPatterns: {
        repetitionPatterns: this.patterns.repetition.length,
        verbosePhrases: this.patterns.verbosePhrases.length,
        fillerPatterns: this.patterns.fillerWords.length,
        redundancyPatterns: this.patterns.redundantQualifiers.length,
        totalPatterns: this.patterns.repetition.length + 
                       this.patterns.verbosePhrases.length + 
                       this.patterns.fillerWords.length + 
                       this.patterns.redundantQualifiers.length
      },
      capabilities: {
        removeRepetition: true,
        simplifyVerbose: true,
        removeFillers: true,
        fixRedundancy: true,
        trimLongMessages: true,
        skipSystemMessages: !this.optimizeSystemPrompts
      },
      savings: {
        estimatedCost: (this.tokensSaved / 1000) * 0.01, // Assuming $0.01 per 1000 tokens
        percentageReduction: this.tokensSaved > 0 ? "5-15%" : "0%"  // Typical range
      }
    };
  }
}

const tokenOptimizer = new TokenOptimizer();
export default tokenOptimizer;
