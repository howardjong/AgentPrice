
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// API key validation
if (!process.env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not set - Gemini service will not function properly');
}

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Load a prompt from file
 * @param {string} promptName - Name of the prompt file
 * @returns {Promise<string>} - Content of the prompt file
 */
async function loadPrompt(promptName) {
  try {
    const promptPath = path.join(__dirname, '..', 'prompts', 'gemini', `${promptName}.txt`);
    return await fs.promises.readFile(promptPath, 'utf8');
  } catch (error) {
    console.error(`Error loading prompt ${promptName}: ${error.message}`);
    throw new Error(`Failed to load ${promptName} prompt: ${error.message}`);
  }
}

/**
 * Get a code review from Gemini AI
 * @param {string} code - The code to review
 * @param {Object} options - Configuration options
 * @param {string} options.model - The Gemini model to use
 * @param {number} options.temperature - Temperature for generation
 * @returns {Promise<Object>} - Gemini's response
 */
async function reviewCode(code, options = {}) {
  try {
    const model = options.model || 'gemini-1.5-flash';
    const temperature = options.temperature || 0.4;
    
    console.log(`Processing code review with Gemini [${model}]`);
    
    // Get the Gemini model
    const geminiModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        temperature,
        topP: 0.8,
        topK: 40,
      },
    });
    
    // Load the system prompt from file
    const systemPrompt = await loadPrompt('code_review');
    
    // Generate content with Gemini
    const result = await geminiModel.generateContent({
      contents: [
        { role: 'user', parts: [{ text: code }] },
      ],
      systemInstruction: systemPrompt,
    });

    // Extract the response
    const response = result.response;
    const reviewText = response.text();
    
    // Save the review as a markdown file if requested
    if (options.saveToFile) {
      await saveReviewToMarkdown(reviewText, options.title || 'code-review');
    }
    
    return {
      text: reviewText,
      promptFeedback: response.promptFeedback
    };
  } catch (error) {
    console.error(`Error processing code review with Gemini: ${error.message}`);
    throw new Error(`Gemini code review failed: ${error.message}`);
  }
}

/**
 * Save a code review to a markdown file
 * @param {string} reviewText - The code review text
 * @param {string} title - Title for the review file
 * @returns {Promise<string>} - Path to the saved file
 */
async function saveReviewToMarkdown(reviewText, title) {
  try {
    // Create reviews directory if it doesn't exist
    const reviewsDir = path.join(__dirname, '..', 'reviews');
    if (!fs.existsSync(reviewsDir)) {
      await fs.promises.mkdir(reviewsDir, { recursive: true });
    }
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${title.replace(/\s+/g, '-')}-${timestamp}.md`;
    const filePath = path.join(reviewsDir, filename);
    
    // Add header to the markdown file
    const content = `# Code Review: ${title}\n\nGenerated on: ${new Date().toLocaleString()}\n\n${reviewText}`;
    
    // Write to file
    await fs.promises.writeFile(filePath, content, 'utf8');
    console.log(`✅ Code review saved to: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`Error saving code review to markdown: ${error.message}`);
    throw new Error(`Failed to save code review: ${error.message}`);
  }
}

module.exports = {
  reviewCode
};
