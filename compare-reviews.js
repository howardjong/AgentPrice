const fs = require('fs');
const path = require('path');

class ReviewManager {
  constructor() {
    this.reviews = {};
  }

  loadReview(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return {
        filePath,
        content,
        timestamp: this.extractTimestamp(filePath)
      };
    } catch (error) {
      console.error(`Error loading review from ${filePath}:`, error.message);
      return null;
    }
  }

  extractTimestamp(filePath) {
    const filename = path.basename(filePath);
    const match = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
    return match ? match[1] : null;
  }

  compareReviews(reviewPath1, reviewPath2) {
    const review1 = this.loadReview(reviewPath1);
    const review2 = this.loadReview(reviewPath2);

    if (!review1 || !review2) {
      throw new Error(`Could not load one or both review files`);
    }

    // Compare reviews and generate a comparison report
    const comparisonReport = this.generateComparisonReport(review1, review2);

    // Save the comparison to a file
    const comparisonFilename = `Comparison_${path.basename(review1.filePath)}_vs_${path.basename(review2.filePath)}`;
    const comparisonPath = path.join('reviews', comparisonFilename);

    fs.writeFileSync(comparisonPath, comparisonReport);
    console.log(`Comparison saved to ${comparisonPath}`);

    return comparisonPath;
  }

  generateComparisonReport(review1, review2) {
    // Create a markdown document comparing the two reviews
    return `# Code Review Comparison

## Review 1: ${path.basename(review1.filePath)}
**Timestamp:** ${review1.timestamp || 'Unknown'}

## Review 2: ${path.basename(review2.filePath)}
**Timestamp:** ${review2.timestamp || 'Unknown'}

## Key Differences

### Content Length
- Review 1: ${review1.content.length} characters
- Review 2: ${review2.content.length} characters
${review1.content.length > review2.content.length 
  ? '- Review 1 is more detailed' 
  : '- Review 2 is more detailed'}

### Full Content Comparison

<details>
<summary>Review 1 Content</summary>

\`\`\`markdown
${review1.content}
\`\`\`
</details>

<details>
<summary>Review 2 Content</summary>

\`\`\`markdown
${review2.content}
\`\`\`
</details>

`;
  }
}

// Function to handle command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'compare' && args.length === 3) {
    return {
      command: 'compare',
      reviewPath1: args[1],
      reviewPath2: args[2]
    };
  }

  console.log('Usage: node compare-reviews.js compare <review1_path> <review2_path>');
  process.exit(1);
}

function compareReviewsById(id1, id2) {
  const reviewManager = new ReviewManager();
  return reviewManager.compareReviews(id1, id2);
}

function compareReviews() {
  const args = parseArgs();
  if (args.command === 'compare') {
    try {
      const reviewManager = new ReviewManager();
      reviewManager.compareReviews(args.reviewPath1, args.reviewPath2);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }
}

// If this script is executed directly
if (require.main === module) {
  compareReviews();
}

module.exports = {
  compareReviewsById,
  compareReviews
};