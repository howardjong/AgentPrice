
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// API key validation
if (!process.env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not set - Gemini service will not function properly');
}

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
    
    // Create the system prompt
    const systemPrompt = 
      "You are a senior developer conducting a thorough code review. " +
      "Analyze the code for bugs, performance issues, security vulnerabilities, " +
      "and adherence to best practices. Provide specific, constructive feedback " +
      "with examples of how to improve the code. Format your response with " +
      "clear sections: 'Critical Issues', 'Improvements', and 'Positive Aspects'.";
    
    // Generate content with Gemini
    const result = await geminiModel.generateContent({
      contents: [
        { role: 'user', parts: [{ text: code }] },
      ],
      systemInstruction: systemPrompt,
    });

    // Extract and return the response
    const response = result.response;
    return {
      text: response.text(),
      promptFeedback: response.promptFeedback
    };
  } catch (error) {
    console.error(`Error processing code review with Gemini: ${error.message}`);
    throw new Error(`Gemini code review failed: ${error.message}`);
  }
}

/**
 * Get code refactoring suggestions from Gemini AI
 * @param {string} code - The code to refactor
 * @param {string} instructions - Specific refactoring instructions (optional)
 * @param {Object} options - Configuration options
 * @param {string} options.model - The Gemini model to use
 * @param {number} options.temperature - Temperature for generation
 * @returns {Promise<Object>} - Gemini's response
 */
async function refactorCode(code, instructions = '', options = {}) {
  try {
    const model = options.model || 'gemini-1.5-flash';
    const temperature = options.temperature || 0.2; // Lower temperature for more precise refactoring
    
    console.log(`Processing code refactoring with Gemini [${model}]`);
    
    // Get the Gemini model
    const geminiModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        temperature,
        topP: 0.95,
        topK: 40,
      },
    });
    
    // Create the system prompt
    const systemPrompt = 
      "You are an expert software engineer specializing in code refactoring and optimization. " +
      "Your task is to refactor the provided code to improve its quality, performance, and maintainability. " +
      "Focus on: eliminating code smells, improving readability, optimizing for performance, " +
      "applying design patterns, and adhering to best practices for the language. " +
      "When providing a refactored solution, include the full refactored code and " +
      "detailed explanations about the changes you made and why they improve the code.";
    
    // Create user instructions
    let userPrompt = "Refactor the following code:";
    if (instructions) {
      userPrompt = `Refactor the following code with these specific instructions: ${instructions}`;
    }
    
    // Generate content with Gemini
    const result = await geminiModel.generateContent({
      contents: [
        { role: 'user', parts: [{ text: `${userPrompt}\n\n${code}` }] },
      ],
      systemInstruction: systemPrompt,
    });

    // Extract and return the response
    const response = result.response;
    return {
      text: response.text(),
      promptFeedback: response.promptFeedback
    };
  } catch (error) {
    console.error(`Error processing code refactoring with Gemini: ${error.message}`);
    throw new Error(`Gemini code refactoring failed: ${error.message}`);
  }
}

module.exports = {
  reviewCode,
  refactorCode
};
