/**
 * Search Utilities
 * 
 * Provides functions for searching and filtering results
 * from the search API.
 */

import axios from 'axios';

/**
 * Search the API for results
 * 
 * @param {string} query - The search query
 * @param {Object} options - Additional search options
 * @returns {Promise<Array>} - Promise resolving to array of search results
 */
export async function search(query, options = {}) {
  try {
    const response = await axios.get('/api/search', {
      params: {
        q: query,
        limit: options.limit || 10,
        page: options.page || 1,
        ...options
      }
    });
    
    return response.data.results;
  } catch (error) {
    console.error('Search API error:', error);
    return [];
  }
}

/**
 * Filter search results by confidence score
 * 
 * @param {Array} results - The search results to filter
 * @param {number} threshold - Minimum score to include (0-1)
 * @returns {Array} - Filtered results
 */
export function filterResults(results, threshold = 0.5) {
  return results.filter(result => result.score >= threshold);
}

/**
 * Group results by category
 * 
 * @param {Array} results - The search results to group
 * @returns {Object} - Results grouped by category
 */
export function groupByCategory(results) {
  return results.reduce((groups, result) => {
    const category = result.category || 'uncategorized';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(result);
    return groups;
  }, {});
}

/**
 * Sort results by score (descending)
 * 
 * @param {Array} results - The search results to sort
 * @returns {Array} - Sorted results
 */
export function sortByScore(results) {
  return [...results].sort((a, b) => b.score - a.score);
}

/**
 * Transform search results for display
 * 
 * @param {Array} results - The search results to transform
 * @returns {Array} - Transformed results
 */
export function transformForDisplay(results) {
  return results.map(result => ({
    ...result,
    displayTitle: result.title || 'Unnamed result',
    scorePercentage: Math.round(result.score * 100) + '%',
    date: result.timestamp ? new Date(result.timestamp).toLocaleDateString() : 'Unknown date'
  }));
}

/**
 * Extract keywords from a search query
 * 
 * @param {string} query - The search query
 * @returns {Array<string>} - Extracted keywords
 */
export function extractKeywords(query) {
  // Simple implementation - split by spaces and remove common words
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at'];
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 1 && !commonWords.includes(word));
}

export default {
  search,
  filterResults,
  groupByCategory,
  sortByScore,
  transformForDisplay,
  extractKeywords
};