
import anthropicService from '../../services/anthropicService.js';

async function checkModel() {
  try {
    const response = await anthropicService.client.messages.create({
      model: anthropicService.model,
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: 'What model are you? Please respond with only the model name.'
      }]
    });
    
    console.log('Configured model:', anthropicService.model);
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
