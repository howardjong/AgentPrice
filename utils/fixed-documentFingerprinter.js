/**
 * Document Fingerprinter
 * 
 * Creates fingerprints of documents/responses to detect similarities
 * and avoid redundant API calls for similar content.
 */
import crypto from 'crypto';
import logger from './logger.js';

class DocumentFingerprinter {
  constructor(options = {}) {
    // Combine configuration from both implementations
    this.options = {
      // Minimum similarity score to consider documents similar (0-1)
      similarityThreshold: options.similarityThreshold || 0.85,
      // Number of most frequent terms to include in fingerprint
      signatureTermCount: options.signatureTermCount || 50,
      // Minimum term frequency to include in fingerprint
      minTermFrequency: options.minTermFrequency || 2,
      // Whether to normalize text before fingerprinting
      normalizeText: options.normalizeText !== false,
      // Hash algorithm to use
      hashAlgorithm: options.hashAlgorithm || 'sha256',
      // Maximum cache size
      maxCacheSize: options.maxCacheSize || 100,
      // Enable truncation for memory efficiency
      enableTruncation: options.enableTruncation !== false,
      // Truncate length for large texts
      truncateLength: options.truncateLength || 1000
    };
    
    // For backward compatibility
    this.similarityThreshold = this.options.similarityThreshold;
    this.hashAlgorithm = this.options.hashAlgorithm;
    this.maxCacheSize = this.options.maxCacheSize;
    
    // Cache of document hashes for quick lookups
    this.fingerprintCache = new Map();
    this.keywordExtractors = new Map();
    
    // Initialize keyword extractors for common content types
    this.initializeKeywordExtractors();
    
    // Stopwords to exclude from fingerprinting
    this.stopwords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
      'at', 'from', 'by', 'for', 'with', 'about', 'against', 'between', 
      'into', 'through', 'during', 'before', 'after', 'above', 'below', 
      'to', 'in', 'on', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'will',
      'would', 'shall', 'should', 'may', 'might', 'must', 'of', 'as', 'this',
      'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their'
    ]);
  }
  
  /**
   * Initialize keyword extractors for different content types
   */
  initializeKeywordExtractors() {
    // Text documents extractor (basic stopword removal and normalization)
    this.keywordExtractors.set('text', content => {
      // Use our main stopwords set
      return content
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter(word => word.length > 2 && !this.stopwords.has(word))
        .map(word => word.trim())
        .filter(Boolean);
    });
    
    // Code extractor (preserve syntax-specific keywords)
    this.keywordExtractors.set('code', content => {
      // For code, we preserve identifiers, function names, etc.
      const codeTokens = content
        .split(/[\s\{\}\(\)\[\];:=<>]/g)
        .filter(token => token.length > 2)
        .map(token => token.trim())
        .filter(Boolean);
      
      return codeTokens;
    });
    
    // Default extractor falls back to text
    this.keywordExtractors.set('default', content => {
      return this.keywordExtractors.get('text')(content);
    });
  }
  
  /**
   * Create a fingerprint for a document
   * @param {string} content - Document content
   * @param {string} contentType - Type of content ('text', 'code', etc.)
   * @returns {Object} Fingerprint with hash, terms, and metadata
   */
  createFingerprint(content, contentType = 'text') {
    if (!content) {
      return { hash: '', terms: {}, similarity: 0 };
    }
    
    // Truncate content if enabled and necessary
    if (this.options.enableTruncation && content.length > this.options.truncateLength) {
      content = content.substring(0, this.options.truncateLength);
    }
    
    // Normalize content based on type
    if (this.options.normalizeText) {
      content = this.normalizeContent(content, contentType);
    }
    
    // Generate hash
    const hash = this.generateHash(content);
    
    // Extract term frequencies
    const terms = this.extractTermFrequencies(content, contentType);
    
    // Create signature from most frequent terms
    const signature = this.createSignature(terms);
    
    return {
      hash,
      terms,
      signature,
      contentType,
      timestamp: Date.now(),
      contentLength: content.length
    };
  }
  
  /**
   * Normalize content based on content type
   * @param {string} content - Content to normalize
   * @param {string} contentType - Type of content
   * @returns {string} Normalized content
   */
  normalizeContent(content, contentType = 'text') {
    switch (contentType) {
      case 'text':
        // For text, lowercase and trim whitespace
        return content.toLowerCase().trim().replace(/\s+/g, ' ');
        
      case 'code':
        // For code, preserve case but normalize whitespace
        return content.trim().replace(/\s+/g, ' ');
        
      default:
        return content.trim();
    }
  }
  
  /**
   * Generate a hash for a string
   * @param {string} content - Content to hash
   * @returns {string} Hash
   */
  generateHash(content) {
    return crypto
      .createHash(this.options.hashAlgorithm)
      .update(content)
      .digest('hex');
  }
  
  /**
   * Extract term frequencies from content
   * @param {string} content - Document content
   * @param {string} contentType - Content type
   * @returns {Object} Term frequencies
   */
  extractTermFrequencies(content, contentType = 'text') {
    // Get the appropriate extractor for this content type
    const extractor = this.keywordExtractors.get(contentType) || 
                     this.keywordExtractors.get('default');
    
    // Extract terms
    const terms = extractor(content);
    
    // Calculate term frequencies
    const termFrequencies = {};
    for (const term of terms) {
      termFrequencies[term] = (termFrequencies[term] || 0) + 1;
    }
    
    return termFrequencies;
  }
  
  /**
   * Create a signature from term frequencies
   * @param {Object} termFrequencies - Term frequencies
   * @returns {Object} Signature with most frequent terms
   */
  createSignature(termFrequencies) {
    // Sort terms by frequency
    const sortedTerms = Object.entries(termFrequencies)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, freq]) => freq >= this.options.minTermFrequency)
      .slice(0, this.options.signatureTermCount)
      .map(([term]) => term);
    
    return sortedTerms;
  }
  
  /**
   * Check if document is similar to a cached document
   * @param {string} content - Document content
   * @param {string} contentType - Content type
   * @returns {Object|null} Match if found, null otherwise
   */
  findSimilar(content, contentType = 'text') {
    // Create fingerprint for this content
    const fingerprint = this.createFingerprint(content, contentType);
    
    // First, check for exact hash match
    for (const [cachedHash, cachedFingerprint] of this.fingerprintCache.entries()) {
      if (fingerprint.hash === cachedHash) {
        return {
          match: cachedFingerprint,
          similarity: 1.0,
          exactMatch: true
        };
      }
    }
    
    // If no exact match, check for similarity
    let bestMatch = null;
    let highestSimilarity = 0;
    
    for (const [_, cachedFingerprint] of this.fingerprintCache.entries()) {
      // Skip different content types
      if (cachedFingerprint.contentType !== contentType) {
        continue;
      }
      
      const similarity = this.calculateSimilarity(fingerprint, cachedFingerprint);
      
      if (similarity >= this.options.similarityThreshold && similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = cachedFingerprint;
      }
    }
    
    if (bestMatch) {
      return {
        match: bestMatch,
        similarity: highestSimilarity,
        exactMatch: false
      };
    }
    
    return null;
  }
  
  /**
   * Calculate similarity between two fingerprints
   * @param {Object} fp1 - First fingerprint
   * @param {Object} fp2 - Second fingerprint
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(fp1, fp2) {
    // Calculate Jaccard similarity between signatures
    const set1 = new Set(fp1.signature);
    const set2 = new Set(fp2.signature);
    
    let intersection = 0;
    for (const term of set1) {
      if (set2.has(term)) {
        intersection++;
      }
    }
    
    const union = set1.size + set2.size - intersection;
    
    return union === 0 ? 0 : intersection / union;
  }
  
  /**
   * Add a document to the cache
   * @param {string} content - Document content
   * @param {string} contentType - Content type
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Fingerprint
   */
  addToCache(content, contentType = 'text', metadata = {}) {
    const fingerprint = this.createFingerprint(content, contentType);
    
    // Add metadata
    fingerprint.metadata = metadata;
    
    // Add to cache
    this.fingerprintCache.set(fingerprint.hash, fingerprint);
    
    // Enforce cache size limit
    if (this.fingerprintCache.size > this.options.maxCacheSize) {
      // Remove oldest entry
      const oldestKey = this.fingerprintCache.keys().next().value;
      this.fingerprintCache.delete(oldestKey);
    }
    
    return fingerprint;
  }
  
  /**
   * Clear the fingerprint cache
   */
  clearCache() {
    this.fingerprintCache.clear();
    logger.info('Document fingerprint cache cleared');
  }
  
  /**
   * Get the size of the fingerprint cache
   * @returns {number} Cache size
   */
  getCacheSize() {
    return this.fingerprintCache.size;
  }
}

// Create and export singleton instance
const documentFingerprinter = new DocumentFingerprinter();
export default documentFingerprinter;