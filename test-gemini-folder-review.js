import fs from 'fs';
import path from 'path';
import geminiService from './src/geminiService.js';

async function testGeminiFolderReview() {
  try {
    // Get command line arguments
    const [, , targetFolder, modelName, promptFilePath] = process.argv;

    if (!targetFolder || !promptFilePath) {
      console.error('Usage: node test-gemini-folder-review.js <folder-path> [model-name] <prompt-file-path>');
      console.error('Example: node test-gemini-folder-review.js ./src gemini-1.5-pro prompts/gemini/versions/code_review_v2.txt');
      process.exit(1);
    }

    // Set default model if not provided
    const model = modelName || 'gemini-1.5-pro';

    console.log(`Target folder: ${targetFolder}`);
    console.log(`Using model: ${model}`);
    console.log(`Prompt file: ${promptFilePath}`);

    // Check if target folder exists
    if (!fs.existsSync(targetFolder)) {
      console.error(`Error: Target folder "${targetFolder}" does not exist`);
      process.exit(1);
    }

    // Check if prompt file exists
    if (!fs.existsSync(promptFilePath)) {
      console.error(`Error: Prompt file "${promptFilePath}" does not exist`);
      process.exit(1);
    }

    // Read all files in the target folder
    const files = await readFilesRecursively(targetFolder);

    if (files.length === 0) {
      console.error(`No files found in "${targetFolder}"`);
      process.exit(1);
    }

    console.log(`Found ${files.length} files to analyze`);

    // Format code for review with file markers
    const formattedCode = formatFilesForReview(files);

    // Start the timer
    const startTime = Date.now();

    try {
      // Send to Gemini for review
      const review = await geminiService.reviewCode(
        formattedCode,
        promptFilePath,
        model
      );

      // Calculate time taken
      const timeInSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Gemini review completed in ${timeInSeconds}s`);

      // Create output directory if it doesn't exist
      const outputDir = './reviews';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Save review to file
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const outputFile = path.join(outputDir, `code-review-${timestamp}.md`);
      fs.writeFileSync(outputFile, review);

      console.log(`Review saved to: ${outputFile}`);

      // Display the review in the console
      console.log('\n==== CODE REVIEW ====\n');
      console.log(review);
      console.log('\n==== END REVIEW ====\n');

    } catch (error) {
      const timeInSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`❌ Gemini review failed after ${timeInSeconds}s:`, error);
      console.error('❌ Error during test:', error.message);
      process.exit(1);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

/**
 * Read files recursively from a directory
 * @param {string} dir - Directory path
 * @param {Array} fileList - List to store found files
 * @returns {Promise<Array>} List of file info objects
 */
async function readFilesRecursively(dir, fileList = []) {
  // Get all files in the directory
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    // Skip node_modules, .git, and other non-code directories
    if (stat.isDirectory()) {
      if (!['node_modules', '.git', 'coverage', 'dist'].includes(file)) {
        await readFilesRecursively(filePath, fileList);
      }
      continue;
    }

    // Only include code files
    const ext = path.extname(file).toLowerCase();
    if (['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json', '.md'].includes(ext)) {
      const content = fs.readFileSync(filePath, 'utf8');
      fileList.push({
        path: filePath,
        content: content
      });
    }
  }

  return fileList;
}

/**
 * Format files for code review
 * @param {Array} files - List of file info objects
 * @returns {string} Formatted code
 */
function formatFilesForReview(files) {
  let result = '';

  for (const file of files) {
    // Add file separator and path
    result += `\n// FILE: ${file.path}\n`;
    result += `${file.content}\n`;
  }

  return result;
}

// Run the script
testGeminiFolderReview();