const express = require('express');
const cors = require('cors');
const geminiService = require('./geminiService');
require('dotenv').config();

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
  try {
    const { path } = req.query;

    if (!path) {
      return res.status(400).json({ error: 'No file path provided' });
    }

    // Basic validation to prevent directory traversal
    if (path.includes('..')) {
      return res.status(403).json({ error: 'Invalid file path' });
    }

    const fs = require('fs');
    const { promisify } = require('util');
    const readFile = promisify(fs.readFile);
    const stat = promisify(fs.stat);
    const readdir = promisify(fs.readdir);
    const path_module = require('path');

    // Check if path is a directory or file
    const stats = await stat(path);

    if (stats.isDirectory()) {
      // Get all files in directory recursively
      const getFilesRecursively = async (dir) => {
        const dirents = await readdir(dir, { withFileTypes: true });
        const files = await Promise.all(dirents.map(async (dirent) => {
          const res = path_module.resolve(dir, dirent.name);
          return dirent.isDirectory() ? await getFilesRecursively(res) : res;
        }));
        return Array.prototype.concat(...files);
      };

      const files = await getFilesRecursively(path);
      // Format paths relative to the root
      const relativePaths = files.map(file => file.replace(process.cwd() + '/', ''));

      // Return the list of files
      return res.json({ 
        isDirectory: true, 
        files: relativePaths 
      });
    } else {
      // It's a file, return its content
      const fileContent = await readFile(path, 'utf8');
      res.type('text/plain').send(fileContent);
    }
  } catch (error) {
    console.error('Error reading file or directory:', error);

    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File or directory not found' });
    }

    return res.status(500).json({ error: error.message });
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