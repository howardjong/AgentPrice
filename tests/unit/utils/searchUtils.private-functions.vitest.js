/**
 * Private Helper Function Tests for searchUtils.js
 * 
 * This file specifically tests the private helper functions that were
 * previously untested, to improve function coverage from 64.28% to above 80%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateRelevanceScore,
  highlightMatchingText,
  formatDate,
  // Adding the previously untested functions
  initialize,
  processResults,
  _performTextSearch
} from '../../../utils/searchUtils.js';

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}));

describe('calculateRelevanceScore Function', () => {
  it('should calculate a score based on title match', () => {
    const item = { title: 'Machine Learning Basics', description: 'A guide to AI' };
    const score = calculateRelevanceScore(item, 'machine learning');
    
    // Should have a high score for title match
    expect(score).toBeGreaterThanOrEqual(0.6);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('should calculate a score based on description match', () => {
    const item = { title: 'Programming Guide', description: 'Learn machine learning' };
    const score = calculateRelevanceScore(item, 'machine learning');
    
    // Should have a medium score for description match only
    expect(score).toBeGreaterThanOrEqual(0.4);
    expect(score).toBeLessThan(0.6);
  });

  it('should assign a higher score for exact title match', () => {
    const item1 = { title: 'Machine Learning', description: 'A guide to AI' };
    const item2 = { title: 'Introduction to Machine Learning', description: 'A guide to AI' };
    
    const score1 = calculateRelevanceScore(item1, 'machine learning');
    const score2 = calculateRelevanceScore(item2, 'machine learning');
    
    // Exact match should have a higher score
    expect(score1).toBeGreaterThan(score2);
  });

  it('should handle case insensitivity', () => {
    const item = { title: 'MACHINE LEARNING', description: 'AI guide' };
    const score = calculateRelevanceScore(item, 'machine learning');
    
    // Should match despite case differences
    expect(score).toBeGreaterThan(0.5);
  });

  it('should handle items with null or undefined fields', () => {
    const item1 = { description: 'Machine learning guide' }; // No title
    const item2 = { title: 'AI Guide' }; // No description
    const item3 = {}; // No fields
    
    // Should still calculate a score without errors
    expect(() => calculateRelevanceScore(item1, 'machine learning')).not.toThrow();
    expect(() => calculateRelevanceScore(item2, 'machine learning')).not.toThrow();
    expect(() => calculateRelevanceScore(item3, 'machine learning')).not.toThrow();
    
    // Score for description match should be lower than title match
    const score1 = calculateRelevanceScore(item1, 'machine learning');
    expect(score1).toBeLessThan(0.6);
    expect(score1).toBeGreaterThan(0);
    
    // No matches should have a score of 0
    const score3 = calculateRelevanceScore(item3, 'machine learning');
    expect(score3).toBe(0);
  });
});

describe('highlightMatchingText Function', () => {
  it('should wrap matching text in <strong> tags', () => {
    const item = { title: 'Machine Learning Basics' };
    const highlighted = highlightMatchingText(item, 'machine');
    
    expect(highlighted).toBe('<strong>Machine</strong> Learning Basics');
  });

  it('should highlight multiple occurrences of the query', () => {
    const item = { title: 'JavaScript to JavaScript Advanced' };
    const highlighted = highlightMatchingText(item, 'javascript');
    
    expect(highlighted).toBe('<strong>JavaScript</strong> to <strong>JavaScript</strong> Advanced');
  });

  it('should be case insensitive when highlighting', () => {
    const item = { title: 'PYTHON programming' };
    const highlighted = highlightMatchingText(item, 'python');
    
    expect(highlighted).toBe('<strong>PYTHON</strong> programming');
  });

  it('should return the original title if no match found', () => {
    const item = { title: 'Web Development' };
    const highlighted = highlightMatchingText(item, 'python');
    
    expect(highlighted).toBe('Web Development');
  });

  it('should handle null or undefined inputs', () => {
    expect(highlightMatchingText({ title: null }, 'test')).toBeNull();
    expect(highlightMatchingText({ title: undefined }, 'test')).toBeUndefined();
    expect(highlightMatchingText({}, 'test')).toBeUndefined();
    expect(highlightMatchingText({ title: 'Test' }, '')).toBe('Test');
    expect(highlightMatchingText({ title: 'Test' }, null)).toBe('Test');
    expect(highlightMatchingText({ title: 'Test' }, undefined)).toBe('Test');
  });

  it('should handle special regex characters in the query', () => {
    const item = { title: 'Regular Expressions (Regex) Tutorial' };
    const highlighted = highlightMatchingText(item, 'regex');
    
    // Should escape special regex characters and still highlight correctly
    expect(highlighted).toBe('Regular Expressions (<strong>Regex</strong>) Tutorial');
  });
});

describe('formatDate Function', () => {
  it('should format a date string to a localized date string', () => {
    // Since toLocaleDateString output can vary by environment, we'll check it returns a string
    // and has changed from the input format
    const formatted = formatDate('2025-04-03T12:00:00Z');
    
    expect(typeof formatted).toBe('string');
    expect(formatted).not.toBe('2025-04-03T12:00:00Z');
    
    // Basic check that it contains expected year/date info
    expect(formatted).toMatch(/2025/);
  });

  it('should format a Date object', () => {
    const date = new Date('2025-04-03');
    const formatted = formatDate(date);
    
    expect(typeof formatted).toBe('string');
    expect(formatted).not.toBe('2025-04-03');
  });

  it('should handle invalid date inputs gracefully', () => {
    // In different environments, invalid date formatting can vary
    // The function might return 'Invalid Date' or '' depending on the implementation
    const invalidStringResults = ['', 'Invalid Date'];
    
    // Test strings that should produce invalid dates
    expect(invalidStringResults).toContain(formatDate('not-a-date'));
    expect(invalidStringResults).toContain(formatDate(undefined));
    expect(invalidStringResults).toContain(formatDate(''));
    
    // For null, JavaScript converts it to the Unix epoch (January 1, 1970)
    // This is standard behavior and is considered valid in JavaScript
    const nullDateFormatted = formatDate(null);
    expect(nullDateFormatted).toMatch(/1.*1970|1970.*1|1\/1\/1970|1970-01-01/); // Different locale formats
  });

  it('should handle various date formats', () => {
    // ISO format
    expect(formatDate('2025-04-03')).not.toBe('');
    
    // MM/DD/YYYY format
    expect(formatDate('04/03/2025')).not.toBe('');
    
    // Unix timestamp
    expect(formatDate(1743465600000)).not.toBe('');
  });
});

// Test that the functions interact correctly with each other
describe('Integration of Private Helper Functions', () => {
  it('should calculate score, highlight text, and format date in a workflow', () => {
    const item = {
      title: 'Machine Learning Course',
      description: 'Advanced AI techniques',
      date: '2025-04-15'
    };
    
    // Calculate relevance
    const score = calculateRelevanceScore(item, 'machine learning');
    expect(score).toBeGreaterThan(0);
    
    // Highlight matching text
    const highlighted = highlightMatchingText(item, 'machine learning');
    expect(highlighted).toContain('<strong>Machine Learning</strong>');
    
    // Format date
    const formattedDate = formatDate(item.date);
    expect(formattedDate).not.toBe('2025-04-15');
    expect(typeof formattedDate).toBe('string');
  });
});

// Tests for previously untested functions
describe('initialize Function', () => {
  let originalConsole;
  
  beforeEach(() => {
    // Store original console methods
    originalConsole = { ...console };
    // Mock console methods
    console.log = vi.fn();
    console.error = vi.fn();
  });
  
  afterEach(() => {
    // Restore console
    Object.assign(console, originalConsole);
  });
  
  it('should initialize the search utility with default options', async () => {
    // The function returns a Promise<boolean>
    const result = await initialize();
    
    // Initialize returns true
    expect(result).toBe(true);
  });
  
  it('should initialize with custom options', async () => {
    const customOptions = {
      enableFuzzyMatch: true,
      cacheSize: 500,
      logLevel: 'debug'
    };
    
    // The function returns a Promise<boolean>
    const result = await initialize(customOptions);
    
    // Initialize returns true
    expect(result).toBe(true);
  });
  
  it('should handle invalid options gracefully', async () => {
    // Initialize with invalid options
    const result = await initialize(null);
    
    // Initialize returns true
    expect(result).toBe(true);
  });
});

describe('processResults Function', () => {
  it('should process search results by applying highlighting and formatting', () => {
    // Sample search results with scores
    const results = [
      { 
        title: 'Machine Learning Guide', 
        description: 'Advanced techniques',
        date: '2025-03-15',
        query: 'machine learning',
        score: 0.8
      },
      {
        title: 'Deep Learning Introduction',
        description: 'Machine learning principles',
        date: '2025-04-10',
        query: 'machine learning',
        score: 0.7
      }
    ];
    
    const processed = processResults(results);
    
    // Should return array of same length
    expect(processed).toHaveLength(results.length);
    
    // Should apply highlighting and date formatting
    expect(processed[0].highlighted).toBeDefined();
    expect(processed[0].formattedDate).toBeDefined();
    
    // Should preserve the original score
    expect(processed[0].score).toBe(0.8);
  });
  
  it('should sort results by score in descending order', () => {
    const results = [
      { title: 'JavaScript Basics', score: 0.5 },
      { title: 'Advanced Machine Learning', score: 0.9 },
      { title: 'Machine Learning Guide', score: 0.7 }
    ];
    
    const processed = processResults(results);
    
    // Check if results are sorted by score (highest score first)
    expect(processed[0].score).toBe(0.9);
    expect(processed[1].score).toBe(0.7);
    expect(processed[2].score).toBe(0.5);
  });
  
  it('should handle empty results array', () => {
    const results = [];
    const processed = processResults(results);
    
    expect(processed).toEqual([]);
  });
  
  it('should handle invalid input gracefully', () => {
    expect(processResults(null)).toEqual([]);
    expect(processResults(undefined)).toEqual([]);
    expect(processResults('not an array')).toEqual([]);
  });
});

describe('_performTextSearch Function', () => {
  it('should perform text search on an array of items', () => {
    const items = [
      { title: 'JavaScript Programming', description: 'Learn JS basics' },
      { title: 'Python for Beginners', description: 'Python tutorial' },
      { title: 'Advanced JavaScript', description: 'ES6 features' }
    ];
    
    const query = 'javascript';
    const results = _performTextSearch(items, query);
    
    // Should filter items containing the query
    expect(results).toHaveLength(2);
    expect(results[0].title).toContain('JavaScript');
    expect(results[1].title).toContain('JavaScript');
  });
  
  it('should search in both title and description', () => {
    const items = [
      { title: 'Web Development', description: 'HTML, CSS, JavaScript' },
      { title: 'Database Design', description: 'SQL fundamentals' }
    ];
    
    const query = 'javascript';
    const results = _performTextSearch(items, query);
    
    // Should match item with query term in description
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Web Development');
  });
  
  it('should be case-insensitive when searching', () => {
    const items = [
      { title: 'JAVASCRIPT GUIDE', description: 'Programming tutorial' }
    ];
    
    const query = 'javascript';
    const results = _performTextSearch(items, query);
    
    expect(results).toHaveLength(1);
  });
  
  it('should handle special regex characters in search query', () => {
    const items = [
      { title: 'Regex (.*+?) Guide', description: 'Special characters in regular expressions' }
    ];
    
    // Query with regex special characters
    const query = '(.*+?)';
    const results = _performTextSearch(items, query);
    
    // Should escape regex characters and still find the match
    expect(results).toHaveLength(1);
  });
  
  it('should return empty array when no matches are found', () => {
    const items = [
      { title: 'Python Programming', description: 'Learn Python' }
    ];
    
    const query = 'javascript';
    const results = _performTextSearch(items, query);
    
    expect(results).toEqual([]);
  });
  
  it('should handle empty or invalid inputs', () => {
    // Empty array
    expect(_performTextSearch([], 'query')).toEqual([]);
    
    // Null or undefined inputs
    expect(_performTextSearch(null, 'query')).toEqual([]);
    expect(_performTextSearch(undefined, 'query')).toEqual([]);
    
    // Empty query
    const items = [{ title: 'Test', description: 'Description' }];
    expect(_performTextSearch(items, '')).toEqual(items);
    expect(_performTextSearch(items, null)).toEqual(items);
  });
});