
/**
 * Review Manager Utility
 * 
 * Manages code reviews, handles versioning, and provides tools for comparing
 * multiple reviews of the same codebase across time or across different models.
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ReviewManager {
  constructor(options = {}) {
    this.reviewsDir = options.reviewsDir || path.join(process.cwd(), 'reviews');
    this.indexFile = path.join(this.reviewsDir, 'review-index.json');
    this.reviewIndex = {};
    this.initialized = false;
  }
  
  /**
   * Initialize the review manager
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Create reviews directory if it doesn't exist
      await fs.mkdir(this.reviewsDir, { recursive: true });
      
      // Try to load existing index
      try {
        const indexData = await fs.readFile(this.indexFile, 'utf8');
        this.reviewIndex = JSON.parse(indexData);
      } catch (err) {
        // If file doesn't exist or can't be parsed, create new index
        this.reviewIndex = {
          folders: {},
          models: {},
          versions: {},
          lastUpdated: new Date().toISOString()
        };
        await this.saveIndex();
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing review manager:', error);
      throw error;
    }
  }
  
  /**
   * Save the review index
   * @returns {Promise<void>}
   */
  async saveIndex() {
    this.reviewIndex.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.indexFile, JSON.stringify(this.reviewIndex, null, 2));
  }
  
  /**
   * Add a review to the index
   * @param {Object} reviewMetadata - Review metadata
   * @param {string} filePath - Path to the review file
   * @returns {Promise<void>}
   */
  async addReviewToIndex(reviewMetadata, filePath) {
    if (!this.initialized) await this.initialize();
    
    const relativeFilePath = path.relative(process.cwd(), filePath);
    const folderId = this.getFolderId(reviewMetadata.folder);
    
    // Initialize folder entry if it doesn't exist
    if (!this.reviewIndex.folders[folderId]) {
      this.reviewIndex.folders[folderId] = {
        path: reviewMetadata.folder,
        reviews: []
      };
    }
    
    // Initialize model entry if it doesn't exist
    if (!this.reviewIndex.models[reviewMetadata.model]) {
      this.reviewIndex.models[reviewMetadata.model] = {
        name: reviewMetadata.model,
        reviews: []
      };
    }
    
    // Add to version tracking
    if (!this.reviewIndex.versions[reviewMetadata.version]) {
      this.reviewIndex.versions[reviewMetadata.version] = {
        version: reviewMetadata.version,
        reviews: []
      };
    }
    
    // Create review entry
    const reviewEntry = {
      id: crypto.randomBytes(8).toString('hex'),
      title: reviewMetadata.title,
      timestamp: reviewMetadata.timestamp,
      model: reviewMetadata.model,
      folder: reviewMetadata.folder,
      version: reviewMetadata.version,
      path: relativeFilePath
    };
    
    // Add to indices
    this.reviewIndex.folders[folderId].reviews.push(reviewEntry.id);
    this.reviewIndex.models[reviewMetadata.model].reviews.push(reviewEntry.id);
    this.reviewIndex.versions[reviewMetadata.version].reviews.push(reviewEntry.id);
    
    // Add the full entry to a flat reviews collection
    if (!this.reviewIndex.reviews) {
      this.reviewIndex.reviews = {};
    }
    this.reviewIndex.reviews[reviewEntry.id] = reviewEntry;
    
    await this.saveIndex();
    
    return reviewEntry;
  }
  
  /**
   * Get a folder ID from a path
   * @param {string} folderPath - Path to the folder
   * @returns {string} - A hash-based folder ID
   */
  getFolderId(folderPath) {
    return crypto
      .createHash('md5')
      .update(folderPath)
      .digest('hex')
      .substring(0, 10);
  }
  
  /**
   * Find reviews for a specific folder
   * @param {string} folderPath - Path to look for
   * @returns {Promise<Array>} - Array of review entries
   */
  async findReviewsByFolder(folderPath) {
    if (!this.initialized) await this.initialize();
    
    const folderId = this.getFolderId(folderPath);
    const folderEntry = this.reviewIndex.folders[folderId];
    
    if (!folderEntry) return [];
    
    return folderEntry.reviews.map(reviewId => this.reviewIndex.reviews[reviewId]);
  }
  
  /**
   * Find the latest review for a specific folder
   * @param {string} folderPath - Path to look for
   * @param {string} model - Optional model to filter by
   * @returns {Promise<Object|null>} - Latest review entry or null
   */
  async findLatestReview(folderPath, model = null) {
    const reviews = await this.findReviewsByFolder(folderPath);
    
    if (reviews.length === 0) return null;
    
    // Filter by model if specified
    const filteredReviews = model 
      ? reviews.filter(review => review.model === model)
      : reviews;
    
    if (filteredReviews.length === 0) return null;
    
    // Sort by timestamp descending
    filteredReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return filteredReviews[0];
  }
  
  /**
   * Compare two reviews and generate a comparison report
   * @param {string} reviewId1 - First review ID
   * @param {string} reviewId2 - Second review ID
   * @returns {Promise<Object>} - Comparison results
   */
  async compareReviews(reviewId1, reviewId2) {
    if (!this.initialized) await this.initialize();
    
    const review1 = this.reviewIndex.reviews[reviewId1];
    const review2 = this.reviewIndex.reviews[reviewId2];
    
    if (!review1 || !review2) {
      throw new Error('One or both review IDs not found');
    }
    
    // Read the review files
    const content1 = await fs.readFile(path.join(process.cwd(), review1.path), 'utf8');
    const content2 = await fs.readFile(path.join(process.cwd(), review2.path), 'utf8');
    
    // Extract review content (remove YAML front matter)
    const reviewText1 = content1.replace(/^---\n(.+\n)+---\n\n/m, '');
    const reviewText2 = content2.replace(/^---\n(.+\n)+---\n\n/m, '');
    
    // Generate a comparison markdown file
    const comparisonTitle = `Comparison-${review1.model}-vs-${review2.model}-${path.basename(review1.folder)}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const comparisonFilename = `${comparisonTitle}-${timestamp}.md`;
    const comparisonPath = path.join(this.reviewsDir, comparisonFilename);
    
    // Create the comparison content
    const comparisonContent = `---
type: comparison
title: ${comparisonTitle}
timestamp: ${new Date().toISOString()}
review1: ${reviewId1}
review2: ${reviewId2}
review1_model: ${review1.model}
review2_model: ${review2.model}
folder: ${review1.folder}
---

# Code Review Comparison: ${path.basename(review1.folder)}

## Review 1: ${review1.model} (${new Date(review1.timestamp).toLocaleDateString()})

${reviewText1}

## Review 2: ${review2.model} (${new Date(review2.timestamp).toLocaleDateString()})

${reviewText2}
`;
    
    // Write the comparison file
    await fs.writeFile(comparisonPath, comparisonContent);
    
    return {
      path: comparisonPath,
      title: comparisonTitle
    };
  }
  
  /**
   * List all available reviews
   * @returns {Promise<Object>} - Object with reviews by folder, model, and version
   */
  async listReviews() {
    if (!this.initialized) await this.initialize();
    
    return {
      folders: this.reviewIndex.folders,
      models: this.reviewIndex.models,
      versions: this.reviewIndex.versions,
      total: Object.keys(this.reviewIndex.reviews || {}).length
    };
  }
}

// Export singleton instance
const reviewManager = new ReviewManager();
module.exports = reviewManager;
