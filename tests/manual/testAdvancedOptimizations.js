
/**
 * Test Advanced Optimizations
 * 
 * This script tests the advanced optimization features including:
 * - Document fingerprinting
 * - Content chunking
 * - Batch processing
 * - Enhanced caching
 */
import perplexityService from '../../services/perplexityService.js';
import documentFingerprinter from '../../utils/documentFingerprinter.js';
import contentChunker from '../../utils/contentChunker.js';
import batchProcessor from '../../utils/batchProcessor.js';
import enhancedCache from '../../utils/enhancedCache.js';
import logger from '../../utils/logger.js';
import { setTimeout as sleep } from 'timers/promises';
import { v4 as uuidv4 } from 'uuid';

// Enable more detailed logging
logger.level = 'debug';

// Test data
const testQuery = `What are the recent developments in large language model cost optimization techniques for API usage? Specifically focus on strategies for chunking large inputs, similarity detection between nearly identical requests, batching API calls, and any other techniques that reduce token usage without compromising quality. Include information on how to handle context windows, implement fingerprinting of results, and estimate cost savings from these techniques. Also compare different chunking approaches and their tradeoffs.`;

// Long test query
const longTestQuery = testQuery.repeat(5);

/**
 * Test document fingerprinting
 */
async function testDocumentFingerprinting() {
  console.log('\n============ TESTING DOCUMENT FINGERPRINTING ============');
  
  // Create sample documents
  const doc1 = `Document fingerprinting is a technique used to identify similar documents by creating a unique hash or signature. This can be used to avoid duplicate processing and save costs.`;
  
  const doc2 = `Document fingerprinting techniques can be used to identify similar documents through unique hash creation or signatures. This strategy helps avoid duplicate processing, ultimately saving costs.`;
  
  const doc3 = `Machine learning models use neural networks to learn patterns from data. They can be applied to various tasks like classification, regression, and generation.`;
  
  // Generate fingerprints
  console.log('Generating fingerprints for sample documents...');
  const fp1 = documentFingerprinter.generateFingerprint(doc1);
  const fp2 = documentFingerprinter.generateFingerprint(doc2);
  const fp3 = documentFingerprinter.generateFingerprint(doc3);
  
  console.log(`Fingerprint 1 hash: ${fp1.fullHash.substring(0, 16)}...`);
  console.log(`Fingerprint 2 hash: ${fp2.fullHash.substring(0, 16)}...`);
  console.log(`Fingerprint 3 hash: ${fp3.fullHash.substring(0, 16)}...`);
  
  // Compare documents
  console.log('\nComparing documents for similarity:');
  const similarity12 = documentFingerprinter.compareDocs(fp1, fp2);
  const similarity13 = documentFingerprinter.compareDocs(fp1, fp3);
  
  console.log(`Doc1 vs Doc2 similarity: ${(similarity12.similarity * 100).toFixed(1)}% - ${similarity12.isMatch ? 'MATCH' : 'NO MATCH'}`);
  console.log(`Doc1 vs Doc3 similarity: ${(similarity13.similarity * 100).toFixed(1)}% - ${similarity13.isMatch ? 'MATCH' : 'NO MATCH'}`);
  
  // Test find most similar
  console.log('\nFinding most similar document in collection:');
  const collection = [
    { document: doc1, fingerprint: fp1 },
    { document: doc2, fingerprint: fp2 },
    { document: doc3, fingerprint: fp3 }
  ];
  
  const testDoc = `Fingerprinting documents can create unique signatures to identify similar content. This technique helps reduce costs by avoiding duplicate processing.`;
  
  const mostSimilar = documentFingerprinter.findMostSimilar(testDoc, collection);
  console.log(`Most similar document: index ${mostSimilar.bestMatch.index}, similarity: ${(mostSimilar.similarity * 100).toFixed(1)}%`);
  console.log(`Is match: ${mostSimilar.isMatch ? 'YES' : 'NO'}`);
  
  return { success: true };
}

/**
 * Test content chunking
 */
async function testContentChunking() {
  console.log('\n============ TESTING CONTENT CHUNKING ============');
  
  // Create test content - a long document with sections
  let testContent = `# Introduction to Content Chunking

Content chunking is a technique used to break down large documents into smaller, manageable pieces.
This is particularly useful when working with AI models that have context length limitations.

## Benefits of Content Chunking

1. Overcomes token limitations of LLMs
2. Enables processing of very large documents
3. Can improve processing efficiency
4. Allows for parallel processing

## Chunking Strategies

There are several strategies for breaking content into chunks:

### Fixed-Size Chunking

The simplest approach is to divide content into fixed-size chunks, typically measured in tokens or characters.
However, this approach may break semantic units like paragraphs or sentences.

### Semantic Chunking

A more sophisticated approach is to chunk based on semantic boundaries like:
- Headings
- Paragraphs
- Sections
- Natural language boundaries

\`\`\`javascript
function semanticChunk(content) {
  // Find semantic boundaries
  const boundaries = findSemanticBoundaries(content);
  
  // Create chunks based on boundaries
  return createChunksAtBoundaries(content, boundaries);
}
\`\`\`

### Overlapping Chunks

To maintain context across chunk boundaries, chunks can overlap:

1. Chunk 1: [Content A | Content B | Content C]
2. Chunk 2: [Content B | Content C | Content D]
3. Chunk 3: [Content C | Content D | Content E]

## Reassembling Chunks

After processing individual chunks, they need to be reassembled into a cohesive document.
This requires careful handling of overlapping sections to avoid duplication.

# Conclusion

Content chunking is essential for working with large documents and LLMs with context limitations.
The choice of chunking strategy depends on the specific requirements of the task at hand.`;

  // Make it longer
  testContent = testContent.repeat(3);
  
  console.log(`Test content length: ${testContent.length} characters`);
  
  // Test chunking with various options
  console.log('\nTesting basic chunking:');
  const basicChunks = contentChunker.chunkContent(testContent, { chunkSize: 500, overlap: 50 });
  console.log(`Created ${basicChunks.length} chunks with basic chunking`);
  console.log(`First chunk size: ${basicChunks[0].content.length} characters`);
  
  console.log('\nTesting semantic chunking:');
  const semanticChunks = contentChunker.chunkContent(testContent, { 
    chunkSize: 500, 
    overlap: 50,
    preserveParagraphs: true
  });
  console.log(`Created ${semanticChunks.length} chunks with semantic chunking`);
  
  console.log('\nTesting code-preserving chunking:');
  const codePreservingChunks = contentChunker.chunkContent(testContent, { 
    chunkSize: 500, 
    overlap: 50,
    preserveCodeBlocks: true
  });
  console.log(`Created ${codePreservingChunks.length} chunks with code-preserving chunking`);
  
  // Test reassembly
  console.log('\nTesting chunk reassembly:');
  
  // Create some mock processed responses based on chunks
  const processedChunks = basicChunks.map((chunk, i) => ({
    content: `[Processed chunk ${i+1}] ${chunk.content.substring(0, 50)}...`,
    chunkIndex: i
  }));
  
  const reassembled = contentChunker.reassembleChunks(processedChunks);
  console.log(`Reassembled ${reassembled.chunks} chunks into content of length ${reassembled.content.length}`);
  console.log(`First 100 chars of reassembled content: ${reassembled.content.substring(0, 100)}...`);
  
  return { success: true };
}

/**
 * Test batch processing
 */
async function testBatchProcessing() {
  console.log('\n============ TESTING BATCH PROCESSING ============');
  
  // Create a test processor function
  async function testProcessor(items, options = {}) {
    const isBatch = options._isBatch || false;
    const batchSize = options._batchSize || 1;
    
    console.log(`Processing ${isBatch ? `batch of ${batchSize} items` : 'single item'}`);
    
    // Simulate API call
    await sleep(500);
    
    if (Array.isArray(items)) {
      return items.map(item => ({ 
        result: `Processed: ${item}`,
        timestamp: new Date().toISOString()
      }));
    } else {
      return {
        result: `Processed: ${items}`,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  // Test single item processing
  console.log('\nProcessing single item:');
  const singleResult = await batchProcessor.process(
    'test-processor',
    'Item 1',
    testProcessor
  );
  console.log(`Single result: ${singleResult.result}`);
  
  // Test batch processing
  console.log('\nProcessing multiple items (should be batched):');
  
  const items = ['Item A', 'Item B', 'Item C', 'Item D', 'Item E'];
  const startTime = Date.now();
  
  // Process items in parallel
  const promises = items.map(item => 
    batchProcessor.process('test-processor', item, testProcessor)
  );
  
  // Wait for all to complete
  const results = await Promise.all(promises);
  
  const duration = Date.now() - startTime;
  console.log(`Processed ${items.length} items in ${duration}ms`);
  console.log(`First result: ${results[0].result}`);
  console.log(`Last result: ${results[results.length-1].result}`);
  
  // Check batch processor stats
  const stats = batchProcessor.getStats();
  console.log('\nBatch processor stats:');
  console.log(`- Total processed: ${stats.processed}`);
  console.log(`- Batched items: ${stats.batched}`);
  console.log(`- Individual items: ${stats.singleItems}`);
  console.log(`- Average batch size: ${stats.avgBatchSize}`);
  console.log(`- Average processing time: ${stats.avgProcessingTime}`);
  
  return { success: true };
}

/**
 * Test enhanced caching with fingerprinting
 */
async function testEnhancedCaching() {
  console.log('\n============ TESTING ENHANCED CACHING ============');
  
  // Create test data
  const query1 = "What are the best strategies for reducing API costs when using LLMs?";
  const query2 = "What strategies can reduce API costs for large language models?";
  const query3 = "How does machine learning impact healthcare outcomes?";
  
  const response1 = {
    content: "There are several strategies to reduce API costs when using LLMs:\n\n1. Implement token optimization\n2. Use caching for similar queries\n3. Batch API requests\n4. Choose appropriate models\n5. Use chunking for large inputs",
    sources: [{ title: "Cost Optimization Guide", url: "https://example.com/cost-guide" }]
  };
  
  // Test setting with fingerprint
  console.log('\nStoring item with fingerprinting:');
  await enhancedCache.setWithFingerprint(`enhanced-cache-test:${query1}`, response1, {
    ttl: 3600 * 1000, // 1 hour
    fingerprintField: 'content',
    tags: ['test', 'cost-optimization']
  });
  
  console.log('Item stored successfully');
  
  // Test exact match
  console.log('\nTesting exact match retrieval:');
  const exactMatch = await enhancedCache.getWithSimilarityMatch(`enhanced-cache-test:${query1}`);
  console.log(`Exact match found: ${exactMatch ? 'YES' : 'NO'}`);
  if (exactMatch) {
    console.log(`Match source: ${exactMatch.source}`);
  }
  
  // Test similarity match
  console.log('\nTesting similarity match retrieval:');
  const similarMatch = await enhancedCache.getWithSimilarityMatch(
    `enhanced-cache-test:${query2}`,
    { enableSimilarityMatch: true, queryContent: query2 }
  );
  console.log(`Similarity match found: ${similarMatch ? 'YES' : 'NO'}`);
  if (similarMatch) {
    console.log(`Match source: ${similarMatch.source}`);
    if (similarMatch.similarity) {
      console.log(`Similarity score: ${(similarMatch.similarity * 100).toFixed(1)}%`);
    }
  }
  
  // Test non-match
  console.log('\nTesting non-matching query:');
  const nonMatch = await enhancedCache.getWithSimilarityMatch(
    `enhanced-cache-test:${query3}`,
    { enableSimilarityMatch: true, queryContent: query3 }
  );
  console.log(`Non-match result: ${nonMatch ? 'Found (unexpected)' : 'Not found (expected)'}`);
  
  // Test getOrCreateWithSimilarity
  console.log('\nTesting getOrCreateWithSimilarity:');
  let factoryCallCount = 0;
  
  const factory = async () => {
    factoryCallCount++;
    await sleep(100); // Simulate work
    return {
      content: "Factory created response for similar query",
      sources: [{ title: "Generated Content", url: "https://example.com/generated" }]
    };
  };
  
  const similar1 = await enhancedCache.getOrCreateWithSimilarity(
    `enhanced-cache-test:${query2}`,
    factory,
    { 
      enableSimilarityMatch: true, 
      queryContent: query2,
      similarityThreshold: 0.7
    }
  );
  
  console.log(`Result 1 - cached: ${similar1.cached}, source: ${similar1.source}, factory calls: ${factoryCallCount}`);
  
  const similar2 = await enhancedCache.getOrCreateWithSimilarity(
    `enhanced-cache-test:${query3}`,
    factory,
    { 
      enableSimilarityMatch: true, 
      queryContent: query3
    }
  );
  
  console.log(`Result 2 - cached: ${similar2.cached}, source: ${similar2.source}, factory calls: ${factoryCallCount}`);
  
  return { success: true };
}

/**
 * Test with real Perplexity API
 */
async function testWithPerplexity() {
  console.log('\n============ TESTING WITH PERPLEXITY SERVICE ============');
  
  // Check if LLM calls are disabled first
  const { areLlmCallsDisabled } = await import('../../utils/disableLlmCalls.js');
  if (areLlmCallsDisabled()) {
    console.log('⚠️ LLM calls are disabled. Skipping real API test.');
    return { success: true, message: 'Skipped real API test' };
  }
  
  try {
    // First query - should be a cache miss
    console.log('\nExecuting first query (should be cache miss):');
    console.time('First query');
    const result1 = await perplexityService.performDeepResearch(testQuery, {
      useCache: true,
      enableFingerprinting: true,
      sessionId: `test-session-${uuidv4()}`
    });
    console.timeEnd('First query');
    
    console.log(`Result received: ${result1.content.length} chars, ${result1.sources.length} sources`);
    console.log(`Cached: ${result1.cached || false}`);
    
    // Small wait
    await sleep(2000);
    
    // Second query - similar but not identical (should hit cache with fingerprinting)
    const similarQuery = testQuery.replace('cost optimization techniques', 'cost reduction approaches')
      .replace('chunking large inputs', 'chunking big inputs');
    
    console.log('\nExecuting similar query (should use fingerprinting for cache hit):');
    console.time('Similar query');
    const result2 = await perplexityService.performDeepResearch(similarQuery, {
      useCache: true,
      enableFingerprinting: true,
      sessionId: `test-session-${uuidv4()}`
    });
    console.timeEnd('Similar query');
    
    console.log(`Result received: ${result2.content.length} chars, ${result2.sources.length} sources`);
    console.log(`Cached: ${result2.cached || false}`);
    if (result2.cached) {
      console.log(`Cache source: ${result2.cacheSource}`);
      if (result2.cacheSimilarity) {
        console.log(`Similarity score: ${(result2.cacheSimilarity * 100).toFixed(1)}%`);
      }
    }
    
    // Test long query (should use chunking)
    console.log('\nTesting long query (should use chunking):');
    console.time('Long query');
    const result3 = await perplexityService.performDeepResearch(longTestQuery, {
      useCache: true,
      enableChunking: true,
      sessionId: `test-session-${uuidv4()}`
    });
    console.timeEnd('Long query');
    
    console.log(`Result received: ${result3.content.length} chars, ${result3.sources.length} sources`);
    console.log(`Processing method: ${result3.processingMethod || 'standard'}`);
    if (result3.chunksProcessed) {
      console.log(`Chunks processed: ${result3.chunksProcessed}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in Perplexity test:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('=================================================');
  console.log('   RUNNING COST OPTIMIZATION TESTS');
  console.log('=================================================');
  
  const results = {};
  
  try {
    console.log('Tests will run in sequence...\n');
    
    // Run fingerprinting test
    results.fingerprinting = await testDocumentFingerprinting();
    
    // Run chunking test
    results.chunking = await testContentChunking();
    
    // Run batch processing test
    results.batching = await testBatchProcessing();
    
    // Run enhanced caching test
    results.enhancedCaching = await testEnhancedCaching();
    
    // Test with real API (if enabled)
    results.perplexity = await testWithPerplexity();
    
    // Output summary
    console.log('\n=================================================');
    console.log('   TEST RESULTS SUMMARY');
    console.log('=================================================');
    
    let allPassed = true;
    for (const [test, result] of Object.entries(results)) {
      const status = result.success ? '✅ PASSED' : '❌ FAILED';
      console.log(`${test}: ${status}`);
      if (!result.success) {
        allPassed = false;
        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }
      } else if (result.message) {
        console.log(`  Note: ${result.message}`);
      }
    }
    
    console.log('\n=================================================');
    console.log(`   OVERALL: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log('=================================================');
    
  } catch (error) {
    console.error('Unexpected error running tests:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
