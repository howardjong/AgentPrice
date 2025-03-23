
const AnthropicService = require('../../services/anthropicService.js');

async function checkModel() {
  const claude = new AnthropicService();
  
  try {
    const response = await claude.client.messages.create({
      model: claude.model,
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: 'What model are you? Please respond with only the model name.'
      }]
    });
    
    console.log('Configured model:', claude.model);
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
