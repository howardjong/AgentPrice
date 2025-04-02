/**
 * Service Mocks for Testing
 */

import { vi } from 'vitest';

/**
 * Mock Redis Client
 */
export const mockRedisClient = {
  get: vi.fn().mockImplementation(async (key) => {
    if (key.startsWith('search:')) {
      return JSON.stringify([
        { id: 1, title: 'Cached Result 1', score: 0.9 },
        { id: 2, title: 'Cached Result 2', score: 0.7 }
      ]);
    }
    return null;
  }),
  
  set: vi.fn().mockResolvedValue('OK'),
  
  del: vi.fn().mockResolvedValue(1),
  
  ping: vi.fn().mockResolvedValue('PONG'),
  
  keys: vi.fn().mockResolvedValue([]),
  
  scan: vi.fn().mockResolvedValue(['0', []]),
  
  quit: vi.fn().mockResolvedValue('OK'),
  
  // Add any other Redis methods your application uses here
  hget: vi.fn().mockResolvedValue(null),
  hset: vi.fn().mockResolvedValue(1),
  hmget: vi.fn().mockResolvedValue([]),
  hmset: vi.fn().mockResolvedValue('OK'),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1)
};

/**
 * Mock API Client
 */
export const mockApiClient = {
  get: vi.fn().mockResolvedValue({ data: {} }),
  post: vi.fn().mockResolvedValue({ data: {} }),
  put: vi.fn().mockResolvedValue({ data: {} }),
  delete: vi.fn().mockResolvedValue({ data: {} })
};

/**
 * Mock Database Client
 */
export const mockDbClient = {
  query: vi.fn().mockResolvedValue({ rows: [] }),
  execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
  connect: vi.fn().mockResolvedValue(true),
  disconnect: vi.fn().mockResolvedValue(true)
};