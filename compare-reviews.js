
/**
 * Compare Reviews CLI Tool
 * 
 * This script lets you compare code reviews of the same folder across different models
 * or different versions/times.
 */
const reviewManager = require('./review-manager');
const fs = require('fs').promises;
const path = require('path');

async function compareReviews() {
  try {
    // Initialize review manager
    await reviewManager.initialize();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
      printHelp();
      return;
    }
    
    // Handle different commands
    const command = args[0];
    
    switch (command) {
      case 'list':
        await listReviews();
        break;
      case 'compare':
        if (args.length < 3) {
          console.log('❌ Error: Missing review IDs for comparison');
          printHelp();
          return;
        }
        await compareReviewsById(args[1], args[2]);
        break;
      case 'folder':
        if (args.length < 2) {
          console.log('❌ Error: Missing folder path');
          printHelp();
          return;
        }
        await listReviewsForFolder(args[1]);
        break;
      case 'models':
        if (args.length < 3) {
          console.log('❌ Error: Missing folder path and/or model names');
          printHelp();
          return;
        }
        await compareByModels(args[1], args[2], args[3]);
        break;
      case 'latest':
        if (args.length < 2) {
          console.log('❌ Error: Missing folder path');
          printHelp();
          return;
        }
        await showLatestReview(args[1], args[2]);
        break;
      default:
        console.log(`❌ Unknown command: ${command}`);
        printHelp();
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

function printHelp() {
  console.log(`
📋 Code Review Comparison Tool

Usage:
  node compare-reviews.js <command> [options]

Commands:
  list                     List all available reviews
  folder <path>            List reviews for a specific folder
  compare <id1> <id2>      Compare two reviews by their IDs
  models <folder> <m1> <m2> Compare the latest reviews of two models for a folder
  latest <folder> [model]  Show the latest review for a folder (optionally by model)

Examples:
  node compare-reviews.js list
  node compare-reviews.js folder src
  node compare-reviews.js compare abc123 def456
  node compare-reviews.js models src gemini-1.5-pro gemini-1.5-flash
  node compare-reviews.js latest src
  `);
}

async function listReviews() {
  const reviewList = await reviewManager.listReviews();
  
  console.log('\n📊 Reviews Summary');
  console.log(`Total reviews: ${reviewList.total}`);
  
  console.log('\n📁 Reviews by folder:');
  for (const [folderId, folder] of Object.entries(reviewList.folders)) {
    console.log(`- ${folder.path} (${folder.reviews.length} reviews)`);
  }
  
  console.log('\n🤖 Reviews by model:');
  for (const [modelId, model] of Object.entries(reviewList.models)) {
    console.log(`- ${model.name} (${model.reviews.length} reviews)`);
  }
  
  console.log('\n🔢 Reviews by version:');
  for (const [versionId, version] of Object.entries(reviewList.versions)) {
    console.log(`- ${version.version} (${version.reviews.length} reviews)`);
  }
}

async function listReviewsForFolder(folderPath) {
  const reviews = await reviewManager.findReviewsByFolder(folderPath);
  
  if (reviews.length === 0) {
    console.log(`ℹ️ No reviews found for folder: ${folderPath}`);
    return;
  }
  
  console.log(`\n📁 Reviews for folder: ${folderPath}`);
  console.log(`Found ${reviews.length} reviews\n`);
  
  // Group by model
  const byModel = {};
  for (const review of reviews) {
    if (!byModel[review.model]) {
      byModel[review.model] = [];
    }
    byModel[review.model].push(review);
  }
  
  // Display grouped by model, sorted by date
  for (const [model, modelReviews] of Object.entries(byModel)) {
    console.log(`\n🤖 Model: ${model}`);
    
    // Sort by timestamp descending
    modelReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    for (const review of modelReviews) {
      const date = new Date(review.timestamp).toLocaleString();
      console.log(`- ${review.id}: ${review.title} (${date})`);
    }
  }
}

async function compareReviewsById(id1, id2) {
  console.log(`🔍 Comparing reviews ${id1} and ${id2}...`);
  
  const comparison = await reviewManager.compareReviews(id1, id2);
  
  console.log(`✅ Comparison created: ${comparison.path}`);
}

async function compareByModels(folderPath, model1, model2) {
  console.log(`🔍 Comparing latest reviews for ${folderPath} between ${model1} and ${model2}...`);
  
  const review1 = await reviewManager.findLatestReview(folderPath, model1);
  const review2 = await reviewManager.findLatestReview(folderPath, model2);
  
  if (!review1) {
    console.log(`❌ No reviews found for folder ${folderPath} with model ${model1}`);
    return;
  }
  
  if (!review2) {
    console.log(`❌ No reviews found for folder ${folderPath} with model ${model2}`);
    return;
  }
  
  const comparison = await reviewManager.compareReviews(review1.id, review2.id);
  
  console.log(`✅ Comparison created: ${comparison.path}`);
}

async function showLatestReview(folderPath, model = null) {
  const latestReview = await reviewManager.findLatestReview(folderPath, model);
  
  if (!latestReview) {
    console.log(`ℹ️ No reviews found for folder: ${folderPath}${model ? ` with model ${model}` : ''}`);
    return;
  }
  
  console.log(`\n📄 Latest review for folder: ${folderPath}`);
  console.log(`ID: ${latestReview.id}`);
  console.log(`Title: ${latestReview.title}`);
  console.log(`Model: ${latestReview.model}`);
  console.log(`Date: ${new Date(latestReview.timestamp).toLocaleString()}`);
  console.log(`Path: ${latestReview.path}`);
  
  // Show the content
  try {
    const content = await fs.readFile(path.join(process.cwd(), latestReview.path), 'utf8');
    console.log('\n--- Review Content ---\n');
    console.log(content);
  } catch (error) {
    console.error(`Error reading review file: ${error.message}`);
  }
}

// Run the script
compareReviews().catch(console.error);
