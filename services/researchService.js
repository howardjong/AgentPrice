/**
 * Research Service
 * 
 * Handles deep research operations and manages long-running research jobs
 */

import { v4 as uuidv4 } from 'uuid';
import * as claudeService from './claudeService.js';
import * as perplexityService from './perplexityService.js';
import * as jobManager from './jobManager.js';
import logger from '../utils/logger.js';
import path from 'path';
import * as fs from 'fs/promises';

// Directory for saving research results
const RESEARCH_DIR = process.env.RESEARCH_DIR || 'reports';

// Initialize research service
async function initialize() {
  try {
    // Ensure the research directory exists
    await fs.mkdir(RESEARCH_DIR, { recursive: true });
    
    // Register the processor for deep research jobs
    // Register for both queue names to handle jobs from either
    jobManager.registerProcessor('deep-research', processResearchJob);
    jobManager.registerProcessor('research', processResearchJob);
    
    logger.info('Research service initialized successfully', {
      researchDir: path.resolve(RESEARCH_DIR)
    });
  } catch (error) {
    logger.error('Failed to initialize research service', {
      error: error.message
    });
    throw new Error(`Research service initialization failed: ${error.message}`);
  }
}

/**
 * Process a deep research job
 * @param {Object} job - The job object with data
 * @returns {Promise<Object>} - The research results
 */
async function processResearchJob(job) {
  const { query, options } = job.data;
  const requestId = options.requestId || uuidv4();
  
  try {
    logger.info(`Processing deep research job [${requestId}]`, {
      jobId: job.id,
      query,
      options: {
        model: options.model,
        recencyFilter: options.recencyFilter || 'month'
      }
    });
    
    // Update job progress
    await job.updateProgress(10);
    
    // Conduct deep research with Perplexity
    const results = await perplexityService.conductDeepResearch(query, {
      model: options.model,
      domainFilter: options.domainFilter || [],
      recencyFilter: options.recencyFilter || 'month',
      maxTokens: options.maxTokens || 4096,
      systemPrompt: options.systemPrompt
    });
    
    // Update job progress
    await job.updateProgress(60);
    
    // For longer research, we may want to also generate a summary with Claude
    let summary = null;
    if (options.generateSummary) {
      try {
        summary = await generateResearchSummary(results.content, {
          model: options.summaryModel,
          maxTokens: options.summaryMaxTokens || 1024
        });
        await job.updateProgress(80);
      } catch (summaryError) {
        logger.warn(`Failed to generate research summary [${requestId}]`, {
          error: summaryError.message
        });
        // Continue without summary - non-critical component
      }
    }
    
    // Save research results to file if requested
    let savedFilePath = null;
    if (options.saveResults) {
      try {
        savedFilePath = await saveResearchResults(query, results, summary);
        await job.updateProgress(90);
      } catch (saveError) {
        logger.warn(`Failed to save research results [${requestId}]`, {
          error: saveError.message
        });
        // Continue without saving - non-critical component
      }
    }
    
    // Construct result object
    const researchResult = {
      query,
      content: results.content,
      citations: results.citations || [],
      followUpQuestions: results.followUpQuestions || [],
      summary: summary ? summary.content : null,
      model: results.model,
      timestamp: new Date().toISOString(),
      requestId,
      savedFilePath
    };
    
    logger.info(`Deep research job completed successfully [${requestId}]`, {
      jobId: job.id,
      citationsCount: researchResult.citations.length,
      contentLength: researchResult.content.length
    });
    
    return researchResult;
  } catch (error) {
    logger.error(`Deep research job failed [${requestId}]`, {
      jobId: job.id,
      error: error.message,
      query
    });
    throw new Error(`Deep research job failed: ${error.message}`);
  }
}

/**
 * Generate a summary of research content using Claude
 * @param {string} researchContent - The full research content
 * @param {Object} options - Summary generation options
 * @returns {Promise<Object>} - The summary results
 */
async function generateResearchSummary(researchContent, options = {}) {
  const model = options.model || 'claude-3-7-haiku-20250219'; // Use faster model for summaries
  const maxTokens = options.maxTokens || 1024;
  
  const prompt = `Summarize the following research content. Create a concise summary that captures the 
key findings, main arguments, and important conclusions. Organize with bullet points for clarity.

${researchContent}`;

  return await claudeService.processText(prompt, {
    model,
    maxTokens,
    temperature: 0.2 // Lower temperature for factual summary
  });
}

/**
 * Save research results to file
 * @param {string} query - The original research query
 * @param {Object} results - The research results
 * @param {Object} summary - The optional summary
 * @returns {Promise<string>} - The path to the saved file
 */
async function saveResearchResults(query, results, summary = null) {
  try {
    // Create a normalized filename from the query
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const normalizedQuery = query.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 50);
    
    const filename = `research-${normalizedQuery}-${timestamp}.md`;
    const filePath = path.join(RESEARCH_DIR, filename);
    
    // Format research results as Markdown
    let markdown = `# Research: ${query}\n\n`;
    markdown += `*Generated on: ${new Date().toLocaleString()}*\n\n`;
    
    // Add summary if available
    if (summary && summary.content) {
      markdown += `## Summary\n\n${summary.content}\n\n`;
    }
    
    // Add main content
    markdown += `## Detailed Research\n\n${results.content}\n\n`;
    
    // Add citations if available
    if (results.citations && results.citations.length > 0) {
      markdown += `## Sources\n\n`;
      results.citations.forEach((citation, index) => {
        markdown += `${index + 1}. ${citation}\n`;
      });
      markdown += '\n';
    }
    
    // Add follow-up questions if available
    if (results.followUpQuestions && results.followUpQuestions.length > 0) {
      markdown += `## Follow-up Questions\n\n`;
      results.followUpQuestions.forEach((question, index) => {
        markdown += `${index + 1}. ${question}\n`;
      });
      markdown += '\n';
    }
    
    // Add metadata
    markdown += `## Metadata\n\n`;
    markdown += `- Query: ${query}\n`;
    markdown += `- Model: ${results.model}\n`;
    markdown += `- Citations Count: ${results.citations?.length || 0}\n`;
    
    // Write to file
    await fs.writeFile(filePath, markdown, 'utf8');
    
    logger.info(`Research results saved to file`, {
      filePath,
      query
    });
    
    return filePath;
  } catch (error) {
    logger.error(`Failed to save research results`, {
      error: error.message,
      query
    });
    throw error;
  }
}

/**
 * Start a new research job
 * @param {string} query - The research query
 * @param {Object} options - Research options
 * @returns {Promise<Object>} - Job information
 */
async function startResearchJob(query, options = {}) {
  const requestId = options.requestId || uuidv4();
  
  try {
    logger.info(`Starting research job [${requestId}]`, {
      query,
      options: {
        model: options.model,
        saveResults: options.saveResults
      }
    });
    
    // Enqueue as a job for background processing
    const jobId = await jobManager.enqueueJob('deep-research', {
      query,
      options: {
        ...options,
        requestId
      }
    });
    
    return {
      jobId,
      requestId,
      status: 'queued',
      message: 'Research job has been queued for processing',
      estimatedTime: options.complex ? '60-120 seconds' : '30-60 seconds'
    };
  } catch (error) {
    logger.error(`Error starting research job [${requestId}]`, {
      error: error.message
    });
    throw new Error(`Research job failed to start: ${error.message}`);
  }
}

/**
 * Get status of a research job
 * @param {string} jobId - The job ID
 * @returns {Promise<Object>} - Current job status
 */
async function getResearchStatus(jobId) {
  try {
    return await jobManager.getJobStatus(jobId);
  } catch (error) {
    logger.error(`Error checking research job status`, {
      error: error.message,
      jobId
    });
    throw new Error(`Failed to get research job status: ${error.message}`);
  }
}

/**
 * List saved research reports
 * @returns {Promise<Array>} - List of research reports
 */
async function listResearchReports() {
  try {
    const files = await fs.readdir(RESEARCH_DIR);
    
    // Filter for markdown files that match our naming convention
    const researchFiles = files.filter(file => 
      file.startsWith('research-') && file.endsWith('.md')
    );
    
    // Get file stats for each research file
    const researchReports = await Promise.all(
      researchFiles.map(async (file) => {
        try {
          const filePath = path.join(RESEARCH_DIR, file);
          const stats = await fs.stat(filePath);
          
          // Extract query from filename
          const match = file.match(/^research-(.+)-\d{4}-\d{2}-\d{2}T/);
          const query = match ? match[1].replace(/-/g, ' ') : 'Unknown query';
          
          return {
            id: file.replace(/\.md$/, ''),
            query,
            filename: file,
            path: filePath,
            created: stats.ctime,
            size: stats.size
          };
        } catch (error) {
          logger.warn(`Error processing research file ${file}`, {
            error: error.message
          });
          return null;
        }
      })
    );
    
    // Filter out any null entries from errors
    return researchReports.filter(Boolean);
  } catch (error) {
    logger.error(`Error listing research reports`, {
      error: error.message
    });
    throw new Error(`Failed to list research reports: ${error.message}`);
  }
}

/**
 * Get a specific research report by ID
 * @param {string} reportId - The report ID
 * @returns {Promise<Object>} - The research report
 */
async function getResearchReport(reportId) {
  try {
    const filename = `${reportId}.md`;
    const filePath = path.join(RESEARCH_DIR, filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`Research report ${reportId} not found`);
    }
    
    // Read file contents
    const content = await fs.readFile(filePath, 'utf8');
    const stats = await fs.stat(filePath);
    
    // Extract query from filename
    const match = filename.match(/^research-(.+)-\d{4}-\d{2}-\d{2}T/);
    const query = match ? match[1].replace(/-/g, ' ') : 'Unknown query';
    
    // Simple parsing of markdown to extract sections
    const sections = {};
    let currentSection = 'content';
    
    content.split('\n').forEach(line => {
      if (line.startsWith('## ')) {
        currentSection = line.substring(3).toLowerCase();
        sections[currentSection] = '';
      } else if (currentSection) {
        sections[currentSection] = (sections[currentSection] || '') + line + '\n';
      }
    });
    
    return {
      id: reportId,
      query,
      filename,
      path: filePath,
      created: stats.ctime,
      size: stats.size,
      content,
      sections
    };
  } catch (error) {
    logger.error(`Error getting research report`, {
      error: error.message,
      reportId
    });
    throw new Error(`Failed to get research report: ${error.message}`);
  }
}

export {
  initialize,
  startResearchJob,
  getResearchStatus,
  listResearchReports,
  getResearchReport,
  processResearchJob // Exposed for testing purposes
};