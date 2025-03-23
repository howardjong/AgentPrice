
import claudeService from '../../services/claudeService.js';
import logger from '../../utils/logger.js';

async function checkModel() {
  try {
    const EXPECTED_MODEL = 'claude-3-7-sonnet-20250219';
    if (!claudeService.isConnected) {
      throw new Error('Claude service is not connected');
    }

    console.log('\n=== API Configuration ===');
    console.log('Expected model:', EXPECTED_MODEL);
    console.log('API Key configured:', !!process.env.ANTHROPIC_API_KEY);
    
    // Test 1: API Response validation
    const modelResponse = await claudeService.client.messages.create({
      model: EXPECTED_MODEL,
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: 'Return exactly this string: "claude-3-7-sonnet-20240219"'
      }]
    });

    // Log complete response object for debugging
    console.log('\n=== Raw API Response ===');
    console.log('Response ID:', modelResponse.id);
    console.log('Response Type:', modelResponse.type);
    console.log('Complete Message:', modelResponse.content);
    console.log('Response Model:', modelResponse.model);
    console.log('Response Role:', modelResponse.role);
    console.log('System Fingerprint:', modelResponse.system_fingerprint);
    console.log('Usage Details:', JSON.stringify(modelResponse.usage, null, 2));
    
    console.log('\n=== Model Identity Test ===');
    console.log('Configured model:', 'claude-3-7-sonnet-20250219');
    console.log('Model self-identification:', modelResponse.content[0].text);
    console.log('Response metadata:', {
      model: modelResponse.model,
      usage: modelResponse.usage
    });

    // Test 2: Version check
    const versionResponse = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: 'What version number are you? Please provide only the version number.'
      }]
    });

    console.log('\n=== Version Test ===');
    console.log('Version response:', versionResponse.content[0].text);
    console.log('Version metadata:', {
      model: versionResponse.model,
      usage: versionResponse.usage
    });

    // Test 3: Capabilities check
    const capabilitiesResponse = await claudeService.client.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: 'What are your core capabilities? List only the key features.'
      }]
    });

    console.log('\n=== Capabilities Test ===');
    console.log('Capabilities response:', capabilitiesResponse.content[0].text);
    console.log('Capabilities metadata:', {
      model: capabilitiesResponse.model,
      usage: capabilitiesResponse.usage
    });

  } catch (error) {
    console.error('Error checking Claude model:', error);
    process.exit(1);
  }
}

checkModel();
