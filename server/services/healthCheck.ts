/**
 * System Health Monitoring Service
 * 
 * This service provides functions to check the overall health of the system,
 * including memory usage, file system access, and API key availability.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

interface SystemHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  apiKeys: {
    anthropic: boolean;
    perplexity: boolean;
    allKeysPresent: boolean;
  };
  fileSystem: {
    uploadsDir: boolean;
    promptsDir: boolean;
    testsOutputDir: boolean;
    contentUploadsDir: boolean;
    allDirsExist: boolean;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
    healthy: boolean;
  };
  isHealthy: boolean;
}

/**
 * Check the overall system health
 * 
 * @returns {SystemHealthStatus} System health status information
 */
export function checkSystemHealth(): SystemHealthStatus {
  // Get memory usage information
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const usagePercent = (usedMemory / totalMemory) * 100;
  
  // Check if memory usage is healthy (below 90%)
  const memoryHealthy = usagePercent < 90;
  
  // Check if required API keys are available
  const anthropicKeyPresent = !!process.env.ANTHROPIC_API_KEY;
  const perplexityKeyPresent = !!process.env.PERPLEXITY_API_KEY;
  const allKeysPresent = anthropicKeyPresent && perplexityKeyPresent;
  
  // Check if required directories exist (synchronous to avoid Promises)
  const rootDir = path.resolve('.');
  const uploadsDir = fs.existsSync(path.join(rootDir, 'uploads'));
  const promptsDir = fs.existsSync(path.join(rootDir, 'prompts'));
  const testsOutputDir = fs.existsSync(path.join(rootDir, 'tests', 'output'));
  const contentUploadsDir = fs.existsSync(path.join(rootDir, 'content-uploads'));
  const allDirsExist = uploadsDir && promptsDir && contentUploadsDir;
  
  // Determine overall system status
  let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
  if (!allKeysPresent || !allDirsExist || !memoryHealthy) {
    status = 'degraded';
  }
  if (!allKeysPresent && !memoryHealthy) {
    status = 'unhealthy';
  }
  
  // Determine overall health
  const isHealthy = status === 'healthy';
  
  // Return comprehensive health information
  return {
    status,
    apiKeys: {
      anthropic: anthropicKeyPresent,
      perplexity: perplexityKeyPresent,
      allKeysPresent
    },
    fileSystem: {
      uploadsDir,
      promptsDir,
      testsOutputDir,
      contentUploadsDir,
      allDirsExist
    },
    memory: {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      usagePercent,
      healthy: memoryHealthy
    },
    isHealthy
  };
}