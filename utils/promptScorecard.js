
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Utility for generating and comparing scorecards for prompt versions
 */
class PromptScorecard {
  constructor() {
    this.resultsDir = path.join(__dirname, '..', 'tests', 'output');
  }

  /**
   * Generate a scorecard for a test result
   * @param {Object} testResult - The result data from a test run
   * @returns {Object} A standardized scorecard with metrics
   */
  generateScorecard(testResult) {
    if (!testResult || !testResult.result || !testResult.result.content) {
      return {
        error: 'Invalid test result data',
        valid: false
      };
    }

    const content = testResult.result.content;
    const query = testResult.query || '';
    const timestamp = testResult.timestamp || new Date().toISOString();
    const enhancedQuery = testResult.enhancedQuery || '';
    const usage = testResult.result.usage || {};
    const sources = testResult.result.sources || [];
    
    // Extract pricing-relevant metrics
    const pricingMetrics = this.extractPricingMetrics(content);
    
    // Calculate quality score
    const qualityScore = this.calculateQualityScore(content, pricingMetrics, sources);
    
    return {
      version: testResult.version || 'unknown',
      timestamp,
      queryType: this.categorizeQuery(query),
      metrics: {
        quality: qualityScore,
        tokens: {
          prompt: usage.prompt_tokens || 0,
          completion: usage.completion_tokens || 0,
          total: usage.total_tokens || 0,
          reasoning: usage.reasoning_tokens || 0
        },
        sources: sources.length,
        vanWestendorp: pricingMetrics.vanWestendorp,
        conjoint: pricingMetrics.conjoint,
        mentionsPricing: pricingMetrics.pricingMentions
      },
      valid: true
    };
  }

  /**
   * Extract pricing-specific metrics from the content
   * @param {string} content - The result content to analyze
   * @returns {Object} Pricing-related metrics
   */
  extractPricingMetrics(content) {
    const vanWestendorpRegex = /van\s*westendorp|price\s*sensitivity|too\s*cheap|bargain|upper\s*threshold|rejection\s*point/gi;
    const conjointRegex = /conjoint\s*analysis|willingness[\s-]*to[\s-]*pay|price\s*impact|price\s*elasticity/gi;
    const pricingRegex = /pric(e|ing)|cost|subscription|tier|plan|freemium|premium|discount/gi;

    const vanWestendorpMatches = content.match(vanWestendorpRegex) || [];
    const conjointMatches = content.match(conjointRegex) || [];
    const pricingMatches = content.match(pricingRegex) || [];

    const vanWestendorpSnippets = this.extractSnippets(content, vanWestendorpRegex);
    const conjointSnippets = this.extractSnippets(content, conjointRegex);

    return {
      vanWestendorp: {
        mentions: vanWestendorpMatches.length,
        snippets: vanWestendorpSnippets
      },
      conjoint: {
        mentions: conjointMatches.length,
        snippets: conjointSnippets
      },
      pricingMentions: pricingMatches.length
    };
  }

  /**
   * Extract text snippets around matches
   * @param {string} content - The content to search in
   * @param {RegExp} regex - The regex pattern to search for
   * @returns {Array} Array of snippets
   */
  extractSnippets(content, regex) {
    const snippets = [];
    let match;
    const regexWithGlobal = new RegExp(regex.source, 'gi');
    
    while ((match = regexWithGlobal.exec(content)) !== null) {
      const start = Math.max(0, match.index - 40);
      const end = Math.min(content.length, match.index + match[0].length + 40);
      const snippet = content.substring(start, end);
      snippets.push(snippet);
      
      // Limit to 3 snippets to avoid overwhelming the scorecard
      if (snippets.length >= 3) break;
    }
    
    return snippets;
  }

  /**
   * Calculate an overall quality score
   * @param {string} content - The result content
   * @param {Object} pricingMetrics - The extracted pricing metrics
   * @param {Array} sources - Array of sources used
   * @returns {Object} Quality score information
   */
  calculateQualityScore(content, pricingMetrics, sources) {
    // Base score from content length and structure
    let score = 0;
    
    // Content length (max 15 points)
    const contentLength = content.length;
    score += Math.min(15, contentLength / 200);
    
    // Structure - check for headings, bullet points, tables (max 15 points)
    const hasHeadings = (content.match(/#{1,3}\s+[A-Za-z]/g) || []).length > 0;
    const hasBulletPoints = (content.match(/[*-]\s+[A-Za-z]/g) || []).length > 0;
    const hasTables = content.includes('|---') || content.includes('+---');
    
    score += hasHeadings ? 5 : 0;
    score += hasBulletPoints ? 5 : 0;
    score += hasTables ? 5 : 0;
    
    // Pricing focus (max 40 points)
    score += Math.min(10, pricingMetrics.vanWestendorp.mentions * 2); // max 10 points
    score += Math.min(10, pricingMetrics.conjoint.mentions * 2); // max 10 points
    score += Math.min(20, pricingMetrics.pricingMentions / 2); // max 20 points
    
    // Sources (max 20 points)
    score += Math.min(20, sources.length * 2); // max 20 points
    
    // Specific keywords (max 10 points)
    const keywordsRegex = /competitor|market|segment|strategy|value|ROI|benchmark|penetration|psychology|elasticity/gi;
    const keywordMatches = (content.match(keywordsRegex) || []).length;
    score += Math.min(10, keywordMatches / 2);
    
    // Normalize to 100 points
    score = Math.min(100, Math.round(score));
    
    // Determine quality rating
    let qualityRating;
    if (score >= 90) qualityRating = 'Excellent';
    else if (score >= 80) qualityRating = 'Very Good';
    else if (score >= 70) qualityRating = 'Good';
    else if (score >= 50) qualityRating = 'Adequate';
    else qualityRating = 'Needs Improvement';
    
    return {
      totalScore: score,
      qualityRating: qualityRating,
      structure: {
        hasHeadings,
        hasBulletPoints,
        hasTables
      }
    };
  }

  /**
   * Save a scorecard to a file
   * @param {Object} scorecard - The scorecard to save
   * @param {string} version - The prompt version
   * @param {string} engine - The LLM engine used
   * @param {string} promptType - The prompt type
   */
  async saveScorecard(scorecard, version, engine, promptType) {
    try {
      // Create directory if it doesn't exist
      const scorecardsDir = path.join(this.resultsDir, 'scorecards');
      await fs.mkdir(scorecardsDir, { recursive: true });
      
      const filename = `${engine}_${promptType}_${version}_scorecard.json`;
      const filepath = path.join(scorecardsDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(scorecard, null, 2));
      logger.info(`Saved scorecard to ${filepath}`);
      
      return filepath;
    } catch (error) {
      logger.error('Error saving scorecard', { error: error.message });
      throw error;
    }
  }

  /**
   * Load a scorecard from a file
   * @param {string} version - The prompt version
   * @param {string} engine - The LLM engine used
   * @param {string} promptType - The prompt type
   * @returns {Object|null} The scorecard or null if not found
   */
  async loadScorecard(version, engine, promptType) {
    try {
      const scorecardsDir = path.join(this.resultsDir, 'scorecards');
      const filename = `${engine}_${promptType}_${version}_scorecard.json`;
      const filepath = path.join(scorecardsDir, filename);
      
      const data = await fs.readFile(filepath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.debug(`Scorecard not found: ${error.message}`);
      return null;
    }
  }

  /**
   * Compare multiple scorecards
   * @param {Array} scorecards - Array of scorecards to compare
   * @returns {Object} Comparison results
   */
  compareScorecards(scorecards) {
    if (!scorecards || scorecards.length < 2) {
      return {
        error: 'At least two valid scorecards are required for comparison',
        valid: false
      };
    }

    // Sort by quality score
    const sortedScorecards = [...scorecards].sort((a, b) => 
      b.metrics.quality.totalScore - a.metrics.quality.totalScore
    );
    
    // Find the best performer
    const best = sortedScorecards[0];
    
    // Calculate differences
    const comparisons = sortedScorecards.map(scorecard => {
      if (scorecard === best) {
        return {
          version: scorecard.version,
          ranking: 1,
          isBest: true,
          metrics: scorecard.metrics,
          advantages: ['Highest overall quality score']
        };
      }
      
      const advantages = [];
      const disadvantages = [];
      
      // Compare with the best scorecard
      if (scorecard.metrics.quality.totalScore > best.metrics.quality.totalScore - 5) {
        advantages.push('Comparable quality to best version');
      } else {
        disadvantages.push(`Quality score ${best.metrics.quality.totalScore - scorecard.metrics.quality.totalScore} points below best`);
      }
      
      if (scorecard.metrics.vanWestendorp.mentions > best.metrics.vanWestendorp.mentions) {
        advantages.push('More Van Westendorp model references');
      }
      
      if (scorecard.metrics.conjoint.mentions > best.metrics.conjoint.mentions) {
        advantages.push('More conjoint analysis references');
      }
      
      if (scorecard.metrics.tokens.total < best.metrics.tokens.total) {
        advantages.push('More token-efficient');
      } else {
        disadvantages.push('Less token-efficient');
      }
      
      if (scorecard.metrics.sources > best.metrics.sources) {
        advantages.push('Cites more sources');
      } else if (scorecard.metrics.sources < best.metrics.sources) {
        disadvantages.push('Cites fewer sources');
      }
      
      return {
        version: scorecard.version,
        ranking: sortedScorecards.indexOf(scorecard) + 1,
        isBest: false,
        metrics: scorecard.metrics,
        advantages,
        disadvantages
      };
    });
    
    return {
      bestVersion: best.version,
      bestScore: best.metrics.quality.totalScore,
      comparisons,
      valid: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate an HTML report for scorecard comparison
   * @param {Object} comparison - The comparison results
   * @returns {string} HTML report
   */
  generateHtmlReport(comparison) {
    if (!comparison || !comparison.valid) {
      return '<div class="error">Invalid comparison data</div>';
    }
    
    const comparisons = comparison.comparisons;
    
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prompt Version Scorecard Comparison</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    .summary {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .scorecard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .scorecard {
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 15px;
    }
    .scorecard.best {
      border-color: #28a745;
      box-shadow: 0 0 10px rgba(40, 167, 69, 0.3);
    }
    .scorecard-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .version {
      font-weight: bold;
      font-size: 1.2em;
    }
    .score {
      font-size: 1.2em;
      padding: 3px 8px;
      border-radius: 3px;
      background-color: #f0f0f0;
    }
    .score.excellent {
      background-color: #28a745;
      color: white;
    }
    .score.very-good {
      background-color: #5cb85c;
      color: white;
    }
    .score.good {
      background-color: #4f93ce;
      color: white;
    }
    .score.adequate {
      background-color: #f0ad4e;
      color: white;
    }
    .score.needs-improvement {
      background-color: #d9534f;
      color: white;
    }
    .metrics {
      margin-bottom: 15px;
    }
    .metrics table {
      width: 100%;
      border-collapse: collapse;
    }
    .metrics th, .metrics td {
      text-align: left;
      padding: 8px;
      border-bottom: 1px solid #eee;
    }
    .metrics th {
      background-color: #f8f9fa;
    }
    .advantages-disadvantages h4 {
      margin: 10px 0 5px;
    }
    .advantages {
      color: #28a745;
      padding-left: 20px;
    }
    .disadvantages {
      color: #d9534f;
      padding-left: 20px;
    }
    .badge {
      display: inline-block;
      padding: 3px 7px;
      border-radius: 3px;
      font-size: 0.8em;
      margin-left: 10px;
    }
    .badge.rank-1 {
      background-color: gold;
      color: #333;
    }
    .badge.rank-2 {
      background-color: silver;
      color: #333;
    }
    .badge.rank-3 {
      background-color: #cd7f32;
      color: white;
    }
    .badge.other-rank {
      background-color: #6c757d;
      color: white;
    }
    .timestamp {
      font-size: 0.8em;
      color: #6c757d;
      text-align: right;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <h1>Prompt Version Scorecard Comparison</h1>
  
  <div class="summary">
    <h3>Summary</h3>
    <p>Version <strong>${comparison.bestVersion}</strong> achieved the highest quality score of <strong>${comparison.bestScore}/100</strong>.</p>
  </div>
  
  <div class="scorecard-grid">
`;
    
    // Add each scorecard
    for (const item of comparisons) {
      const metrics = item.metrics;
      const scoreClass = metrics.quality.qualityRating.toLowerCase().replace(' ', '-');
      const rankClass = item.ranking <= 3 ? `rank-${item.ranking}` : 'other-rank';
      const isBest = item.isBest ? 'best' : '';
      
      html += `
    <div class="scorecard ${isBest}">
      <div class="scorecard-header">
        <div class="version">${item.version} <span class="badge ${rankClass}">#${item.ranking}</span></div>
        <div class="score ${scoreClass}">${metrics.quality.totalScore}/100</div>
      </div>
      
      <div class="metrics">
        <table>
          <tr>
            <th>Quality Rating</th>
            <td>${metrics.quality.qualityRating}</td>
          </tr>
          <tr>
            <th>Van Westendorp</th>
            <td>${metrics.vanWestendorp.mentions} mentions</td>
          </tr>
          <tr>
            <th>Conjoint Analysis</th>
            <td>${metrics.conjoint.mentions} mentions</td>
          </tr>
          <tr>
            <th>Pricing Mentions</th>
            <td>${metrics.mentionsPricing}</td>
          </tr>
          <tr>
            <th>Token Usage</th>
            <td>${metrics.tokens.total.toLocaleString()} tokens</td>
          </tr>
          <tr>
            <th>Sources</th>
            <td>${metrics.sources}</td>
          </tr>
        </table>
      </div>
      
      <div class="advantages-disadvantages">
`;
      
      if (item.advantages && item.advantages.length) {
        html += `
        <h4>Advantages</h4>
        <ul class="advantages">
          ${item.advantages.map(adv => `<li>${adv}</li>`).join('')}
        </ul>
`;
      }
      
      if (item.disadvantages && item.disadvantages.length) {
        html += `
        <h4>Disadvantages</h4>
        <ul class="disadvantages">
          ${item.disadvantages.map(dis => `<li>${dis}</li>`).join('')}
        </ul>
`;
      }
      
      html += `
      </div>
    </div>
`;
    }
    
    html += `
  </div>
  
  <div class="timestamp">
    Generated on ${new Date(comparison.timestamp).toLocaleString()}
  </div>
</body>
</html>
`;
    
    return html;
  }

  /**
   * Generate a scorecard from a test result file
   * @param {string} resultFilePath - Path to the test result JSON file
   * @returns {Object} Generated scorecard
   */
  async generateScorecardFromFile(resultFilePath) {
    try {
      const data = await fs.readFile(resultFilePath, 'utf8');
      const testResult = JSON.parse(data);
      
      // Extract version from filename if not in the data
      if (!testResult.version) {
        const filename = path.basename(resultFilePath);
        const versionMatch = filename.match(/_([^_]+)_result\.json$/);
        if (versionMatch) {
          testResult.version = versionMatch[1];
        }
      }
      
      return this.generateScorecard(testResult);
    } catch (error) {
      logger.error('Error generating scorecard from file', { 
        path: resultFilePath, 
        error: error.message 
      });
      return {
        error: `Failed to generate scorecard: ${error.message}`,
        valid: false
      };
    }
  }

  /**
   * Categorize a query by its content
   * @param {string} query - The query text
   * @returns {string} Query category
   */
  categorizeQuery(query) {
    if (!query) return 'Unknown';
    
    const pricingKeywords = /pric(e|ing)|cost|subscription|tier|plan|freemium|premium|discount/i;
    const marketKeywords = /market|competitor|landscape|industry|sector/i;
    const productKeywords = /product|feature|functionality|capability|offering/i;
    
    if (pricingKeywords.test(query)) return 'Pricing';
    if (marketKeywords.test(query)) return 'Market Research';
    if (productKeywords.test(query)) return 'Product Research';
    
    return 'General Research';
  }
}

export default new PromptScorecard();
