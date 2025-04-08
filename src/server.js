
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import geminiService from './geminiService.js';

// Get dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// API route for code reviews
app.post('/api/review', async (req, res) => {
  try {
    const { code, options } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'No code provided for review' });
    }

    console.log(`🔍 Starting Gemini code review (${new Date().toISOString()})`);
    const startTime = Date.now();
    
    // Set up a progress indicator
    const progressInterval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      console.log(`⏳ Gemini review in progress... (${elapsedSeconds}s elapsed)`);
    }, 5000); // Show progress every 5 seconds
    
    try {
      // Add saveToFile option if not explicitly specified
      const reviewOptions = {
        ...options,
        saveToFile: options.saveToFile !== false, // Default to true if not specified
        title: options.title || (req.body.filePath ? `Review-${path.basename(req.body.filePath)}` : 'Code-Review')
      };
      
      const review = await geminiService.reviewCode(code, reviewOptions);
      clearInterval(progressInterval);
      console.log(`✅ Gemini review completed in ${Math.floor((Date.now() - startTime) / 1000)}s`);
      return res.json(review);
    } catch (error) {
      clearInterval(progressInterval);
      console.error(`❌ Gemini review failed after ${Math.floor((Date.now() - startTime) / 1000)}s:`, error);
      return res.status(500).json({ error: error.message });
    }
  } catch (error) {
    console.error('Error in review endpoint:', error);
    return res.status(500).json({ error: error.message });
  }
});

// API route for reading files or directories
app.get('/api/file', async (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }

  try {
    const normalizedPath = path.normalize(filePath);
    console.log(`Attempting to read path: ${normalizedPath}`);

    // First check if the path exists
    const stats = await fs.promises.stat(normalizedPath);

    // If it's a directory, read all files and prepare them for code review
    if (stats.isDirectory()) {
      console.log(`Reading directory: ${normalizedPath}`);
      const files = await fs.promises.readdir(normalizedPath);
      
      // Process files in the directory
      const fileContents = [];
      let fileCount = 0;
      
      for (const file of files) {
        const filePath = path.join(normalizedPath, file);
        try {
          const fileStats = await fs.promises.stat(filePath);
          
          // Skip subdirectories and non-text files
          if (!fileStats.isDirectory()) {
            try {
              const content = await fs.promises.readFile(filePath, 'utf8');
              fileContents.push(`// FILE: ${filePath}\n${content}\n\n`);
              fileCount++;
            } catch (fileError) {
              console.error(`Error reading file ${filePath}:`, fileError.message);
              // Continue with other files even if one fails
            }
          }
        } catch (statError) {
          console.error(`Error checking file stats for ${filePath}:`, statError.message);
          // Continue with other files
        }
      }
      
      // Combine all file contents with file markers for Gemini to process
      const combinedContent = fileContents.join('');
      
      console.log(`Loaded ${fileCount} files from directory: ${normalizedPath}`);
      return res.json({ 
        isDirectory: true, 
        path: normalizedPath,
        fileCount: fileCount,
        files: files,
        content: combinedContent
      });
    }

    // Otherwise read the file content
    const content = await fs.promises.readFile(normalizedPath, 'utf8');
    console.log(`Successfully read file: ${normalizedPath}`);
    res.json({ 
      isDirectory: false,
      path: normalizedPath,
      content 
    });
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    res.status(404).json({ error: `File not found or cannot be read: ${error.message}` });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'code-reviewer' });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Code reviewer server running on port ${PORT}`);
});

export default app;
