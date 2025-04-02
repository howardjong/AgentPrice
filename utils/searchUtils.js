/**
 * Search Utilities Module
 * 
 * Provides functions for searching and processing results
 */

import logger from './logger.js';
import redisClient from '../services/redisClient.js';
import { getData } from '../services/dataService.js';

// Configuration options
let config = {
  cacheEnabled: false,
  cacheTtl: 3600, // 1 hour
  maxResults: 10,
  minScore: 0.1
};

/**
 * Initialize the search module with configuration options
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Success status
 */
export async function initialize(options = {}) {
  config = { ...config, ...options };
  
  logger.info('Search module initialized with options:', config);
  
  if (config.cacheEnabled) {
    try {
      // Check Redis connection if caching is enabled
      await redisClient.ping();
      logger.info('Search cache connection verified');
      return true;
    } catch (error) {
      logger.error('Failed to initialize search cache', error);
      return false;
    }
  }
  
  return true;
}

/**
 * Search for items matching the query
 * @param {string} query - The search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Search results
 */
export async function search(query, options = {}) {
  const searchOptions = { ...config, ...options };
  
  logger.info(`Searching for: "${query}"`, searchOptions);
  
  if (searchOptions.cacheEnabled) {
    // Try to get from cache first
    const cacheKey = `search:${query}`;
    const cachedResults = await redisClient.get(cacheKey);
    
    if (cachedResults) {
      logger.debug('Cache hit for search query', query);
      return JSON.parse(cachedResults);
    }
  }
  
  // Perform the actual search
  try {
    const rawData = await getData();
    
    // Simple search implementation
    const results = rawData
      .filter(item => 
        item.title?.toLowerCase().includes(query.toLowerCase()) || 
        item.description?.toLowerCase().includes(query.toLowerCase())
      )
      .map(item => ({
        ...item,
        score: calculateRelevanceScore(item, query)
      }))
      .filter(item => item.score >= searchOptions.minScore)
      .slice(0, searchOptions.maxResults);
    
    // Process the results
    const processedResults = processResults(results);
    
    // Cache the results if enabled
    if (searchOptions.cacheEnabled) {
      const cacheKey = `search:${query}`;
      await redisClient.set(cacheKey, JSON.stringify(processedResults), 'EX', searchOptions.cacheTtl);
    }
    
    return processedResults;
  } catch (error) {
    logger.error('Search operation failed', error);
    return [];
  }
}

/**
 * Process and enhance search results
 * @param {Array} results - Raw search results
 * @returns {Array} - Processed results
 */
export function processResults(results) {
  if (!results || !Array.isArray(results)) {
    logger.warn('Invalid results provided to processResults');
    return [];
  }
  
  // Sort by score descending
  const sortedResults = [...results].sort((a, b) => b.score - a.score);
  
  // Process and enhance each result
  return sortedResults.map(item => ({
    ...item,
    highlighted: highlightMatchingText(item, item.query || ''),
    formattedDate: item.date ? formatDate(item.date) : null
  }));
}

/**
 * Calculate relevance score for an item against a query
 * @private
 */
function calculateRelevanceScore(item, query) {
  // Simple scoring algorithm
  let score = 0;
  
  const titleMatch = item.title?.toLowerCase().includes(query.toLowerCase());
  const descMatch = item.description?.toLowerCase().includes(query.toLowerCase());
  
  if (titleMatch) score += 0.6;
  if (descMatch) score += 0.4;
  
  // Exact matches get a boost
  if (item.title?.toLowerCase() === query.toLowerCase()) score += 0.3;
  
  return Math.min(1, score);
}

/**
 * Highlight matching text in the item
 * @private
 */
function highlightMatchingText(item, query) {
  // This is a simple implementation
  // In a real app, you would use a more sophisticated approach
  if (!query || !item.title) return item.title;
  
  const regex = new RegExp(`(${query})`, 'gi');
  return item.title.replace(regex, '<strong>$1</strong>');
}

/**
 * Format a date for display
 * @private
 */
function formatDate(date) {
  try {
    return new Date(date).toLocaleDateString();
  } catch (e) {
    return '';
  }
}