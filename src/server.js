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

// API route for reading files
app.get('/api/file', async (req, res) => {
  const filePath = req.query.path;

  if (!filePath) {
    return res.status(400).json({ error: 'No file path provided' });
  }

  try {
    // Normalize the path to prevent directory traversal attacks
    const normalizedPath = path.normalize(filePath);
    console.log(`Attempting to read file: ${normalizedPath}`);

    // Check if the file exists before attempting to read it
    await fs.promises.access(normalizedPath); // Use fs.promises for async access
    const content = await fs.promises.readFile(normalizedPath, 'utf8'); // Use fs.promises for async readFile

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