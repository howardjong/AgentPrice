import fs from 'fs';
import path from 'path';

// Simple helper to check if API keys exist without making actual API calls
export function checkApiKeysExist(): {
  anthropic: boolean;
  perplexity: boolean;
  allKeysPresent: boolean;
} {
  const anthropicKeyExists = 
    typeof process.env.ANTHROPIC_API_KEY === 'string' && 
    process.env.ANTHROPIC_API_KEY.length > 20;
  
  const perplexityKeyExists = 
    typeof process.env.PERPLEXITY_API_KEY === 'string' && 
    process.env.PERPLEXITY_API_KEY.length > 20;
  
  return {
    anthropic: anthropicKeyExists,
    perplexity: perplexityKeyExists,
    allKeysPresent: anthropicKeyExists && perplexityKeyExists
  };
}

// Check if required directories and files exist
export function checkSystemFiles(): {
  uploadsDir: boolean;
  promptsDir: boolean;
  testsOutputDir: boolean;
  contentUploadsDir: boolean;
  allDirsExist: boolean;
} {
  // Get directory paths
  const __filename = new URL(import.meta.url).pathname;
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, '../..');
  
  const uploadsDirExists = fs.existsSync(path.join(rootDir, 'uploads'));
  const promptsDirExists = fs.existsSync(path.join(rootDir, 'prompts'));
  const testsOutputDirExists = fs.existsSync(path.join(rootDir, 'tests', 'output'));
  const contentUploadsDirExists = fs.existsSync(path.join(rootDir, 'content-uploads'));
  
  // Ensure content-uploads directory exists
  if (!contentUploadsDirExists) {
    try {
      fs.mkdirSync(path.join(rootDir, 'content-uploads'), { recursive: true });
    } catch (err) {
      console.error('Failed to create content-uploads directory:', err);
    }
  }
  
  // Ensure tests/output directory exists
  if (!testsOutputDirExists) {
    try {
      fs.mkdirSync(path.join(rootDir, 'tests', 'output'), { recursive: true });
    } catch (err) {
      console.error('Failed to create tests/output directory:', err);
    }
  }
  
  return {
    uploadsDir: uploadsDirExists,
    promptsDir: promptsDirExists,
    testsOutputDir: testsOutputDirExists || fs.existsSync(path.join(rootDir, 'tests', 'output')),
    contentUploadsDir: contentUploadsDirExists || fs.existsSync(path.join(rootDir, 'content-uploads')),
    allDirsExist: 
      uploadsDirExists && 
      promptsDirExists && 
      (testsOutputDirExists || fs.existsSync(path.join(rootDir, 'tests', 'output'))) && 
      (contentUploadsDirExists || fs.existsSync(path.join(rootDir, 'content-uploads')))
  };
}

// Check overall system health without making API calls
export function checkSystemHealth(): {
  status: 'healthy' | 'unhealthy' | 'degraded';
  apiKeys: { anthropic: boolean; perplexity: boolean; allKeysPresent: boolean };
  fileSystem: { 
    uploadsDir: boolean;
    promptsDir: boolean;
    testsOutputDir: boolean;
    contentUploadsDir: boolean;
    allDirsExist: boolean;
  };
  memory: { usagePercent: number; healthy: boolean };
  isHealthy: boolean;
} {
  const apiKeys = checkApiKeysExist();
  const fileSystem = checkSystemFiles();
  
  // Check memory usage
  const memoryUsage = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100;
  const memoryHealthy = memoryUsage < 90; // If memory usage is over 90%, consider it unhealthy
  
  // Determine overall health status
  const isHealthy = 
    apiKeys.allKeysPresent && 
    fileSystem.allDirsExist && 
    memoryHealthy;
  
  // If everything is good, status is healthy
  // If API keys are missing, status is unhealthy
  // If only some directories are missing, status is degraded
  let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
  
  if (!apiKeys.allKeysPresent) {
    status = 'unhealthy';
  } else if (!fileSystem.allDirsExist || !memoryHealthy) {
    status = 'degraded';
  }
  
  return {
    status,
    apiKeys,
    fileSystem,
    memory: {
      usagePercent: memoryUsage,
      healthy: memoryHealthy
    },
    isHealthy
  };
}