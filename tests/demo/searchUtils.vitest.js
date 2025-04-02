import { describe, it, expect, vi } from 'vitest';
import { search, initialize, processResults } from '../../utils/searchUtils.js';
import { mockRedisClient } from '../mocks/serviceMocks.js';
import logger from '../../utils/logger.js';

// These vi.mock calls are AFTER imports, which can cause reference errors
// because Vitest hoists them to the top of the file during execution
vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}));

vi.mock('../../services/redisClient.js', () => ({
  default: mockRedisClient
}));

// Missing module reset in beforeEach
// Missing __esModule: true flag

describe('Search Utilities', () => {
  // Reset modules and clear mocks before each test
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });
  
  // Restore original implementations after each test
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('should initialize the search utilities properly', () => {
    const options = { apiKey: 'test', cacheEnabled: true };
    initialize(options);
    
    expect(mockRedisClient.connect).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('Search utilities initialized');
  });
  
  it('should search with provided query', async () => {
    const query = 'test query';
    mockRedisClient.get.mockResolvedValueOnce(null); // No cache hit
    
    const mockResults = [{ id: 1, title: 'Test Result' }];
    
    // Missing global mocks for fetch/axios that would be used by search
    
    const results = await search(query);
    expect(results).toEqual(mockResults);
    expect(mockRedisClient.set).toHaveBeenCalled();
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