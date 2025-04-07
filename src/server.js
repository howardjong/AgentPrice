const express = require('express');
const cors = require('cors');
const geminiService = require('./geminiService');
require('dotenv').config();
const path = require('path'); // Added to use path.normalize
const fs = require('fs');


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

    const review = await geminiService.reviewCode(code, options);
    return res.json(review);
  } catch (error) {
    console.error('Error in review endpoint:', error);
    return res.status(500).json({ error: error.message });
  }
});

// API route for reading files or directories
app.get('/api/file', async (req, res) => {
  const filePath = req.query.path;

  if (!filePath) {
    return res.status(400).json({ error: 'No file path provided' });
  }

  try {
    // Normalize the path to prevent directory traversal attacks
    const normalizedPath = path.normalize(filePath);
    console.log(`Attempting to read path: ${normalizedPath}`);

    // Check if the path exists
    const stats = await fs.promises.stat(normalizedPath);

    // If it's a directory, read all files and combine content
    if (stats.isDirectory()) {
      console.log(`Reading directory: ${normalizedPath}`);
      const files = await fs.promises.readdir(normalizedPath);

      // Limit number of files to prevent requests that are too large
      const MAX_FILES = 10;
      const filesToProcess = files.slice(0, MAX_FILES);

      let combinedContent = '';

      // Process each file
      for (const file of filesToProcess) {
        const fullPath = path.join(normalizedPath, file);
        try {
          const fileStats = await fs.promises.stat(fullPath);

          // Only include regular files, not subdirectories or other special files
          if (fileStats.isFile()) {
            // Skip large files or non-text files
            const ext = path.extname(fullPath).toLowerCase();
            const skipExtensions = ['.jpg', '.png', '.gif', '.zip', '.pdf', '.exe'];

            if (!skipExtensions.includes(ext) && fileStats.size < 1000000) {
              const fileContent = await fs.promises.readFile(fullPath, 'utf8');
              combinedContent += `\n// FILE: ${fullPath}\n${fileContent}\n\n`;
            }
          }
        } catch (fileError) {
          console.error(`Error reading file ${fullPath}:`, fileError);
          // Continue to next file
        }
      }

      if (combinedContent.trim()) {
        return res.json({ content: combinedContent, isDirectory: true, fileCount: filesToProcess.length });
      } else {
        return res.status(400).json({ error: 'No readable text files found in directory' });
      }
    } else {
      // It's a regular file
      console.log(`Reading file: ${normalizedPath}`);
      const content = await fs.promises.readFile(normalizedPath, 'utf8');

      console.log(`Successfully read file: ${normalizedPath}`);
      res.json({ content });
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
});