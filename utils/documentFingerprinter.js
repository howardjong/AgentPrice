
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
    this.options = {
      // Minimum similarity score to consider documents similar (0-1)
      similarityThreshold: options.similarityThreshold || 0.85,
      // Number of most frequent terms to include in fingerprint
      signatureTermCount: options.signatureTermCount || 50,
      // Minimum term frequency to include in fingerprint
      minTermFrequency: options.minTermFrequency || 2,
      // Whether to normalize text before fingerprinting
      normalizeText: options.normalizeText !== false,
      // Cache of document hashes for quick lookups
      fingerprintCache: new Map()
    };
    
    // Stopwords to exclude from fingerprinting
    this.stopwords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
      'at', 'from', 'by', 'for', 'with', 'about', 'against', 'between', 
      'into', 'through', 'during', 'before', 'after', 'above', 'below', 
      'to', 'of', 'in', 'on', 'is', 'are', 'was', 'were', 'be', 'been', 
      'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);
  }
  
  /**
   * Generate a document fingerprint
   * @param {string} text - Document text
   * @param {Object} options - Fingerprinting options
   * @returns {Object} Fingerprint data
   */
  generateFingerprint(text, options = {}) {
    if (!text || typeof text !== 'string') {
      logger.warn('Invalid text provided for fingerprinting');
      return null;
    }
    
    const startTime = Date.now();
    
    // Create normalized text for processing
    const normalizedText = this.options.normalizeText ? 
      this.normalizeText(text) : text;
    
    // Create a simple hash of the entire document
    const fullHash = this.hashText(normalizedText);
    
    // Extract significant terms and their frequencies
    const termFrequencies = this.extractTermFrequencies(normalizedText);
    
    // Get the most frequent terms for the signature
    const signatureTerms = this.getSignatureTerms(
      termFrequencies, 
      options.signatureTermCount || this.options.signatureTermCount
    );
    
    // Create term frequency vector
    const termVector = this.createTermVector(signatureTerms);
    
    // Create the fingerprint object
    const fingerprint = {
      fullHash,
      signatureTerms,
      termVector,
      length: text.length,
      processingTime: Date.now() - startTime
    };
    
    // Cache the fingerprint for future comparisons
    const cacheKey = fullHash.substring(0, 10);
    this.options.fingerprintCache.set(cacheKey, fingerprint);
    
    logger.debug(`Document fingerprint generated in ${fingerprint.processingTime}ms`, {
      service: 'documentFingerprinter',
      termCount: Object.keys(signatureTerms).length,
      textLength: text.length
    });
    
    return fingerprint;
  }
  
  /**
   * Compare two documents for similarity
   * @param {string|Object} doc1 - First document text or fingerprint
   * @param {string|Object} doc2 - Second document text or fingerprint
   * @returns {Object} Similarity details
   */
  compareDocs(doc1, doc2) {
    // Convert strings to fingerprints if needed
    const fp1 = typeof doc1 === 'string' ? this.generateFingerprint(doc1) : doc1;
    const fp2 = typeof doc2 === 'string' ? this.generateFingerprint(doc2) : doc2;
    
    if (!fp1 || !fp2) {
      return { similarity: 0, isMatch: false };
    }
    
    // Quick check: if full hashes match, documents are identical
    if (fp1.fullHash === fp2.fullHash) {
      return { 
        similarity: 1, 
        isMatch: true,
        matchType: 'exact',
        details: 'Documents have identical hash'
      };
    }
    
    // Calculate cosine similarity between term vectors
    const similarity = this.calculateCosineSimilarity(fp1.termVector, fp2.termVector);
    
    // Determine if it's a match based on similarity threshold
    const threshold = this.options.similarityThreshold;
    const isMatch = similarity >= threshold;
    
    return {
      similarity,
      isMatch,
      matchType: isMatch ? 'similar' : 'different',
      details: isMatch ? 
        `Documents are ${(similarity * 100).toFixed(1)}% similar (above threshold of ${(threshold * 100).toFixed(1)}%)` :
        `Documents are ${(similarity * 100).toFixed(1)}% similar (below threshold of ${(threshold * 100).toFixed(1)}%)`
    };
  }
  
  /**
   * Find most similar document from a collection
   * @param {string|Object} targetDoc - Target document text or fingerprint
   * @param {Array} docCollection - Collection of documents to compare against
   * @returns {Object} Best match and similarity score
   */
  findMostSimilar(targetDoc, docCollection) {
    if (!targetDoc || !docCollection || !Array.isArray(docCollection) || docCollection.length === 0) {
      return { bestMatch: null, similarity: 0, isMatch: false };
    }
    
    // Convert target to fingerprint if needed
    const targetFp = typeof targetDoc === 'string' ? 
      this.generateFingerprint(targetDoc) : targetDoc;
    
    if (!targetFp) {
      return { bestMatch: null, similarity: 0, isMatch: false };
    }
    
    let bestMatch = null;
    let highestSimilarity = 0;
    
    // Compare with each document in collection
    for (let i = 0; i < docCollection.length; i++) {
      const doc = docCollection[i];
      const { document, fingerprint } = doc;
      
      // Get or generate fingerprint
      const docFp = fingerprint || this.generateFingerprint(document);
      
      // Calculate similarity
      const { similarity } = this.compareDocs(targetFp, docFp);
      
      // Track best match
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = { index: i, document: doc, similarity };
      }
    }
    
    // Determine if it's a match based on threshold
    const isMatch = highestSimilarity >= this.options.similarityThreshold;
    
    return {
      bestMatch,
      similarity: highestSimilarity,
      isMatch,
      matchType: isMatch ? 'similar' : 'different'
    };
  }
  
  /**
   * Normalize text for better comparison
   * @param {string} text - Text to normalize
   * @returns {string} Normalized text
   */
  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }
  
  /**
   * Create a hash of text content
   * @param {string} text - Text to hash
   * @returns {string} Hash string
   */
  hashText(text) {
    return crypto
      .createHash('sha256')
      .update(text)
      .digest('hex');
  }
  
  /**
   * Extract term frequencies from text
   * @param {string} text - Text to analyze
   * @returns {Object} Term frequency map
   */
  extractTermFrequencies(text) {
    const terms = text.split(/\s+/);
    const termFreq = {};
    
    // Count term frequencies
    for (const term of terms) {
      // Skip stopwords and short terms
      if (term.length < 3 || this.stopwords.has(term)) {
        continue;
      }
      
      termFreq[term] = (termFreq[term] || 0) + 1;
    }
    
    return termFreq;
  }
  
  /**
   * Get most significant terms for signature
   * @param {Object} termFreq - Term frequency map
   * @param {number} count - Number of terms to include
   * @returns {Object} Significant terms and frequencies
   */
  getSignatureTerms(termFreq, count) {
    // Sort terms by frequency
    const sortedTerms = Object.entries(termFreq)
      .filter(([_, freq]) => freq >= this.options.minTermFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count);
    
    // Convert back to object
    return Object.fromEntries(sortedTerms);
  }
  
  /**
   * Create term vector for similarity comparison
   * @param {Object} terms - Term frequency map
   * @returns {Object} Term vector
   */
  createTermVector(terms) {
    // Calculate magnitude for normalization
    const entries = Object.entries(terms);
    let magnitude = 0;
    
    for (const [_, freq] of entries) {
      magnitude += freq * freq;
    }
    
    magnitude = Math.sqrt(magnitude);
    
    // Create normalized vector
    const vector = {};
    for (const [term, freq] of entries) {
      vector[term] = freq / magnitude;
    }
    
    return vector;
  }
  
  /**
   * Calculate cosine similarity between term vectors
   * @param {Object} vector1 - First term vector
   * @param {Object} vector2 - Second term vector
   * @returns {number} Similarity score (0-1)
   */
  calculateCosineSimilarity(vector1, vector2) {
    let dotProduct = 0;
    
    // Calculate dot product
    for (const term in vector1) {
      if (vector2[term]) {
        dotProduct += vector1[term] * vector2[term];
      }
    }
    
    return dotProduct;
  }
  
  /**
   * Clear the fingerprint cache
   */
  clearCache() {
    const cacheSize = this.options.fingerprintCache.size;
    this.options.fingerprintCache.clear();
    logger.info(`Cleared fingerprint cache (${cacheSize} items)`);
  }
  
  /**
   * Get current cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: this.options.fingerprintCache.size
    };
  }
}

// Create and export singleton instance
const documentFingerprinter = new DocumentFingerprinter();
export default documentFingerprinter;
/**
 * Document Fingerprinter
 * 
 * Creates unique fingerprints of document content to enable content-based
 * caching and efficient similarity searching
 */
import crypto from 'crypto';
import logger from './logger.js';

class DocumentFingerprinter {
  constructor(options = {}) {
    this.similarityThreshold = options.similarityThreshold || 0.85;
    this.hashAlgorithm = options.hashAlgorithm || 'sha256';
    this.maxCacheSize = options.maxCacheSize || 100;
    this.fingerprintCache = new Map();
    this.keywordExtractors = new Map();
    
    // Configure for efficient memory usage
    this.enableTruncation = options.enableTruncation !== false;
    this.truncateLength = options.truncateLength || 1000;
    
    // Initialize keyword extractors for common content types
    this.initializeKeywordExtractors();
  }
  
  /**
   * Initialize keyword extractors for different content types
   */
  initializeKeywordExtractors() {
    // Text documents extractor (basic stopword removal and normalization)
    this.keywordExtractors.set('text', content => {
      const stopwords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 
        'be', 'been', 'being', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'as', 'of']);
      
      return content
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopwords.has(word)) // Filter stopwords and short words
        .slice(0, 100) // Limit to top 100 words for memory efficiency
        .join(' ');
    });
    
    // JSON document extractor (extracts keys and significant values)
    this.keywordExtractors.set('json', content => {
      try {
        const obj = typeof content === 'string' ? JSON.parse(content) : content;
        
        // Extract keys and some values as a fingerprint
        const keys = this.extractKeys(obj, 3);
        return keys.join(' ');
      } catch (e) {
        // If JSON parsing fails, fall back to text extraction
        return this.keywordExtractors.get('text')(content);
      }
    });
  }
  
  /**
   * Extract keys from an object up to a certain depth
   * @param {Object} obj - Object to extract keys from
   * @param {number} maxDepth - Maximum depth to traverse
   * @param {string} prefix - Prefix for nested keys
   * @returns {Array} Array of keys
   */
  extractKeys(obj, maxDepth = 3, prefix = '', depth = 0) {
    if (depth >= maxDepth || typeof obj !== 'object' || obj === null) {
      return [];
    }
    
    let keys = [];
    
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        keys.push(fullKey);
        
        // Include some values for better fingerprinting
        const value = obj[key];
        if (typeof value === 'string' && value.length < 50) {
          keys.push(value);
        } else if (typeof value === 'number') {
          keys.push(value.toString());
        }
        
        // Recursively process nested objects
        if (typeof value === 'object' && value !== null) {
          keys = keys.concat(this.extractKeys(value, maxDepth, fullKey, depth + 1));
        }
      }
    }
    
    return keys;
  }
  
  /**
   * Create a fingerprint for a document
   * @param {string|Object} content - Document content to fingerprint
   * @param {Object} options - Fingerprinting options
   * @returns {Object} Fingerprint object
   */
  createFingerprint(content, options = {}) {
    if (!content) {
      return { 
        hash: '',
        keywords: [],
        contentType: 'empty'
      };
    }
    
    // Determine content type
    const contentType = options.contentType || this.detectContentType(content);
    
    // Extract keywords based on content type
    let extractedContent = content;
    if (typeof content === 'object' && content !== null) {
      try {
        extractedContent = JSON.stringify(content);
      } catch (e) {
        logger.warn('Failed to stringify object for fingerprinting', { error: e.message });
        extractedContent = Object.keys(content).join(' ');
      }
    }
    
    // Truncate content if enabled to save memory
    if (this.enableTruncation && typeof extractedContent === 'string' && 
        extractedContent.length > this.truncateLength) {
      extractedContent = extractedContent.substring(0, this.truncateLength);
    }
    
    // Extract keywords using appropriate extractor
    const extractor = this.keywordExtractors.get(contentType) || this.keywordExtractors.get('text');
    const keywordText = extractor(extractedContent);
    
    // Create hash from keywords
    const hash = crypto
      .createHash(this.hashAlgorithm)
      .update(keywordText)
      .digest('hex');
    
    // Extract top keywords for similarity matching
    const keywords = keywordText.split(/\s+/).slice(0, 50);
    
    return {
      hash,
      keywords,
      contentType
    };
  }
  
  /**
   * Detect content type from the content
   * @param {string|Object} content - Content to analyze
   * @returns {string} Content type
   */
  detectContentType(content) {
    if (typeof content === 'object' && content !== null) {
      return 'json';
    }
    
    if (typeof content === 'string') {
      // Check if content is JSON
      if ((content.startsWith('{') && content.endsWith('}')) || 
          (content.startsWith('[') && content.endsWith(']'))) {
        try {
          JSON.parse(content);
          return 'json';
        } catch (e) {
          // Not valid JSON
        }
      }
      
      // Check if content is HTML
      if (content.includes('<html') || content.includes('<body') || 
          (content.includes('<') && content.includes('</') && content.includes('>'))) {
        return 'html';
      }
      
      // Check if content is CSV
      if (content.includes(',') && content.split('\n').length > 1) {
        const lines = content.split('\n');
        if (lines[0].split(',').length > 1 && lines[1].split(',').length > 1) {
          return 'csv';
        }
      }
    }
    
    // Default to text
    return 'text';
  }
  
  /**
   * Calculate similarity between two fingerprints
   * @param {Object} fingerprint1 - First fingerprint
   * @param {Object} fingerprint2 - Second fingerprint
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(fingerprint1, fingerprint2) {
    // If hashes match, they're identical
    if (fingerprint1.hash === fingerprint2.hash) {
      return 1.0;
    }
    
    // If content types differ significantly, reduce similarity
    const typeSimilarity = fingerprint1.contentType === fingerprint2.contentType ? 1.0 : 0.5;
    
    // Compare keywords using Jaccard index
    const keywords1 = new Set(fingerprint1.keywords);
    const keywords2 = new Set(fingerprint2.keywords);
    
    const intersection = new Set();
    for (const keyword of keywords1) {
      if (keywords2.has(keyword)) {
        intersection.add(keyword);
      }
    }
    
    const union = new Set([...keywords1, ...keywords2]);
    
    const jaccardIndex = union.size === 0 ? 0 : intersection.size / union.size;
    
    // Combine type similarity and keyword similarity
    return jaccardIndex * typeSimilarity;
  }
  
  /**
   * Get cached fingerprint or create a new one
   * @param {string} content - Content to fingerprint
   * @param {Object} options - Fingerprinting options
   * @returns {Object} Fingerprint object
   */
  getFingerprint(content, options = {}) {
    // Skip caching if the content is too large to save memory
    const skipCache = options.skipCache || 
      (typeof content === 'string' && content.length > 10000);
    
    if (!skipCache) {
      // Use the first 100 chars of the content as a cache key
      const cacheKey = typeof content === 'string' 
        ? content.substring(0, 100) 
        : JSON.stringify(content).substring(0, 100);
      
      // Check cache
      if (this.fingerprintCache.has(cacheKey)) {
        return this.fingerprintCache.get(cacheKey);
      }
      
      // Create new fingerprint
      const fingerprint = this.createFingerprint(content, options);
      
      // Manage cache size
      if (this.fingerprintCache.size >= this.maxCacheSize) {
        // Remove oldest entry (first key)
        const firstKey = this.fingerprintCache.keys().next().value;
        this.fingerprintCache.delete(firstKey);
      }
      
      // Cache the fingerprint
      this.fingerprintCache.set(cacheKey, fingerprint);
      
      return fingerprint;
    }
    
    // Skip caching for large content
    return this.createFingerprint(content, options);
  }
  
  /**
   * Find best matching document from a list based on similarity
   * @param {string} queryContent - Content to match
   * @param {Array} documents - Array of documents with content property
   * @param {Object} options - Options for matching
   * @returns {Object|null} Best matching document or null
   */
  findBestMatch(queryContent, documents, options = {}) {
    if (!queryContent || !documents || documents.length === 0) {
      return null;
    }
    
    const threshold = options.threshold || this.similarityThreshold;
    const contentField = options.contentField || 'content';
    
    // Create fingerprint for query
    const queryFingerprint = this.getFingerprint(queryContent);
    
    let bestMatch = null;
    let highestSimilarity = threshold;
    
    // Compare with each document
    for (const doc of documents) {
      if (!doc[contentField]) continue;
      
      // Create document fingerprint
      const docFingerprint = this.getFingerprint(doc[contentField]);
      
      // Calculate similarity
      const similarity = this.calculateSimilarity(queryFingerprint, docFingerprint);
      
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = {
          document: doc,
          similarity
        };
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Clear the fingerprint cache
   */
  clearCache() {
    this.fingerprintCache.clear();
  }
}

// Create singleton instance
const documentFingerprinter = new DocumentFingerprinter();
export default documentFingerprinter;
