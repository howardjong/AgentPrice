
/**
 * Compare Code Review Prompts
 * 
 * A script to compare the effectiveness of different code review prompts
 * using the specialized code review scorecard metrics.
 */

const path = require('path');
const fs = require('fs');
const CodeReviewScorecard = require('../utils/codeReviewScorecard');
const logger = require('../utils/logger');

// Directory paths
const REVIEWS_DIR = path.join(process.cwd(), 'reviews');
const RESULTS_DIR = path.join(process.cwd(), 'reviews', 'comparisons');

// Make sure the results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Process command line arguments
 */
function processArgs() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node compare-code-review-prompts.js <review1_id> <review2_id> [options]');
    console.log('\nOptions:');
    console.log('  --verbose     Show detailed output');
    console.log('  --scores-only Only show scores, not full report');
    console.log('\nExample:');
    console.log('  node compare-code-review-prompts.js Review-tests-manual_gemini-2.5-pro-preview-03-25_2025-04-07T22-40-41-371Z Review-tests-manual_gemini-2.5-pro-preview-03-25_2025-04-07T23-32-45-519Z');
    process.exit(1);
  }
  
  return {
    review1: args[0],
    review2: args[1],
    verbose: args.includes('--verbose'),
    scoresOnly: args.includes('--scores-only')
  };
}

/**
 * Score a review based on its content
 * @param {string} reviewId - ID of the review
 * @param {string} reviewContent - Content of the review
 * @returns {Object} Scorecard object
 */
function scoreReview(reviewId, reviewContent) {
  const scorecard = new CodeReviewScorecard();
  
  // Parse the review content to identify metrics
  // This is a simplified example - in a real implementation,
  // this would perform more sophisticated analysis on the review content
  
  // Basic scoring based on content keywords and patterns
  const metrics = {
    codeQualityImprovement: 0,
    redundancyReduction: 0,
    resourceOptimization: 0,
    issueResolution: 0
  };
  
  const comments = {
    codeQualityImprovement: '',
    redundancyReduction: '',
    resourceOptimization: '',
    issueResolution: ''
  };
  
  // Basic metrics calculation - this is a simplified example
  // A more sophisticated implementation would analyze the review more thoroughly
  
  // Code Quality Improvement
  const qualityPatterns = [
    /code quality/i, /best practices/i, /readability/i, /maintainability/i,
    /consistent/i, /clean code/i, /naming convention/i, /code organization/i
  ];
  metrics.codeQualityImprovement = calculateMetricScore(reviewContent, qualityPatterns);
  comments.codeQualityImprovement = `Found ${countMatches(reviewContent, qualityPatterns)} code quality improvement suggestions`;
  
  // Redundancy Reduction
  const redundancyPatterns = [
    /redundant/i, /duplicate/i, /reuse/i, /duplication/i,
    /repeated code/i, /extract method/i, /extract function/i,
    /common functionality/i, /don't repeat yourself/i, /DRY/i
  ];
  metrics.redundancyReduction = calculateMetricScore(reviewContent, redundancyPatterns);
  comments.redundancyReduction = `Found ${countMatches(reviewContent, redundancyPatterns)} redundancy reduction suggestions`;
  
  // Resource Optimization
  const optimizationPatterns = [
    /performance/i, /memory leak/i, /resource/i, /optimization/i,
    /efficient/i, /faster/i, /slow/i, /bottleneck/i, /intensive/i,
    /memory usage/i, /cpu usage/i, /time complexity/i, /space complexity/i
  ];
  metrics.resourceOptimization = calculateMetricScore(reviewContent, optimizationPatterns);
  comments.resourceOptimization = `Found ${countMatches(reviewContent, optimizationPatterns)} resource optimization suggestions`;
  
  // Issue Resolution
  const issuePatterns = [
    /bug/i, /fix/i, /issue/i, /problem/i, /error/i, /exception/i,
    /crash/i, /unexpected/i, /incorrect/i, /failure/i, /edge case/i,
    /resolve/i, /solution/i, /address/i
  ];
  metrics.issueResolution = calculateMetricScore(reviewContent, issuePatterns);
  comments.issueResolution = `Found ${countMatches(reviewContent, issuePatterns)} issue resolution suggestions`;
  
  // Score the review
  return scorecard.ratePrompt(reviewId, metrics, comments, {
    contentLength: reviewContent.length,
    dateScored: new Date().toISOString()
  });
}

/**
 * Calculate a metric score based on pattern matches in content
 * @param {string} content - Content to analyze
 * @param {Array} patterns - Array of regex patterns to match
 * @returns {number} Score from 0-10
 */
function calculateMetricScore(content, patterns) {
  const matches = countMatches(content, patterns);
  
  // Convert number of matches to a score from 0-10
  // This is a simplified scoring algorithm
  const baseScore = Math.min(10, Math.ceil(matches / 3));
  
  // Adjust score based on content length and quality
  const contentLengthFactor = Math.min(1, content.length / 10000);
  
  return Math.round((baseScore * 0.7 + contentLengthFactor * 10 * 0.3) * 10) / 10;
}

/**
 * Count regex pattern matches in content
 * @param {string} content - Content to analyze
 * @param {Array} patterns - Array of regex patterns to match
 * @returns {number} Number of matches
 */
function countMatches(content, patterns) {
  let count = 0;
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/**
 * Main function
 */
async function main() {
  const args = processArgs();
  const { review1, review2, verbose, scoresOnly } = args;
  
  try {
    // Load review content
    const review1Path = path.join(REVIEWS_DIR, `${review1}.md`);
    const review2Path = path.join(REVIEWS_DIR, `${review2}.md`);
    
    if (!fs.existsSync(review1Path) || !fs.existsSync(review2Path)) {
      console.error('Error: Review file not found. Please check the review IDs.');
      process.exit(1);
    }
    
    console.log('Loading reviews...');
    const review1Content = fs.readFileSync(review1Path, 'utf8');
    const review2Content = fs.readFileSync(review2Path, 'utf8');
    
    // Score the reviews
    console.log('Scoring reviews...');
    const scorecard1 = scoreReview(review1, review1Content);
    const scorecard2 = scoreReview(review2, review2Content);
    
    // Save scorecards
    const scorecard1Path = path.join(RESULTS_DIR, `Scorecard-${review1}.json`);
    const scorecard2Path = path.join(RESULTS_DIR, `Scorecard-${review2}.json`);
    
    scorecard1.saveToFile(scorecard1Path);
    scorecard2.saveToFile(scorecard2Path);
    
    // Compare the scorecards
    console.log('Comparing reviews...');
    const comparisonPath = path.join(RESULTS_DIR, `Comparison-${review1}-vs-${review2}.json`);
    const comparison = CodeReviewScorecard.comparePromptsFromFiles(
      scorecard1Path,
      scorecard2Path,
      comparisonPath
    );
    
    // Generate and save report
    const reportPath = path.join(RESULTS_DIR, `Report-${review1}-vs-${review2}.md`);
    const report = CodeReviewScorecard.generateComparisonReport(comparison, reportPath);
    
    if (verbose) {
      console.log('\n=== DETAILED COMPARISON ===\n');
      console.log(report);
    } else if (scoresOnly) {
      console.log('\n=== SCORECARD COMPARISON ===\n');
      console.log(`Review 1 (${review1}):`);
      Object.entries(scorecard1.metrics).forEach(([metric, score]) => {
        console.log(`  ${metric}: ${score.toFixed(1)}/10`);
      });
      console.log(`  Overall: ${scorecard1.getOverallScore().toFixed(2)}/10\n`);
      
      console.log(`Review 2 (${review2}):`);
      Object.entries(scorecard2.metrics).forEach(([metric, score]) => {
        console.log(`  ${metric}: ${score.toFixed(1)}/10`);
      });
      console.log(`  Overall: ${scorecard2.getOverallScore().toFixed(2)}/10\n`);
      
      console.log(`Better prompt: ${comparison.overallComparison.betterPrompt}`);
    } else {
      console.log('\n=== COMPARISON SUMMARY ===\n');
      console.log(`Review 1 (${review1}): ${scorecard1.getOverallScore().toFixed(2)}/10`);
      console.log(`Review 2 (${review2}): ${scorecard2.getOverallScore().toFixed(2)}/10`);
      console.log(`Difference: ${comparison.overallComparison.difference.toFixed(2)}`);
      console.log(`Better prompt: ${comparison.overallComparison.betterPrompt}`);
      
      console.log('\nMetrics Comparison:');
      Object.entries(comparison.metricComparisons).forEach(([metric, data]) => {
        console.log(`  ${metric}: ${data.betterPrompt} is better by ${Math.abs(data.difference).toFixed(1)} points`);
      });
      
      console.log(`\nDetailed report saved to: ${reportPath}`);
    }
    
  } catch (error) {
    console.error('Error comparing reviews:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
