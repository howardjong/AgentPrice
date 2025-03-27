import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Check the assistant's health status
 * This function uses the cost-efficient endpoint that does not make real API calls
 */
export async function checkAssistantHealth(): Promise<{
  status: 'healthy' | 'unhealthy' | 'degraded' | 'error';
  apiKeys: { allPresent: boolean };
  system: {
    memory: { usagePercent: number; healthy: boolean };
    fileSystem: boolean;
  };
  timestamp: string;
}> {
  try {
    const response = await fetch('/api/assistant/health');
    if (!response.ok) {
      return {
        status: 'error',
        apiKeys: { allPresent: false },
        system: {
          memory: { usagePercent: 0, healthy: false },
          fileSystem: false
        },
        timestamp: new Date().toISOString()
      };
    }
    return await response.json();
  } catch (error) {
    console.error('Error checking assistant health:', error);
    return {
      status: 'error',
      apiKeys: { allPresent: false },
      system: {
        memory: { usagePercent: 0, healthy: false },
        fileSystem: false
      },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Check the comprehensive health status of all services
 * This function provides more detailed information about the system
 */
export async function checkFullSystemHealth(): Promise<{
  redis: { status: string; healthy: boolean };
  promptManager: { status: string; healthy: boolean };
  circuitBreaker: { status: string; healthy: boolean; openCircuits: string[] };
  memory: { usagePercent: number };
  apiServices: {
    claude: {
      service: string;
      status: 'connected' | 'disconnected' | 'error';
      lastUsed: string | null;
      version: string;
    };
    perplexity: {
      service: string;
      status: 'connected' | 'disconnected' | 'error';
      lastUsed: string | null;
      version: string;
    };
    server: {
      status: 'running' | 'error';
      load: number;
      uptime: string;
    };
  };
} | null> {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) {
      console.error('Health check failed:', response.statusText);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Error checking system health:', error);
    return null;
  }
}
