
/**
 * Compare-Cached-Results
 * 
 * This script compares previously run test results from different prompt versions
 * without making new API calls. It uses the data stored in tests/output/ to analyze
 * performance differences between prompt versions.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import promptVersioner from '../../utils/promptVersioner.js';
import promptManager from '../../services/promptManager.js';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

// Metrics to analyze in the responses
const PRICING_TERMS = [
  'pricing', 'price', 'cost', 'subscription', 'tier', 'plan', 'freemium',
  'premium', 'enterprise', 'basic', 'standard', 'professional', 'discount'
];

const VAN_WESTENDORP_TERMS = [
  'van westendorp', 'price sensitivity', 'too cheap', 'bargain', 'expensive',
  'rejection point', 'optimal price point'
];

const CONJOINT_TERMS = [
  'conjoint analysis', 'willingness to pay', 'price elasticity', 'feature value',
  'attribute preference', 'customer preference'
];

async function ensureOutputDirectory() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (error) {
    // Ignore error if directory already exists
  }
}

/**
 * Find all previously saved test results
 */
async function findCachedResults() {
  try {
    const files = await fs.readdir(OUTPUT_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    // Group files by test type
    const deepResearchResults = jsonFiles.filter(file => file.includes('deep-research-results'));
    const versionResults = jsonFiles.filter(file => file.includes('-results.json') && !file.includes('deep-research-results'));
    
    return { deepResearchResults, versionResults };
  } catch (error) {
    console.error('Error finding cached results:', error);
    return { deepResearchResults: [], versionResults: [] };
  }
}

/**
 * Load and parse a specific result file
 */
async function loadResultFile(filename) {
  try {
    const filePath = path.join(OUTPUT_DIR, filename);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return null;
  }
}

/**
 * Extract version name from filename
 */
function extractVersionFromFilename(filename) {
  // Handle different filename patterns
  const match = filename.match(/^([^-]+)-results\.json$/);
  if (match && match[1]) {
    return match[1];
  }
  return 'unknown';
}

/**
 * Analyze content for metrics
 */
function analyzeContent(content) {
  // Count mentions of pricing-related terms
  const pricingMentions = PRICING_TERMS.reduce((count, term) => {
    const regex = new RegExp(term, 'gi');
    const matches = content.match(regex) || [];
    return count + matches.length;
  }, 0);

  // Check for Van Westendorp mentions
  const vanWestendorpMentions = VAN_WESTENDORP_TERMS.reduce((count, term) => {
    const regex = new RegExp(term, 'gi');
    const matches = content.match(regex) || [];
    return count + matches.length;
  }, 0);

  // Check for Conjoint Analysis mentions
  const conjointMentions = CONJOINT_TERMS.reduce((count, term) => {
    const regex = new RegExp(term, 'gi');
    const matches = content.match(regex) || [];
    return count + matches.length;
  }, 0);

  // Extract structured data if available (looking for tables, etc.)
  const tableCount = (content.match(/\|/g) || []).length / 4; // Rough estimate of markdown tables
  const listCount = (content.match(/^\s*[\d-]+\.\s+/gm) || []).length; // Numbered or bullet lists
  
  // Calculate a quality score based on these metrics
  const structureScore = Math.min(25, (tableCount * 5) + (listCount * 3));
  const pricingScore = Math.min(30, pricingMentions);
  const analysisScore = Math.min(30, (vanWestendorpMentions * 5) + (conjointMentions * 5));
  const lengthScore = Math.min(15, content.length / 500);
  
  const totalScore = structureScore + pricingScore + analysisScore + lengthScore;
  const qualityRating = totalScore >= 80 ? 'Excellent' :
                     totalScore >= 60 ? 'Good' :
                     totalScore >= 40 ? 'Average' :
                     'Below Average';

  return {
    mentionsPricing: pricingMentions,
    vanWestendorp: {
      mentions: vanWestendorpMentions,
      score: vanWestendorpMentions * 5
    },
    conjoint: {
      mentions: conjointMentions,
      score: conjointMentions * 5
    },
    structure: {
      tables: tableCount,
      lists: listCount,
      score: structureScore
    },
    quality: {
      totalScore,
      qualityRating,
      lengthScore,
      pricingScore,
      analysisScore,
      structureScore
    }
  };
}

/**
 * Extract snippet from content
 */
function extractSnippet(content, pattern) {
  const match = content.match(pattern);
  if (!match) return null;

  const matchIndex = match.index;
  const snippetStart = Math.max(0, matchIndex - 100);
  const snippetEnd = Math.min(content.length, matchIndex + 300);

  return content.substring(snippetStart, snippetEnd) + "...";
}

/**
 * Format timestamp for human-readable display
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Compare cached results from different prompt versions
 */
async function compareCachedResults() {
  console.log("\n==== COMPARING CACHED PROMPT VERSION RESULTS ====\n");
  console.log("Focusing on pricing analysis metrics (Van Westendorp and Conjoint Analysis)");
  await ensureOutputDirectory();

  try {
    // Initialize prompt manager
    await promptManager.initialize();

    // Get available prompt versions
    const versions = await promptVersioner.listVersions('perplexity', 'deep_research');
    console.log("Available prompt versions:", versions.availableVersions);
    console.log("Currently active version:", versions.activeVersion);

    // Find cached results
    const { deepResearchResults, versionResults } = await findCachedResults();
    console.log(`\nFound ${deepResearchResults.length} deep research results and ${versionResults.length} version-specific results`);

    // Analyze the most recent test run first (deep-research-results.json)
    if (deepResearchResults.length > 0) {
      console.log("\n=== Most Recent Deep Research Result ===");
      const latestResult = await loadResultFile(deepResearchResults[0]);
      if (latestResult) {
        console.log(`Query: "${latestResult.query}"`);
        console.log(`Timestamp: ${formatTimestamp(latestResult.timestamp)}`);
        console.log(`Model: ${latestResult.result.modelUsed}`);
        
        // Analyze content
        const metrics = analyzeContent(latestResult.result.content);
        console.log(`Pricing mentions: ${metrics.mentionsPricing}`);
        console.log(`Van Westendorp mentions: ${metrics.vanWestendorp.mentions}`);
        console.log(`Conjoint analysis mentions: ${metrics.conjoint.mentions}`);
        console.log(`Quality score: ${metrics.quality.totalScore}/100 (${metrics.quality.qualityRating})`);
      }
    }

    // Compare version-specific results if available
    if (versionResults.length > 0) {
      console.log("\n=== Comparing Version-Specific Results ===");
      
      const comparisonResults = [];
      
      // Analyze each version result
      for (const resultFile of versionResults) {
        const versionName = extractVersionFromFilename(resultFile);
        console.log(`\n--- Analyzing version: ${versionName} ---`);
        
        const versionResult = await loadResultFile(resultFile);
        if (!versionResult) continue;
        
        // Check if this is a properly formatted version result
        if (!versionResult.version || !versionResult.result) {
          console.log(`Skipping ${resultFile} - not in expected version result format`);
          continue;
        }
        
        console.log(`Test ran at: ${formatTimestamp(versionResult.timestamp)}`);
        console.log(`Model used: ${versionResult.result.modelUsed}`);
        console.log(`Sources: ${versionResult.result.sources.length}`);
        
        // Analyze the content
        const metrics = analyzeContent(versionResult.result.content);
        
        // Store metrics for comparison
        comparisonResults.push({
          version: versionResult.version,
          timestamp: versionResult.timestamp,
          metrics,
          sources: versionResult.result.sources.length,
          model: versionResult.result.modelUsed
        });
        
        // Display metrics
        console.log(`Pricing mentions: ${metrics.mentionsPricing}`);
        console.log(`Van Westendorp mentions: ${metrics.vanWestendorp.mentions}`);
        console.log(`Conjoint analysis mentions: ${metrics.conjoint.mentions}`);
        console.log(`Quality score: ${metrics.quality.totalScore}/100 (${metrics.quality.qualityRating})`);
        
        // Check if we have Van Westendorp analysis
        if (metrics.vanWestendorp.mentions > 0) {
          const snippet = extractSnippet(versionResult.result.content, /van\s+westendorp/i);
          if (snippet) {
            console.log("\nVan Westendorp analysis snippet:");
            console.log("---------------------------------");
            console.log(snippet);
          }
        }
      }

      // Create table headers for results comparison
      console.log("\n=== METRICS COMPARISON TABLE ===");
      console.log("| VERSION | TIMESTAMP | SOURCES | VAN WESTENDORP | CONJOINT | PRICE MENTIONS | QUALITY |");
      console.log("|---------|-----------|---------|----------------|----------|----------------|---------|");
      
      // Sort by quality score
      comparisonResults.sort((a, b) => b.metrics.quality.totalScore - a.metrics.quality.totalScore);
      
      // Display table rows
      for (const result of comparisonResults) {
        console.log(`| ${result.version.padEnd(7)} | ${formatTimestamp(result.timestamp).substring(0, 10)} | ${String(result.sources).padEnd(7)} | ${String(result.metrics.vanWestendorp.mentions).padEnd(14)} | ${String(result.metrics.conjoint.mentions).padEnd(8)} | ${String(result.metrics.mentionsPricing).padEnd(14)} | ${result.metrics.quality.totalScore}/100 |`);
      }
      
      // Determine which version is better for pricing analysis
      if (comparisonResults.length >= 2) {
        const best = comparisonResults[0];
        console.log(`\nVersion "${best.version}" appears to provide the best pricing analysis with a score of ${best.metrics.quality.totalScore}/100`);
        
        // Compare top two versions if we have at least two
        if (comparisonResults.length >= 2) {
          const secondBest = comparisonResults[1];
          const difference = best.metrics.quality.totalScore - secondBest.metrics.quality.totalScore;
          
          console.log(`\nComparison between top two versions:`);
          console.log(`- "${best.version}" scores ${best.metrics.quality.totalScore}/100`);
          console.log(`- "${secondBest.version}" scores ${secondBest.metrics.quality.totalScore}/100`);
          console.log(`- Difference: ${difference} points (${Math.round(difference / secondBest.metrics.quality.totalScore * 100)}% improvement)`);
          
          if (best.metrics.vanWestendorp.mentions > secondBest.metrics.vanWestendorp.mentions) {
            console.log(`- "${best.version}" has ${best.metrics.vanWestendorp.mentions - secondBest.metrics.vanWestendorp.mentions} more Van Westendorp references`);
          }
          
          if (best.metrics.conjoint.mentions > secondBest.metrics.conjoint.mentions) {
            console.log(`- "${best.version}" has ${best.metrics.conjoint.mentions - secondBest.metrics.conjoint.mentions} more Conjoint Analysis references`);
          }
        }
      }
    } else {
      console.log("\nNo version-specific test results found. Try running compare-prompt-versions.js first to generate test data.");
    }

    console.log("\n==== CACHED RESULTS COMPARISON TEST COMPLETED ====");

  } catch (error) {
    console.error("Error in cached results comparison:", error);
    logger.error(`Test failed: ${error.message}`);
  }
}

// Run the comparison
compareCachedResults();
