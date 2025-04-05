/**
 * Simple Deep Research Test
 * 
 * This script tests the Perplexity API deep research functionality directly
 * without going through the test runner infrastructure.
 */

import perplexityService from './services/perplexityService.js';
import { v4 as uuidv4 } from 'uuid';

// Test query
const TEST_QUERY = 'What are the latest breakthroughs in quantum computing?';

// Check API key
if (!process.env.PERPLEXITY_API_KEY) {
  console.error('PERPLEXITY_API_KEY is required but not found in environment variables');
  process.exit(1);
}

async function runTest() {
  // Generate a unique test ID
  const testId = uuidv4().substring(0, 8);
  
  console.log(`\n🔬 STARTING DEEP RESEARCH TEST (${testId})`);
  console.log(`Query: "${TEST_QUERY}"`);
  console.log('-----------------------------------------------------');
  
  try {
    // Using the deep research model
    const modelType = 'sonar-deep-research';
    console.log(`Using model: ${modelType}`);
    
    console.time('deepResearch');
    
    // Call the deep research function directly
    const researchResults = await perplexityService.conductDeepResearch(TEST_QUERY, {
      model: modelType,
      maxTokens: 1000,
      timeout: 180000, // 3 minute timeout
      fullResponse: true
    });
    
    console.timeEnd('deepResearch');
    
    // Extract and format model information
    console.log('\n📊 MODEL INFORMATION:');
    console.log(`Requested model: ${modelType}`);
    console.log(`Model in response: ${researchResults.model}`);
    console.log(`Model used: ${researchResults.modelUsed || 'Not specified'}`);
    
    // Additional info like citations and follow-up questions
    console.log('\n📝 CONTENT LENGTH:', researchResults.content.length);
    console.log('🔗 CITATIONS COUNT:', researchResults.citations.length);
    
    if (researchResults.followUpQuestions) {
      console.log('\n❓ FOLLOW-UP QUESTIONS:', researchResults.followUpQuestions.length);
      researchResults.followUpQuestions.forEach((q, i) => console.log(`   ${i+1}. ${q}`));
    }
    
    // Content preview
    const previewLength = Math.min(300, researchResults.content.length);
    console.log('\n📄 CONTENT PREVIEW:');
    console.log(researchResults.content.substring(0, previewLength) + '...');
    
    // Sample citations
    if (researchResults.citations && researchResults.citations.length > 0) {
      console.log('\n📚 SAMPLE CITATIONS:');
      researchResults.citations.slice(0, 3).forEach((citation, i) => {
        console.log(`${i+1}. ${citation}`);
      });
    }
    
    return {
      success: true,
      query: TEST_QUERY,
      modelRequested: modelType,
      modelUsed: researchResults.modelUsed || researchResults.model,
      contentLength: researchResults.content.length,
      citationsCount: researchResults.citations.length,
      followUpQuestionsCount: researchResults.followUpQuestions ? researchResults.followUpQuestions.length : 0,
      // Include raw API response
      apiResponse: researchResults.apiResponse
    };
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Error details:', error);
    
    return {
      success: false,
      query: TEST_QUERY,
      error: error.message
    };
  }
}

// Run the test
runTest()
  .then(results => {
    if (results.success) {
      console.log('\n✅ DEEP RESEARCH TEST COMPLETED SUCCESSFULLY!');
      console.log('\nRESULTS SUMMARY:');
      console.log('Query:', results.query);
      console.log('Model requested:', results.modelRequested);
      console.log('Model used:', results.modelUsed); 
      console.log('Content length:', results.contentLength);
      console.log('Citations count:', results.citationsCount);
      console.log('Follow-up questions:', results.followUpQuestionsCount);
      
      // If there's token information, display it
      if (results.apiResponse && results.apiResponse.usage) {
        console.log('\nTOKEN USAGE:');
        console.log('Prompt tokens:', results.apiResponse.usage.prompt_tokens);
        console.log('Completion tokens:', results.apiResponse.usage.completion_tokens);
        console.log('Total tokens:', results.apiResponse.usage.total_tokens);
      }
    } else {
      console.log('\n❌ DEEP RESEARCH TEST FAILED');
      console.log('Error:', results.error);
    }
  })
  .catch(error => {
    console.error('Unexpected error in test execution:', error);
    process.exit(1);
  });