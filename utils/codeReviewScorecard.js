/**
 * Code Review Scorecard Utility
 * 
 * A specialized scorecard system for evaluating the effectiveness of different
 * code review prompts based on key metrics relevant to code quality improvement.
 */

import fs from 'fs';
import path from 'path';
import logger from './logger';

class CodeReviewScorecard {
  constructor() {
    this.metrics = {
      codeQualityImprovement: 0,  // How well the prompt identifies quality issues
      redundancyReduction: 0,     // How well it identifies redundant code
      resourceOptimization: 0,    // Effectiveness at identifying performance issues
      issueResolution: 0          // How well it addresses actual code problems
    };
    this.maxScore = 10;           // Each metric is scored from 0-10
    this.comments = [];           // Detailed comments for each metric
    this.promptDetails = {};      // Details about the prompt being evaluated
  }

  /**
   * Rate a code review prompt based on the defined metrics
   * @param {string} promptId - Identifier for the prompt
   * @param {Object} scores - Scores for each metric (0-10)
   * @param {Object} comments - Optional comments for each metric
   * @param {Object} details - Additional details about the prompt
   */
  ratePrompt(promptId, scores, comments = {}, details = {}) {
    // Validate scores
    for (const [metric, score] of Object.entries(scores)) {
      if (!this.metrics.hasOwnProperty(metric)) {
        logger.warn(`Unknown metric: ${metric}`);
        continue;
      }

      if (score < 0 || score > this.maxScore) {
        logger.warn(`Invalid score for ${metric}: ${score}. Must be between 0-${this.maxScore}`);
        this.metrics[metric] = Math.max(0, Math.min(score, this.maxScore));
      } else {
        this.metrics[metric] = score;
      }

      if (comments[metric]) {
        this.comments.push({
          metric,
          comment: comments[metric]
        });
      }
    }

    this.promptDetails = {
      id: promptId,
      timestamp: new Date().toISOString(),
      ...details
    };

    return this;
  }

  /**
   * Calculate the overall score across all metrics
   * @returns {number} The average score across all metrics
   */
  getOverallScore() {
    const metrics = Object.values(this.metrics);
    return metrics.reduce((sum, score) => sum + score, 0) / metrics.length;
  }

  /**
   * Get the best-performing metric
   * @returns {Object} The metric name and score
   */
  getBestMetric() {
    let bestMetric = null;
    let bestScore = -1;

    for (const [metric, score] of Object.entries(this.metrics)) {
      if (score > bestScore) {
        bestScore = score;
        bestMetric = metric;
      }
    }

    return { metric: bestMetric, score: bestScore };
  }

  /**
   * Get the metric that needs the most improvement
   * @returns {Object} The metric name and score
   */
  getWeakestMetric() {
    let weakestMetric = null;
    let lowestScore = Infinity;

    for (const [metric, score] of Object.entries(this.metrics)) {
      if (score < lowestScore) {
        lowestScore = score;
        weakestMetric = metric;
      }
    }

    return { metric: weakestMetric, score: lowestScore };
  }

  /**
   * Save the scorecard to a JSON file
   * @param {string} outputPath - Path to save the scorecard
   * @returns {boolean} Success status
   */
  saveToFile(outputPath) {
    try {
      const scorecardData = {
        promptDetails: this.promptDetails,
        metrics: this.metrics,
        comments: this.comments,
        overallScore: this.getOverallScore(),
        bestMetric: this.getBestMetric(),
        weakestMetric: this.getWeakestMetric(),
        timestamp: new Date().toISOString()
      };

      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, JSON.stringify(scorecardData, null, 2));
      logger.info(`Saved code review scorecard to ${outputPath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to save code review scorecard: ${error.message}`);
      return false;
    }
  }

  /**
   * Compare two code review scorecards
   * @param {string} scorecard1Path - Path to first scorecard
   * @param {string} scorecard2Path - Path to second scorecard
   * @param {string} outputPath - Path to save comparison
   * @returns {Object} Comparison results
   */
  static comparePromptsFromFiles(scorecard1Path, scorecard2Path, outputPath) {
    try {
      const scorecard1 = JSON.parse(fs.readFileSync(scorecard1Path, 'utf8'));
      const scorecard2 = JSON.parse(fs.readFileSync(scorecard2Path, 'utf8'));

      const comparison = {
        prompt1: scorecard1.promptDetails,
        prompt2: scorecard2.promptDetails,
        metricComparisons: {},
        overallComparison: {
          prompt1Score: scorecard1.overallScore,
          prompt2Score: scorecard2.overallScore,
          difference: scorecard1.overallScore - scorecard2.overallScore,
          betterPrompt: scorecard1.overallScore > scorecard2.overallScore ? 
            scorecard1.promptDetails.id : scorecard2.promptDetails.id
        },
        timestamp: new Date().toISOString()
      };

      // Compare each metric
      for (const metric of Object.keys(scorecard1.metrics)) {
        const score1 = scorecard1.metrics[metric];
        const score2 = scorecard2.metrics[metric];

        comparison.metricComparisons[metric] = {
          prompt1Score: score1,
          prompt2Score: score2,
          difference: score1 - score2,
          betterPrompt: score1 > score2 ? scorecard1.promptDetails.id : 
                        (score1 < score2 ? scorecard2.promptDetails.id : 'tie')
        };
      }

      // Save comparison if outputPath provided
      if (outputPath) {
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(comparison, null, 2));
        logger.info(`Saved code review comparison to ${outputPath}`);
      }

      return comparison;
    } catch (error) {
      logger.error(`Failed to compare code review scorecards: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a markdown report from the comparison
   * @param {Object} comparison - Comparison data
   * @param {string} outputPath - Path to save markdown report
   * @returns {string} Markdown content
   */
  static generateComparisonReport(comparison, outputPath) {
    try {
      const betterPrompt = comparison.overallComparison.betterPrompt;
      const markdown = `
# Code Review Prompt Comparison Report

## Overview

This report compares two code review prompts:
- **Prompt 1**: ${comparison.prompt1.id}
- **Prompt 2**: ${comparison.prompt2.id}

## Overall Results

Overall better performing prompt: **${betterPrompt}**

| Metric | ${comparison.prompt1.id} | ${comparison.prompt2.id} | Difference | Better Prompt |
|--------|---------|---------|------------|--------------|
| Overall Score | ${comparison.overallComparison.prompt1Score.toFixed(2)} | ${comparison.overallComparison.prompt2Score.toFixed(2)} | ${comparison.overallComparison.difference.toFixed(2)} | ${comparison.overallComparison.betterPrompt} |

## Metrics Breakdown

${Object.entries(comparison.metricComparisons).map(([metric, data]) => `
### ${metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}

- **${comparison.prompt1.id}**: ${data.prompt1Score.toFixed(2)}
- **${comparison.prompt2.id}**: ${data.prompt2Score.toFixed(2)}
- **Difference**: ${data.difference.toFixed(2)}
- **Better Prompt**: ${data.betterPrompt}
`).join('\n')}

## Summary

${comparison.overallComparison.difference > 0 
  ? `Prompt "${comparison.prompt1.id}" outperforms "${comparison.prompt2.id}" by ${Math.abs(comparison.overallComparison.difference).toFixed(2)} points overall.`
  : comparison.overallComparison.difference < 0
    ? `Prompt "${comparison.prompt2.id}" outperforms "${comparison.prompt1.id}" by ${Math.abs(comparison.overallComparison.difference).toFixed(2)} points overall.`
    : `Both prompts perform equally overall.`
}

### Metric-by-Metric Analysis

${Object.entries(comparison.metricComparisons)
  .sort((a, b) => Math.abs(b[1].difference) - Math.abs(a[1].difference))
  .map(([metric, data]) => {
    const metricName = metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    const better = data.betterPrompt === 'tie' 
      ? 'Both prompts perform equally' 
      : `"${data.betterPrompt}" performs better`;

    return `- **${metricName}**: ${better} by ${Math.abs(data.difference).toFixed(2)} points.`;
  })
  .join('\n')}

## Recommendations

Based on this analysis, here are recommendations for prompt improvement:

${comparison.overallComparison.difference !== 0 
  ? `1. Use prompt "${comparison.overallComparison.betterPrompt}" as the baseline for future improvements.`
  : `1. Both prompts perform equally overall. Consider their individual metric strengths.`
}

2. Areas for improvement in the better prompt:
   - Focus on improving the ${Object.entries(comparison.metricComparisons)
       .filter(([_, data]) => data.betterPrompt === comparison.overallComparison.betterPrompt)
       .sort((a, b) => a[1][`${comparison.overallComparison.betterPrompt === comparison.prompt1.id ? 'prompt1' : 'prompt2'}Score`] - 
                       b[1][`${comparison.overallComparison.betterPrompt === comparison.prompt1.id ? 'prompt1' : 'prompt2'}Score`])
       .slice(0, 2)
       .map(([metric, _]) => metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()))
       .join(' and ')} metrics.

3. Consider creating a hybrid prompt that combines:
   ${Object.entries(comparison.metricComparisons)
       .map(([metric, data]) => {
         const betterPromptForMetric = data.betterPrompt === 'tie' 
           ? 'Either prompt'
           : `"${data.betterPrompt}"`;
         return `   - ${betterPromptForMetric} for ${metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}`;
       })
       .join('\n')}

Generated on: ${new Date().toISOString()}
`;

      if (outputPath) {
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, markdown);
        logger.info(`Saved code review comparison report to ${outputPath}`);
      }

      return markdown;
    } catch (error) {
      logger.error(`Failed to generate comparison report: ${error.message}`);
      throw error;
    }
  }
}

export default CodeReviewScorecard;