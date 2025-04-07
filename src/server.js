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
    return res.status(400).json({ error: 'File path is required' });
  }

  try {
    const normalizedPath = path.normalize(filePath);
    console.log(`Attempting to read path: ${normalizedPath}`);

    // First check if the path exists
    const stats = await fs.promises.stat(normalizedPath);

    // If it's a directory, return a list of files
    if (stats.isDirectory()) {
      console.log(`Reading directory: ${normalizedPath}`);
      const files = await fs.promises.readdir(normalizedPath);
      return res.json({ 
        isDirectory: true, 
        path: normalizedPath,
        files: files
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