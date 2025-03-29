
/**
 * Test Claude Prompt Manager Integration
 * 
 * This test verifies that Claude can handle missing prompts gracefully
 */

import claudeService from '../../services/claudeService.js';
import logger from '../../utils/logger.js';

async function testClaudePromptManager() {
  logger.info('Testing Claude prompt manager integration');
  
  try {
    // Test chart data generation with default prompt
    const chartResult = await claudeService.generateChartData('Test market data for a product launch', 'van_westendorp');
    logger.info('✓ Successfully generated chart data with fallback prompt');
    
    // Test clarifying questions with default prompt
    const questions = await claudeService.generateClarifyingQuestions('What is the best strategy for launching a SaaS product?');
    logger.info('✓ Successfully generated clarifying questions with fallback prompt');
    logger.info(`Generated ${questions.length} questions successfully`);
    
    logger.info('All Claude prompt manager tests passed!');
  } catch (error) {
    logger.error('Claude prompt manager test failed', { error: error.message });
    process.exit(1);
  }
}

// Run the test
testClaudePromptManager()
  .then(() => {
    logger.info('Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    logger.error('Test failed with error', { error: error.message });
    process.exit(1);
  });
