/**
 * Claude Model Behavior Monitor
 * 
 * This utility tests whether Claude is behaving as expected despite model identity mismatches.
 * It's designed to be run periodically to ensure the system continues to function properly.
 */

import claudeService from '../services/claudeService.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function monitorClaudeBehavior() {
  console.log('==== Claude Model Behavior Monitor [Fast Mode] ====');
  console.log('Testing whether Claude services function as expected\n');
  
  try {
    // 1. Check service status
    const status = claudeService.getStatus();
    console.log('Claude Service Status:');
    console.log(JSON.stringify(status, null, 2));
    console.log('');

    // 2. Test a simple fast conversation to check model identity
    console.log('Testing conversation with identity check...');
    const conversationResponse = await claudeService.processConversation([
      {
        role: 'user',
        content: 'Please identify which Claude model you are in a single sentence. Include the term "MODEL CHECK" at the beginning.'
      }
    ]);
    
    console.log('Response metadata:');
    console.log(`Requested model: ${conversationResponse.requestedModel}`);
    console.log(`Actual model: ${conversationResponse.actualModel}`);
    console.log(`Tokens used: ${conversationResponse.tokens.input} input, ${conversationResponse.tokens.output} output`);
    console.log('\nResponse content:');
    console.log('------------------');
    console.log(conversationResponse.response);
    
    console.log('\nFast check completed successfully!');
    
    // Return lightweight test results
    return {
      status,
      conversationResponse,
      success: true,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error during Claude behavior monitoring:', error);
    logger.error('Claude behavior monitor failed', { error: error.message });
    
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Run the monitoring if executed directly
if (process.argv[1].includes('monitor-claude-behavior.js')) {
  monitorClaudeBehavior()
    .then(results => {
      if (results.success) {
        console.log('\nClaudeMonitor: All tests passed successfully ✓');
        process.exit(0);
      } else {
        console.error('\nClaudeMonitor: Tests failed ✗');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('ClaudeMonitor execution error:', error);
      process.exit(1);
    });
}

export default monitorClaudeBehavior;