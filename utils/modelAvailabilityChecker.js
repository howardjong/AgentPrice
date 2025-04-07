
/**
 * Model availability checker utility
 * Helps determine which Gemini models are currently operational
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

/**
 * Check the availability of a specific Gemini model
 * @param {string} modelName - The model name to check
 * @returns {Promise<{available: boolean, message: string}>} Availability status
 */
async function checkModelAvailability(modelName) {
  try {
    // Initialize the Gemini API client
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Create a simple model instance
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 10
      }
    });
    
    // Attempt a minimal content generation to test model availability
    await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'test' }] }]
    });
    
    return {
      available: true,
      message: `Model ${modelName} is available`
    };
  } catch (error) {
    const isOverloaded = error.message && error.message.includes('model is overloaded');
    const isRateLimited = error.message && error.message.includes('rate limit');
    
    return {
      available: false,
      message: `Model ${modelName} is not available: ${error.message}`,
      isOverloaded,
      isRateLimited,
      error
    };
  }
}

/**
 * Check a set of fallback models in order of preference
 * Returns the first available model
 * @param {string[]} modelNames - Array of model names to try
 * @returns {Promise<{model: string|null, available: boolean, message: string}>}
 */
async function findAvailableModel(modelNames = [
  'gemini-2.0-flash-thinking-exp-01-21',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash'
]) {
  for (const model of modelNames) {
    const status = await checkModelAvailability(model);
    if (status.available) {
      return {
        model,
        available: true,
        message: `Found available model: ${model}`
      };
    }
    console.log(`Model ${model} check: ${status.message}`);
  }
  
  return {
    model: null,
    available: false,
    message: 'No available models found'
  };
}

module.exports = {
  checkModelAvailability,
  findAvailableModel
};
