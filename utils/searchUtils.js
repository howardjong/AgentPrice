/**
 * Search Utilities
 * 
 * Provides functions for searching and filtering results
 * from the search API.
 */

import axios from 'axios';

/**
 * Performs text search on a collection
 * 
 * @param {Array} collection - The collection to search
 * @param {string} searchText - The search text to match
 * @returns {Array} - Filtered collection containing only items matching the search text
 */
export function performTextSearch(collection, searchText) {
  // Handle invalid collection
  if (!collection || !Array.isArray(collection)) {
    return [];
  }
  
  // If no search text provided, return the original collection
  if (!searchText || typeof searchText !== 'string') {
    return collection;
  }
  
  const lowerSearchText = searchText.toLowerCase();
  return collection.filter(item => {
    const titleMatch = item.title && item.title.toLowerCase().includes(lowerSearchText);
    const contentMatch = item.content && item.content.toLowerCase().includes(lowerSearchText);
    const descriptionMatch = item.description && item.description.toLowerCase().includes(lowerSearchText);
    return titleMatch || contentMatch || descriptionMatch;
  });
}

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
  if (!results || !Array.isArray(results)) {
    return [];
  }
  
  return results.filter(result => 
    result && typeof result === 'object' && 
    typeof result.score === 'number' && 
    result.score >= threshold
  );
}

/**
 * Group results by category
 * 
 * @param {Array} results - The search results to group
 * @returns {Object} - Results grouped by category
 */
export function groupByCategory(results) {
  if (!results || !Array.isArray(results)) {
    return {};
  }
  
  return results.reduce((groups, result) => {
    if (!result || typeof result !== 'object') {
      return groups;
    }
    
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
  if (!results || !Array.isArray(results)) {
    return [];
  }
  
  try {
    return [...results].sort((a, b) => {
      const scoreA = a && typeof a === 'object' && typeof a.score === 'number' ? a.score : 0;
      const scoreB = b && typeof b === 'object' && typeof b.score === 'number' ? b.score : 0;
      return scoreB - scoreA;
    });
  } catch (error) {
    console.error('Error sorting results by score:', error);
    return [...results]; // Return a copy of the original array if sorting fails
  }
}

/**
 * Transform search results for display
 * 
 * @param {Array} results - The search results to transform
 * @returns {Array} - Transformed results
 */
export function transformForDisplay(results) {
  if (!results || !Array.isArray(results)) {
    return [];
  }
  
  try {
    return results.map(result => {
      if (!result || typeof result !== 'object') {
        return {
          displayTitle: 'Unnamed result',
          scorePercentage: '0%',
          date: 'Unknown date'
        };
      }
      
      const score = typeof result.score === 'number' ? result.score : 0;
      
      return {
        ...result,
        displayTitle: result.title || 'Unnamed result',
        scorePercentage: Math.round(score * 100) + '%',
        date: result.timestamp ? new Date(result.timestamp).toLocaleDateString() : 'Unknown date'
      };
    });
  } catch (error) {
    console.error('Error transforming results for display:', error);
    return [];
  }
}

/**
 * Extract keywords from a search query
 * 
 * @param {string} query - The search query
 * @returns {Array<string>} - Extracted keywords
 */
export function extractKeywords(query) {
  if (!query || typeof query !== 'string') {
    return [];
  }
  
  try {
    // Simple implementation - split by spaces and remove common words
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to'];
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 1 && !commonWords.includes(word));
  } catch (error) {
    console.error('Error extracting keywords:', error);
    return [];
  }
}

export default {
  search,
  performTextSearch,
  filterResults,
  groupByCategory,
  sortByScore,
  transformForDisplay,
  extractKeywords
};