/**
 * Basic Socket.IO Utils Test
 * 
 * This is a minimal test of the socket test utilities.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  createSocketTestEnvironment,
  waitForConnect
} from '../utils/socket-test-utils.js';

describe('Socket Test Utilities', () => {
  // Shared test environment
  let testEnv;
  
  // Set up a fresh test environment before each test
  beforeEach(async () => {
    console.log('Setting up Socket.IO test environment...');
    try {
      testEnv = await createSocketTestEnvironment();
      console.log(`Test environment created on port ${testEnv.port}`);
    } catch (error) {
      console.error('Error setting up test environment:', error);
      throw error;
    }
  });
  
  // Clean up all resources after each test
  afterEach(async () => {
    console.log('Cleaning up Socket.IO test environment...');
    if (testEnv) {
      try {
        await testEnv.shutdown();
        console.log('Test environment shutdown complete');
      } catch (error) {
        console.error('Error during test environment shutdown:', error);
      }
    }
  });
  
  // Basic test of the test utilities
  it('should create a test environment and client successfully', async () => {
    // Just a basic check to verify the test environment is working
    expect(testEnv).toBeDefined();
    expect(typeof testEnv.port).toBe('number');
    expect(testEnv.clientURL).toContain(`http://localhost:${testEnv.port}`);
    
    // Create a client
    const client = testEnv.createClient();
    expect(client).toBeDefined();
    
    // Connect should be successful
    client.connect();
    
    // This isn't actually testing the socket connection yet, just that the 
    // environment and client were created correctly
    expect(true).toBe(true);
  });
});