
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
