import React, { useEffect, useState, useRef } from 'react';

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
}

type WebSocketMessage = ApiStatusMessage | StatusChangeMessage | SystemStatusMessage;

const SystemStatusMonitor: React.FC = () => {
  // Set up state for our status data
  const [apiStatus, setApiStatus] = useState<ApiStatusData | null>(null);
  const [statusChanges, setStatusChanges] = useState<StatusChangeMessage['data'][]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatusMessage | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  
  // Websocket connection reference
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to the WebSocket server
  const connectWebSocket = () => {
    // Determine the correct WebSocket protocol (wss for https, ws for http)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    // Close existing connection if it exists
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    // Create new WebSocket connection
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    // Set up event handlers
    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      setReconnectAttempts(0);
      
      // Subscribe to topics we're interested in
      ws.send(JSON.stringify({
        type: 'subscribe',
        topics: ['api-status', 'status-change', 'system_status']
      }));
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      handleReconnect();
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // The onclose handler will be called after this
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        
        // Handle different message types
        switch (message.type) {
          case 'api-status':
            setApiStatus(message.data);
            break;
          
          case 'status-change':
            setStatusChanges(prev => [message.data, ...prev].slice(0, 10)); // Keep last 10 changes
            break;
          
          case 'system_status':
            setSystemStatus(message);
            break;
            
          default:
            console.log('Unknown message type:', message);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  };
  
  // Handle WebSocket reconnection with exponential backoff
  const handleReconnect = () => {
    // Clear any existing reconnect attempt
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Calculate backoff delay (capped at 30 seconds)
    const nextAttempt = reconnectAttempts + 1;
    const reconnectDelay = Math.min(
      30000, // Max 30 seconds
      1000 * Math.pow(1.5, Math.min(nextAttempt, 10)) // Exponential backoff
    );
    
    console.log(`Attempting to reconnect in ${reconnectDelay}ms (attempt ${nextAttempt})...`);
    
    // Set reconnect timeout
    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts(nextAttempt);
      connectWebSocket();
    }, reconnectDelay);
  };
  
  // Set up WebSocket connection on component mount
  useEffect(() => {
    connectWebSocket();
    
    // Clean up function to close WebSocket and clear timeouts on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      
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
    <div className="bg-white shadow rounded-lg p-4">
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