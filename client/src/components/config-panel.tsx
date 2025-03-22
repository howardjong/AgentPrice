import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Terminal } from "@/components/ui/terminal";

interface ConfigPanelProps {
  claudeApiKey: boolean;
  perplexityApiKey: boolean;
  logs: string[];
}

export function ConfigPanel({ claudeApiKey, perplexityApiKey, logs }: ConfigPanelProps) {
  const [autoSwitch, setAutoSwitch] = useState(true);
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [persistenceEnabled, setPersistenceEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState("configuration");

  return (
    <Card className="bg-white rounded-lg shadow overflow-hidden">
      <CardHeader className="border-b border-gray-200">
        <CardTitle className="text-lg font-medium text-gray-900">Configuration & Logs</CardTitle>
        <CardDescription>Service settings and real-time logs</CardDescription>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full border-b border-gray-200 grid grid-cols-2">
          <TabsTrigger 
            value="configuration" 
            className="py-3 px-1 text-center data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:font-medium data-[state=active]:text-sm data-[state=active]:text-primary"
          >
            Configuration
          </TabsTrigger>
          <TabsTrigger 
            value="logs"
            className="py-3 px-1 text-center data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:font-medium data-[state=active]:text-sm data-[state=active]:text-primary"
          >
            Logs
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="configuration" className="px-4 py-4 sm:px-6">
          <div className="space-y-4">
            {/* Claude API Configuration */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Claude API Configuration</h3>
              <div className="bg-gray-50 rounded-md p-3">
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">API Key Status</span>
                    <span className={`font-medium ${claudeApiKey ? 'text-success' : 'text-danger'}`}>
                      {claudeApiKey ? 'Configured' : 'Not Configured'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Model</span>
                    <span className="font-mono">claude-3-7-sonnet-20250219</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Max Tokens</span>
                    <span>4096</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Perplexity API Configuration */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Perplexity API Configuration</h3>
              <div className="bg-gray-50 rounded-md p-3">
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">API Key Status</span>
                    <span className={`font-medium ${perplexityApiKey ? 'text-success' : 'text-danger'}`}>
                      {perplexityApiKey ? 'Configured' : 'Not Configured'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Model</span>
                    <span className="font-mono">llama-3.1-sonar-small-128k-online</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">MCP Enabled</span>
                    <Switch checked={true} />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Service Configuration */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Service Configuration</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-switch" className="text-sm text-gray-700">
                    Auto-switch between services based on query content
                  </Label>
                  <Switch 
                    id="auto-switch" 
                    checked={autoSwitch} 
                    onCheckedChange={setAutoSwitch} 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="streaming" className="text-sm text-gray-700">
                    Enable streaming responses
                  </Label>
                  <Switch 
                    id="streaming" 
                    checked={streamingEnabled} 
                    onCheckedChange={setStreamingEnabled} 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="persistent" className="text-sm text-gray-700">
                    Enable conversation persistence
                  </Label>
                  <Switch 
                    id="persistent" 
                    checked={persistenceEnabled} 
                    onCheckedChange={setPersistenceEnabled} 
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="logs" className="px-4 py-4 sm:px-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">Server Logs</h3>
              <span className="text-xs bg-gray-100 rounded-full py-1 px-2 text-gray-600">Node.js Server</span>
            </div>
            <Terminal content={logs} />
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
