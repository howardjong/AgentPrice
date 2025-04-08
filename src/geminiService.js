import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

/**
 * Service for interacting with Google's Gemini models
 */

// Default model to use if none specified
const DEFAULT_MODEL = 'gemini-1.5-pro';

/**
 * Reviews code using Gemini AI
 * @param {string} code - The code to review
 * @param {string} promptFilePath - Path to the prompt file
 * @param {string} modelName - Optional model name to use
 * @returns {Promise<string>} The review text
 */
async function reviewCode(code, promptFilePath, modelName = DEFAULT_MODEL) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable not set');
    }

    // Create Gemini API client
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    // Load prompt template
    console.log(`Loading code review prompt from: ${promptFilePath}`);
    let promptTemplate = '';
    try {
      promptTemplate = fs.readFileSync(promptFilePath, 'utf8');
    } catch (err) {
      throw new Error(`Failed to read prompt file: ${err.message}`);
    }

    // Configure generation parameters
    const generationConfig = {
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 8192,
    };

    // Create structured prompt
    const prompt = promptTemplate + "\n\n" + code;

    // Generate review
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = result.response;
    return response.text();
  } catch (error) {
    console.error('Error in Gemini code review:', error);
    throw new Error(`Failed to get code review: ${error.message}`);
  }
}

export default {
  reviewCode
};