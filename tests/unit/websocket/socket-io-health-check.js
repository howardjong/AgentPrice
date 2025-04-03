/**
 * Socket.IO Health Check Utility
 * 
 * This utility performs a series of checks to ensure Socket.IO tests
 * will function properly in the Replit environment.
 */

import { Server } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';
import getPort from 'get-port';
import {
  optimizeSocketClient,
  optimizedWaitForEvent,
  safeDisconnect,
  createOptimizedReconnectionTest,
  optimizeSocketServer
} from '../utils/socket-test-optimization.js';

/**
 * Run a comprehensive health check on Socket.IO test utilities
 * @returns {Promise<Object>} Health status report
 */
async function runSocketIOHealthCheck() {
  console.log('🔍 Starting Socket.IO health check...');
  
  const report = {
    timestamp: new Date().toISOString(),
    status: 'pending',
    checks: {},
    issues: [],
    recommendations: []
  };
  
  let port;
  let httpServer;
  let io;
  let client;
  
  try {
    // 1. Check port availability
    console.log('🔍 Checking port availability...');
    port = await getPort();
    report.checks.portAvailability = { status: 'success', port };
    
    // 2. Check server creation
    console.log('🔍 Testing server creation...');
    const app = express();
    httpServer = createServer(app);
    
    io = new Server(httpServer, {
      cors: { origin: '*' }
    });
    
    optimizeSocketServer(io);
    report.checks.serverCreation = { status: 'success' };
    
    // Setup basic server handlers
    io.on('connection', (socket) => {
      console.log(`🔍 Health Check Server: Client connected - ${socket.id}`);
      
      socket.on('ping', () => {
        socket.emit('pong', { time: Date.now() });
      });
      
      socket.on('health_check', () => {
        socket.emit('health_status', { 
          status: 'ok',
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          timestamp: Date.now()
        });
      });
    });
    
    // 3. Check server start
    console.log('🔍 Testing server start...');
    await new Promise(resolve => httpServer.listen(port, resolve));
    report.checks.serverStart = { status: 'success' };
    
    // 4. Check client connection
    console.log('🔍 Testing client connection...');
    client = SocketIOClient(`http://localhost:${port}`, {
      reconnection: true
    });
    
    optimizeSocketClient(client);
    
    // 5. Check connection establishment
    const connectionStart = Date.now();
    await optimizedWaitForEvent(client, 'connect', 2000);
    const connectionTime = Date.now() - connectionStart;
    
    report.checks.clientConnection = { 
      status: 'success', 
      connectionTimeMs: connectionTime
    };
    
    // 6. Check message exchange
    console.log('🔍 Testing message exchange...');
    client.emit('ping');
    
    const messageStart = Date.now();
    await optimizedWaitForEvent(client, 'pong', 2000);
    const messageTime = Date.now() - messageStart;
    
    report.checks.messageExchange = { 
      status: 'success', 
      messageTimeMs: messageTime
    };
    
    // 7. Check health status
    console.log('🔍 Testing health status request...');
    client.emit('health_check');
    
    const healthStatus = await optimizedWaitForEvent(client, 'health_status', 2000);
    report.checks.healthStatus = { 
      status: 'success',
      serverStatus: healthStatus
    };
    
    // 8. Check reconnection functionality
    console.log('🔍 Testing reconnection functionality...');
    const reconnectionTest = createOptimizedReconnectionTest(client);
    
    const reconnectionStart = Date.now();
    const reconnected = await reconnectionTest.simulateDisconnectAndReconnect(3000);
    const reconnectionTime = Date.now() - reconnectionStart;
    
    report.checks.reconnection = { 
      status: reconnected ? 'success' : 'failure',
      reconnectionTimeMs: reconnectionTime
    };
    
    if (!reconnected) {
      report.issues.push('Reconnection test failed');
      report.recommendations.push('Check Socket.IO reconnection settings and server stability');
    }
    
    // 9. Check optimization settings
    console.log('🔍 Verifying optimization settings...');
    const clientSettings = client.io?.opts || {};
    
    report.checks.optimizationSettings = { 
      status: 'success',
      settings: {
        timeout: clientSettings.timeout,
        pingTimeout: clientSettings.pingTimeout,
        pingInterval: clientSettings.pingInterval,
        reconnectionAttempts: clientSettings.reconnectionAttempts
      }
    };
    
    if (clientSettings.timeout > 5000) {
      report.issues.push('Client timeout is set too high');
      report.recommendations.push('Reduce timeout to 2000ms or less');
    }
    
    // 10. Final cleanup
    await safeDisconnect(client);
    
    await new Promise(resolve => {
      io.close(() => {
        httpServer.close(resolve);
      });
    });
    
    report.checks.cleanup = { status: 'success' };
    
    // Overall status
    const hasFailures = Object.values(report.checks).some(check => check.status === 'failure');
    report.status = hasFailures ? 'warning' : 'success';
    
    if (report.issues.length === 0) {
      report.recommendations.push('Socket.IO test utilities are working properly');
    }
    
    console.log('🔍 Socket.IO health check completed successfully');
    return report;
    
  } catch (error) {
    console.error('🔍 Socket.IO health check failed:', error);
    
    report.status = 'error';
    report.error = {
      message: error.message,
      stack: error.stack
    };
    
    report.issues.push(`Error during health check: ${error.message}`);
    report.recommendations.push('Review error details and fix underlying issues');
    
    // Attempt cleanup even after error
    try {
      if (client) await safeDisconnect(client);
      if (io) io.close();
      if (httpServer) httpServer.close();
    } catch (cleanupError) {
      console.error('🔍 Error during cleanup:', cleanupError);
    }
    
    return report;
  }
}

/**
 * Format health check report as a string
 * @param {Object} report - The health check report
 * @returns {string} Formatted report
 */
function formatHealthReport(report) {
  let output = `
======================================
Socket.IO Test Health Check Report
======================================
Time: ${report.timestamp}
Overall Status: ${report.status.toUpperCase()}
`;

  output += `
Check Results:
--------------`;

  for (const [checkName, result] of Object.entries(report.checks)) {
    const icon = result.status === 'success' ? '✅' : '❌';
    output += `\n${icon} ${checkName}: ${result.status}`;
    
    if (checkName === 'portAvailability' && result.port) {
      output += ` (Port: ${result.port})`;
    }
    else if (checkName === 'clientConnection' && result.connectionTimeMs) {
      output += ` (${result.connectionTimeMs}ms)`;
    }
    else if (checkName === 'messageExchange' && result.messageTimeMs) {
      output += ` (${result.messageTimeMs}ms)`;
    }
    else if (checkName === 'reconnection' && result.reconnectionTimeMs) {
      output += ` (${result.reconnectionTimeMs}ms)`;
    }
    else if (checkName === 'optimizationSettings' && result.settings) {
      output += `\n    - timeout: ${result.settings.timeout}ms`;
      output += `\n    - pingTimeout: ${result.settings.pingTimeout}ms`;
      output += `\n    - pingInterval: ${result.settings.pingInterval}ms`;
      output += `\n    - reconnectionAttempts: ${result.settings.reconnectionAttempts}`;
    }
  }
  
  if (report.issues.length > 0) {
    output += `
\nIssues Detected:
----------------`;
    report.issues.forEach((issue, index) => {
      output += `\n❗ ${index + 1}. ${issue}`;
    });
  }
  
  if (report.recommendations.length > 0) {
    output += `
\nRecommendations:
----------------`;
    report.recommendations.forEach((recommendation, index) => {
      output += `\n💡 ${index + 1}. ${recommendation}`;
    });
  }
  
  if (report.error) {
    output += `
\nError Details:
-------------
${report.error.message}
`;
  }
  
  output += `
======================================
`;

  return output;
}

/**
 * Run the health check and print the report
 */
async function runHealthCheck() {
  try {
    const report = await runSocketIOHealthCheck();
    const formattedReport = formatHealthReport(report);
    console.log(formattedReport);
    
    // Exit with error code if health check failed
    if (report.status === 'error') {
      process.exit(1);
    }
  } catch (error) {
    console.error('Failed to run health check:', error);
    process.exit(1);
  }
}

// Allow running directly or as a module
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  runHealthCheck();
}

// Export functions for use as a module
export {
  runSocketIOHealthCheck,
  formatHealthReport
};