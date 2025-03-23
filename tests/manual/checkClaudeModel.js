
import { Anthropic } from '@anthropic-ai/sdk';
import logger from '../../utils/logger.js';

async function checkModel() {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    const response = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: 'What model are you? Please respond with only the model name.'
      }]
    });
    
    console.log('Configured model:', 'claude-3-7-sonnet-20250219');
    console.log('Actual model response:', response.content[0].text);
    console.log('Message metadata:', {
      model: response.model,
      usage: response.usage
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkModel();
