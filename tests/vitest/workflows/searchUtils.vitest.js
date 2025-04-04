/**
 * SearchUtils Test using Mocked API Client
 * 
 * This test demonstrates how to test a function that relies on API client
 * without making real API calls
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import axios from 'axios';

// First, mock axios
vi.mock('axios');

// Import the module under test
import { search, filterResults } from '../../../utils/searchUtils.js';

// Test suite 
describe('SearchUtils', () => {
  // Setup mock responses before all tests
  beforeAll(() => {
    // Configure axios mock
    axios.get.mockResolvedValue({
      data: {
        results: [
          { id: 1, title: 'First result', score: 0.95 },
          { id: 2, title: 'Second result', score: 0.85 },
          { id: 3, title: 'Low priority result', score: 0.35 }
        ]
      }
    });
  });

  // Test the search function
  describe('search', () => {
    it('should return results from API', async () => {
      // Call the function
      const results = await search('test query');
      
      // Verify results
      expect(results).toHaveLength(3);
      expect(results[0].id).toBe(1);
      expect(results[0].title).toBe('First result');
      
      // Verify the API was called correctly
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/search'),
        expect.objectContaining({
          params: expect.objectContaining({
            q: 'test query'
          })
        })
      );
    });
  });
  
  // Test the filter function
  describe('filterResults', () => {
    it('should filter results below threshold', () => {
      const input = [
        { id: 1, title: 'High score', score: 0.9 },
        { id: 2, title: 'Medium score', score: 0.7 },
        { id: 3, title: 'Low score', score: 0.3 }
      ];
      
      const filtered = filterResults(input, 0.5);
      
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe(1);
      expect(filtered[1].id).toBe(2);
    });
  });
});