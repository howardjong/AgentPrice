/**
 * System Health Check Tests
 * 
 * Tests the system health monitoring functionality.
 * 
 * This test verifies that:
 * 1. Health scores are calculated correctly
 * 2. API service status is properly reported
 * 3. The system correctly identifies and reports issues
 * 4. Health status events are broadcasted as expected
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    configure: vi.fn()
  }
}));

// Mock socket.io for broadcast testing
vi.mock('socket.io', () => ({
  default: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    to: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    sockets: {
      emit: vi.fn(),
      to: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    }
  }))
}));

// Import the system health monitor
import healthMonitor from '../../../services/healthMonitor.js';

// Mock API services
const mockServices = {
  perplexity: {
    getStatus: vi.fn(() => ({ status: 'connected', score: 100 }))
  },
  claude: {
    getStatus: vi.fn(() => ({ status: 'connected', score: 100 }))
  }
};

describe('System Health Check', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Reset health monitor if possible
    if (healthMonitor && typeof healthMonitor.reset === 'function') {
      healthMonitor.reset();
    }
    
    // Initialize with mock services
    if (healthMonitor && typeof healthMonitor.initialize === 'function') {
      healthMonitor.initialize({
        socketServer: { emit: vi.fn() },
        services: mockServices,
        broadcastFn: vi.fn()
      });
    }
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should calculate correct health score when all services are available', () => {
    // All services healthy
    mockServices.perplexity.getStatus.mockReturnValue({ status: 'connected', score: 100 });
    mockServices.claude.getStatus.mockReturnValue({ status: 'connected', score: 100 });
    
    // Calculate health
    const health = healthMonitor.getSystemHealth();
    
    // Should be perfect score
    expect(health.score).toBe(100);
    expect(health.status).toBe('healthy');
    expect(health.services.perplexity.status).toBe('connected');
    expect(health.services.claude.status).toBe('connected');
  });
  
  it('should report degraded health when a service is having issues', () => {
    // Perplexity service degraded
    mockServices.perplexity.getStatus.mockReturnValue({ status: 'degraded', score: 50 });
    mockServices.claude.getStatus.mockReturnValue({ status: 'connected', score: 100 });
    
    // Calculate health
    const health = healthMonitor.getSystemHealth();
    
    // Should be reduced score
    expect(health.score).toBeLessThan(100);
    expect(health.status).toBe('degraded');
    expect(health.services.perplexity.status).toBe('degraded');
    expect(health.services.claude.status).toBe('connected');
  });
  
  it('should report critical health when a service is down', () => {
    // Perplexity service down
    mockServices.perplexity.getStatus.mockReturnValue({ status: 'unavailable', score: 0 });
    mockServices.claude.getStatus.mockReturnValue({ status: 'connected', score: 100 });
    
    // Calculate health
    const health = healthMonitor.getSystemHealth();
    
    // Should be critically low score
    expect(health.score).toBeLessThan(50);
    expect(health.status).toBe('critical');
    expect(health.services.perplexity.status).toBe('unavailable');
    expect(health.services.claude.status).toBe('connected');
  });
  
  it('should report emergency when all services are down', () => {
    // All services down
    mockServices.perplexity.getStatus.mockReturnValue({ status: 'unavailable', score: 0 });
    mockServices.claude.getStatus.mockReturnValue({ status: 'unavailable', score: 0 });
    
    // Calculate health
    const health = healthMonitor.getSystemHealth();
    
    // Should be zero score
    expect(health.score).toBe(0);
    expect(health.status).toBe('emergency');
    expect(health.services.perplexity.status).toBe('unavailable');
    expect(health.services.claude.status).toBe('unavailable');
  });
  
  it('should broadcast health status changes', () => {
    // Mock broadcast function
    const broadcastFn = vi.fn();
    
    // Re-initialize with mock broadcast
    if (healthMonitor && typeof healthMonitor.initialize === 'function') {
      healthMonitor.initialize({
        socketServer: { emit: vi.fn() },
        services: mockServices,
        broadcastFn
      });
    }
    
    // Trigger health status change
    mockServices.perplexity.getStatus.mockReturnValue({ status: 'degraded', score: 50 });
    
    // Broadcast health update
    healthMonitor.broadcastHealth();
    
    // Verify broadcast was called
    expect(broadcastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'system_status',
        data: expect.objectContaining({
          status: 'degraded',
          score: expect.any(Number)
        })
      }),
      expect.any(Array)
    );
  });
  
  it('should track API rate limits in health status', () => {
    // Set API service with rate limit information
    mockServices.perplexity.getStatus.mockReturnValue({ 
      status: 'connected', 
      score: 80,
      rateLimited: true,
      rateLimitResetTime: Date.now() + 60000 // 1 minute from now
    });
    
    // Calculate health
    const health = healthMonitor.getSystemHealth();
    
    // Verify rate limit info is included
    expect(health.services.perplexity.rateLimited).toBe(true);
    expect(health.services.perplexity.rateLimitResetTime).toBeGreaterThan(Date.now());
    
    // Score should be impacted by rate limiting
    expect(health.score).toBeLessThan(100);
  });
  
  it('should handle services in recovery state', () => {
    // Set API service in recovery
    mockServices.perplexity.getStatus.mockReturnValue({ 
      status: 'recovering', 
      score: 70,
      previousFailures: 2
    });
    
    // Calculate health
    const health = healthMonitor.getSystemHealth();
    
    // Verify recovery info is included
    expect(health.services.perplexity.status).toBe('recovering');
    expect(health.status).toBe('degraded');
    
    // Score should reflect recovery state
    expect(health.score).toBeLessThan(100);
  });
  
  it('should include memory health in overall status', () => {
    // This might need adaptation based on how your health monitor tracks memory
    
    // If we can set memory health directly
    if (healthMonitor && typeof healthMonitor.setMemoryHealth === 'function') {
      healthMonitor.setMemoryHealth({ score: 50, status: 'warning', usage: 0.7 });
    }
    
    // Calculate health
    const health = healthMonitor.getSystemHealth();
    
    // Memory health should be included and impact the score
    if (health.memory) {
      expect(health.memory.status).toBe('warning');
      expect(health.score).toBeLessThan(100);
    }
  });
  
  it('should handle simulated API status recovery', () => {
    // Start with degraded status
    mockServices.perplexity.getStatus.mockReturnValue({ 
      status: 'degraded', 
      score: 50
    });
    
    // Calculate initial health
    const initialHealth = healthMonitor.getSystemHealth();
    expect(initialHealth.status).toBe('degraded');
    
    // Service recovers
    mockServices.perplexity.getStatus.mockReturnValue({ 
      status: 'connected', 
      score: 100
    });
    
    // Calculate new health
    const updatedHealth = healthMonitor.getSystemHealth();
    
    // Should be healthy again
    expect(updatedHealth.status).toBe('healthy');
    expect(updatedHealth.score).toBe(100);
  });
});