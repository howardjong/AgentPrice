/**
 * Diagnostic Service
 * 
 * This service provides test tools to generate simulated diagnostic data
 * for testing the health monitoring UI and Socket.IO connections.
 */

/**
 * API Status structure used by the health monitoring system
 */
export interface ApiStatus {
  claude: {
    status: string;
    model: string;
    responseTime: number;
    costPerHour: number;
    uptime: number;
    // Additional detailed metrics for testing
    requestCount?: number;
    errorCount?: number;
    throttleCount?: number;
  };
  perplexity: {
    status: string;
    model: string;
    responseTime: number;
    costPerHour: number;
    uptime: number;
    // Additional detailed metrics for testing
    requestCount?: number;
    errorCount?: number;
    throttleCount?: number;
  };
  lastUpdated: string;
  healthScore: number;
}

/**
 * System status structure used by the health monitoring system
 */
export interface SystemStatus {
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
  healthScore: number;
}

/**
 * Status change event structure
 */
export interface StatusChange {
  service: string;
  oldStatus: string;
  newStatus: string;
  reason: string;
  timestamp: number;
}

/**
 * Generate a simulated API status report for testing
 * 
 * @param scenario - Test scenario to simulate ('normal', 'degraded', 'error', 'recover')
 * @returns Simulated API status data
 */
export function generateTestApiStatus(scenario: string): ApiStatus {
  // Create a base normal status
  const baseStatus: ApiStatus = {
    claude: {
      status: 'connected',
      model: 'claude-3-7-sonnet-20250219',
      responseTime: 1200,
      costPerHour: 8.5,
      uptime: 99.8,
      requestCount: 245,
      errorCount: 0,
      throttleCount: 0
    },
    perplexity: {
      status: 'connected',
      model: 'sonar',
      responseTime: 850,
      costPerHour: 5.2,
      uptime: 99.9,
      requestCount: 312,
      errorCount: 0,
      throttleCount: 0
    },
    lastUpdated: new Date().toISOString(),
    healthScore: 98
  };

  // Modify the status based on the requested scenario
  switch (scenario) {
    case 'degraded':
      baseStatus.claude.status = 'degraded';
      baseStatus.claude.responseTime = 3500;
      baseStatus.claude.uptime = 95.2;
      baseStatus.claude.throttleCount = 12;
      baseStatus.healthScore = 72;
      break;

    case 'error':
      baseStatus.perplexity.status = 'error';
      baseStatus.perplexity.responseTime = 0;
      baseStatus.perplexity.uptime = 85.0;
      baseStatus.perplexity.errorCount = 25;
      baseStatus.healthScore = 45;
      break;

    case 'critical':
      baseStatus.claude.status = 'error';
      baseStatus.perplexity.status = 'error';
      baseStatus.claude.responseTime = 0;
      baseStatus.perplexity.responseTime = 0;
      baseStatus.claude.uptime = 78.5;
      baseStatus.perplexity.uptime = 80.1;
      baseStatus.claude.errorCount = 35;
      baseStatus.perplexity.errorCount = 28;
      baseStatus.healthScore = 15;
      break;

    case 'throttled':
      baseStatus.perplexity.status = 'throttled';
      baseStatus.perplexity.responseTime = 4200;
      baseStatus.perplexity.throttleCount = 42;
      baseStatus.perplexity.uptime = 92.1;
      baseStatus.healthScore = 65;
      break;

    case 'recovering':
      baseStatus.claude.status = 'recovering';
      baseStatus.claude.responseTime = 2800;
      baseStatus.claude.uptime = 89.3;
      baseStatus.claude.errorCount = 8;
      baseStatus.healthScore = 78;
      break;
  }

  return baseStatus;
}

/**
 * Generate a simulated system status report for testing
 * 
 * @param scenario - Test scenario to simulate ('normal', 'memory-pressure', 'optimizing', 'critical')
 * @returns Simulated system status data
 */
export function generateTestSystemStatus(scenario: string): SystemStatus {
  // Create a base normal status
  const baseStatus: SystemStatus = {
    type: 'system_status',
    timestamp: Date.now(),
    status: 'healthy',
    memory: {
      usagePercent: 45.2,
      healthy: true
    },
    apiServices: {
      claude: {
        status: 'connected',
        requestCount: 245
      },
      perplexity: {
        status: 'connected',
        requestCount: 312
      }
    },
    optimization: {
      enabled: true,
      tokenSavings: 124500,
      tier: 'standard'
    },
    healthScore: 98
  };

  // Modify the status based on the requested scenario
  switch (scenario) {
    case 'memory-pressure':
      baseStatus.status = 'degraded';
      baseStatus.memory.usagePercent = 82.5;
      baseStatus.memory.healthy = false;
      baseStatus.optimization.tier = 'aggressive';
      baseStatus.healthScore = 64;
      break;

    case 'optimizing':
      baseStatus.status = 'degraded';
      baseStatus.memory.usagePercent = 72.3;
      baseStatus.memory.healthy = true;
      baseStatus.optimization.tier = 'aggressive';
      baseStatus.optimization.tokenSavings = 256800;
      baseStatus.healthScore = 78;
      break;

    case 'critical':
      baseStatus.status = 'critical';
      baseStatus.memory.usagePercent = 94.8;
      baseStatus.memory.healthy = false;
      baseStatus.apiServices.claude.status = 'error';
      baseStatus.apiServices.perplexity.status = 'throttled';
      baseStatus.optimization.tier = 'emergency';
      baseStatus.healthScore = 15;
      break;
  }

  return baseStatus;
}

/**
 * Generate a simulated status change event for testing
 * 
 * @param service - Service name ('claude', 'perplexity', 'system')
 * @param oldStatus - Previous status
 * @param newStatus - New status
 * @param reason - Reason for the status change
 * @returns Simulated status change event
 */
export function generateStatusChange(
  service: string,
  oldStatus: string,
  newStatus: string,
  reason: string
): StatusChange {
  return {
    service,
    oldStatus,
    newStatus,
    reason,
    timestamp: Date.now()
  };
}

/**
 * Generate a set of related status change events based on a scenario
 * 
 * @param scenario - Scenario to simulate ('recovery', 'degradation', 'failure')
 * @returns Array of status change events
 */
export function generateScenarioChanges(scenario: string): StatusChange[] {
  const events: StatusChange[] = [];
  
  switch (scenario) {
    case 'recovery':
      events.push(
        generateStatusChange(
          'perplexity',
          'throttled',
          'degraded',
          'Rate limits increased by provider'
        ),
        generateStatusChange(
          'perplexity',
          'degraded',
          'connected',
          'Response times back to normal'
        ),
        generateStatusChange(
          'system',
          'degraded',
          'healthy',
          'All services online and operational'
        )
      );
      break;
      
    case 'degradation':
      events.push(
        generateStatusChange(
          'claude',
          'connected',
          'degraded',
          'Increased response latency detected'
        ),
        generateStatusChange(
          'system',
          'healthy',
          'degraded',
          'Primary API service experiencing slowdowns'
        )
      );
      break;
      
    case 'failure':
      events.push(
        generateStatusChange(
          'perplexity',
          'connected',
          'throttled',
          'Rate limit exceeded - 429 errors'
        ),
        generateStatusChange(
          'perplexity',
          'throttled',
          'error',
          'Connection failures after throttling'
        ),
        generateStatusChange(
          'system',
          'degraded',
          'critical',
          'Research capability unavailable'
        )
      );
      break;
  }
  
  return events;
}