
import axios from 'axios';
import logger from '../../utils/logger.js';

async function testHealthEndpoint() {
  try {
    const response = await axios.get('http://0.0.0.0:5000/health');
    
    if (response.status === 200 && response.data.status === 'ok') {
      logger.info('Health endpoint test passed', {
        status: response.status,
        data: response.data,
        headers: response.headers['x-trace-id'] ? 'Trace ID present' : 'No trace ID'
      });
    } else {
      logger.error('Health endpoint test failed', {
        status: response.status,
        data: response.data
      });
    }
  } catch (error) {
    logger.error('Health endpoint test error', {
      error: error.message
    });
  }
}

testHealthEndpoint();
