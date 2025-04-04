/**
 * Chart Validation Utilities
 * 
 * This module provides functions for validating chart data and Plotly configurations
 * for different chart types used in the workflow tests.
 */

/**
 * Validate chart data structure
 * @param {Object} chartData - The chart data to validate
 * @param {string} chartType - The type of chart
 * @param {Object} expectations - The expected validation criteria
 * @returns {Object} Validation result {valid: boolean, errors: string[]}
 */
export function validateChartData(chartData, chartType, expectations = {}) {
  const errors = [];
  
  // Common validations
  if (!chartData) {
    errors.push('Chart data is missing');
    return { valid: false, errors };
  }
  
  if (!chartData.data) {
    errors.push('Chart data.data property is missing');
  }
  
  if (!Array.isArray(chartData.insights)) {
    errors.push('Chart insights should be an array');
  }
  
  // Check required fields from expectations
  if (expectations.chartDataRequiredFields) {
    expectations.chartDataRequiredFields.forEach(field => {
      // Handle nested fields with dot notation
      if (field.includes('.')) {
        const parts = field.split('.');
        let current = chartData;
        let missing = false;
        
        for (const part of parts) {
          if (!current || !current[part]) {
            missing = true;
            break;
          }
          current = current[part];
        }
        
        if (missing) {
          errors.push(`Required nested field '${field}' is missing in chart data`);
        }
      } else if (!chartData[field]) {
        errors.push(`Required field '${field}' is missing in chart data`);
      }
    });
  }
  
  // Type-specific validations
  switch (chartType) {
    case 'van_westendorp':
      if (!chartData.data.x_values || !Array.isArray(chartData.data.x_values)) {
        errors.push('Van Westendorp x_values must be an array');
      }
      
      if (!chartData.data.too_cheap || !Array.isArray(chartData.data.too_cheap)) {
        errors.push('Van Westendorp too_cheap data must be an array');
      }
      
      if (!chartData.data.bargain || !Array.isArray(chartData.data.bargain)) {
        errors.push('Van Westendorp bargain data must be an array');
      }
      
      if (!chartData.data.expensive || !Array.isArray(chartData.data.expensive)) {
        errors.push('Van Westendorp expensive data must be an array');
      }
      
      if (!chartData.data.too_expensive || !Array.isArray(chartData.data.too_expensive)) {
        errors.push('Van Westendorp too_expensive data must be an array');
      }
      
      // Check that arrays have the same length
      const lengths = [
        chartData.data.x_values?.length,
        chartData.data.too_cheap?.length,
        chartData.data.bargain?.length,
        chartData.data.expensive?.length,
        chartData.data.too_expensive?.length
      ].filter(l => typeof l === 'number');
      
      if (new Set(lengths).size > 1) {
        errors.push('Van Westendorp data arrays must all have the same length');
      }
      break;
      
    case 'conjoint':
      if (!chartData.data.attributes || !Array.isArray(chartData.data.attributes)) {
        errors.push('Conjoint attributes must be an array');
      }
      
      if (!chartData.data.importance || !Array.isArray(chartData.data.importance)) {
        errors.push('Conjoint importance values must be an array');
      }
      
      if (chartData.data.attributes?.length !== chartData.data.importance?.length) {
        errors.push('Conjoint attributes and importance arrays must have the same length');
      }
      
      if (!chartData.data.part_worths) {
        errors.push('Conjoint part_worths data is missing');
      }
      break;
      
    case 'basic_bar':
    default:
      if (!chartData.data.competitors && !chartData.data.categories && !chartData.data.labels) {
        errors.push('Bar chart categories/competitors/labels data is missing');
      }
      
      if (!chartData.data.values && !chartData.data.prices) {
        errors.push('Bar chart values/prices data is missing');
      }
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate Plotly configuration
 * @param {Object} plotlyConfig - The Plotly configuration to validate
 * @param {string} chartType - The type of chart
 * @param {Object} expectations - The expected validation criteria
 * @returns {Object} Validation result {valid: boolean, errors: string[]}
 */
export function validatePlotlyConfig(plotlyConfig, chartType, expectations = {}) {
  const errors = [];
  
  // Common validations
  if (!plotlyConfig) {
    errors.push('Plotly configuration is missing');
    return { valid: false, errors };
  }
  
  if (!plotlyConfig.data || !Array.isArray(plotlyConfig.data)) {
    errors.push('Plotly data must be an array');
  }
  
  if (!plotlyConfig.layout) {
    errors.push('Plotly layout is missing');
  }
  
  if (!plotlyConfig.config) {
    errors.push('Plotly config is missing');
  }
  
  // Check required fields from expectations
  if (expectations.plotlyConfigRequiredFields) {
    expectations.plotlyConfigRequiredFields.forEach(field => {
      // Handle nested fields with dot notation
      if (field.includes('.')) {
        const parts = field.split('.');
        let current = plotlyConfig;
        let missing = false;
        
        for (const part of parts) {
          if (!current || !current[part]) {
            missing = true;
            break;
          }
          current = current[part];
        }
        
        if (missing) {
          errors.push(`Required nested field '${field}' is missing in Plotly config`);
        }
      } else if (!plotlyConfig[field]) {
        errors.push(`Required field '${field}' is missing in Plotly config`);
      }
    });
  }
  
  // Type-specific validations
  switch (chartType) {
    case 'van_westendorp':
      if (plotlyConfig.data.length < 4) {
        errors.push('Van Westendorp chart should have at least 4 data traces');
      }
      
      if (!plotlyConfig.pricePoints) {
        errors.push('Van Westendorp chart should include price points analysis');
      }
      break;
      
    case 'conjoint':
      if (!plotlyConfig.optimalCombination) {
        errors.push('Conjoint analysis should include optimal combination data');
      }
      break;
      
    case 'basic_bar':
    default:
      if (plotlyConfig.data.length < 1) {
        errors.push('Chart should have at least one data trace');
      }
      
      const hasBarType = plotlyConfig.data.some(trace => 
        trace.type === 'bar' || trace.type === 'column');
      
      if (!hasBarType) {
        errors.push('Basic bar chart should have at least one trace of type "bar"');
      }
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate content for expected keywords and minimum length
 * @param {string} content - The content to validate 
 * @param {Object} expectations - Expected validation criteria
 * @returns {Object} Validation result {valid: boolean, errors: string[], matches: string[]}
 */
export function validateContent(content, expectations = {}) {
  const errors = [];
  const matches = [];
  
  // Check minimum length
  if (expectations.contentMinLength && content.length < expectations.contentMinLength) {
    errors.push(`Content length (${content.length}) is less than minimum required (${expectations.contentMinLength})`);
  }
  
  // Check for required keywords
  if (expectations.requiredKeywords && Array.isArray(expectations.requiredKeywords)) {
    const contentLower = content.toLowerCase();
    expectations.requiredKeywords.forEach(keyword => {
      if (contentLower.includes(keyword.toLowerCase())) {
        matches.push(keyword);
      } else {
        errors.push(`Required keyword "${keyword}" not found in content`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    matches
  };
}

/**
 * Validate sources/citations
 * @param {Array} sources - The sources to validate 
 * @param {Object} expectations - Expected validation criteria
 * @returns {Object} Validation result {valid: boolean, errors: string[]}
 */
export function validateSources(sources, expectations = {}) {
  const errors = [];
  
  // Check if sources exist and are in array format
  if (!sources) {
    errors.push('Sources/citations are missing');
    return { valid: false, errors };
  }
  
  if (!Array.isArray(sources)) {
    errors.push('Sources/citations should be an array');
    return { valid: false, errors };
  }
  
  // Check minimum count of sources
  if (expectations.sourcesMinCount && sources.length < expectations.sourcesMinCount) {
    errors.push(`Number of sources (${sources.length}) is less than minimum required (${expectations.sourcesMinCount})`);
  }
  
  // Check structure of sources if any exist
  if (sources.length > 0) {
    // Sample the first source
    const firstSource = sources[0];
    
    if (typeof firstSource === 'object') {
      // Check for common source properties
      if (!firstSource.title && !firstSource.name) {
        errors.push('Sources should have title or name property');
      }
      
      if (!firstSource.url && !firstSource.link) {
        errors.push('Sources should have url or link property');
      }
    } else if (typeof firstSource === 'string') {
      // If sources are strings, they should look like URLs
      const urlPattern = /^(https?:\/\/|www\.)/i;
      const isUrl = urlPattern.test(firstSource);
      
      if (!isUrl) {
        errors.push('String sources should be valid URLs');
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}