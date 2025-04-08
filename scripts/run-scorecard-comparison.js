
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CodeReviewScorecard from '../utils/codeReviewScorecard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function compareCodeReviewPrompts() {
  // Get command line arguments for prompt files
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log("Usage: node run-scorecard-comparison.js <prompt1_path> <prompt2_path>");
    console.log("Example: node run-scorecard-comparison.js prompts/gemini/versions/code_review_v1.txt prompts/gemini/versions/code_review_v2.txt");
    process.exit(1);
  }

  const [promptPath1, promptPath2] = args;
  const promptsDir = path.join(__dirname, '..', 'prompts', 'gemini', 'versions');
  
  // Try to load the prompt files
  try {
    // Create scorecard with verbose option
    const scorecard = new CodeReviewScorecard({ verbose: true });
    
    // Use full paths if provided, or resolve relative to the prompts directory
    const resolvedPath1 = path.isAbsolute(promptPath1) ? promptPath1 : path.join(promptsDir, path.basename(promptPath1));
    const resolvedPath2 = path.isAbsolute(promptPath2) ? promptPath2 : path.join(promptsDir, path.basename(promptPath2));
    
    console.log(`Comparing prompts:\n1. ${resolvedPath1}\n2. ${resolvedPath2}\n`);
    
    // Compare the review prompts
    const comparison = scorecard.compareReviewFiles(resolvedPath1, resolvedPath2);
    
    // Generate and print the report
    const report = scorecard.generateComparisonReport(comparison, true);
    console.log(report);
    
    // Save report to file
    const outputDir = path.join(__dirname, '..', 'tests', 'output');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, `prompt_comparison_${Date.now()}.txt`);
    fs.writeFileSync(outputPath, report);
    
    console.log(`Report saved to: ${outputPath}`);
    
  } catch (error) {
    console.error("Error comparing prompts:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the function
compareCodeReviewPrompts();
