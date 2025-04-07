const fs = require('fs');
const path = require('path');
const geminiService = require('./src/geminiService');

async function testGeminiFolderReview() {
  try {
    // Specify the folder to review
    const folderPath = process.argv[2] || 'src';
    console.log(`🔍 Testing Gemini folder review with directory: ${folderPath}`);

    // Read all files in the directory
    const files = await readDirectoryFiles(folderPath);
    console.log(`📂 Found ${files.length} files in the directory`);

    // Combine files with markers
    const combinedContent = files.map(file => 
      `// FILE: ${file.path}\n${file.content}\n\n`
    ).join('');

    console.log(`📦 Combined ${files.length} files with a total of ${combinedContent.length} characters`);

    // Send to Gemini for review
    console.log('🚀 Sending to Gemini for review...');

    const startTime = Date.now();
    // Set up a progress indicator
    const progressInterval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      console.log(`⏳ Gemini review in progress... (${elapsedSeconds}s elapsed)`);
    }, 5000); // Show progress every 5 seconds

    // Process model selection with better error handling
    const modelArg = process.argv[3];
    const isPro = modelArg === 'pro'; // Allow simple 'pro' option

    // Model options with rate limit info
    const standardModel = 'gemini-2.0-flash-thinking-exp-01-21'; // 10 RPM, 1500 req/day
    const proModel = 'gemini-2.5-pro-preview-03-25'; // 5 RPM, 25 req/dayreview-03-25';

    // Select model with fallback options
    let actualModel;
    if (isPro) {
      actualModel = proModel;
      console.log(`🔍 Using Pro model: ${proModel}`);
    } else if (modelArg && modelArg !== 'pro') {
      actualModel = modelArg; // Use custom model if specified
      console.log(`🔍 Using custom model: ${actualModel}`);
    } else {
      actualModel = standardModel; // Default to standard model
      console.log(`🔍 Using standard model: ${standardModel}`);
    }

    const version = process.argv[4] || '1.0'; // Allow version specification as 4th arg

    console.log(`📋 Using model: ${actualModel}`);
    console.log(`📋 Review version: ${version}`);
    
    // Display rate limit information
    if (isPro) {
      console.log(`⚠️ Rate limit warning: Pro model limited to 5 RPM and 25 requests/day`);
    } else {
      console.log(`ℹ️ Rate limit info: Standard model limited to 10 RPM and 1500 requests/day`);
    }

    let review;
    try {
      // Pass options to the reviewCode function with retry configuration
      review = await geminiService.reviewCode(combinedContent, {
        model: actualModel,
        saveToFile: true, 
        title: `Review-${folderPath}`,
        folder: folderPath,
        version: version,
        temperature: 0.4,
        maxRetries: 3,         // Allow up to 3 retries for overloaded model
        initialBackoff: 3000   // Start with 3 second backoff
      });

      clearInterval(progressInterval);
      console.log(`✅ Gemini review completed in ${Math.floor((Date.now() - startTime) / 1000)}s`);
    } catch (error) {
      clearInterval(progressInterval);
      console.error(`❌ Gemini review failed after ${Math.floor((Date.now() - startTime) / 1000)}s:`, error);
      
      // Provide more helpful error guidance
      if (error.message && error.message.includes('model is overloaded')) {
        console.log('\n📋 Model Overload Guidance:');
        console.log('  - The Gemini model is currently experiencing high traffic');
        console.log('  - Try again later when traffic may be reduced');
        console.log('  - Consider using a different model if available');
      }
      
      throw error;
    }

    // Print the review
    console.log('\n==== GEMINI CODE REVIEW RESULTS ====\n');
    console.log(review.text);
    console.log('\n==== END OF REVIEW ====\n');

    // Success!
    console.log('✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Error during test:', error.message);
    console.error(error);
  }
}

// Function to read all files in a directory recursively
async function readDirectoryFiles(dirPath, options = { maxDepth: 2, exclude: ['.git', 'node_modules'] }) {
  const files = [];
  const items = await fs.promises.readdir(dirPath);

  for (const item of items) {
    const itemPath = path.join(dirPath, item);

    // Skip excluded directories
    if (options.exclude.some(excluded => itemPath.includes(excluded))) {
      continue;
    }

    try {
      const stats = await fs.promises.stat(itemPath);

      if (stats.isDirectory()) {
        // Skip if we've reached max depth
        if (options.maxDepth > 0) {
          const subDirFiles = await readDirectoryFiles(itemPath, { 
            ...options, 
            maxDepth: options.maxDepth - 1 
          });
          files.push(...subDirFiles);
        }
      } else if (stats.isFile()) {
        // Only include text files
        if (isTextFile(itemPath)) {
          try {
            const content = await fs.promises.readFile(itemPath, 'utf8');
            files.push({ 
              path: itemPath,
              content,
              size: stats.size
            });
          } catch (error) {
            console.warn(`⚠️ Could not read file ${itemPath}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error processing ${itemPath}: ${error.message}`);
    }
  }

  return files;
}

// Determine if a file is likely a text file based on extension
function isTextFile(filePath) {
  const textExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.scss', '.json', '.md', 
    '.txt', '.py', '.java', '.c', '.cpp', '.h', '.php', '.rb', '.go', '.rs',
    '.sh', '.yml', '.yaml', '.toml', '.xml', '.svg', '.sql'
  ];

  const ext = path.extname(filePath).toLowerCase();
  return textExtensions.includes(ext);
}

// Run the test
testGeminiFolderReview();