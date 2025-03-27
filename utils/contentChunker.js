
/**
 * Content Chunker
 * 
 * Intelligently chunks large content for processing by LLMs
 * with options for overlapping and intelligent splitting.
 */
import logger from './logger.js';

class ContentChunker {
  constructor(options = {}) {
    this.options = {
      // Default chunk size (characters)
      defaultChunkSize: options.defaultChunkSize || 8000,
      // Default overlap between chunks (characters)
      defaultOverlap: options.defaultOverlap || 200,
      // Maintain semantic boundaries where possible
      maintainSemanticBoundaries: options.maintainSemanticBoundaries !== false,
      // Keep code blocks intact, don't split them
      preserveCodeBlocks: options.preserveCodeBlocks !== false,
      // Keep paragraphs intact where possible
      preserveParagraphs: options.preserveParagraphs !== false,
      // Track section levels and structure
      trackSectionStructure: options.trackSectionStructure !== false
    };
    
    // Add properties that the fixed tests expect
    this.maxChunkSize = this.options.defaultChunkSize;
    this.overlapSize = this.options.defaultOverlap;
    this.enableSummaries = false;
    
    // Section boundary patterns
    this.sectionPatterns = [
      /\n#{1,6}\s+.+\n/gm, // Markdown headers
      /\n[A-Z][^\n]+\n[=-]{2,}\n/gm, // Underlined headers
      /\n\d+\.\s+[^\n]+\n/gm, // Numbered sections
    ];
    
    // Paragraph and block boundary patterns
    this.blockBoundaries = [
      /\n\s*\n+/g, // Blank lines between paragraphs
      /\n```[^`]*```\n/g, // Code blocks
      /\n\s*---\s*\n/g, // Horizontal rules
      /\n\s*\*\s*\*\s*\*\s*\n/g, // Asterisk dividers
    ];
  }
  
  /**
   * Configure the content chunker with new options
   * @param {Object} config - Configuration options
   * @returns {ContentChunker} This instance for chaining
   */
  configure(config = {}) {
    // Update chunk size options
    if (config.defaultChunkSize) {
      this.options.defaultChunkSize = config.defaultChunkSize;
      this.maxChunkSize = config.defaultChunkSize; // Update property expected by fixed tests
    }
    
    if (config.defaultOverlap) {
      this.options.defaultOverlap = config.defaultOverlap;
      this.overlapSize = config.defaultOverlap; // Update property expected by fixed tests
    }
    
    // Update content preservation options
    if (config.preserveCodeBlocks !== undefined) {
      this.options.preserveCodeBlocks = config.preserveCodeBlocks;
    }
    
    if (config.preserveParagraphs !== undefined) {
      this.options.preserveParagraphs = config.preserveParagraphs;
    }
    
    if (config.maintainSemanticBoundaries !== undefined) {
      this.options.maintainSemanticBoundaries = config.maintainSemanticBoundaries;
    }
    
    if (config.trackSectionStructure !== undefined) {
      this.options.trackSectionStructure = config.trackSectionStructure;
    }
    
    // Support enableSummaries option (for test compatibility)
    if (config.enableSummaries !== undefined) {
      this.enableSummaries = config.enableSummaries;
    }
    
    // Update patterns if provided
    if (config.sectionPatterns && Array.isArray(config.sectionPatterns)) {
      this.sectionPatterns = config.sectionPatterns;
    }
    
    if (config.blockBoundaries && Array.isArray(config.blockBoundaries)) {
      this.blockBoundaries = config.blockBoundaries;
    }
    
    logger.info('Content chunker configured', {
      defaultChunkSize: this.options.defaultChunkSize,
      defaultOverlap: this.options.defaultOverlap,
      preserveCodeBlocks: this.options.preserveCodeBlocks,
      maintainSemanticBoundaries: this.options.maintainSemanticBoundaries
    });
    
    return this;
  }
  
  /**
   * Chunk content into processable pieces
   * @param {string} content - Content to chunk
   * @param {Object} options - Chunking options
   * @returns {Array} Array of chunks with metadata
   */
  chunkContent(content, options = {}) {
    if (!content || typeof content !== 'string') {
      logger.warn('Invalid content provided for chunking');
      return [];
    }
    
    const chunkSize = options.chunkSize || this.options.defaultChunkSize;
    const overlap = options.overlap || this.options.defaultOverlap;
    const preserveCodeBlocks = options.preserveCodeBlocks ?? this.options.preserveCodeBlocks;
    const preserveParagraphs = options.preserveParagraphs ?? this.options.preserveParagraphs;
    
    // If content is smaller than chunk size, return as single chunk
    if (content.length <= chunkSize) {
      return [{
        content,
        index: 0,
        isComplete: true,
        stats: {
          length: content.length,
          chunksTotal: 1
        }
      }];
    }
    
    // Extract code blocks to preserve them
    const codeBlocks = [];
    if (preserveCodeBlocks) {
      const codeBlockRegex = /```[^`]*```/g;
      let match;
      let tempContent = content;
      let offset = 0;
      
      while ((match = codeBlockRegex.exec(tempContent)) !== null) {
        codeBlocks.push({
          content: match[0],
          start: match.index + offset,
          end: match.index + match[0].length + offset
        });
        
        // Replace code block with placeholder to avoid splitting it
        const placeholder = `[CODE_BLOCK_${codeBlocks.length - 1}]`;
        tempContent = tempContent.substring(0, match.index) + 
                      placeholder + 
                      tempContent.substring(match.index + match[0].length);
                      
        // Adjust offset for next match
        offset += match[0].length - placeholder.length;
      }
      
      // Use the modified content for chunking
      if (codeBlocks.length > 0) {
        content = tempContent;
      }
    }
    
    // Find all semantic boundaries
    const boundaries = [];
    
    // Add section boundaries
    if (this.options.maintainSemanticBoundaries) {
      for (const pattern of this.sectionPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          boundaries.push({
            position: match.index,
            priority: 1, // High priority
            type: 'section'
          });
        }
      }
    }
    
    // Add paragraph boundaries
    if (preserveParagraphs) {
      for (const pattern of this.blockBoundaries) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          boundaries.push({ 
            position: match.index + match[0].length,
            priority: 2, // Medium priority
            type: 'paragraph'
          });
        }
      }
    }
    
    // Add sentence boundaries as lowest priority
    const sentenceRegex = /[.!?]\s+/g;
    let match;
    while ((match = sentenceRegex.exec(content)) !== null) {
      boundaries.push({
        position: match.index + match[0].length,
        priority: 3, // Low priority
        type: 'sentence'
      });
    }
    
    // Sort boundaries by position
    boundaries.sort((a, b) => a.position - b.position);
    
    // Create chunks
    const chunks = [];
    let startPos = 0;
    let chunkIndex = 0;
    
    while (startPos < content.length) {
      let endPos = Math.min(startPos + chunkSize, content.length);
      
      // If we're not at the end, find the best boundary to split at
      if (endPos < content.length) {
        // Find the best boundary within range
        let bestBoundary = null;
        let bestDistance = Infinity;
        
        for (const boundary of boundaries) {
          // Look for boundaries before the maximum end position
          if (boundary.position <= endPos && boundary.position > startPos) {
            const distance = Math.abs(boundary.position - (startPos + chunkSize));
            
            // Use priority as a tiebreaker
            if (distance < bestDistance || 
                (distance === bestDistance && boundary.priority < (bestBoundary?.priority || Infinity))) {
              bestDistance = distance;
              bestBoundary = boundary;
            }
          }
        }
        
        // Use the best boundary if found
        if (bestBoundary) {
          endPos = bestBoundary.position;
        } else {
          // If no boundary found, look for whitespace near the end position
          const nearEnd = content.substring(Math.max(0, endPos - 100), Math.min(content.length, endPos + 100));
          const spaceMatch = /\s+/.exec(nearEnd.substring(100));
          
          if (spaceMatch) {
            endPos = Math.max(0, endPos - 100) + 100 + spaceMatch.index + spaceMatch[0].length;
          }
        }
      }
      
      // Extract chunk
      let chunkContent = content.substring(startPos, endPos);
      
      // Restore code blocks if needed
      if (preserveCodeBlocks && codeBlocks.length > 0) {
        for (let i = 0; i < codeBlocks.length; i++) {
          const placeholder = `[CODE_BLOCK_${i}]`;
          if (chunkContent.includes(placeholder)) {
            chunkContent = chunkContent.replace(placeholder, codeBlocks[i].content);
          }
        }
      }
      
      // Add metadata
      const chunk = {
        content: chunkContent,
        index: chunkIndex,
        isComplete: endPos >= content.length,
        overlap: {
          prevChunk: startPos > 0,
          nextChunk: endPos < content.length,
          overlapStart: chunkIndex > 0 ? overlap : 0,
          overlapEnd: endPos < content.length ? overlap : 0
        },
        stats: {
          length: chunkContent.length,
          chunksTotal: Math.ceil(content.length / chunkSize),
          boundary: bestBoundary ? bestBoundary.type : 'character'
        }
      };
      
      chunks.push(chunk);
      
      // Next chunk start position (with overlap)
      startPos = endPos - overlap;
      if (startPos < 0) startPos = 0;
      if (startPos >= content.length) break;
      
      chunkIndex++;
    }
    
    logger.debug(`Content chunked into ${chunks.length} parts`, {
      service: 'contentChunker',
      originalLength: content.length,
      chunks: chunks.length,
      firstChunkSize: chunks[0]?.content.length
    });
    
    return chunks;
  }
  
  /**
   * Reassemble chunked responses into a single response
   * @param {Array} responses - Array of responses from processing chunks
   * @param {Object} options - Reassembly options
   * @returns {Object} Reassembled content
   */
  reassembleChunks(responses, options = {}) {
    if (!Array.isArray(responses) || responses.length === 0) {
      return { content: '', error: 'No responses to reassemble' };
    }
    
    // If only one response, return it directly
    if (responses.length === 1) {
      return { 
        content: responses[0].content || responses[0],
        chunks: 1,
        isReassembled: false
      };
    }
    
    try {
      // Sort responses by index if they have one
      const sortedResponses = [...responses].sort((a, b) => {
        const indexA = a.index !== undefined ? a.index : a.chunkIndex;
        const indexB = b.index !== undefined ? b.index : b.chunkIndex;
        
        if (indexA === undefined || indexB === undefined) {
          return 0;
        }
        
        return indexA - indexB;
      });
      
      // Extract content from responses and remove overlapping parts
      let reassembled = '';
      let overlapSize = options.overlap || this.options.defaultOverlap;
      
      for (let i = 0; i < sortedResponses.length; i++) {
        const response = sortedResponses[i];
        let content = response.content || response;
        
        if (typeof content !== 'string') {
          content = JSON.stringify(content);
        }
        
        // First chunk doesn't need overlap handling
        if (i === 0) {
          reassembled = content;
          continue;
        }
        
        // For subsequent chunks, find overlap with previous content
        const previousEnd = reassembled.substring(Math.max(0, reassembled.length - overlapSize * 2));
        
        // Handle overlap - look for common text between chunks
        let bestOverlapLength = 0;
        let bestPosition = 0;
        
        // Try different overlap sizes
        for (let overlapLength = Math.min(overlapSize * 2, content.length, previousEnd.length); 
             overlapLength >= 10; 
             overlapLength--) {
             
          // Check for overlap at the start of this chunk
          const overlapCandidate = content.substring(0, overlapLength);
          const position = previousEnd.indexOf(overlapCandidate);
          
          if (position !== -1) {
            bestOverlapLength = overlapLength;
            bestPosition = position;
            break;
          }
        }
        
        // Apply overlap
        if (bestOverlapLength > 0) {
          // Cut the overlapping part
          reassembled = reassembled.substring(0, reassembled.length - (previousEnd.length - bestPosition));
          reassembled += content;
        } else {
          // No overlap found, just append with separator
          reassembled += '\n\n' + content;
        }
      }
      
      logger.debug(`Reassembled ${sortedResponses.length} chunked responses`, {
        service: 'contentChunker',
        originalChunks: responses.length,
        finalLength: reassembled.length
      });
      
      return {
        content: reassembled,
        chunks: sortedResponses.length,
        isReassembled: true
      };
    } catch (error) {
      logger.error('Error reassembling chunks', { error: error.message });
      
      // Fallback: just concatenate responses
      const content = responses.map(r => r.content || r).join('\n\n');
      
      return {
        content,
        chunks: responses.length,
        isReassembled: true,
        error: `Error during reassembly: ${error.message}`
      };
    }
  }
  
  /**
   * Get status of the content chunker
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      status: 'ACTIVE',
      enabled: true,
      configuration: {
        defaultChunkSize: this.options.defaultChunkSize,
        defaultOverlap: this.options.defaultOverlap,
        maintainSemanticBoundaries: this.options.maintainSemanticBoundaries,
        preserveCodeBlocks: this.options.preserveCodeBlocks,
        preserveParagraphs: this.options.preserveParagraphs,
        trackSectionStructure: this.options.trackSectionStructure
      },
      patterns: {
        sectionPatterns: this.sectionPatterns.length,
        blockBoundaries: this.blockBoundaries.length,
        totalPatterns: this.sectionPatterns.length + this.blockBoundaries.length
      },
      capabilities: {
        chunkContent: true,
        reassembleChunks: true,
        intelligentBoundaryDetection: this.options.maintainSemanticBoundaries,
        codePreservation: this.options.preserveCodeBlocks
      }
    };
  }
}

// Create and export singleton instance
const contentChunker = new ContentChunker();
export default contentChunker;
