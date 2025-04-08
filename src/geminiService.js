import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize the Gemini API
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Use the Gemini Pro model for code reviews
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || 'gemini-pro',
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 8192,
  },
});

/**
 * Loads the code review prompt from a file
 */
async function loadPrompt() {
  try {
    const promptPath = process.env.GEMINI_PROMPT_PATH || path.join(process.cwd(), 'prompts', 'gemini', 'code_review.txt');
    console.log(`Loading code review prompt from: ${promptPath}`);
    return await fs.readFile(promptPath, 'utf8');
  } catch (error) {
    console.error('Error loading prompt:', error);
    return 'You are an expert software engineer. Review the following code and suggest improvements.';
  }
}

/**
 * Reviews code using the Gemini API
 */
async function reviewCode(code, options = {}) {
  try {
    const prompt = await loadPrompt();

    const result = await model.generateContent([
      prompt,
      code
    ]);

    const response = result.response;
    const reviewText = response.text();

    // Save the review to a file if the option is enabled
    if (options.saveToFile !== false) {
      const title = options.title || 'Code-Review';
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filename = `${title}_${timestamp}.md`;
      const reviewsDir = path.join(process.cwd(), 'reviews');

      try {
        // Ensure the reviews directory exists
        await fs.mkdir(reviewsDir, { recursive: true });

        // Save the review with a timestamp
        const filePath = path.join(reviewsDir, filename);
        await fs.writeFile(filePath, reviewText, 'utf8');
        console.log(`Review saved to: ${filePath}`);
      } catch (saveError) {
        console.error('Error saving review:', saveError);
      }
    }

    return {
      review: reviewText,
      model: process.env.GEMINI_MODEL || 'gemini-pro',
    };
  } catch (error) {
    console.error('Error in Gemini code review:', error);
    throw new Error(`Failed to get code review: ${error.message}`);
  }
}

export default {
  reviewCode
};