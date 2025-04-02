/**
 * Research Service Test Utilities
 * 
 * Helper functions and utilities specifically for testing the Research Service module.
 * These utilities make it easier to mock the file system, generate test data,
 * and validate research results.
 */

import { vi } from 'vitest';
import path from 'path';

/**
 * Creates comprehensive mocks for the fs/promises module
 * @param {Object} options - Customization options for the mock behavior
 * @returns {Object} - Mock implementation for fs/promises
 */
export function createFsPromisesMocks(options = {}) {
  const {
    researchDir = 'reports',
    existingFiles = [
      'research-test-query-2025-04-25T12-00-00.md',
      'research-another-query-2025-04-26T13-00-00.md'
    ],
    fileContents = {},
    throwErrors = {}
  } = options;
  
  // Default file content if not specified
  const defaultContent = '# Research: {{query}}\n\nMock research content';
  
  return {
    mkdir: vi.fn().mockImplementation((dirPath, options) => {
      if (throwErrors.mkdir) {
        return Promise.reject(new Error(throwErrors.mkdir));
      }
      return Promise.resolve(undefined);
    }),
    
    writeFile: vi.fn().mockImplementation((filePath, content, encoding) => {
      if (throwErrors.writeFile) {
        return Promise.reject(new Error(throwErrors.writeFile));
      }
      return Promise.resolve(undefined);
    }),
    
    readFile: vi.fn().mockImplementation((filePath) => {
      if (throwErrors.readFile) {
        return Promise.reject(new Error(throwErrors.readFile));
      }
      
      // Extract filename from path
      const filename = path.basename(filePath);
      
      // Check if we have specific content for this file
      if (fileContents[filename]) {
        return Promise.resolve(fileContents[filename]);
      }
      
      // Generate content based on filename
      if (filename.startsWith('research-')) {
        // Extract query from filename
        const match = filename.match(/^research-(.+)-\d{4}-\d{2}-\d{2}T/);
        if (match) {
          const query = match[1].replace(/-/g, ' ');
          return Promise.resolve(defaultContent.replace('{{query}}', query));
        }
      }
      
      return Promise.reject(new Error(`File not found: ${filePath}`));
    }),
    
    readdir: vi.fn().mockImplementation((dirPath) => {
      if (throwErrors.readdir) {
        return Promise.reject(new Error(throwErrors.readdir));
      }
      
      // Add a non-research file to test filtering
      return Promise.resolve([...existingFiles, 'not-a-research-file.txt']);
    }),
    
    stat: vi.fn().mockImplementation((filePath) => {
      if (throwErrors.stat) {
        return Promise.reject(new Error(throwErrors.stat));
      }
      
      // Extract filename from path
      const filename = path.basename(filePath);
      
      // Return stats based on filename
      if (filename.includes('test-query')) {
        return Promise.resolve({
          ctime: new Date('2025-04-25T12:00:00Z'),
          size: 1024
        });
      } else if (filename.includes('another-query')) {
        return Promise.resolve({
          ctime: new Date('2025-04-26T13:00:00Z'),
          size: 2048
        });
      }
      
      return Promise.reject(new Error(`File not found: ${filePath}`));
    }),
    
    access: vi.fn().mockImplementation((filePath) => {
      if (throwErrors.access) {
        return Promise.reject(new Error(throwErrors.access));
      }
      
      // Check if it's a research file or the research directory
      if (existingFiles.some(file => filePath.includes(file)) || 
          filePath.includes(researchDir)) {
        return Promise.resolve();
      }
      
      return Promise.reject(new Error(`ENOENT: File or directory not found: ${filePath}`));
    })
  };
}

/**
 * Creates a mock job object for testing research job processing
 * @param {Object} options - Job options
 * @returns {Object} - Mock job object
 */
export function createMockJob(options = {}) {
  const {
    id = 'job-123',
    query = 'test query',
    jobOptions = {},
    updateProgressErrors = false
  } = options;
  
  return {
    id,
    data: {
      query,
      options: jobOptions
    },
    updateProgress: updateProgressErrors 
      ? vi.fn().mockRejectedValue(new Error('Failed to update progress'))
      : vi.fn().mockResolvedValue(undefined)
  };
}

/**
 * Creates sample research results for testing
 * @param {Object} options - Customization options
 * @returns {Object} - Mock research results
 */
export function createSampleResearchResults(options = {}) {
  const {
    content = 'Mock research results',
    model = 'sonar-chart-pro',
    citationsCount = 3,
    followUpQuestionsCount = 2,
    includeSummary = false
  } = options;
  
  // Generate citations
  const citations = Array.from({ length: citationsCount }, (_, i) => 
    `https://example.com/source${i + 1}`
  );
  
  // Generate follow-up questions
  const followUpQuestions = Array.from({ length: followUpQuestionsCount }, (_, i) => 
    `Follow up question ${i + 1}?`
  );
  
  // Create results object
  const results = {
    content,
    citations,
    followUpQuestions,
    model
  };
  
  // Add summary if requested
  if (includeSummary) {
    results.summary = {
      content: 'This is a summary of the research findings.',
      model: 'claude-3-haiku'
    };
  }
  
  return results;
}

/**
 * Validates a research report structure
 * @param {Object} report - The report to validate
 * @returns {boolean} - True if valid, throws error if invalid
 */
export function validateResearchReport(report) {
  // Required fields
  const requiredFields = ['id', 'query', 'filename', 'path', 'created', 'size'];
  
  for (const field of requiredFields) {
    if (!(field in report)) {
      throw new Error(`Missing required field in research report: ${field}`);
    }
  }
  
  // Type checks
  if (typeof report.id !== 'string') throw new Error('Report id must be a string');
  if (typeof report.query !== 'string') throw new Error('Report query must be a string');
  if (typeof report.filename !== 'string') throw new Error('Report filename must be a string');
  if (typeof report.path !== 'string') throw new Error('Report path must be a string');
  if (!(report.created instanceof Date)) throw new Error('Report created must be a Date');
  if (typeof report.size !== 'number') throw new Error('Report size must be a number');
  
  // Filename format
  if (!report.filename.startsWith('research-') || !report.filename.endsWith('.md')) {
    throw new Error('Invalid research report filename format');
  }
  
  return true;
}

/**
 * Mocks the global Date object to return a fixed date
 * @param {string|Date} date - The date to fix Date to
 * @returns {Function} - Function to restore the original Date
 */
export function mockDate(date) {
  const fixedDate = date instanceof Date ? date : new Date(date);
  const originalDate = global.Date;
  
  // Mock Date constructor
  global.Date = class extends Date {
    constructor(...args) {
      if (args.length === 0) {
        return new originalDate(fixedDate);
      }
      return new originalDate(...args);
    }
  };
  
  // Mock Date.now
  global.Date.now = () => fixedDate.getTime();
  
  // Keep the original static methods
  global.Date.parse = originalDate.parse;
  global.Date.UTC = originalDate.UTC;
  
  // Return restore function
  return () => {
    global.Date = originalDate;
  };
}

/**
 * Creates a predictable filename for testing
 * @param {string} query - The research query
 * @param {string|Date} date - The date (optional, defaults to fixed date)
 * @returns {string} - Normalized filename
 */
export function createResearchFilename(query, date = '2025-04-25T12:00:00Z') {
  const timestamp = new Date(date).toISOString().replace(/:/g, '-');
  const normalizedQuery = query.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 50);
  
  return `research-${normalizedQuery}-${timestamp}.md`;
}

/**
 * Creates file content in the format used by the Research Service
 * @param {Object} options - Content options
 * @returns {string} - Formatted file content
 */
export function createResearchFileContent(options = {}) {
  const {
    query = 'test query',
    content = 'Mock research content',
    summary = null,
    citations = [],
    followUpQuestions = [],
    model = 'sonar-chart-pro',
    date = new Date('2025-04-25T12:00:00Z')
  } = options;
  
  let markdown = `# Research: ${query}\n\n`;
  markdown += `*Generated on: ${date.toLocaleString()}*\n\n`;
  
  // Add summary if available
  if (summary) {
    markdown += `## Summary\n\n${summary}\n\n`;
  }
  
  // Add main content
  markdown += `## Detailed Research\n\n${content}\n\n`;
  
  // Add citations if available
  if (citations.length > 0) {
    markdown += `## Sources\n\n`;
    citations.forEach((citation, index) => {
      markdown += `${index + 1}. ${citation}\n`;
    });
    markdown += '\n';
  }
  
  // Add follow-up questions if available
  if (followUpQuestions.length > 0) {
    markdown += `## Follow-up Questions\n\n`;
    followUpQuestions.forEach((question, index) => {
      markdown += `${index + 1}. ${question}\n`;
    });
    markdown += '\n';
  }
  
  // Add metadata
  markdown += `## Metadata\n\n`;
  markdown += `- Query: ${query}\n`;
  markdown += `- Model: ${model}\n`;
  markdown += `- Citations Count: ${citations.length}\n`;
  
  return markdown;
}