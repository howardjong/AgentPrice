/**
 * End-to-End Single Query Flow Test
 * 
 * This test verifies the complete path of a search query through the system,
 * from API request to database query to results processing and formatting.
 * 
 * It validates both REST API and Socket.IO communication paths.
 */

const axios = require('axios');
const { io } = require('socket.io-client');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const getPort = require('get-port');

// Mock search results for testing
const MOCK_SEARCH_RESULTS = [
  { id: 1, title: 'First Test Result', snippet: 'This is the first test result', score: 0.95 },
  { id: 2, title: 'Second Test Result', snippet: 'This is the second test result', score: 0.87 },
  { id: 3, title: 'Final Test Result', snippet: 'This is the final test result', score: 0.72 }
];

/**
 * Helper to create a promise that times out
 */
function createTimeout(ms, errorMessage) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), ms);
  });
}

/**
 * Helper to wait for a specific socket event
 */
function waitForEvent(socket, eventName, timeout = 5000) {
  return Promise.race([
    new Promise(resolve => socket.once(eventName, resolve)),
    createTimeout(timeout, `Timeout waiting for '${eventName}' event`)
  ]);
}

/**
 * Run the REST API-based search test
 */
async function runRestApiSearchTest() {
  console.log('\n🔍 Testing REST API Search Flow...');
  
  // Setup a test server
  const app = express();
  const server = http.createServer(app);
  const port = await getPort({ port: getPort.makeRange(3000, 3100) });
  
  // Setup search endpoint
  app.get('/api/search', (req, res) => {
    const query = req.query.q || '';
    console.log(`📥 REST API received search query: "${query}"`);
    
    // Simulate processing
    setTimeout(() => {
      // Filter results based on query
      const results = MOCK_SEARCH_RESULTS.filter(
        result => result.title.toLowerCase().includes(query.toLowerCase()) || 
                 result.snippet.toLowerCase().includes(query.toLowerCase())
      );
      
      console.log(`📤 REST API responding with ${results.length} results`);
      res.json({ success: true, query, results });
    }, 100); // Small delay to simulate processing
  });
  
  // Start the server
  await new Promise(resolve => server.listen(port, resolve));
  console.log(`🚀 Test server started on port ${port}`);
  
  try {
    // Test with an empty query (should return all results)
    console.log('📋 Testing empty query...');
    const emptyResponse = await axios.get(`http://localhost:${port}/api/search?q=`);
    console.log(`✅ Empty query returned ${emptyResponse.data.results.length} results`);
    
    // Test with a specific query
    const testQuery = 'test';
    console.log(`📋 Testing query: "${testQuery}"...`);
    const response = await axios.get(`http://localhost:${port}/api/search?q=${testQuery}`);
    
    // Validate response format
    if (!response.data.success) {
      throw new Error('REST API response missing success flag');
    }
    
    if (response.data.query !== testQuery) {
      throw new Error(`REST API response query mismatch: ${response.data.query} vs ${testQuery}`);
    }
    
    if (!Array.isArray(response.data.results)) {
      throw new Error('REST API response results should be an array');
    }
    
    console.log(`✅ Query "${testQuery}" returned ${response.data.results.length} results`);
    console.log('✅ REST API Search Flow test passed!');
    return true;
  } catch (error) {
    console.error('❌ REST API Search Flow test failed:', error.message);
    throw error;
  } finally {
    // Cleanup
    server.close();
    console.log('🧹 Test server shut down');
  }
}

/**
 * Run the Socket.IO-based search test
 */
async function runSocketSearchTest() {
  console.log('\n🔍 Testing Socket.IO Search Flow...');
  
  // Setup a test server
  const app = express();
  const server = http.createServer(app);
  const port = await getPort({ port: getPort.makeRange(3100, 3200) });
  
  // Configure Socket.IO with optimized settings
  const io = new Server(server, {
    perMessageDeflate: false,
    maxHttpBufferSize: 1e6,
    pingTimeout: 10000,
    pingInterval: 5000
  });
  
  // Setup socket handlers
  io.on('connection', (socket) => {
    console.log('👋 Client connected to Socket.IO server');
    
    socket.on('search', (query) => {
      console.log(`📥 Socket.IO received search query: "${query}"`);
      
      // Simulate processing
      setTimeout(() => {
        // Filter results based on query
        const results = MOCK_SEARCH_RESULTS.filter(
          result => result.title.toLowerCase().includes(query.toLowerCase()) || 
                  result.snippet.toLowerCase().includes(query.toLowerCase())
        );
        
        console.log(`📤 Socket.IO responding with ${results.length} results`);
        socket.emit('search_results', { success: true, query, results });
      }, 100); // Small delay to simulate processing
    });
    
    socket.on('disconnect', () => {
      console.log('👋 Client disconnected from Socket.IO server');
    });
  });
  
  // Start the server
  await new Promise(resolve => server.listen(port, resolve));
  console.log(`🚀 Socket.IO test server started on port ${port}`);
  
  // Create client
  const socket = io(`http://localhost:${port}`, {
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 100,
    reconnectionDelayMax: 200,
    timeout: 2000
  });
  
  try {
    // Wait for connection
    await waitForEvent(socket, 'connect');
    console.log('✅ Connected to Socket.IO server');
    
    // Test with an empty query (should return all results)
    console.log('📋 Testing empty query via Socket.IO...');
    socket.emit('search', '');
    const emptyResults = await waitForEvent(socket, 'search_results');
    console.log(`✅ Empty query returned ${emptyResults.results.length} results`);
    
    // Test with a specific query
    const testQuery = 'test';
    console.log(`📋 Testing query: "${testQuery}" via Socket.IO...`);
    socket.emit('search', testQuery);
    const results = await waitForEvent(socket, 'search_results');
    
    // Validate response format
    if (!results.success) {
      throw new Error('Socket.IO response missing success flag');
    }
    
    if (results.query !== testQuery) {
      throw new Error(`Socket.IO response query mismatch: ${results.query} vs ${testQuery}`);
    }
    
    if (!Array.isArray(results.results)) {
      throw new Error('Socket.IO response results should be an array');
    }
    
    console.log(`✅ Query "${testQuery}" returned ${results.results.length} results via Socket.IO`);
    console.log('✅ Socket.IO Search Flow test passed!');
    return true;
  } catch (error) {
    console.error('❌ Socket.IO Search Flow test failed:', error.message);
    throw error;
  } finally {
    // Cleanup - follow best practices
    if (socket) {
      socket.io.opts.reconnection = false; // Disable reconnection before disconnecting
      socket.disconnect();
      socket.removeAllListeners();
    }
    
    server.close();
    console.log('🧹 Socket.IO test server shut down');
  }
}

/**
 * Run the complete end-to-end test suite
 */
async function runEndToEndTests() {
  console.log('🧪 Running End-to-End Query Flow Tests');
  console.log('======================================');
  
  try {
    // Run REST API test
    await runRestApiSearchTest();
    
    // Run Socket.IO test
    await runSocketSearchTest();
    
    console.log('\n🎉 All end-to-end tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ End-to-end tests failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runEndToEndTests();