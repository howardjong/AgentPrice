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
      await saveReviewToMarkdown(reviewText, options.title || 'code-review', options);
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
 * Save a code review to a markdown file with versioning
 * @param {string} reviewText - The review text
 * @param {string} title - Base title for the review
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Path to the saved file
 */
async function saveReviewToMarkdown(reviewText, title, options = {}) {
  try {
    // Create reviews directory if it doesn't exist
    const reviewsDir = path.join(process.cwd(), 'reviews');
    if (!fs.existsSync(reviewsDir)) {
      await fs.promises.mkdir(reviewsDir, { recursive: true });
    }

    // Format timestamp for filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Get model name from options or use default
    const model = options.model || 'gemini-1.5-flash';

    // Create a sanitized title (remove special chars)
    const safeTitle = title.replace(/[^a-zA-Z0-9-_]/g, '-');

    // Generate filename with timestamp and model
    const filename = `${safeTitle}_${model}_${timestamp}.md`;
    const filePath = path.join(reviewsDir, filename);

    // Add metadata header to review
    const metadata = {
      title: title,
      timestamp: new Date().toISOString(),
      model: model,
      folder: options.folder || 'unknown',
      version: options.version || '1.0',
      comparison: options.comparison || false
    };

    // Format the metadata as YAML front matter
    const metadataStr = '---\n' + 
      Object.entries(metadata)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n') + 
      '\n---\n\n';

    // Write the file with metadata and review content
    await fs.writeFile(filePath, metadataStr + reviewText);

    console.log(`✅ Review saved to: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('Error saving review:', error);
    throw error;
  }
}

/**
 * Read file content
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - Content of the file
 */
async function readFileContent(filePath) {
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error.message}`);
    throw error;
  }
}


async function reviewFolder(folderPath) {
  console.log(`Starting code review of folder: ${folderPath}`);

  try {
    // Get all files in the folder
    const files = await fs.promises.readdir(folderPath, { withFileTypes: true });

    // Filter out directories and collect file contents
    const fileContents = [];

    for (const file of files) {
      if (file.isFile()) {
        const filePath = path.join(folderPath, file.name);
        try {
          const content = await readFileContent(filePath);
          fileContents.push(content);
        } catch (fileError) {
          console.error(`Error reading file ${filePath}:`, fileError);
          // Continue with other files
        }
      }
    }

    if (fileContents.length === 0) {
      throw new Error(`No readable files found in folder: ${folderPath}`);
    }

    // Join all file contents with file markers
    const allFilesContent = fileContents.join('\n\n');

    // Review the code
    const review = await reviewCode(allFilesContent);

    return review;
  } catch (error) {
    console.error('Error reviewing folder:', error);
    throw error;
  }
}

module.exports = {
  reviewCode,
  reviewFolder
};