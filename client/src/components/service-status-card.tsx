import React from "react";
import { ServiceStatus } from "@shared/schema";

interface ServiceStatusCardProps {
  type: "claude" | "perplexity" | "server";
  status: ServiceStatus | {
    status: 'running' | 'error';
    load: number;
    uptime: string;
    error?: string;
  };
}

export function ServiceStatusCard({ type, status }: ServiceStatusCardProps) {
  // Define icon and color based on service type
  let icon, bgColor, title;
  
  switch (type) {
    case "claude":
      icon = <i className="ri-chat-3-line text-primary text-xl"></i>;
      bgColor = "bg-primary/10";
      title = "Claude API";
      break;
    case "perplexity":
      icon = <i className="ri-search-line text-secondary text-xl"></i>;
      bgColor = "bg-secondary/10";
      title = "Perplexity API";
      break;
    case "server":
      icon = <i className="ri-server-line text-dark text-xl"></i>;
      bgColor = "bg-gray-100";
      title = "Express Server";
      break;
  }

  const isActive = status.status === 'connected' || status.status === 'running';
  const statusLabel = isActive ? (type === 'server' ? 'Running' : 'Connected') : 'Disconnected';

  // Format last used time if available
  let lastUsedText = '';
  if ('lastUsed' in status && status.lastUsed) {
    const lastUsed = new Date(status.lastUsed);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) {
      lastUsedText = 'Just now';
    } else if (diffMinutes === 1) {
      lastUsedText = '1 minute ago';
    } else if (diffMinutes < 60) {
      lastUsedText = `${diffMinutes} minutes ago`;
    } else {
      const diffHours = Math.floor(diffMinutes / 60);
      lastUsedText = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    }
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center">
          <div className={`flex-shrink-0 ${bgColor} rounded-md p-3`}>
            {icon}
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd>
                <div className="flex items-center">
                  <span className="text-2xl font-semibold text-dark">{statusLabel}</span>
                  <span className="ml-2 flex-shrink-0">
                    <span className={`w-3 h-3 rounded-full ${isActive ? 'bg-success' : 'bg-danger'}`}></span>
                  </span>
                </div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
      <div className="bg-gray-50 px-4 py-4 sm:px-6">
        <div className="text-sm flex justify-between">
          {type === 'server' ? (
            <>
              <span className="font-medium text-gray-700 truncate">
                <i className="ri-dashboard-line inline-block mr-1"></i> Load: {(status as any).load}%
              </span>
              <span className="font-medium text-gray-500 truncate">
                Uptime: {(status as any).uptime}
              </span>
            </>
          ) : (
            <>
              <span className={`font-medium ${type === 'claude' ? 'text-primary' : 'text-secondary'} truncate`}>
                <i className="ri-time-line inline-block mr-1"></i> Last used: {lastUsedText || 'Never'}
              </span>
              <span className="font-medium text-gray-500 truncate">
                {type === 'claude' ? 'Version: Claude 3 Opus' : 'MCP Integration Active'}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
