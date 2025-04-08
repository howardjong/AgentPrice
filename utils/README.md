
# Code Review Scorecard

The `CodeReviewScorecard` utility evaluates and compares code review prompts based on key metrics that are important for effective code reviews. This tool helps to quantitatively measure the quality of different code review approaches.

## Overview

The scorecard system analyzes code review prompts (or actual code reviews) to evaluate their effectiveness across several dimensions:

- **Bug Identification**: How well the review identifies potential bugs and coding errors
- **Refactoring Recommendations**: Quality of suggestions for improving code structure
- **Code Organization**: Focus on architectural improvements and organization
- **Security Awareness**: Attention to security vulnerabilities and best practices

## Usage

### Basic Evaluation

```javascript
import CodeReviewScorecard from './codeReviewScorecard.js';

// Create a scorecard instance
const scorecard = new CodeReviewScorecard();

// Evaluate a single code review text
const evaluation = scorecard.evaluate(reviewText);

console.log(`Overall score: ${evaluation.overallScore.toFixed(2)}/10`);
console.log('Metric scores:', evaluation.scores);
console.log('Insights:', evaluation.insights);
```

### Comparing Reviews

```javascript
// Compare two different code review approaches
const comparison = scorecard.compareReviews(review1, review2);

// Generate a report
const report = scorecard.generateComparisonReport(comparison, true);
console.log(report);
```

### Comparing Review Files

```javascript
// Compare reviews from files
const fileComparison = scorecard.compareReviewFiles(
  'prompts/gemini/versions/code_review_v1.txt',
  'prompts/gemini/versions/code_review_v2.txt'
);
```

### Running From Command Line

We have a dedicated script to run comparisons from the command line:

```bash
node scripts/run-scorecard-comparison.js <prompt1_path> <prompt2_path>
```

## Metrics Explanation

### Bug Identification (0-10)

Measures how well a code review prompt emphasizes finding bugs and coding errors. Keywords include:
- bug, error, issue, fix, incorrect, wrong, mistake
- exception, crash, failure, defect, undefined behavior

High scores indicate strong focus on identifying potential issues in code.

### Refactoring Recommendations (0-10)

Evaluates how effectively a prompt encourages providing refactoring suggestions. Keywords include:
- refactor, restructure, simplify, improve, optimize, cleaner
- more readable, maintainable, extract method, reuse, DRY

High scores indicate strong guidance for improving code quality through restructuring.

### Code Organization (0-10)

Assesses focus on higher-level code structure and architecture. Keywords include:
- organization, structure, modular, separation of concerns
- cohesive, SOLID, architecture, design pattern, consistent

High scores reflect emphasis on maintaining clean architecture and good design principles.

### Security Awareness (0-10)

Measures attention to security concerns in code reviews. Keywords include:
- security, vulnerability, injection, XSS, CSRF, validation
- sanitize, escape, authorize, authenticate, encrypt, hash

High scores indicate strong security-focused review guidance.

## Customization

You can customize the scorecard with different options:

```javascript
const customScorecard = new CodeReviewScorecard({
  verbose: true,  // Enable more detailed output
  scoreRange: [0, 10],  // Min and max possible scores
  metricsWeights: {
    bugIdentification: 2,  // Prioritize bug finding
    refactoringRecommendations: 1,
    codeOrganization: 1,
    securityAwareness: 1.5  // Emphasize security
  }
});
```

## Output Example

The comparison report includes:
- Overall scores for each review
- Detailed metric-by-metric comparison
- Insights about strengths and weaknesses
- Recommendations for improvement

Example output:
```
=== CODE REVIEW COMPARISON REPORT ===

OVERALL SCORES:
Review 1: 3.14 / 10
Review 2: 4.70 / 10
Difference: 1.56 (Review 2 wins)

METRICS COMPARISON:
Bug Identification: 2.04 (Review 2 better)
Refactoring Recommendations: 2.04 (Review 2 better)
Code Organization: 1.50 (Review 2 better)
Security Awareness: 0.66 (Review 2 better)

INSIGHTS:
Review 1:
- Low bug identification score - could improve detection of coding errors
- Limited refactoring suggestions - more concrete examples would be beneficial
- Code organization feedback could be enhanced with more structure recommendations
- Security awareness is low - consider adding more security-focused feedback

Review 2:
- Low bug identification score - could improve detection of coding errors
- Code organization feedback could be enhanced with more structure recommendations
- Security awareness is low - consider adding more security-focused feedback
```
