
import promptManager from '../../services/promptManager.js';
import logger from '../../utils/logger.js';

async function testPromptManager() {
  try {
    logger.info('Testing prompt manager initialization');
    await promptManager.initialize();
    
    logger.info('Testing default prompt loading');
    const prompt = await promptManager.getPrompt('perplexity', 'deep_research');
    
    if (prompt) {
      logger.info('✓ Successfully loaded default prompt');
    } else {
      logger.error('✗ Failed to load default prompt');
    }
  } catch (error) {
    logger.error('Prompt manager test failed', { error: error.message });
  }
}

testPromptManager();
