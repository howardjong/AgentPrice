/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import * as searchUtils from '../../../utils/searchUtils.js';

describe('searchUtils - Private Functions', () => {
  describe('performTextSearch', () => {
    it('should return matching items based on title', () => {
      const collection = [
        { id: '1', title: 'Machine Learning Basics', content: 'Introduction to ML' },
        { id: '2', title: 'Deep Learning', content: 'Neural Networks' },
        { id: '3', title: 'JavaScript Basics', content: 'Intro to JS' },
        { id: '4', title: 'Advanced Machine Learning', content: 'Advanced ML topics' }
      ];
      
      const result = searchUtils.performTextSearch(collection, 'machine learning');
      
      expect(result).toHaveLength(2);
      expect(result.map(item => item.id)).toContain('1');
      expect(result.map(item => item.id)).toContain('4');
    });
    
    it('should return matching items based on content', () => {
      const collection = [
        { id: '1', title: 'ML Basics', content: 'Introduction to machine learning' },
        { id: '2', title: 'Deep Learning', content: 'Neural Networks' },
        { id: '3', title: 'JS Basics', content: 'JavaScript intro' },
        { id: '4', title: 'ML Advanced', content: 'Advanced machine learning topics' }
      ];
      
      const result = searchUtils.performTextSearch(collection, 'machine learning');
      
      expect(result).toHaveLength(2);
      expect(result.map(item => item.id)).toContain('1');
      expect(result.map(item => item.id)).toContain('4');
    });
    
    it('should return matching items based on description', () => {
      const collection = [
        { id: '1', title: 'ML Basics', description: 'Introduction to machine learning' },
        { id: '2', title: 'Deep Learning', description: 'Neural Networks' },
        { id: '3', title: 'JS Basics', description: 'JavaScript intro' },
        { id: '4', title: 'ML Advanced', description: 'Advanced machine learning topics' }
      ];
      
      const result = searchUtils.performTextSearch(collection, 'machine learning');
      
      expect(result).toHaveLength(2);
      expect(result.map(item => item.id)).toContain('1');
      expect(result.map(item => item.id)).toContain('4');
    });
    
    it('should return all items when search text is empty', () => {
      const collection = [
        { id: '1', title: 'ML Basics' },
        { id: '2', title: 'Deep Learning' },
        { id: '3', title: 'JS Basics' }
      ];
      
      const result = searchUtils.performTextSearch(collection, '');
      
      expect(result).toEqual(collection);
    });
    
    it('should return all items when search text is null or undefined', () => {
      const collection = [
        { id: '1', title: 'ML Basics' },
        { id: '2', title: 'Deep Learning' },
        { id: '3', title: 'JS Basics' }
      ];
      
      expect(searchUtils.performTextSearch(collection, null)).toEqual(collection);
      expect(searchUtils.performTextSearch(collection, undefined)).toEqual(collection);
    });
    
    it('should handle case-insensitive search', () => {
      const collection = [
        { id: '1', title: 'Machine Learning' },
        { id: '2', title: 'Deep Learning' }
      ];
      
      const result1 = searchUtils.performTextSearch(collection, 'machine');
      const result2 = searchUtils.performTextSearch(collection, 'MACHINE');
      
      expect(result1).toHaveLength(1);
      expect(result1[0].id).toBe('1');
      expect(result2).toHaveLength(1);
      expect(result2[0].id).toBe('1');
    });
    
    it('should handle empty collection', () => {
      expect(searchUtils.performTextSearch([], 'test')).toEqual([]);
    });
    
    it('should handle null or undefined collection', () => {
      // Should handle gracefully or at least not throw an error
      expect(() => searchUtils.performTextSearch(null, 'test')).not.toThrow();
      expect(() => searchUtils.performTextSearch(undefined, 'test')).not.toThrow();
    });
  });
});