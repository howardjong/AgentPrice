/**
 * CodeReviewScorecard
 * 
 * Utility for evaluating the quality and effectiveness of
 * code review prompts based on key metrics relevant to code quality improvement.
 */

import fs from 'fs';
import path from 'path';
import logger from './logger.js';

class CodeReviewScorecard {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      scoreRange: options.scoreRange || [0, 10],
      metricsWeights: options.metricsWeights || {
        bugIdentification: 1,
        refactoringRecommendations: 1,
        codeOrganization: 1,
        securityAwareness: 1
      }
    };
  }

  /**
   * Evaluate a code review text against key metrics
   * @param {string} reviewText - The code review text to evaluate
   * @returns {object} The evaluation results including scores and insights
   */
  evaluate(reviewText) {
    if (!reviewText || typeof reviewText !== 'string') {
      throw new Error('Review text is required and must be a string');
    }

    const scores = {
      bugIdentification: this._evaluateBugIdentification(reviewText),
      refactoringRecommendations: this._evaluateRefactoringRecommendations(reviewText),
      codeOrganization: this._evaluateCodeOrganization(reviewText),
      securityAwareness: this._evaluateSecurityAwareness(reviewText)
    };

    // Calculate overall score based on weights
    const totalWeight = Object.values(this.options.metricsWeights).reduce((sum, weight) => sum + weight, 0);
    const weightedSum = Object.entries(scores).reduce((sum, [metric, score]) => {
      return sum + (score * (this.options.metricsWeights[metric] || 1));
    }, 0);

    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return {
      scores,
      overallScore,
      insights: this._generateInsights(scores, reviewText)
    };
  }

  /**
   * Compare two code reviews and determine which one performs better
   * @param {string} review1 - First code review text
   * @param {string} review2 - Second code review text
   * @returns {object} Comparison results
   */
  compareReviews(review1, review2) {
    const evaluation1 = this.evaluate(review1);
    const evaluation2 = this.evaluate(review2);

    const comparison = {
      review1: evaluation1,
      review2: evaluation2,
      differences: {}
    };

    // Calculate differences for each metric
    Object.keys(evaluation1.scores).forEach(metric => {
      const diff = evaluation2.scores[metric] - evaluation1.scores[metric];
      comparison.differences[metric] = diff;
    });

    comparison.overallDifference = evaluation2.overallScore - evaluation1.overallScore;
    comparison.winner = comparison.overallDifference > 0 ? 'review2' : 
                       comparison.overallDifference < 0 ? 'review1' : 'tie';

    return comparison;
  }

  /**
   * Load reviews from files and compare them
   * @param {string} filePath1 - Path to first review file
   * @param {string} filePath2 - Path to second review file
   * @returns {object} Comparison results
   */
  compareReviewFiles(filePath1, filePath2) {
    try {
      const review1 = fs.readFileSync(path.resolve(process.cwd(), filePath1), 'utf8');
      const review2 = fs.readFileSync(path.resolve(process.cwd(), filePath2), 'utf8');
      return this.compareReviews(review1, review2);
    } catch (err) {
      logger.error(`Error comparing review files: ${err.message}`);
      throw err;
    }
  }

  /**
   * Generate a report from comparison results
   * @param {object} comparison - The comparison results
   * @param {boolean} verbose - Whether to include detailed information
   * @returns {string} Formatted comparison report
   */
  generateComparisonReport(comparison, verbose = false) {
    const { review1, review2, differences, overallDifference, winner } = comparison;

    let report = `\n=== CODE REVIEW COMPARISON REPORT ===\n\n`;

    // Overall comparison
    report += `OVERALL SCORES:\n`;
    report += `Review 1: ${review1.overallScore.toFixed(2)} / 10\n`;
    report += `Review 2: ${review2.overallScore.toFixed(2)} / 10\n`;
    report += `Difference: ${overallDifference.toFixed(2)} (${winner === 'tie' ? 'Tie' : `Review ${winner.slice(-1)} wins`})\n\n`;

    // Metric by metric comparison
    report += `METRICS COMPARISON:\n`;
    Object.entries(differences).forEach(([metric, diff]) => {
      const formattedMetric = metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      report += `${formattedMetric}: ${diff.toFixed(2)} (`;

      if (diff > 0) {
        report += `Review 2 better`;
      } else if (diff < 0) {
        report += `Review 1 better`;
      } else {
        report += `Equal`;
      }

      report += `)\n`;
    });

    // Add insights if verbose
    if (verbose) {
      report += `\nINSIGHTS:\n`;
      report += `Review 1:\n`;
      review1.insights.forEach(insight => report += `- ${insight}\n`);

      report += `\nReview 2:\n`;
      review2.insights.forEach(insight => report += `- ${insight}\n`);
    }

    return report;
  }

  // Private methods for evaluating specific aspects

  _evaluateBugIdentification(text) {
    // Calculate a score based on bug identification mentions
    const bugKeywords = [
      'bug', 'error', 'issue', 'fix', 'incorrect', 'wrong', 'mistake', 
      'exception', 'crash', 'failure', 'defect', 'undefined behavior'
    ];

    return this._calculateKeywordScore(text, bugKeywords);
  }

  _evaluateRefactoringRecommendations(text) {
    // Calculate a score based on refactoring recommendations
    const refactoringKeywords = [
      'refactor', 'restructure', 'simplify', 'improve', 'optimize', 'cleaner',
      'more readable', 'maintainable', 'extract method', 'reuse', 'DRY'
    ];

    return this._calculateKeywordScore(text, refactoringKeywords);
  }

  _evaluateCodeOrganization(text) {
    // Calculate a score based on code organization mentions
    const organizationKeywords = [
      'organization', 'structure', 'modular', 'separation of concerns', 
      'cohesive', 'SOLID', 'architecture', 'design pattern', 'consistent'
    ];

    return this._calculateKeywordScore(text, organizationKeywords);
  }

  _evaluateSecurityAwareness(text) {
    // Calculate a score based on security awareness
    const securityKeywords = [
      'security', 'vulnerability', 'injection', 'XSS', 'CSRF', 'validation',
      'sanitize', 'escape', 'authorize', 'authenticate', 'encrypt', 'hash'
    ];

    return this._calculateKeywordScore(text, securityKeywords);
  }

  _calculateKeywordScore(text, keywords) {
    // Count occurrences of keywords and calculate a score
    const [min, max] = this.options.scoreRange;
    const normalizedText = text.toLowerCase();

    let count = 0;
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = normalizedText.match(regex);
      if (matches) count += matches.length;
    });

    // Apply diminishing returns (log scale) and normalize to score range
    const normalizedCount = count > 0 ? Math.log10(count + 1) : 0;
    const maxPossible = Math.log10(30); // Assuming 30 is a reasonable max

    return min + (normalizedCount / maxPossible) * (max - min);
  }

  _generateInsights(scores, text) {
    const insights = [];

    // General insights based on scores
    if (scores.bugIdentification < 5) {
      insights.push('Low bug identification score - could improve detection of coding errors');
    }

    if (scores.refactoringRecommendations < 5) {
      insights.push('Limited refactoring suggestions - more concrete examples would be beneficial');
    }

    if (scores.codeOrganization < 5) {
      insights.push('Code organization feedback could be enhanced with more structure recommendations');
    }

    if (scores.securityAwareness < 5) {
      insights.push('Security awareness is low - consider adding more security-focused feedback');
    }

    // Content-based insights
    if (text.length < 1000) {
      insights.push('Review is relatively short - more detailed explanations could improve effectiveness');
    }

    if (!text.includes('example') && !text.includes('Example')) {
      insights.push('No explicit examples provided - adding code examples would make feedback more actionable');
    }

    return insights;
  }
}

export default CodeReviewScorecard;