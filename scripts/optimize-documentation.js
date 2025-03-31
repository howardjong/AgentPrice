
/**
 * Documentation Optimizer
 * 
 * This script analyzes markdown documents for duplicates and recommends
 * which documents to keep based on:
 * 1. Completeness (document size and structure)
 * 2. Content helpfulness (keyword analysis)
 * 3. Last updated timestamp (file modification time)
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const util = require('util');
const glob = util.promisify(require('glob'));

// Helpful terms that indicate document quality
const HELPFUL_TERMS = [
  'example', 'guide', 'tutorial', 'steps', 'instruction',
  'best practice', 'recommendation', 'solution', 'detail',
  'comprehensive', 'complete', 'thorough', 'workflow'
];

// Configuration
const CONFIG = {
  // Minimum similarity threshold to consider documents as duplicates (0-1)
  similarityThreshold: 0.75,
  // Weight factors for scoring
  weights: {
    completeness: 0.3,   // Document length and structure
    helpfulness: 0.4,    // Presence of helpful terms
    recency: 0.3         // Last modified timestamp
  },
  // Directories to scan for markdown files
  dirsToScan: [
    './',                 // Root directory
    './docs',            // Main documentation
    './tests/docs'       // Test documentation
  ],
  // Extensions to include
  extensions: ['.md'],
  // Files to exclude from duplicate analysis
  excludeFiles: [
    'README.md',          // Keep all READMEs
    'CONTRIBUTING.md',    // Keep contribution guidelines
    'MIGRATION_PROGRESS.md' // Keep migration progress tracking
  ]
};

/**
 * Main function to analyze and optimize documentation
 */
async function optimizeDocumentation() {
  console.log('=== Documentation Optimization Analysis ===');
  
  // Find all markdown files
  const files = await findMarkdownFiles();
  console.log(`Found ${files.length} markdown files to analyze`);
  
  // Read file contents and metadata
  const documents = await loadDocuments(files);
  console.log(`Loaded ${documents.length} documents for analysis`);
  
  // Find potential duplicates
  const duplicateSets = findDuplicates(documents);
  console.log(`Found ${duplicateSets.length} sets of potential duplicate documents`);
  
  // Analyze and recommend which documents to keep
  const recommendations = analyzeDuplicates(duplicateSets);
  
  // Print recommendations
  printRecommendations(recommendations);
  
  return recommendations;
}

/**
 * Find all markdown files in the specified directories
 */
async function findMarkdownFiles() {
  let allFiles = [];
  
  for (const dir of CONFIG.dirsToScan) {
    // Use glob to find markdown files
    const pattern = path.join(dir, '**', `*{${CONFIG.extensions.join(',')}}`);
    const files = await glob(pattern, { nodir: true });
    allFiles = allFiles.concat(files);
  }
  
  // Filter out excluded files
  return allFiles.filter(file => {
    const basename = path.basename(file);
    return !CONFIG.excludeFiles.some(excluded => basename === excluded);
  });
}

/**
 * Load document contents and metadata
 */
async function loadDocuments(files) {
  const documents = [];
  
  for (const file of files) {
    try {
      // Read file content
      const content = await fs.readFile(file, 'utf8');
      
      // Get file stats (for last modified time)
      const stats = await fs.stat(file);
      
      documents.push({
        path: file,
        content,
        size: content.length,
        lastModified: stats.mtime,
        basename: path.basename(file),
        directory: path.dirname(file)
      });
    } catch (error) {
      console.error(`Error loading document ${file}:`, error.message);
    }
  }
  
  return documents;
}

/**
 * Find potential duplicate documents based on content similarity
 */
function findDuplicates(documents) {
  const duplicateSets = [];
  const processedIndices = new Set();
  
  for (let i = 0; i < documents.length; i++) {
    if (processedIndices.has(i)) continue;
    
    const doc = documents[i];
    const similarDocs = [{ index: i, document: doc }];
    
    // Compare with all other documents
    for (let j = i + 1; j < documents.length; j++) {
      if (processedIndices.has(j)) continue;
      
      const otherDoc = documents[j];
      const similarity = calculateSimilarity(doc.content, otherDoc.content);
      
      if (similarity >= CONFIG.similarityThreshold) {
        similarDocs.push({ index: j, document: otherDoc });
        processedIndices.add(j);
      }
    }
    
    // If we found similar documents, add to our sets
    if (similarDocs.length > 1) {
      duplicateSets.push(similarDocs);
      processedIndices.add(i);
    }
  }
  
  return duplicateSets;
}

/**
 * Calculate content similarity between two documents
 */
function calculateSimilarity(contentA, contentB) {
  // Normalize content
  const normalizedA = normalizeContent(contentA);
  const normalizedB = normalizeContent(contentB);
  
  // Split into words
  const wordsA = normalizedA.split(/\s+/).filter(word => word.length > 2);
  const wordsB = normalizedB.split(/\s+/).filter(word => word.length > 2);
  
  // Create sets for comparison
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  
  // Calculate Jaccard similarity
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) {
      intersection++;
    }
  }
  
  const union = setA.size + setB.size - intersection;
  
  return union === 0 ? 0 : intersection / union;
}

/**
 * Normalize content for comparison
 */
function normalizeContent(content) {
  return content
    .toLowerCase()
    .replace(/[#*`_]/g, '') // Remove markdown formatting
    .replace(/\n+/g, ' ')   // Replace newlines with spaces
    .replace(/\s+/g, ' ')   // Normalize whitespace
    .trim();
}

/**
 * Analyze duplicate sets and make recommendations
 */
function analyzeDuplicates(duplicateSets) {
  const recommendations = [];
  
  for (const duplicateSet of duplicateSets) {
    // Score each document in the set
    const scoredDocs = duplicateSet.map(({ index, document }) => {
      const completenessScore = scoreCompleteness(document);
      const helpfulnessScore = scoreHelpfulness(document);
      const recencyScore = scoreRecency(document);
      
      // Calculate weighted total score
      const totalScore = 
        completenessScore * CONFIG.weights.completeness +
        helpfulnessScore * CONFIG.weights.helpfulness +
        recencyScore * CONFIG.weights.recency;
      
      return {
        index,
        document,
        scores: {
          completeness: completenessScore,
          helpfulness: helpfulnessScore,
          recency: recencyScore,
          total: totalScore
        }
      };
    });
    
    // Sort by total score (descending)
    scoredDocs.sort((a, b) => b.scores.total - a.scores.total);
    
    // The highest scoring document is our recommendation to keep
    recommendations.push({
      keep: scoredDocs[0],
      duplicates: scoredDocs.slice(1),
      similarity: calculateSimilarity(
        scoredDocs[0].document.content,
        scoredDocs[1].document.content
      )
    });
  }
  
  return recommendations;
}

/**
 * Score document for completeness
 */
function scoreCompleteness(document) {
  const { content, size } = document;
  
  // Factors that contribute to completeness
  const hasHeadings = (content.match(/^#+\s+.+$/gm) || []).length;
  const hasCodeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;
  const hasLists = (content.match(/^(\s*[-*+]|\s*\d+\.)\s+.+$/gm) || []).length;
  
  // Normalize size to 0-1 range (assume 10KB is maximum reasonable size)
  const normalizedSize = Math.min(size / 10000, 1);
  
  // Calculate score based on combination of factors
  return (
    normalizedSize * 0.4 +
    Math.min(hasHeadings / 10, 1) * 0.3 +
    Math.min(hasCodeBlocks / 5, 1) * 0.2 +
    Math.min(hasLists / 10, 1) * 0.1
  );
}

/**
 * Score document for helpfulness
 */
function scoreHelpfulness(document) {
  const { content } = document;
  const normalizedContent = content.toLowerCase();
  
  // Count occurrences of helpful terms
  let termCount = 0;
  for (const term of HELPFUL_TERMS) {
    const regex = new RegExp(term, 'g');
    const matches = normalizedContent.match(regex);
    if (matches) {
      termCount += matches.length;
    }
  }
  
  // Normalize term count (assume 20 occurrences is excellent)
  return Math.min(termCount / 20, 1);
}

/**
 * Score document for recency
 */
function scoreRecency(document) {
  const { lastModified } = document;
  
  // Calculate days since last modified
  const now = new Date();
  const diffTime = Math.abs(now - lastModified);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Normalize based on recency (30 days = 0.5 score)
  return Math.max(1 - (diffDays / 60), 0);
}

/**
 * Print recommendations in a readable format
 */
function printRecommendations(recommendations) {
  console.log('\n=== Documentation Optimization Recommendations ===\n');
  
  if (recommendations.length === 0) {
    console.log('No duplicate documents found. All documents are unique!');
    return;
  }
  
  for (let i = 0; i < recommendations.length; i++) {
    const { keep, duplicates, similarity } = recommendations[i];
    
    console.log(`Duplicate Set #${i + 1} (${(similarity * 100).toFixed(0)}% similar):`);
    console.log(`\n✅ KEEP: ${keep.document.path}`);
    console.log(`   Scores: Completeness=${(keep.scores.completeness * 100).toFixed(0)}%, ` +
                `Helpfulness=${(keep.scores.helpfulness * 100).toFixed(0)}%, ` +
                `Recency=${(keep.scores.recency * 100).toFixed(0)}%`);
    console.log(`   Last Modified: ${keep.document.lastModified.toISOString().split('T')[0]}`);
    console.log(`   Size: ${(keep.document.size / 1024).toFixed(1)}KB`);
    
    console.log('\n   Potential duplicates to consider moving or removing:');
    duplicates.forEach(dup => {
      console.log(`   ❌ ${dup.document.path}`);
      console.log(`      Scores: Completeness=${(dup.scores.completeness * 100).toFixed(0)}%, ` +
                  `Helpfulness=${(dup.scores.helpfulness * 100).toFixed(0)}%, ` +
                  `Recency=${(dup.scores.recency * 100).toFixed(0)}%`);
      console.log(`      Last Modified: ${dup.document.lastModified.toISOString().split('T')[0]}`);
      console.log(`      Size: ${(dup.document.size / 1024).toFixed(1)}KB`);
    });
    
    console.log('\n' + '-'.repeat(80) + '\n');
  }
  
  // Summary of all recommendations
  console.log('=== Summary ===');
  console.log(`Total duplicate sets found: ${recommendations.length}`);
  console.log(`Total documents to keep: ${recommendations.length}`);
  console.log(`Total potential duplicates: ${recommendations.reduce((sum, rec) => sum + rec.duplicates.length, 0)}`);
  
  console.log('\nRecommended actions:');
  console.log('1. Review each duplicate set and confirm the recommendation');
  console.log('2. Consider merging useful content from duplicates into the document to keep');
  console.log('3. Move or remove duplicates after confirming content is preserved');
}

/**
 * Create helper method to merge two documents
 */
async function mergeDocuments(primaryPath, secondaryPath, outputPath = null) {
  try {
    // If no output path specified, use the primary path
    outputPath = outputPath || primaryPath;
    
    // Read both documents
    const primaryContent = await fs.readFile(primaryPath, 'utf8');
    const secondaryContent = await fs.readFile(secondaryPath, 'utf8');
    
    // Extract title from secondary document
    const secondaryTitle = secondaryContent.match(/^#\s+(.+)$/m)?.[1] || 
                          path.basename(secondaryPath, '.md');
    
    // Create merged content
    const mergedContent = 
      primaryContent + 
      '\n\n## Additional Content from ' + secondaryTitle + '\n\n' +
      secondaryContent.replace(/^#\s+(.+)$/m, ''); // Remove main title
    
    // Write merged file
    await fs.writeFile(outputPath, mergedContent);
    
    console.log(`Successfully merged documents:`);
    console.log(`- Primary: ${primaryPath}`);
    console.log(`- Secondary: ${secondaryPath}`);
    console.log(`- Output: ${outputPath}`);
    
    return true;
  } catch (error) {
    console.error('Error merging documents:', error);
    return false;
  }
}

// Execute the optimization if run directly
if (require.main === module) {
  optimizeDocumentation().catch(error => {
    console.error('Error optimizing documentation:', error);
    process.exit(1);
  });
}

module.exports = {
  optimizeDocumentation,
  mergeDocuments
};
