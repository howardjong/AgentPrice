import React from "react";
import { ServiceStatusCard } from "@/components/service-status-card";
import { ApiEndpointsTable } from "@/components/api-endpoints-table";
import { ChatInterface } from "@/components/chat-interface";
import { ConfigPanel } from "@/components/config-panel";
import { useChat } from "@/hooks/use-chat";

const API_ENDPOINTS = [
  {
    method: 'POST' as const,
    path: '/api/conversation',
    description: 'Process a conversation message with Claude',
    service: 'Claude' as const
  },
  {
    method: 'POST' as const,
    path: '/api/research',
    description: 'Perform web research using Perplexity',
    service: 'Perplexity' as const
  },
  {
    method: 'POST' as const,
    path: '/api/chat',
    description: 'Auto-route between Claude and Perplexity based on query',
    service: 'Auto-Detect' as const
  },
  {
    method: 'GET' as const,
    path: '/api/status',
    description: 'Get current status of all connected services',
    service: 'System' as const
  },
  {
    method: 'POST' as const,
    path: '/api/visualize',
    description: 'Generate data visualizations via Claude',
    service: 'Claude' as const
  },
  {
    method: 'GET' as const,
    path: '/api/test-visualization/van-westendorp',
    description: 'Test visualization for Van Westendorp Price Sensitivity',
    service: 'Claude' as const
  },
  {
    method: 'GET' as const,
    path: '/api/test-visualization/conjoint',
    description: 'Test visualization for Conjoint Analysis',
    service: 'Claude' as const
  }
];

export default function Dashboard() {
  const { 
    messages, 
    sendMessage, 
    isSendingMessage, 
    apiStatus, 
    isLoadingStatus,
    logs
  } = useChat();

  const handleSendMessage = async (message: string, service: string) => {
    await sendMessage({ message, service });
  };

  // Determine if API keys are configured
  const claudeApiKeyConfigured = !isLoadingStatus && 
    apiStatus?.claude.status === 'connected';
  
  const perplexityApiKeyConfigured = !isLoadingStatus && 
    apiStatus?.perplexity.status === 'connected';

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <div className="flex items-center">
                  <i className="ri-robot-2-line text-primary text-2xl mr-2"></i>
                  <span className="font-bold text-xl text-dark">ChatBot Backend Service</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="flex items-center text-sm text-gray-600">
                <span className="w-3 h-3 rounded-full bg-success mr-2"></span>Services Active
              </span>
              <button className="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none">
                <i className="ri-settings-4-line text-xl"></i>
              </button>
              <button className="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none">
                <i className="ri-user-line text-xl"></i>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {!isLoadingStatus && apiStatus && (
              <>
                <ServiceStatusCard type="claude" status={apiStatus.claude} />
                <ServiceStatusCard type="perplexity" status={apiStatus.perplexity} />
                <ServiceStatusCard type="server" status={apiStatus.server} />
              </>
            )}
          </div>
          
          {/* Chat and Config Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChatInterface 
              messages={messages} 
              onSendMessage={handleSendMessage} 
              isLoading={isSendingMessage}
            />
            
            <ConfigPanel 
              claudeApiKey={claudeApiKeyConfigured}
              perplexityApiKey={perplexityApiKeyConfigured}
              logs={logs}
            />
          </div>
          
          {/* Visualization Section */}
          <div className="mt-6 bg-white rounded-lg shadow overflow-hidden">
            <div className="border-b border-gray-200">
              <div className="px-4 py-4 sm:px-6">
                <h2 className="text-lg font-medium text-gray-900">Visualization Examples</h2>
                <p className="mt-1 text-sm text-gray-500">Test the visualization capabilities of the system</p>
              </div>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a 
                  href="/api/test-visualization/van-westendorp" 
                  target="_blank"
                  rel="noopener noreferrer" 
                  className="flex flex-col items-center p-4 border rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <div className="text-xl font-semibold mb-2">Van Westendorp Chart</div>
                  <p className="text-sm text-gray-500 text-center">Price sensitivity analysis visualization</p>
                </a>
                <a 
                  href="/api/test-visualization/conjoint" 
                  target="_blank"
                  rel="noopener noreferrer" 
                  className="flex flex-col items-center p-4 border rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <div className="text-xl font-semibold mb-2">Conjoint Analysis</div>
                  <p className="text-sm text-gray-500 text-center">Feature preference visualization</p>
                </a>
              </div>
            </div>
          </div>
          
          {/* API Endpoints Section */}
          <div className="mt-6 bg-white rounded-lg shadow overflow-hidden">
            <div className="border-b border-gray-200">
              <div className="px-4 py-4 sm:px-6">
                <h2 className="text-lg font-medium text-gray-900">API Endpoints</h2>
                <p className="mt-1 text-sm text-gray-500">Available endpoints for the chatbot service</p>
              </div>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <ApiEndpointsTable endpoints={API_ENDPOINTS} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
