/**
 * Simple test file for searchUtils
 * This is a basic version to demonstrate the extraction of _performTextSearch 
 * and its use with dependency injection for testability.
 */

import { describe, it, expect, vi } from 'vitest';
import searchUtils, { _performTextSearch } from '../../../utils/searchUtils.js';

describe('Search Utils Module Tests', () => {
  const testCollection = [
    { id: '1', title: 'Machine Learning Basics', content: 'Introduction to ML.' },
    { id: '2', title: 'Web Development', content: 'HTML, CSS and JavaScript.' },
    { id: '3', title: 'Data Science', content: 'Statistical analysis.' },
    { id: '4', title: 'Advanced Machine Learning', content: 'Deep neural networks.' }
  ];

  describe('_performTextSearch Function', () => {
    it('should filter items based on text match in title and content', () => {
      const results = _performTextSearch(testCollection, 'machine learning');
      
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('1');
      expect(results[1].id).toBe('4');
    });
    
    it('should return empty array for no matches', () => {
      const results = _performTextSearch(testCollection, 'blockchain');
      expect(results).toHaveLength(0);
    });
    
    it('should return the original collection if query is empty', () => {
      const results = _performTextSearch(testCollection, '');
      expect(results).toHaveLength(4);
      expect(results).toEqual(testCollection);
    });
    
    it('should handle null or undefined collections', () => {
      expect(_performTextSearch(null, 'test')).toEqual([]);
      expect(_performTextSearch(undefined, 'test')).toEqual([]);
    });
  });
  
  describe('search Function with Dependency Injection', () => {
    it('should use the injected text search function', () => {
      // Create a mock text search function that always returns items with IDs 1 and 4
      const mockTextSearch = vi.fn((collection) => {
        return collection.filter(item => item.id === '1' || item.id === '4');
      });
      
      const result = searchUtils.search(testCollection, { 
        query: 'anything' // This will be ignored since we're using our mock
      }, mockTextSearch);
      
      // Verify the mock was called correctly
      expect(mockTextSearch).toHaveBeenCalledWith(testCollection, 'anything');
      
      // Verify the results
      expect(result.results).toHaveLength(2);
      expect(result.results[0].id).toBe('1');
      expect(result.results[1].id).toBe('4');
      expect(result.pagination.total).toBe(2);
    });
    
    it('should perform actual text search when no mock is provided', () => {
      const result = searchUtils.search(testCollection, { 
        query: 'machine learning'
      });
      
      expect(result.results).toHaveLength(2);
      expect(result.results[0].id).toBe('1');
      expect(result.results[1].id).toBe('4');
      expect(result.pagination.total).toBe(2);
    });
    
    it('should handle sorting and pagination', () => {
      const result = searchUtils.search(testCollection, {
        query: 'a', // This matches all items that have 'a' in their title or content
        sortBy: 'title',
        sortOrder: 'asc',
        page: 1,
        limit: 2
      });
      
      // Due to sorting and pagination, we should get the first 2 items alphabetically
      expect(result.results).toHaveLength(2);
      expect(result.pagination.total).toBeGreaterThan(2); // Total is more than limit
      expect(result.pagination.pages).toBeGreaterThan(1); // Multiple pages
    });
  });
});