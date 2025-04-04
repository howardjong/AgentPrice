/**
 * Search Utils Module
 * 
 * This module provides utilities for advanced search capabilities
 * including fuzzy matching, filtering, scoring, and sorting.
 */

/**
 * Perform fuzzy matching on a term against a string
 * 
 * @param {string} text - The text to search within
 * @param {string} term - The search term to match
 * @param {Object} options - Options for fuzzy matching
 * @param {boolean} [options.caseSensitive=false] - Whether to perform case-sensitive matching
 * @param {number} [options.fuzzyThreshold=0.7] - Threshold for fuzzy matching (0-1)
 * @returns {boolean} - Whether the term matches the text
 */
export function fuzzyMatch(text, term, options = {}) {
  if (!text || !term) return false;
  
  const { 
    caseSensitive = false,
    fuzzyThreshold = 0.7
  } = options;
  
  // Handle case sensitivity
  const normalizedText = caseSensitive ? text : text.toLowerCase();
  const normalizedTerm = caseSensitive ? term : term.toLowerCase();
  
  // Exact match check (including as substring)
  if (normalizedText.includes(normalizedTerm)) {
    return true;
  }
  
  // Don't do fuzzy matching for very short terms
  if (normalizedTerm.length < 3) {
    return false;
  }
  
  // Calculate fuzzy score
  const score = calculateFuzzyScore(normalizedText, normalizedTerm);
  
  return score >= fuzzyThreshold;
}

/**
 * Calculate a fuzzy matching score between text and term
 * 
 * @param {string} text - The text to search within
 * @param {string} term - The search term to match
 * @returns {number} - A score between 0 and 1, where 1 is a perfect match
 */
function calculateFuzzyScore(text, term) {
  // Escape special regex characters in the term
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Create a pattern with wildcards between characters
  const pattern = escapedTerm.split('').join('.*?');
  const regex = new RegExp(pattern);
  
  // Check if the pattern matches anywhere
  if (!regex.test(text)) {
    return 0;
  }
  
  // Calculate character matches
  let matches = 0;
  let lastMatchIdx = -1;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;
  
  for (let i = 0; i < term.length; i++) {
    const char = term[i];
    const idx = text.indexOf(char, lastMatchIdx + 1);
    
    if (idx > -1) {
      matches++;
      
      // Check for consecutive matches
      if (idx === lastMatchIdx + 1) {
        consecutiveMatches++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
      } else {
        consecutiveMatches = 1;
      }
      
      lastMatchIdx = idx;
    }
  }
  
  // Calculate base score based on matched characters
  const baseScore = matches / term.length;
  
  // Apply consecutive character bonus
  const consecutiveBonus = maxConsecutive > 1 ? (maxConsecutive / term.length) * 0.3 : 0;
  
  // Apply position penalty (matches at the beginning are better)
  const firstMatchPosition = text.indexOf(term[0]) / text.length;
  const positionPenalty = firstMatchPosition * 0.2;
  
  // Higher penalty for matching "hlo" with "hello world" when term is short and text is long
  const lengthDifferencePenalty = term.length < 4 ? (text.length / 50) * 0.2 : 0;
  
  return Math.min(1, Math.max(0, baseScore + consecutiveBonus - positionPenalty - lengthDifferencePenalty));
}

/**
 * Filter an array of items based on search terms
 * 
 * @param {Array<Object>} items - The items to filter
 * @param {string|Array<string>} searchTerms - Term(s) to search for
 * @param {Object} options - Search options
 * @param {Array<string>} [options.fields] - Fields to search within (if items are objects)
 * @param {boolean} [options.caseSensitive=false] - Whether to perform case-sensitive search
 * @param {boolean} [options.fuzzySearch=true] - Whether to perform fuzzy matching
 * @param {number} [options.fuzzyThreshold=0.7] - Threshold for fuzzy matching (0-1)
 * @param {boolean} [options.matchAll=false] - Whether items must match all terms (AND) or any term (OR)
 * @returns {Array<Object>} - Filtered items
 */
export function filterByTerms(items, searchTerms, options = {}) {
  if (!items) return [];
  if (!items.length) return [];
  if (searchTerms === null) return [];
  if (searchTerms === '') return items;
  if (Array.isArray(searchTerms) && searchTerms.length === 0) return items;
  
  const { 
    fields = null,
    caseSensitive = false, 
    fuzzySearch = true,
    fuzzyThreshold = 0.7,
    matchAll = false
  } = options;
  
  // Normalize search terms to array
  const terms = Array.isArray(searchTerms) 
    ? searchTerms 
    : searchTerms.split(/\s+/).filter(Boolean);
  
  if (!terms.length) return items;
  
  return items.filter(item => {
    const matchResults = terms.map(term => {
      // For string items, directly match against the item
      if (typeof item === 'string') {
        return fuzzySearch 
          ? fuzzyMatch(item, term, { caseSensitive, fuzzyThreshold }) 
          : (caseSensitive ? item : item.toLowerCase()).includes(
              caseSensitive ? term : term.toLowerCase()
            );
      }
      
      // For object items, match against specified fields
      if (typeof item === 'object' && item !== null) {
        const fieldsToSearch = fields || Object.keys(item);
        
        return fieldsToSearch.some(field => {
          const value = item[field];
          if (value == null) return false;
          
          const stringValue = String(value);
          return fuzzySearch
            ? fuzzyMatch(stringValue, term, { caseSensitive, fuzzyThreshold })
            : (caseSensitive ? stringValue : stringValue.toLowerCase()).includes(
                caseSensitive ? term : term.toLowerCase()
              );
        });
      }
      
      return false;
    });
    
    // Apply AND/OR logic to match results
    return matchAll
      ? matchResults.every(Boolean)
      : matchResults.some(Boolean);
  });
}

/**
 * Calculate a search relevance score for an item against search terms
 * 
 * @param {Object|string} item - The item to score
 * @param {string|Array<string>} searchTerms - Term(s) to search for
 * @param {Object} options - Scoring options
 * @param {Array<string>} [options.fields] - Fields to search within (if item is object)
 * @param {Object<string, number>} [options.fieldWeights] - Weight multipliers for fields
 * @param {boolean} [options.caseSensitive=false] - Whether to perform case-sensitive scoring
 * @returns {number} - A relevance score (higher is more relevant)
 */
export function calculateRelevanceScore(item, searchTerms, options = {}) {
  if (!item || !searchTerms) return 0;
  
  const { 
    fields = null,
    fieldWeights = {},
    caseSensitive = false
  } = options;
  
  // Normalize search terms to array
  const terms = Array.isArray(searchTerms) 
    ? searchTerms 
    : searchTerms.split(/\s+/).filter(Boolean);
  
  if (!terms.length) return 0;
  
  // For string items, directly score against the item
  if (typeof item === 'string') {
    return terms.reduce((score, term) => {
      const normalizedItem = caseSensitive ? item : item.toLowerCase();
      const normalizedTerm = caseSensitive ? term : term.toLowerCase();
      
      // Exact match bonus
      if (normalizedItem === normalizedTerm) {
        return score + 2.0;
      }
      
      // Contains match bonus
      if (normalizedItem.includes(normalizedTerm)) {
        // Bonus for match at start of string
        if (normalizedItem.startsWith(normalizedTerm)) {
          return score + 1.5;
        }
        
        // Bonus for match at word boundary
        if (normalizedItem.match(new RegExp(`\\b${escapeRegExp(normalizedTerm)}`, 'i'))) {
          return score + 1.2;
        }
        
        return score + 1.0;
      }
      
      // Fuzzy match bonus
      const fuzzyScore = calculateFuzzyScore(normalizedItem, normalizedTerm);
      return score + fuzzyScore * 0.5;
    }, 0) / terms.length;
  }
  
  // For object items, score against specified fields
  if (typeof item === 'object' && item !== null) {
    const fieldsToScore = fields || Object.keys(item);
    
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const field of fieldsToScore) {
      const value = item[field];
      if (value == null) continue;
      
      const stringValue = String(value);
      const fieldWeight = fieldWeights[field] || 1.0;
      totalWeight += fieldWeight;
      
      const fieldScore = terms.reduce((score, term) => {
        const normalizedValue = caseSensitive ? stringValue : stringValue.toLowerCase();
        const normalizedTerm = caseSensitive ? term : term.toLowerCase();
        
        // Exact match bonus
        if (normalizedValue === normalizedTerm) {
          return score + 2.0;
        }
        
        // Contains match bonus
        if (normalizedValue.includes(normalizedTerm)) {
          // Bonus for match at start of string
          if (normalizedValue.startsWith(normalizedTerm)) {
            return score + 1.5;
          }
          
          // Bonus for match at word boundary
          if (normalizedValue.match(new RegExp(`\\b${escapeRegExp(normalizedTerm)}`, 'i'))) {
            return score + 1.2;
          }
          
          return score + 1.0;
        }
        
        // Fuzzy match bonus
        const fuzzyScore = calculateFuzzyScore(normalizedValue, normalizedTerm);
        return score + fuzzyScore * 0.5;
      }, 0) / terms.length;
      
      totalScore += fieldScore * fieldWeight;
    }
    
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }
  
  return 0;
}

/**
 * Escape special characters in a string for use in a regular expression
 * 
 * @param {string} string - The string to escape
 * @returns {string} - The escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Search and sort items by relevance
 * 
 * @param {Array<Object>} items - The items to search and sort
 * @param {string|Array<string>} searchTerms - Term(s) to search for
 * @param {Object} options - Search and scoring options
 * @param {Array<string>} [options.fields] - Fields to search within (if items are objects)
 * @param {Object<string, number>} [options.fieldWeights] - Weight multipliers for fields
 * @param {boolean} [options.caseSensitive=false] - Whether to perform case-sensitive search
 * @param {boolean} [options.fuzzySearch=true] - Whether to perform fuzzy matching
 * @param {number} [options.fuzzyThreshold=0.7] - Threshold for fuzzy matching (0-1)
 * @param {boolean} [options.matchAll=false] - Whether items must match all terms (AND) or any term (OR)
 * @param {number} [options.limit] - Maximum number of results to return
 * @returns {Array<Object>} - Filtered and sorted items by relevance
 */
export function searchAndSort(items, searchTerms, options = {}) {
  if (!items) return [];
  if (!items.length) return [];
  if (searchTerms === null) return [];
  if (searchTerms === '') return [];
  
  const { 
    limit,
    ...filterOptions 
  } = options;
  
  // First, filter the items
  const filteredItems = filterByTerms(items, searchTerms, filterOptions);
  
  // Then, score and sort by relevance
  const scoredItems = filteredItems.map(item => ({
    item,
    score: calculateRelevanceScore(item, searchTerms, options)
  }));
  
  // Sort by score (descending)
  scoredItems.sort((a, b) => b.score - a.score);
  
  // Apply limit if specified
  const limitedItems = limit && limit > 0
    ? scoredItems.slice(0, limit)
    : scoredItems;
  
  // Return just the items, not the scores
  return limitedItems.map(({ item }) => item);
}

/**
 * Highlight matched terms in a text string
 * 
 * @param {string} text - The text to highlight within
 * @param {string|Array<string>} searchTerms - Term(s) to highlight
 * @param {Object} options - Highlighting options
 * @param {boolean} [options.caseSensitive=false] - Whether to perform case-sensitive matching
 * @param {boolean} [options.fuzzySearch=false] - Whether to highlight fuzzy matches
 * @param {string} [options.highlightStart='<mark>'] - String to insert before highlights
 * @param {string} [options.highlightEnd='</mark>'] - String to insert after highlights
 * @returns {string} - Text with highlights applied
 */
export function highlightMatches(text, searchTerms, options = {}) {
  if (!text || !searchTerms) return text;
  
  const { 
    caseSensitive = false,
    fuzzySearch = false,
    highlightStart = '<mark>',
    highlightEnd = '</mark>'
  } = options;
  
  // Normalize search terms to array
  const terms = Array.isArray(searchTerms) 
    ? searchTerms 
    : searchTerms.split(/\s+/).filter(Boolean);
  
  if (!terms.length) return text;
  
  // Only handle exact matches for simplicity (fuzzy highlighting is more complex)
  if (!fuzzySearch) {
    let highlighted = text;
    const normalizedText = caseSensitive ? text : text.toLowerCase();
    
    // Sort terms by length (descending) to handle overlapping matches properly
    const sortedTerms = [...terms].sort((a, b) => b.length - a.length);
    
    // Create a map to track which parts of the string are already highlighted
    const highlightMap = new Array(text.length).fill(false);
    
    for (const term of sortedTerms) {
      const normalizedTerm = caseSensitive ? term : term.toLowerCase();
      
      let startPos = 0;
      while (startPos < normalizedText.length) {
        const matchPos = normalizedText.indexOf(normalizedTerm, startPos);
        if (matchPos === -1) break;
        
        const endPos = matchPos + normalizedTerm.length;
        
        // Check if this section is already highlighted
        const alreadyHighlighted = highlightMap.slice(matchPos, endPos).some(Boolean);
        
        if (!alreadyHighlighted) {
          // Mark this section as highlighted
          for (let i = matchPos; i < endPos; i++) {
            highlightMap[i] = true;
          }
          
          // Apply highlighting
          const before = highlighted.substring(0, matchPos);
          const match = highlighted.substring(matchPos, endPos);
          const after = highlighted.substring(endPos);
          
          highlighted = before + highlightStart + match + highlightEnd + after;
          
          // Adjust indices to account for the inserted highlighting markers
          const insertedLength = highlightStart.length + highlightEnd.length;
          highlightMap = [
            ...highlightMap.slice(0, endPos),
            ...new Array(insertedLength).fill(true),
            ...highlightMap.slice(endPos)
          ];
        }
        
        startPos = matchPos + 1;
      }
    }
    
    return highlighted;
  }
  
  // For fuzzy highlighting, we would need a more sophisticated approach
  // This is a simplified placeholder that doesn't do actual fuzzy highlighting
  return text;
}

/**
 * Group search results by a field or category
 * 
 * @param {Array<Object>} items - The items to group
 * @param {string|Function} groupBy - Field name or function to determine group
 * @param {Object} options - Grouping options
 * @param {boolean} [options.maintainOrder=true] - Whether to maintain original order within groups
 * @param {boolean} [options.includeEmpty=false] - Whether to include empty groups
 * @returns {Object<string, Array<Object>>} - Items grouped by category
 */
export function groupSearchResults(items, groupBy, options = {}) {
  if (!items || !items.length || !groupBy) return {};
  
  const { 
    maintainOrder = true,
    includeEmpty = false
  } = options;
  
  const groups = {};
  
  // If groupBy is a function, use it directly
  const getGroup = typeof groupBy === 'function'
    ? groupBy
    : item => {
        if (typeof item !== 'object' || item === null) {
          return 'ungrouped';
        }
        return item[groupBy] != null ? String(item[groupBy]) : 'ungrouped';
      };
  
  // Group items
  items.forEach((item, index) => {
    const groupKey = getGroup(item, index);
    
    if (!groups[groupKey]) {
      groups[groupKey] = maintainOrder ? [] : new Set();
    }
    
    if (maintainOrder) {
      groups[groupKey].push(item);
    } else {
      groups[groupKey].add(item);
    }
  });
  
  // Convert Set to Array for non-order-maintaining groups
  if (!maintainOrder) {
    Object.keys(groups).forEach(key => {
      groups[key] = Array.from(groups[key]);
    });
  }
  
  // Remove empty groups if not including them
  if (!includeEmpty) {
    Object.keys(groups).forEach(key => {
      if (!groups[key].length) {
        delete groups[key];
      }
    });
  }
  
  return groups;
}

/**
 * Create an optimized fuzzy search index for faster searching
 * 
 * @param {Array<Object>} items - Items to index
 * @param {Object} options - Indexing options
 * @param {Array<string>} [options.fields] - Fields to index (if items are objects)
 * @param {boolean} [options.caseSensitive=false] - Whether to create a case-sensitive index
 * @returns {Object} - Search index
 */
export function createSearchIndex(items, options = {}) {
  if (!items || !items.length) return { items: [], index: {}, options };
  
  const { 
    fields = null,
    caseSensitive = false
  } = options;
  
  // Create a term-to-items inverted index
  const invertedIndex = {};
  
  items.forEach((item, itemIndex) => {
    const processValue = (value) => {
      if (value == null) return;
      
      const stringValue = String(value);
      const normalizedValue = caseSensitive ? stringValue : stringValue.toLowerCase();
      
      // Index whole words
      const words = normalizedValue.split(/\W+/).filter(Boolean);
      words.forEach(word => {
        if (!invertedIndex[word]) {
          invertedIndex[word] = new Set();
        }
        invertedIndex[word].add(itemIndex);
        
        // For longer words, also index partial prefixes (for autocomplete)
        if (word.length > 3) {
          for (let i = 3; i < word.length; i++) {
            const prefix = word.substring(0, i);
            if (!invertedIndex[prefix]) {
              invertedIndex[prefix] = new Set();
            }
            invertedIndex[prefix].add(itemIndex);
          }
        }
      });
      
      // Also index the first characters (ngrams) for very fuzzy matching
      if (normalizedValue.length > 2) {
        for (let i = 0; i < normalizedValue.length - 2; i++) {
          const trigram = normalizedValue.substring(i, i + 3);
          const key = `__tri__${trigram}`;
          if (!invertedIndex[key]) {
            invertedIndex[key] = new Set();
          }
          invertedIndex[key].add(itemIndex);
        }
      }
    };
    
    if (typeof item === 'string') {
      processValue(item);
    } else if (typeof item === 'object' && item !== null) {
      const fieldsToIndex = fields || Object.keys(item);
      fieldsToIndex.forEach(field => {
        processValue(item[field]);
      });
    }
  });
  
  // Convert Sets to Arrays
  Object.keys(invertedIndex).forEach(key => {
    invertedIndex[key] = Array.from(invertedIndex[key]);
  });
  
  return {
    items: [...items],
    index: invertedIndex,
    options
  };
}

/**
 * Search an optimized index
 * 
 * @param {Object} searchIndex - The search index created with createSearchIndex
 * @param {string|Array<string>} searchTerms - Term(s) to search for
 * @param {Object} options - Search options
 * @param {boolean} [options.fuzzySearch=true] - Whether to perform fuzzy matching
 * @param {boolean} [options.matchAll=false] - Whether items must match all terms (AND) or any term (OR)
 * @param {number} [options.limit] - Maximum number of results to return
 * @returns {Array<Object>} - Matched items
 */
export function searchIndex(searchIndex, searchTerms, options = {}) {
  if (!searchIndex || !searchIndex.items || !searchIndex.index || !searchTerms) {
    return [];
  }
  
  const { 
    fuzzySearch = true,
    matchAll = false,
    limit
  } = options;
  
  const { items, index, options: indexOptions } = searchIndex;
  const caseSensitive = indexOptions.caseSensitive || false;
  
  // Normalize search terms to array
  const terms = Array.isArray(searchTerms) 
    ? searchTerms 
    : searchTerms.split(/\s+/).filter(Boolean);
  
  if (!terms.length) return [];
  
  // Find matching item indices for each term
  const matchingSets = terms.map(term => {
    const normalizedTerm = caseSensitive ? term : term.toLowerCase();
    
    // Exact term matches
    if (index[normalizedTerm]) {
      return new Set(index[normalizedTerm]);
    }
    
    // Collect possible matches from index
    const matches = new Set();
    
    // Try prefix matches
    if (normalizedTerm.length >= 3) {
      Object.keys(index).forEach(key => {
        if (!key.startsWith('__tri__') && key.startsWith(normalizedTerm)) {
          index[key].forEach(idx => matches.add(idx));
        }
      });
    }
    
    // For fuzzy search, use trigrams
    if (fuzzySearch && normalizedTerm.length >= 3) {
      const termTrigrams = new Set();
      for (let i = 0; i < normalizedTerm.length - 2; i++) {
        termTrigrams.add(normalizedTerm.substring(i, i + 3));
      }
      
      // Find items with matching trigrams
      termTrigrams.forEach(trigram => {
        const key = `__tri__${trigram}`;
        if (index[key]) {
          index[key].forEach(idx => matches.add(idx));
        }
      });
    }
    
    return matches;
  });
  
  // Combine match sets according to AND/OR logic
  let resultIndices;
  
  if (matchAll) {
    // AND logic - intersection of all sets
    if (matchingSets.length === 0) {
      resultIndices = [];
    } else {
      resultIndices = Array.from(matchingSets[0]);
      for (let i = 1; i < matchingSets.length; i++) {
        resultIndices = resultIndices.filter(idx => matchingSets[i].has(idx));
      }
    }
  } else {
    // OR logic - union of all sets
    resultIndices = [];
    matchingSets.forEach(set => {
      set.forEach(idx => resultIndices.push(idx));
    });
    // Remove duplicates
    resultIndices = Array.from(new Set(resultIndices));
  }
  
  // Get the actual items
  let results = resultIndices.map(idx => items[idx]);
  
  // Filter against the full search conditions to ensure accuracy
  results = filterByTerms(results, searchTerms, {
    ...options,
    ...indexOptions
  });
  
  // Sort by relevance
  results = results.map(item => ({
    item,
    score: calculateRelevanceScore(item, searchTerms, indexOptions)
  }));
  
  results.sort((a, b) => b.score - a.score);
  
  // Apply limit if specified
  if (limit && limit > 0) {
    results = results.slice(0, limit);
  }
  
  // Return just the items, not the scores
  return results.map(({ item }) => item);
}

/**
 * Convert date strings to standardized format for searching
 * 
 * @param {string|Date} dateInput - Date string or Date object
 * @param {Object} options - Options for date formatting
 * @param {string} [options.format='YYYY-MM-DD'] - Output format
 * @returns {string|null} - Formatted date string or null if invalid
 */
export function normalizeDate(dateInput, options = {}) {
  if (!dateInput) return null;
  
  const { format = 'YYYY-MM-DD' } = options;
  
  let date;
  
  // Convert string to Date object
  if (typeof dateInput === 'string') {
    // Handle various date formats
    if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // ISO format: YYYY-MM-DD
      date = new Date(dateInput);
    } else if (dateInput.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      // US format: MM/DD/YYYY
      const [month, day, year] = dateInput.split('/').map(Number);
      date = new Date(year, month - 1, day);
    } else if (dateInput.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
      // European format: DD.MM.YYYY
      const [day, month, year] = dateInput.split('.').map(Number);
      date = new Date(year, month - 1, day);
    } else {
      // Try built-in parsing
      date = new Date(dateInput);
    }
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    return null;
  }
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return null;
  }
  
  // Format the date
  switch (format) {
    case 'YYYY-MM-DD':
      return date.toISOString().split('T')[0];
    case 'MM/DD/YYYY':
      return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
    case 'DD.MM.YYYY':
      return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
    case 'YYYY-MM-DD HH:mm':
      return `${date.toISOString().split('T')[0]} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    default:
      return date.toISOString().split('T')[0];
  }
}

/**
 * Filter items by date range
 * 
 * @param {Array<Object>} items - Items to filter
 * @param {Object} dateRange - Date range to filter by
 * @param {string|Date} [dateRange.from] - Start date (inclusive)
 * @param {string|Date} [dateRange.to] - End date (inclusive)
 * @param {string} dateField - Field containing date values
 * @returns {Array<Object>} - Filtered items
 */
export function filterByDateRange(items, dateRange, dateField) {
  if (!items) return [];
  if (!items.length) return [];
  if (!dateField) return items;
  if (!dateRange) return items;
  if (!dateRange.from && !dateRange.to) return items;
  
  // Normalize date range
  const fromDate = dateRange.from ? normalizeDate(dateRange.from) : null;
  const toDate = dateRange.to ? normalizeDate(dateRange.to) : null;
  
  if (!fromDate && !toDate) {
    return items;
  }
  
  return items.filter(item => {
    if (!item || typeof item !== 'object' || item[dateField] == null) {
      return false;
    }
    
    const itemDate = normalizeDate(item[dateField]);
    if (!itemDate) {
      return false;
    }
    
    if (fromDate && toDate) {
      return itemDate >= fromDate && itemDate <= toDate;
    } else if (fromDate) {
      return itemDate >= fromDate;
    } else if (toDate) {
      return itemDate <= toDate;
    }
    
    return true;
  });
}

// Export all utilities
export default {
  fuzzyMatch,
  filterByTerms,
  calculateRelevanceScore,
  searchAndSort,
  highlightMatches,
  groupSearchResults,
  createSearchIndex,
  searchIndex,
  normalizeDate,
  filterByDateRange
};