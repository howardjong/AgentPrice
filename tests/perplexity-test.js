/**
 * Direct Perplexity API test script
 * This script directly tests the Perplexity API without using any of our service wrappers
 */
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const apiKey = process.env.PERPLEXITY_API_KEY;

console.log(`API Key available: ${!!apiKey}`);
console.log(`API Key length: ${apiKey ? apiKey.length : 0}`);
console.log(`First few characters: ${apiKey ? apiKey.substring(0, 4) : 'N/A'}...`);

// Display environment variables for debugging
console.log('\nEnvironment Variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DOTENV_CONFIG_PATH:', process.env.DOTENV_CONFIG_PATH);

async function testPerplexityModels() {
  if (!apiKey) {
    console.error('No API key found!');
    return;
  }

  const models = [
    'sonar-mini-online',
    'sonar-small-online',
    'sonar-medium-online',
    'llama-3.1-sonar-small-32k-online',
    'sonar-small-chat',
    'sonar-pro'
  ];

  console.log('\nTesting different models:');
  
  for (const model of models) {
    try {
      console.log(`\nTesting model: ${model}`);
      
      const response = await axios({
        method: 'POST',
        url: 'https://api.perplexity.ai/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        data: {
          model: model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say hello' }
          ],
          max_tokens: 10
        },
        timeout: 10000 // 10 seconds timeout
      });
      
      console.log(`✅ Success with model ${model}`);
      console.log(`Status: ${response.status}`);
      console.log(`Model used: ${response.data.model}`);
      console.log(`Response: ${JSON.stringify(response.data.choices[0].message.content).substring(0, 50)}...`);
    } catch (error) {
      console.error(`❌ Error with model ${model}:`);
      console.error(`Error message: ${error.message}`);
      
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Response data:`, error.response.data);
      }
    }
  }
}

// Run the test
testPerplexityModels()
  .then(() => {
    console.log('\nPerplexity API testing completed.');
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
  });