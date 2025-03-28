import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, Server } from "lucide-react";

interface SystemStatus {
  type: string;
  timestamp: number;
  status: string;
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

interface ResearchProgress {
  type: string;
  jobId: string;
  progress: number;
  status: string;
  timestamp: number;
}

interface OptimizationStatus {
  type: string;
  status: any;
  timestamp: number;
}

type WebSocketMessage = SystemStatus | ResearchProgress | OptimizationStatus;

export default function SystemStatusMonitor() {
  const [connected, setConnected] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [researchJobs, setResearchJobs] = useState<Record<string, ResearchProgress>>({});
  const [optimizationStatus, setOptimizationStatus] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('Never');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  
  // Connect to WebSocket on component mount
  useEffect(() => {
    // WebSocket connection function with exponential backoff
    const connectWebSocket = () => {
      // Clear any existing reconnect timeout
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Close any existing connection
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // Determine the correct WebSocket URL based on the current protocol and host
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      try {
        // Create new WebSocket connection
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        
        // WebSocket event handlers
        ws.addEventListener('open', () => {
          console.log('WebSocket connected');
          setConnected(true);
          setReconnectAttempts(0); // Reset reconnect attempts on successful connection
          
          // Subscribe to all message types
          ws.send(JSON.stringify({
            type: 'subscribe',
            channels: ['all']
          }));
        });
        
        ws.addEventListener('message', (event) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage;
            
            // Update last updated timestamp
            setLastUpdated(new Date().toLocaleTimeString());
            
            // Handle different message types
            switch (message.type) {
              case 'system_status':
                setSystemStatus(message as SystemStatus);
                break;
                
              case 'research_progress':
                const progressMsg = message as ResearchProgress;
                setResearchJobs(prev => ({
                  ...prev,
                  [progressMsg.jobId]: progressMsg
                }));
                break;
                
              case 'optimization_status':
                const optimizationMsg = message as OptimizationStatus;
                setOptimizationStatus(optimizationMsg.status);
                break;
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        });
        
        ws.addEventListener('close', (event) => {
          // Don't attempt to reconnect if this was a clean close initiated by the client
          if (event.wasClean) {
            console.log('WebSocket closed cleanly');
            setConnected(false);
            return;
          }
          
          console.log('WebSocket disconnected, will reconnect');
          setConnected(false);
          
          // Calculate reconnect delay with exponential backoff, max 30 seconds
          const nextReconnectAttempts = reconnectAttempts + 1;
          setReconnectAttempts(nextReconnectAttempts);
          
          const reconnectDelay = Math.min(
            30000, // Maximum 30 seconds
            1000 * Math.pow(1.5, Math.min(nextReconnectAttempts, 10)) // Exponential backoff
          );
          
          console.log(`Reconnecting in ${reconnectDelay}ms (attempt ${nextReconnectAttempts})`);
          
          // Schedule reconnection
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connectWebSocket();
          }, reconnectDelay);
        });
        
        ws.addEventListener('error', (error) => {
          console.error('WebSocket error:', error);
          // Let the 'close' handler handle reconnection
        });
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        // Schedule reconnection after an error
        reconnectTimeoutRef.current = window.setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connectWebSocket();
        }, 5000);
      }
    };
    
    // Initial connection
    connectWebSocket();
    
    // Cleanup on component unmount
    return () => {
      // Clear any reconnection timeouts
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Close the WebSocket if it exists
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [reconnectAttempts]);
  
  // Send ping every 50 seconds to keep connection alive (server timeout is 60 seconds)
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('Error sending ping:', error);
        }
      }
    }, 50000); // Slightly less than the 60-second broadcast interval
    
    return () => clearInterval(pingInterval);
  }, []);
  
  // Format memory usage for display
  const formatMemoryUsage = (percent: number) => {
    return `${Math.round(percent)}%`;
  };
  
  // Determine health status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  // Render active research jobs
  const renderResearchJobs = () => {
    const activeJobs = Object.values(researchJobs).filter(
      job => job.status !== 'completed' && job.status !== 'failed'
    );
    
    if (activeJobs.length === 0) {
      return (
        <div className="text-sm text-muted-foreground mt-2">
          No active research jobs
        </div>
      );
    }
    
    return activeJobs.map(job => (
      <div key={job.jobId} className="mt-2 border rounded-md p-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium">Job {job.jobId.substring(0, 8)}</span>
          <Badge variant="outline">{job.status}</Badge>
        </div>
        <Progress value={job.progress} className="h-2" />
      </div>
    ));
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl">System Status</CardTitle>
          <Badge variant={connected ? "default" : "destructive"}>
            {connected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {systemStatus ? (
          <>
            <div className="grid gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Server className="mr-2 h-4 w-4" />
                    <span className="text-sm font-medium">System Health</span>
                  </div>
                  <Badge variant="outline" className={getStatusColor(systemStatus.status)}>
                    {systemStatus.status.charAt(0).toUpperCase() + systemStatus.status.slice(1)}
                  </Badge>
                </div>
                <div className="mt-2">
                  <div className="text-xs text-muted-foreground">Memory Usage</div>
                  <div className="flex items-center mt-1">
                    <Progress 
                      value={systemStatus.memory.usagePercent} 
                      className="h-2" 
                    />
                    <span className="ml-2 text-xs">{formatMemoryUsage(systemStatus.memory.usagePercent)}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium mb-2">API Services</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between rounded-md border p-2">
                    <span className="text-xs">Claude</span>
                    <Badge variant="outline" className={
                      systemStatus.apiServices.claude.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                    }>
                      {systemStatus.apiServices.claude.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-2">
                    <span className="text-xs">Perplexity</span>
                    <Badge variant="outline" className={
                      systemStatus.apiServices.perplexity.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                    }>
                      {systemStatus.apiServices.perplexity.status}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium mb-2">Optimization</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between rounded-md border p-2">
                    <span className="text-xs">Status</span>
                    <Badge variant={systemStatus.optimization.enabled ? "default" : "secondary"}>
                      {systemStatus.optimization.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-2">
                    <span className="text-xs">Tier</span>
                    <Badge variant="outline">{systemStatus.optimization.tier}</Badge>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium mb-2">Research Jobs</div>
                {renderResearchJobs()}
              </div>
            </div>
            
            <div className="mt-4 text-xs text-muted-foreground flex items-center">
              <Clock className="h-3 w-3 mr-1" /> 
              Last updated: {lastUpdated}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-40">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">Waiting for status update...</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}