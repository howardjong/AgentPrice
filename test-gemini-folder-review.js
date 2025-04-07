
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
    
    let review;
    try {
      review = await geminiService.reviewCode(combinedContent);
      clearInterval(progressInterval);
      console.log(`✅ Gemini review completed in ${Math.floor((Date.now() - startTime) / 1000)}s`);
    } catch (error) {
      clearInterval(progressInterval);
      console.error(`❌ Gemini review failed after ${Math.floor((Date.now() - startTime) / 1000)}s:`, error);
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
