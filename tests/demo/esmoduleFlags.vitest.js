import { describe, it, expect, vi } from 'vitest';
import { search, initialize, processResults } from '../../utils/searchUtils.js';
import { mockRedisClient } from '../mocks/serviceMocks.js';

// Before imports
vi.mock('../../utils/logger.js', () => ({ __esModule: true,
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}));

// Missing __esModule: true vi.mock('../../services/redisClient.js', () => ({ __esModule: true,
  default: mockRedisClient
}));ckRedisClient
}))vi.mock('../../services/dataService.js', () => ({ __esModule: true,
  getData: vi.fn().mockResolvedValue(['data1', 'data2']),
  saveData: vi.fn().mockResolvedValue(true)
}));vi.fn().mockResolvedValue(true)
}));

describe('Search Utilities with ESModule issue', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should process search results correctly', () => {
    const rawResults = [
      { id: 1, title: 'Test 1', score: 0.8 },
      { id: 2, title: 'Test 2', score: 0.5 },
      { id: 3, title: 'Test 3', score: 0.2 }
    ];
    
    const processed = processResults(rawResults);
    expect(processed).toHaveLength(3);
    expect(processed[0].score).toBeGreaterThan(processed[1].score);
  });
});