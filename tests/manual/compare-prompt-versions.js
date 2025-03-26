/**
 * Test script to compare different versions of the deep research prompt
 * This helps evaluate how prompt changes affect the quality of research results
 * with specific focus on pricing analysis metrics
 */

import perplexityService from '../../services/perplexityService.js';
import promptManager from '../../services/promptManager.js';
import promptVersioner from '../../utils/promptVersioner.js';
import logger from '../../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Set up output directory
const OUTPUT_DIR = path.join(process.cwd(), 'tests', 'output', 'prompt-comparison');

async function ensureOutputDirectory() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (error) {
    logger.error(`Error creating output directory: ${error.message}`);
  }
}

// Sample query to test with
const testQuery = "What are the current market pricing models for subscription SaaS products in the productivity space?";

/**
 * Extract Van Westendorp pricing sensitivity metrics from content
 * @param {string} content - The research content text
 * @return {object} Metrics related to Van Westendorp model
 */
function extractVanWestendorpMetrics(content) {
  return {
    mentions: (content.match(/van westendorp/gi) || []).length,
    pricePoints: (content.match(/price point/gi) || []).length,
    tooCheap: (content.match(/too cheap|lower threshold|quality concern/gi) || []).length,
    bargain: (content.match(/bargain|good value|fair price/gi) || []).length,
    tooExpensive: (content.match(/too expensive|upper threshold|expensive but acceptable/gi) || []).length,
    rejectionPoint: (content.match(/rejection point|price ceiling|maximum acceptable/gi) || []).length,
    priceSensitivity: (content.match(/price sensitivity|sensitivity analysis|price elasticity/gi) || []).length,
    optimalPricePoint: (content.match(/optimal price|optimum price|ideal price point/gi) || []).length,
    // Check if all four price points are mentioned together
    completeModel: /too cheap.*bargain.*expensive.*rejection|lower threshold.*value.*upper threshold.*ceiling/is.test(content),
    // Determine if price ranges are included with specific values
    includesPriceRanges: (/\$\d+\.?\d*\s*[-–—]\s*\$\d+\.?\d*/i).test(content),
  };
}

/**
 * Extract conjoint analysis metrics from content
 * @param {string} content - The research content text
 * @return {object} Metrics related to conjoint analysis
 */
function extractConjointMetrics(content) {
  return {
    mentions: (content.match(/conjoint analysis|conjoint study/gi) || []).length,
    willingness: (content.match(/willingness to pay|wtp|price sensitivity/gi) || []).length,
    featureImportance: (content.match(/feature importance|attribute importance/gi) || []).length,
    utilityScores: (content.match(/utility score|utility value|part-worth/gi) || []).length,
    preferenceData: (content.match(/preference data|consumer preference|customer preference/gi) || []).length,
    segmentAnalysis: (content.match(/segment analysis|market segment|customer segment/gi) || []).length,
    priceImpact: (content.match(/impact of price|price impact|price effect/gi) || []).length,
    elasticity: (content.match(/price elasticity|elasticity of demand|elastic/gi) || []).length,
    // Check if there are quantitative data references
    includesPercentages: (/%\s*\d+|\d+\s*%/).test(content),
    includesStatistics: (/statistical significance|confidence interval|p-value|correlation/i).test(content),
  };
}

/**
 * Generate an overall quality score based on the pricing analysis metrics
 * @param {object} vanWestendorp - Van Westendorp metrics
 * @param {object} conjoint - Conjoint analysis metrics 
 * @param {object} general - General metrics
 * @return {object} Scoring and evaluation 
 */
function calculateQualityScore(vanWestendorp, conjoint, general) {
  // Calculate base scores
  const vanWestendorpScore = 
    (vanWestendorp.mentions * 2) + 
    (vanWestendorp.completeModel ? 10 : 0) + 
    (vanWestendorp.tooCheap + vanWestendorp.bargain + vanWestendorp.tooExpensive + vanWestendorp.rejectionPoint) +
    (vanWestendorp.includesPriceRanges ? 5 : 0) +
    (vanWestendorp.optimalPricePoint * 2);

  const conjointScore = 
    (conjoint.mentions * 2) + 
    (conjoint.willingness * 2) + 
    (conjoint.featureImportance + conjoint.utilityScores + conjoint.preferenceData + conjoint.segmentAnalysis) +
    (conjoint.includesPercentages ? 5 : 0) +
    (conjoint.includesStatistics ? 5 : 0);

  const pricingDataScore = 
    (general.mentionsPricing * 0.5) +
    (general.priceTiers * 2) +
    (general.priceComparisons * 2) +
    (general.competitorPricing * 2) +
    (general.priceStrategy * 1.5);

  // Calculate total score (max 100)
  const totalScore = Math.min(100, Math.floor(
    (vanWestendorpScore * 0.35) + 
    (conjointScore * 0.35) + 
    (pricingDataScore * 0.3)
  ));

  // Determine quality rating
  let qualityRating;
  if (totalScore >= 85) qualityRating = "Excellent";
  else if (totalScore >= 70) qualityRating = "Very Good";
  else if (totalScore >= 50) qualityRating = "Good";
  else if (totalScore >= 30) qualityRating = "Fair";
  else qualityRating = "Poor";

  return {
    vanWestendorpScore,
    conjointScore,
    pricingDataScore,
    totalScore,
    qualityRating
  };
}

async function comparePromptVersions() {
  console.log("\n==== COMPARING PROMPT VERSIONS FOR DEEP RESEARCH ====\n");
  console.log("Focusing on pricing analysis metrics (Van Westendorp and Conjoint Analysis)");
  await ensureOutputDirectory();

  try {
    // Initialize prompt manager
    await promptManager.initialize();

    // Get available versions
    const versions = await promptVersioner.listVersions('perplexity', 'deep_research');
    console.log("Available versions:", versions.availableVersions);
    console.log("Active version:", versions.activeVersion);

    // Select versions to compare (latest and previous)
    const versionsToTest = versions.availableVersions;
    if (versionsToTest.length < 2) {
      console.log("Need at least two versions to compare. Please create more versions first.");
      return;
    }

    // Create a simplified test query
    const enhancedQuery = `
${testQuery}

Additional focus areas:
- Price point comparison between competitors
- Freemium vs. paid-only models
- Feature-based pricing strategies
- Regional pricing variations
- Consumer price sensitivity (Van Westendorp model)
- Willingness-to-pay metrics from conjoint analysis
`;

    console.log("Using test query:", enhancedQuery);

    // Create table headers for results comparison
    console.log("\n=== METRICS COMPARISON TABLE ===");
    console.log("| VERSION | SOURCES | VAN WESTENDORP | CONJOINT | PRICE MENTIONS | COMP. PRICING | QUALITY |");
    console.log("|---------|---------|----------------|----------|----------------|---------------|---------|");

    const comparisonResults = [];

    // Test each version
    for (const version of versionsToTest) {
      console.log(`\n--- Testing with version: ${version} ---`);

      try {
        // Switch to this version
        await promptVersioner.switchToVersion('perplexity', 'deep_research', version);
        console.log(`Switched to version: ${version}`);

        // Perform research with this version
        console.time(`Research with ${version}`);
        const researchJobId = uuidv4();
        const researchResults = await perplexityService.performDeepResearch(enhancedQuery, {
          jobId: researchJobId
        });
        console.timeEnd(`Research with ${version}`);

        // Log research results
        console.log(`Research completed with ${researchResults.sources.length} sources`);
        console.log(`Content length: ${researchResults.content.length} characters`);

        // Extract general metrics for comparison
        const generalMetrics = {
          sourceCount: researchResults.sources.length,
          contentLength: researchResults.content.length,
          mentionsPricing: (researchResults.content.match(/pric(e|ing)/gi) || []).length,
          mentionsCompetitors: (researchResults.content.match(/competitor|competition/gi) || []).length,
          mentionsMarket: (researchResults.content.match(/market/gi) || []).length,
          mentionsAnalysis: (researchResults.content.match(/analysis|analytic/gi) || []).length,
          priceTiers: (researchResults.content.match(/tier|plan|package/gi) || []).length,
          priceComparisons: (researchResults.content.match(/compare|versus|vs\.|comparison/gi) || []).length,
          competitorPricing: (researchResults.content.match(/competitor pric|competitive pric/gi) || []).length,
          priceStrategy: (researchResults.content.match(/strategy|approach|model/gi) || []).length,
        };

        // Extract Van Westendorp metrics
        const vanWestendorpMetrics = extractVanWestendorpMetrics(researchResults.content);

        // Extract conjoint analysis metrics
        const conjointMetrics = extractConjointMetrics(researchResults.content);

        // Calculate quality score
        const qualityScore = calculateQualityScore(vanWestendorpMetrics, conjointMetrics, generalMetrics);

        // Display detailed metrics
        console.log("\n=== DETAILED METRICS ===");
        console.log("General Metrics:", generalMetrics);
        console.log("Van Westendorp Metrics:", vanWestendorpMetrics);
        console.log("Conjoint Analysis Metrics:", conjointMetrics);
        console.log("Quality Score:", qualityScore);

        // Extract brief snippets related to Van Westendorp and conjoint analysis
        const vanWestendorpSnippet = extractSnippet(researchResults.content, /van westendorp|price sensitivity/i);
        const conjointSnippet = extractSnippet(researchResults.content, /conjoint analysis|willingness to pay/i);

        if (vanWestendorpSnippet) {
          console.log("\nVan Westendorp Snippet:");
          console.log(vanWestendorpSnippet);
        }

        if (conjointSnippet) {
          console.log("\nConjoint Analysis Snippet:");
          console.log(conjointSnippet);
        }

        // Add to comparison table
        console.log(`| ${version.padEnd(7)} | ${generalMetrics.sourceCount.toString().padEnd(7)} | ${vanWestendorpMetrics.mentions.toString().padEnd(14)} | ${conjointMetrics.mentions.toString().padEnd(8)} | ${generalMetrics.mentionsPricing.toString().padEnd(14)} | ${generalMetrics.competitorPricing.toString().padEnd(13)} | ${qualityScore.qualityRating.padEnd(7)} |`);

        // Store combined metrics
        const combinedMetrics = {
          ...generalMetrics,
          vanWestendorp: vanWestendorpMetrics,
          conjoint: conjointMetrics,
          quality: qualityScore
        };

        // Save research results
        const outputPath = path.join(OUTPUT_DIR, `${version}-results.json`);
        await fs.writeFile(
          outputPath,
          JSON.stringify({
            version,
            query: enhancedQuery,
            result: researchResults,
            metrics: combinedMetrics,
            timestamp: new Date().toISOString()
          }, null, 2)
        );
        console.log(`Results saved to ${outputPath}`);

        // Save just the raw content for easier review
        const contentPath = path.join(OUTPUT_DIR, `${version}-content.txt`);
        await fs.writeFile(
          contentPath,
          researchResults.content
        );
        console.log(`Raw content saved to ${contentPath}`);

        // Add to comparison results
        comparisonResults.push({
          version,
          metrics: combinedMetrics,
          sources: researchResults.sources.length
        });

      } catch (error) {
        console.error(`Error testing version ${version}:`, error.message);
      }
    }

    // Restore the active version
    await promptVersioner.switchToVersion('perplexity', 'deep_research', versions.activeVersion);
    console.log(`\nRestored active version: ${versions.activeVersion}`);

    // Generate scorecards and compare versions
    if (comparisonResults.length >= 2) {
      console.log("\n=== GENERATING SCORECARDS FOR VERSION COMPARISON ===");
      
      import('../../utils/promptScorecard.js').then(async (module) => {
        const promptScorecard = module.default;
        
        // Generate scorecard for each result
        const scorecards = [];
        for (const result of comparisonResults) {
          console.log(`Generating scorecard for version: ${result.version}`);
          const scorecard = promptScorecard.generateScorecard(result);
          scorecards.push(scorecard);
          
          // Save the individual scorecard
          await promptScorecard.saveScorecard(
            scorecard, 
            result.version, 
            'perplexity', 
            'deep_research'
          );
        }
        
        // Compare scorecards
        const comparison = promptScorecard.compareScorecards(scorecards);
        
        // Sort by quality score
        scorecards.sort((a, b) => b.metrics.quality.totalScore - a.metrics.quality.totalScore);
        
        console.log("\n=== VERSION COMPARISON SUMMARY ===");
        console.log("Versions ranked by pricing analysis quality:");
        
        scorecards.forEach((scorecard, index) => {
          console.log(`${index + 1}. Version ${scorecard.version}: ${scorecard.metrics.quality.qualityRating} (${scorecard.metrics.quality.totalScore}/100)`);
          console.log(`   - Van Westendorp mentions: ${scorecard.metrics.vanWestendorp.mentions}`);
          console.log(`   - Conjoint analysis mentions: ${scorecard.metrics.conjoint.mentions}`);
          console.log(`   - Pricing mentions: ${scorecard.metrics.mentionsPricing}`);
          console.log(`   - Sources: ${scorecard.metrics.sources}`);
        });
        
        // Determine which version is better for pricing analysis
        const best = scorecards[0];
        console.log(`\nVersion ${best.version} appears to provide the best pricing analysis with a score of ${best.metrics.quality.totalScore}/100`);
        
        // Save HTML report
        const html = promptScorecard.generateHtmlReport(comparison);
        const reportPath = path.join(OUTPUT_DIR, 'prompt-comparison', 'scorecard-comparison.html');
        
        try {
          await fs.mkdir(path.dirname(reportPath), { recursive: true });
          await fs.writeFile(reportPath, html);
          console.log(`\nDetailed scorecard comparison saved to: ${reportPath}`);
        } catch (err) {
          console.error(`Error saving HTML report: ${err.message}`);
        }
      }).catch(err => {
        console.error(`Error loading promptScorecard module: ${err.message}`);
      });
    }

    console.log("\n==== PROMPT COMPARISON TEST COMPLETED ====");
    console.log(`\nReview the results in ${OUTPUT_DIR} to compare version performance`);

  } catch (error) {
    console.error("Error in prompt comparison test:", error);
    logger.error(`Test failed: ${error.message}`);
  }
}

/**
 * Extract a relevant snippet around a keyword match
 * @param {string} content - The full content text
 * @param {RegExp} pattern - The regex pattern to match
 * @return {string|null} The extracted snippet or null if no match
 */
function extractSnippet(content, pattern) {
  const match = content.match(pattern);
  if (!match) return null;

  const matchIndex = match.index;
  const snippetStart = Math.max(0, matchIndex - 100);
  const snippetEnd = Math.min(content.length, matchIndex + 300);

  return content.substring(snippetStart, snippetEnd) + "...";
}

// Run the test
comparePromptVersions();