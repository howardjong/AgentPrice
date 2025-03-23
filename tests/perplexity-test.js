/**
 * Direct Perplexity API test script
 * This script directly tests the Perplexity API without using any of our service wrappers
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testPerplexityModels() {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      console.error('❌ Error: PERPLEXITY_API_KEY is not set in environment variables');
      process.exit(1);
    }
    
    console.log('=== Perplexity API Direct Test ===');
    console.log('Testing with available models...');
    
    // Define test parameters
    const models = [
      'llama-3.1-sonar-small-128k-online'
      // Uncomment to test additional models
      // 'sonar-small-online',
      // 'sonar-medium-online',
      // 'llama-3.1-sonar-large-128k-online'
    ];
    
    const testPrompt = 'What are the latest developments in AI research in early 2025? Return your answer with proper citations.';
    
    // Test each model
    for (const model of models) {
      console.log(`\n--- Testing model: ${model} ---`);
      
      try {
        console.time('Request duration');
        
        const response = await axios({
          method: 'post',
          url: 'https://api.perplexity.ai/chat/completions',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          data: {
            model: model,
            messages: [
              { role: 'system', content: 'Be precise and concise. Include multiple reliable and diverse sources when providing information.' },
              { role: 'user', content: testPrompt }
            ],
            max_tokens: 1000,
            temperature: 0.2,
            search_domain_filter: [],
            return_images: false,
            return_related_questions: false,
            search_recency_filter: "day",
            search_context_mode: "high",
            top_k: 10
          },
          timeout: 60000
        });
        
        console.timeEnd('Request duration');
        
        // Process response
        console.log('Status: ✅ Success');
        console.log(`Model: ${response.data.model}`);
        console.log(`Content length: ${response.data.choices[0].message.content.length} chars`);
        
        // Show first part of the response
        console.log('\nResponse excerpt:');
        console.log(response.data.choices[0].message.content.substring(0, 200) + '...');
        
        // Show citations if available
        if (response.data.citations && response.data.citations.length > 0) {
          console.log(`\nCitations: ${response.data.citations.length} sources`);
          response.data.citations.slice(0, 5).forEach((citation, i) => {
            console.log(`${i+1}. ${citation}`);
          });
          
          if (response.data.citations.length > 5) {
            console.log(`... and ${response.data.citations.length - 5} more citations`);
          }
        } else {
          console.log('\nNo citations provided in the response');
        }
        
        // Show token usage
        if (response.data.usage) {
          console.log('\nToken usage:');
          console.log(`- Prompt tokens: ${response.data.usage.prompt_tokens}`);
          console.log(`- Completion tokens: ${response.data.usage.completion_tokens}`);
          console.log(`- Total tokens: ${response.data.usage.total_tokens}`);
        }
        
      } catch (error) {
        console.timeEnd('Request duration');
        console.log(`Status: ❌ Failed`);
        console.error(`Error testing model ${model}:`, error.message);
        if (error.response) {
          console.error('API error details:', error.response.data);
        }
      }
    }
    
    console.log('\n=== Test completed ===');
    
  } catch (error) {
    console.error('Test script error:', error);
    process.exit(1);
  }
}

// Run test when this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testPerplexityModels()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testPerplexityModels };