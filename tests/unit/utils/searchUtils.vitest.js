/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as searchUtils from '../../../utils/searchUtils.js';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('searchUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('search', () => {
    it('should search API with provided query and options', async () => {
      // Set up axios mock response
      const mockResponse = {
        data: {
          results: [
            { id: '1', title: 'Result 1', score: 0.8 },
            { id: '2', title: 'Result 2', score: 0.7 }
          ]
        }
      };
      
      axios.get.mockResolvedValue(mockResponse);
      
      // Call the function
      const results = await searchUtils.search('test query', { limit: 5, page: 2 });
      
      // Verify axios was called with correct params
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith('/api/search', {
        params: {
          q: 'test query',
          limit: 5,
          page: 2
        }
      });
      
      // Verify results
      expect(results).toEqual(mockResponse.data.results);
    });
    
    it('should use default options when not provided', async () => {
      // Set up axios mock response
      const mockResponse = {
        data: {
          results: [
            { id: '1', title: 'Result 1', score: 0.8 },
            { id: '2', title: 'Result 2', score: 0.7 }
          ]
        }
      };
      
      axios.get.mockResolvedValue(mockResponse);
      
      // Call the function with only query
      await searchUtils.search('test query');
      
      // Verify axios was called with default params
      expect(axios.get).toHaveBeenCalledWith('/api/search', {
        params: {
          q: 'test query',
          limit: 10,
          page: 1
        }
      });
    });
    
    it('should handle API errors gracefully', async () => {
      // Mock axios error
      axios.get.mockRejectedValue(new Error('API Error'));
      
      // Call the function
      const results = await searchUtils.search('test query');
      
      // Should return empty array instead of throwing
      expect(results).toEqual([]);
    });
  });
  
  describe('filterResults', () => {
    it('should filter results based on score threshold', () => {
      const mockResults = [
        { id: '1', score: 0.9 },
        { id: '2', score: 0.7 },
        { id: '3', score: 0.5 },
        { id: '4', score: 0.3 }
      ];
      
      const filtered = searchUtils.filterResults(mockResults, 0.6);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(r => r.id)).toEqual(['1', '2']);
    });
    
    it('should use default threshold of 0.5 when not specified', () => {
      const mockResults = [
        { id: '1', score: 0.9 },
        { id: '2', score: 0.6 },
        { id: '3', score: 0.5 },
        { id: '4', score: 0.4 }
      ];
      
      const filtered = searchUtils.filterResults(mockResults);
      
      expect(filtered).toHaveLength(3);
      expect(filtered.map(r => r.id)).toEqual(['1', '2', '3']);
    });
  });
  
  describe('groupByCategory', () => {
    it('should group results by their category', () => {
      const mockResults = [
        { id: '1', category: 'article', title: 'Article 1' },
        { id: '2', category: 'video', title: 'Video 1' },
        { id: '3', category: 'article', title: 'Article 2' },
        { id: '4', category: 'image', title: 'Image 1' }
      ];
      
      const grouped = searchUtils.groupByCategory(mockResults);
      
      expect(Object.keys(grouped)).toHaveLength(3);
      expect(grouped.article).toHaveLength(2);
      expect(grouped.video).toHaveLength(1);
      expect(grouped.image).toHaveLength(1);
      expect(grouped.article[0].id).toBe('1');
      expect(grouped.article[1].id).toBe('3');
    });
    
    it('should use "uncategorized" for items without a category', () => {
      const mockResults = [
        { id: '1', category: 'article' },
        { id: '2' }, // No category
        { id: '3', category: '' } // Empty category
      ];
      
      const grouped = searchUtils.groupByCategory(mockResults);
      
      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped.article).toHaveLength(1);
      expect(grouped.uncategorized).toHaveLength(2);
    });
  });
  
  describe('sortByScore', () => {
    it('should sort results by score in descending order', () => {
      const mockResults = [
        { id: '1', score: 0.5 },
        { id: '2', score: 0.9 },
        { id: '3', score: 0.7 }
      ];
      
      const sorted = searchUtils.sortByScore(mockResults);
      
      expect(sorted[0].id).toBe('2'); // 0.9
      expect(sorted[1].id).toBe('3'); // 0.7
      expect(sorted[2].id).toBe('1'); // 0.5
    });
    
    it('should not modify the original array', () => {
      const mockResults = [
        { id: '1', score: 0.5 },
        { id: '2', score: 0.9 }
      ];
      
      searchUtils.sortByScore(mockResults);
      
      // Original array should be unchanged
      expect(mockResults[0].id).toBe('1');
      expect(mockResults[1].id).toBe('2');
    });
  });
  
  describe('transformForDisplay', () => {
    it('should add display-friendly fields to results', () => {
      const mockResults = [
        { 
          id: '1', 
          title: 'Test Result', 
          score: 0.75,
          timestamp: '2023-04-01T12:00:00Z'
        }
      ];
      
      const transformed = searchUtils.transformForDisplay(mockResults);
      
      expect(transformed[0].displayTitle).toBe('Test Result');
      expect(transformed[0].scorePercentage).toBe('75%');
      expect(transformed[0].date).not.toBe('Unknown date');
    });
    
    it('should handle missing fields gracefully', () => {
      const mockResults = [
        { 
          id: '1',
          score: 0.5 
          // No title or timestamp
        }
      ];
      
      const transformed = searchUtils.transformForDisplay(mockResults);
      
      expect(transformed[0].displayTitle).toBe('Unnamed result');
      expect(transformed[0].scorePercentage).toBe('50%');
      expect(transformed[0].date).toBe('Unknown date');
    });
  });
  
  describe('extractKeywords', () => {
    it('should extract keywords from a query string', () => {
      const keywords = searchUtils.extractKeywords('How to build a machine learning model');
      
      expect(keywords).toContain('how');
      expect(keywords).toContain('build');
      expect(keywords).toContain('machine');
      expect(keywords).toContain('learning');
      expect(keywords).toContain('model');
      // Should not contain 'to', 'a' (common words)
      expect(keywords).not.toContain('to');
      expect(keywords).not.toContain('a');
    });
    
    it('should filter out common words and short words', () => {
      const keywords = searchUtils.extractKeywords('The cat in the hat');
      
      expect(keywords).toContain('cat');
      expect(keywords).toContain('hat');
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('in');
    });
    
    it('should handle empty strings', () => {
      const keywords = searchUtils.extractKeywords('');
      expect(keywords).toEqual([]);
    });
  });
});