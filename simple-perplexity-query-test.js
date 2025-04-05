/**
 * Simple Perplexity Query Test
 * 
 * This script tests the basic functionality of the Perplexity service.
 */

import perplexityService from './services/perplexityService.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check API key
function checkApiKey() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    console.error('⚠️ PERPLEXITY_API_KEY environment variable is not set.');
    return false;
  }
  
  console.log('✅ PERPLEXITY_API_KEY is available:', apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 4));
  return true;
}

// Main test function
async function runTest() {
  console.log('Running simple Perplexity query test...');
  
  if (!checkApiKey()) {
    return;
  }
  
  try {
    // Simple web query
    const query = 'What are three important factors to consider in SaaS pricing?';
    console.log(`Executing simple query: "${query}"`);
    
    const response = await perplexityService.processWebQuery(query);
    
    console.log('\n✅ Query successful!');
    console.log(`Citations: ${response.citations ? response.citations.length : 0}`);
    console.log(`Model used: ${response.model || 'Not specified'}`);
    
    // Print the response
    console.log('\nResponse:');
    console.log('--------------------------------------');
    console.log(response.content);
    console.log('--------------------------------------');
    
    if (response.citations && response.citations.length > 0) {
      console.log('\nCitations:');
      response.citations.forEach((citation, index) => {
        console.log(`${index + 1}. ${citation}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error during simple query test:', error);
    
    // More detailed error information
    if (error.response) {
      console.error('Error response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      console.log('\nRequest details:');
      try {
        const requestData = JSON.parse(error.config.data);
        console.log('Request data:', JSON.stringify(requestData, null, 2));
      } catch (e) {
        console.log('Request data:', error.config.data);
      }
    }
  }
}

// Run the test
runTest();