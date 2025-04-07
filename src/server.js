const express = require('express');
const cors = require('cors');
const geminiService = require('./geminiService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

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

// API endpoint for code refactoring
app.post('/api/refactor', async (req, res) => {
  try {
    const { code, instructions, options } = req.body; // Added options for consistency

    if (!code) {
      return res.status(400).json({ error: 'No code provided for refactoring' });
    }

    const refactoring = await geminiService.refactorCode(code, instructions, options);
    return res.json(refactoring);
  } catch (error) {
    console.error('Error in refactor endpoint:', error);
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