/**
 * Simple utility test for model extraction logic
 * 
 * This script tests the ability to extract the model name from the API response
 * without dealing with the complexity of the full test suite.
 */

// Mock API response with model field
const mockResponseWithModel = {
  data: {
    model: 'sonar-pro-actual',
    choices: [
      {
        message: {
          content: 'This is a test response from Perplexity'
        }
      }
    ],
    citations: ['https://example.com/citation1']
  }
};

// Mock API response without model field
const mockResponseWithoutModel = {
  data: {
    choices: [
      {
        message: {
          content: 'This is a test response from Perplexity'
        }
      }
    ],
    citations: ['https://example.com/citation1']
  }
};

// Function to extract model name (similar to what's in perplexityService.js)
function extractModelName(response, defaultModel) {
  return response.data.model || defaultModel;
}

// Test extracting model when it's present in the API response
console.log('Test 1: Model name present in the API response');
const extractedModel1 = extractModelName(mockResponseWithModel, 'fallback-model');
console.log(`Expected: 'sonar-pro-actual', Got: '${extractedModel1}'`);
console.log(`Test ${extractedModel1 === 'sonar-pro-actual' ? 'PASSED' : 'FAILED'}`);

// Test extracting model when it's not present in the API response
console.log('\nTest 2: Model name not present in the API response');
const extractedModel2 = extractModelName(mockResponseWithoutModel, 'fallback-model');
console.log(`Expected: 'fallback-model', Got: '${extractedModel2}'`);
console.log(`Test ${extractedModel2 === 'fallback-model' ? 'PASSED' : 'FAILED'}`);

// Function to format a response with model information
function formatWithModelInfo(originalResponse, modelName) {
  const modelInfo = `[Using Perplexity AI - Model: ${modelName}]\n\n`;
  return modelInfo + originalResponse;
}

// Test formatting a response with model information
console.log('\nTest 3: Formatting response with model information');
const originalText = 'This is the original response';
const formattedText = formatWithModelInfo(originalText, 'sonar-pro-actual');
const expectedFormattedText = '[Using Perplexity AI - Model: sonar-pro-actual]\n\nThis is the original response';
console.log(`Expected to include model info: ${formattedText.includes('sonar-pro-actual') ? 'Yes' : 'No'}`);
console.log(`Test ${formattedText === expectedFormattedText ? 'PASSED' : 'FAILED'}`);

console.log('\nAll tests completed.');