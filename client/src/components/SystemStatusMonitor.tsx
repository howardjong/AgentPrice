import React, { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

// Define types for API status data
interface ApiService {
  status: 'connected' | 'degraded' | 'error' | 'disconnected';
  model: string;
  responseTime: number;
  costPerHour: number;
  uptime: number;
}

interface ApiStatusData {
  claude: ApiService;
  perplexity: ApiService;
  lastUpdated: string;
  healthScore: number;
}

interface ApiStatusMessage {
  type: 'api-status';
  data: ApiStatusData;
}

interface StatusChangeMessage {
  type: 'status-change';
  data: {
    service: 'claude' | 'perplexity';
    oldStatus: string;
    newStatus: string;
    reason: string;
    timestamp: string;
  };
}

interface SystemStatusMessage {
  type: 'system_status';
  timestamp: number;
  status: 'healthy' | 'degraded' | 'critical';
  memory: {
    usagePercent: number;
    healthy: boolean;
  };
  apiServices: {
    claude: {
      status: string;
      requestCount: number;
    };
    perplexity: {
      status: string;
      requestCount: number;
    };
  };
  optimization: {
    enabled: boolean;
    tokenSavings: number;
    tier: string;
  };
  healthScore?: number; // Added health score field
}

type WebSocketMessage = ApiStatusMessage | StatusChangeMessage | SystemStatusMessage;

const SystemStatusMonitor: React.FC = () => {
  // Set up state for our status data
  const [apiStatus, setApiStatus] = useState<ApiStatusData | null>(null);
  const [statusChanges, setStatusChanges] = useState<StatusChangeMessage['data'][]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatusMessage | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  
  // Socket.IO connection reference
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to the Socket.IO server
  const connectSocketIO = () => {
    // Close existing connection if it exists
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    // Create new Socket.IO connection with Replit-optimized configuration
    // Type cast as any to work around Socket.IO type limitations
    const socket = io('', {
      path: '/socket.io',
      // Replit-specific transport configuration: force polling first for reliability
      transports: ['polling', 'websocket'],
      // Enhanced reconnection settings for Replit's environment (with valid types)
      // @ts-ignore - Socket.IO types are incomplete but these options work
      reconnection: true,
      reconnectionAttempts: 15,       // More attempts
      reconnectionDelay: 2000,        // Start with a longer delay
      reconnectionDelayMax: 30000,    // Allow longer delays between attempts
      randomizationFactor: 0.5,       // More randomization to avoid connection waves
      timeout: 40000,                 // Longer timeout for slow connections
      // Connection settings
      autoConnect: true,
      forceNew: true,
      // Disable some potentially problematic features in Replit's environment
      // @ts-ignore - Socket.IO types are incomplete
      upgrade: true,
      rememberUpgrade: false,
      // Connection test can block threads and cause issues, so disable
      // @ts-ignore - Socket.IO type system doesn't correctly model all options but these work at runtime
      perMessageDeflate: false
    });
    
    socketRef.current = socket;
    
    // Connection events
    socket.on('connect', () => {
      console.log('Socket.IO connected with ID:', socket.id);
      setConnected(true);
      setReconnectAttempts(0);
      
      // Subscribe to topics we're interested in
      socket.emit('subscribe', {
        topics: ['api-status', 'status-change', 'system_status', 'all']
      });
      
      // Request initial status
      socket.emit('request_status');
      socket.emit('request_api_status');
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      if (!connected) {
        // Only increment reconnect attempts if we weren't connected
        setReconnectAttempts(prev => prev + 1);
      }
    });
    
    socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected, reason:', reason);
      setConnected(false);
      
      // If the disconnection wasn't initiated by the client
      if (reason !== 'io client disconnect') {
        // Socket.IO will handle automatic reconnection
        console.log('Socket.IO will attempt automatic reconnection');
      }
    });
    
    socket.on('reconnect', (attemptNumber) => {
      console.log(`Socket.IO reconnected after ${attemptNumber} attempts`);
      setReconnectAttempts(0);
    });
    
    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Socket.IO reconnect attempt #${attemptNumber}`);
      setReconnectAttempts(attemptNumber);
    });
    
    socket.on('reconnect_error', (error) => {
      console.error('Socket.IO reconnection error:', error);
    });
    
    socket.on('reconnect_failed', () => {
      console.error('Socket.IO reconnection failed after maximum attempts');
      // Manual reconnection will be needed
      handleManualReconnect();
    });
    
    // Message handling
    socket.on('message', (data) => {
      try {
        // Handle different message types
        const message = typeof data === 'string' ? JSON.parse(data) : data;
        
        switch (message.type) {
          case 'api-status':
            console.log('Received API status update:', message.data);
            setApiStatus(message.data);
            break;
          
          case 'status-change':
            console.log('Received status change:', message.data);
            setStatusChanges(prev => [message.data, ...prev].slice(0, 10)); // Keep last 10 changes
            break;
          
          case 'system_status':
            console.log('Received system status update');
            setSystemStatus(message);
            break;
            
          case 'pong':
            console.log('Received pong response:', message);
            break;
            
          default:
            console.log('Unknown message type:', message);
        }
      } catch (error) {
        console.error('Error parsing Socket.IO message:', error);
      }
    });
    
    // Error event
    socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });
    
    // Set up health check ping
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping', { time: Date.now() });
      }
    }, 30000); // Every 30 seconds
    
    // Store the interval for cleanup (using a custom property)
    (socket as any).pingIntervalId = pingInterval;
  };
  
  // Advanced manual reconnection with exponential backoff and additional safeguards for Replit
  const handleManualReconnect = () => {
    // Clear any existing reconnect attempt
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Calculate backoff delay with jitter for Replit's environment
    // This helps prevent reconnection storms and spread out reconnection attempts
    const nextAttempt = reconnectAttempts + 1;
    
    // Base delay with exponential backoff: 2^n seconds (with a cap)
    let reconnectDelay = Math.min(
      120000, // Max 2 minutes - longer for Replit's environment
      2000 * Math.pow(1.5, Math.min(nextAttempt, 12)) // Slower growth curve (1.5 instead of 2)
    );
    
    // Add jitter (±25%) to prevent reconnection thundering herd
    const jitter = reconnectDelay * 0.25 * (Math.random() * 2 - 1);
    reconnectDelay = Math.floor(reconnectDelay + jitter);
    
    console.log(`Manually reconnecting in ${reconnectDelay}ms (attempt ${nextAttempt})...`);
    
    // Set reconnect timeout with safety checks
    reconnectTimeoutRef.current = setTimeout(() => {
      // Check if component is still mounted
      if (socketRef.current !== null || document.body.contains(document.getElementById('system-status-monitor'))) {
        setReconnectAttempts(nextAttempt);
        
        try {
          // Force clean up old connection first
          if (socketRef.current) {
            try {
              // Clean up any lingering connections and listeners
              socketRef.current.removeAllListeners();
              socketRef.current.disconnect();
              socketRef.current = null;
            } catch (e) {
              console.error('Error cleaning up socket connection:', e);
            }
          }
          
          // Create fresh connection
          connectSocketIO();
        } catch (error) {
          console.error('Error during manual reconnect:', error);
          // If reconnection failed, try again after a delay
          if (nextAttempt < 30) { // Limit maximum retry attempts
            setTimeout(() => handleManualReconnect(), 5000);
          } else {
            console.error('Maximum reconnection attempts exceeded, giving up');
          }
        }
      }
    }, reconnectDelay);
  };
  
  // Set up Socket.IO connection on component mount
  useEffect(() => {
    connectSocketIO();
    
    // Set up periodic status requests
    const statusInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('request_status');
        socketRef.current.emit('request_api_status');
      }
    }, 60000); // Every minute
    
    // Clean up function to close Socket.IO and clear intervals/timeouts on unmount
    return () => {
      if (socketRef.current) {
        // Clear the ping interval
        if ((socketRef.current as any).pingIntervalId) {
          clearInterval((socketRef.current as any).pingIntervalId);
        }
        
        // Disconnect the socket
        socketRef.current.disconnect();
      }
      
      // Clear the status update interval
      clearInterval(statusInterval);
      
      // Clear any reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);
  
  // Helper function to get status badge classes
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'connected':
      case 'online':
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'error':
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'disconnected':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };
  
  // Render the monitor UI
  return (
    <div id="system-status-monitor" className="bg-white shadow rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">System Status</h2>
        <div className="flex items-center">
          <div className={`h-2 w-2 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      
      {/* Connection status message */}
      {!connected && (
        <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
          {reconnectAttempts > 0 
            ? `Attempting to reconnect... (Attempt ${reconnectAttempts})` 
            : 'Connection lost. Reconnecting...'}
        </div>
      )}
      
      {/* API Service Status */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-2">API Services</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {apiStatus ? (
            <>
              <div className="border rounded p-3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Claude</h4>
                  <span className={`text-xs px-2 py-1 rounded-full border ${getStatusBadgeClass(apiStatus.claude.status)}`}>
                    {apiStatus.claude.status}
                  </span>
                </div>
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Model:</span>
                    <span>{apiStatus.claude.model}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Response Time:</span>
                    <span>{apiStatus.claude.responseTime}ms</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Uptime:</span>
                    <span>{apiStatus.claude.uptime}%</span>
                  </div>
                </div>
              </div>
              
              <div className="border rounded p-3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Perplexity</h4>
                  <span className={`text-xs px-2 py-1 rounded-full border ${getStatusBadgeClass(apiStatus.perplexity.status)}`}>
                    {apiStatus.perplexity.status}
                  </span>
                </div>
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Model:</span>
                    <span>{apiStatus.perplexity.model}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Response Time:</span>
                    <span>{apiStatus.perplexity.responseTime}ms</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Uptime:</span>
                    <span>{apiStatus.perplexity.uptime}%</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="col-span-2 text-center py-4 text-gray-500">
              Waiting for API status data...
            </div>
          )}
        </div>
      </div>
      
      {/* System Status */}
      {systemStatus && (
        <div className="mb-6">
          <h3 className="text-md font-medium mb-2">System Health</h3>
          <div className="border rounded p-3">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">Overall Status</h4>
              <span className={`text-xs px-2 py-1 rounded-full border ${getStatusBadgeClass(systemStatus.status)}`}>
                {systemStatus.status}
              </span>
            </div>
            
            <div className="mb-3">
              <div className="flex justify-between mb-1 text-sm">
                <span className="text-gray-600">Memory Usage:</span>
                <span>{systemStatus.memory.usagePercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    systemStatus.memory.usagePercent > 80 ? 'bg-red-500' : 
                    systemStatus.memory.usagePercent > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${systemStatus.memory.usagePercent}%` }}
                ></div>
              </div>
            </div>
            
            <div className="text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Optimization:</span>
                <span>{systemStatus.optimization.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Token Savings:</span>
                <span>{systemStatus.optimization.tokenSavings.toLocaleString()}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Tier:</span>
                <span className="capitalize">{systemStatus.optimization.tier}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Recent Status Changes */}
      {statusChanges.length > 0 && (
        <div>
          <h3 className="text-md font-medium mb-2">Recent Status Changes</h3>
          <ul className="border rounded divide-y">
            {statusChanges.map((change, index) => (
              <li key={index} className="p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium capitalize">{change.service}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(change.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex space-x-1 items-center mb-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${getStatusBadgeClass(change.oldStatus).includes('green') ? 'bg-green-500' : 
                    getStatusBadgeClass(change.oldStatus).includes('yellow') ? 'bg-yellow-500' : 
                    getStatusBadgeClass(change.oldStatus).includes('red') ? 'bg-red-500' : 'bg-gray-500'}`}>
                  </span>
                  <span className="text-sm">{change.oldStatus}</span>
                  <span className="text-gray-400">→</span>
                  <span className={`inline-block w-2 h-2 rounded-full ${getStatusBadgeClass(change.newStatus).includes('green') ? 'bg-green-500' : 
                    getStatusBadgeClass(change.newStatus).includes('yellow') ? 'bg-yellow-500' : 
                    getStatusBadgeClass(change.newStatus).includes('red') ? 'bg-red-500' : 'bg-gray-500'}`}>
                  </span>
                  <span className="text-sm">{change.newStatus}</span>
                </div>
                <p className="text-sm text-gray-600">{change.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SystemStatusMonitor;