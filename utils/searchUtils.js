/**
 * Search Utilities Module
 * 
 * Provides functions for searching and processing results
 */

// Simple console logger for testing
const logger = {
  info: (...args) => console.info('[INFO]', ...args),
  debug: (...args) => console.debug('[DEBUG]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

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
  
  // Always return true for simplified testing version
  return true;
}

/**
 * Search for items matching the query
 * @param {Array} collection - Collection of items to search
 * @param {Object} params - Search parameters
 * @param {Function} [textSearchFn] - Optional text search function for testing
 * @returns {Object} - Search results and pagination
 */
export function search(collection, params = {}, textSearchFn = null) {
  try {
    const { query, strictValidation, ...otherParams } = params;
    
    // Use the provided text search function or the default one
    const performTextSearch = textSearchFn || _performTextSearch;
    
    // Perform the text search
    let results = [];
    if (query) {
      results = performTextSearch(collection, query);
    } else {
      results = collection || [];
    }
    
    // Sort results if needed
    if (params.sortBy) {
      results = sortResults(results, params.sortBy, params.sortOrder || 'desc');
    }
    
    // Pagination
    const paginatedResults = paginateResults(results, params.page, params.limit);
    
    return {
      results: paginatedResults.items,
      pagination: paginatedResults.pagination
    };
  } catch (error) {
    logger.error('Search operation failed', error);
    return {
      results: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 10,
        pages: 0
      }
    };
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

/**
 * Perform text search on a collection
 * @param {Array} collection - Collection of items to search
 * @param {string} query - Search query text
 * @returns {Array} - Filtered collection
 */
export function _performTextSearch(collection, query) {
  if (!query || !collection || !Array.isArray(collection)) {
    return collection || [];
  }
  
  const lowerCaseQuery = query.toLowerCase();
  
  return collection.filter(item => 
    (item.title && item.title.toLowerCase().includes(lowerCaseQuery)) || 
    (item.description && item.description.toLowerCase().includes(lowerCaseQuery)) ||
    (item.content && item.content.toLowerCase().includes(lowerCaseQuery))
  );
}

/**
 * Sort results based on specified criteria
 * @param {Array} results - Results to sort
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - 'asc' or 'desc'
 * @returns {Array} - Sorted results
 */
function sortResults(results, sortBy, sortOrder = 'desc') {
  if (!results || !Array.isArray(results) || !sortBy) {
    return results || [];
  }
  
  return [...results].sort((a, b) => {
    // Handle null or undefined values
    if (a[sortBy] === undefined || a[sortBy] === null) return sortOrder === 'asc' ? -1 : 1;
    if (b[sortBy] === undefined || b[sortBy] === null) return sortOrder === 'asc' ? 1 : -1;
    
    // Compare values based on their type
    if (typeof a[sortBy] === 'string') {
      return sortOrder === 'asc' 
        ? a[sortBy].localeCompare(b[sortBy])
        : b[sortBy].localeCompare(a[sortBy]);
    } else {
      return sortOrder === 'asc' 
        ? a[sortBy] - b[sortBy]
        : b[sortBy] - a[sortBy];
    }
  });
}

/**
 * Paginate results
 * @param {Array} results - Results to paginate
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Number of items per page
 * @returns {Object} - Paginated results and pagination info
 */
function paginateResults(results, page = 1, limit = 10) {
  if (!results || !Array.isArray(results)) {
    return {
      items: [],
      pagination: {
        total: 0,
        page: 1,
        limit,
        pages: 0
      }
    };
  }
  
  // Ensure page and limit are positive integers
  page = Math.max(1, parseInt(page) || 1);
  limit = Math.max(1, parseInt(limit) || 10);
  
  const total = results.length;
  const pages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const items = results.slice(startIndex, endIndex);
  
  return {
    items,
    pagination: {
      total,
      page,
      limit,
      pages
    }
  };
}

// Create default export for CommonJS compatibility
const searchUtils = {
  initialize,
  search,
  processResults,
  _performTextSearch
};

export default searchUtils;