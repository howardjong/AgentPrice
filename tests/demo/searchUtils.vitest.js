import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { search, initialize, processResults } from '../../utils/searchUtils.js';
import { mockRedisClient } from '../mocks/serviceMocks.js';

// Allow imports to be used in factory function by using hoistingImports option
vi.mock('../../utils/logger.js', { hoistingImports: true }, () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}));

// Missing __esModule: true flag
vi.mock('../../services/redisClient.js', { hoistingImports: true }, () => ({
  __esModule: true,
  default: mockRedisClient
}));

// Another mock missing the flag
vi.mock('../../services/dataService.js', { hoistingImports: true }, () => ({
  __esModule: true,
  getData: vi.fn().mockResolvedValue(['data1', 'data2']),
  saveData: vi.fn().mockResolvedValue(true)
}));

describe('Search Utilities Tests', () => {
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
  
  it('should initialize search module correctly', async () => {
    await initialize({ cacheEnabled: true });
    // Add your assertions here
  });
  
  it('should search for items successfully', async () => {
    const results = await search('test query');
    // Add your assertions here
  });
});