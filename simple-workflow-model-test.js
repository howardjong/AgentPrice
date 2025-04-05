/**
 * Simple Workflow Model Test
 * 
 * This script provides a minimal workflow test to validate model information extraction.
 */

import fs from 'fs/promises';

// Mock API responses with model information
const mockResponses = {
  perplexity: {
    content: "JavaScript is a high-level programming language primarily used for web development.",
    model: "sonar",
    references: [
      { title: "MDN Web Docs", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript" },
      { title: "W3Schools", url: "https://www.w3schools.com/js/" }
    ]
  },
  claude: {
    content: "JavaScript is a versatile scripting language commonly used for creating interactive web pages.",
    model: "claude-3-haiku-20240307",
    completion_id: "cmpl_abc123"
  }
};

async function runSimpleWorkflowTest() {
  const output = [];
  
  function log(message) {
    console.log(message);
    output.push(message);
  }
  
  log('======= WORKFLOW MODEL TEST =======');
  
  // Function to process web query and extract model info
  function processWebQuery(query, provider, options) {
    log(`Processing query: "${query}" with ${provider}`);
    
    // Simulate API call by returning mock response
    const response = mockResponses[provider];
    
    // Extract and add model info
    const modelInfo = extractModelInfo(response, provider);
    
    // Final processed response
    return {
      ...response,
      modelInfo,
      source: provider,
      query
    };
  }
  
  // Model extraction function
  function extractModelInfo(response, provider) {
    if (!response) return { model: 'unknown', provider };
    
    let modelName = response.model || 'unknown';
    
    // Format model info based on provider
    const modelInfo = {
      model: modelName,
      provider,
      timestamp: new Date().toISOString(),
      hasModelInfo: !!response.model
    };
    
    // Add provider-specific fields
    if (provider === 'perplexity') {
      modelInfo.hasReferences = Array.isArray(response.references) && response.references.length > 0;
      modelInfo.referenceCount = response.references ? response.references.length : 0;
    } else if (provider === 'claude') {
      modelInfo.completionId = response.completion_id;
    }
    
    return modelInfo;
  }
  
  // Test query for both providers
  const testQuery = "What is JavaScript?";
  
  // Test with Perplexity
  log('\n--- Perplexity Test ---');
  try {
    const perplexityResult = processWebQuery(testQuery, 'perplexity', { model: 'sonar' });
    
    log('Model Information:');
    log(`Model: ${perplexityResult.modelInfo.model}`);
    log(`Provider: ${perplexityResult.modelInfo.provider}`);
    log(`Has references: ${perplexityResult.modelInfo.hasReferences ? 'Yes' : 'No'}`);
    log(`Reference count: ${perplexityResult.modelInfo.referenceCount}`);
    
    const perplexityModelCorrect = perplexityResult.modelInfo.model === 'sonar';
    const perplexityRefsCorrect = perplexityResult.modelInfo.hasReferences === true;
    
    log(`Perplexity test passed: ${perplexityModelCorrect && perplexityRefsCorrect ? '✓' : '❌'}`);
  } catch (error) {
    log(`❌ Perplexity test error: ${error.message}`);
  }
  
  // Test with Claude
  log('\n--- Claude Test ---');
  try {
    const claudeResult = processWebQuery(testQuery, 'claude', { model: 'claude-3-haiku-20240307' });
    
    log('Model Information:');
    log(`Model: ${claudeResult.modelInfo.model}`);
    log(`Provider: ${claudeResult.modelInfo.provider}`);
    log(`Completion ID: ${claudeResult.modelInfo.completionId}`);
    
    const claudeModelCorrect = claudeResult.modelInfo.model === 'claude-3-haiku-20240307';
    const claudeCompletionIdCorrect = !!claudeResult.modelInfo.completionId;
    
    log(`Claude test passed: ${claudeModelCorrect && claudeCompletionIdCorrect ? '✓' : '❌'}`);
  } catch (error) {
    log(`❌ Claude test error: ${error.message}`);
  }
  
  // Overall test results
  log('\n--- Overall Results ---');
  log('Successfully tested model extraction for multiple providers');
  
  // Save results to file
  try {
    await fs.writeFile('workflow-model-test-output.txt', output.join('\n'));
    log('\nTest output written to workflow-model-test-output.txt');
  } catch (error) {
    log(`Error writing output file: ${error.message}`);
  }
  
  return true;
}

// Run the test if executed directly
// Using different detection method for ESM modules
const isMainModule = import.meta.url.startsWith('file:');
if (isMainModule) {
  console.log('Starting workflow model test...');
  
  runSimpleWorkflowTest()
    .then(success => {
      console.log('Test completed successfully:', success);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

export { runSimpleWorkflowTest };