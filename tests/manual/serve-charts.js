
// Simple express server to serve the chart viewer
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Add logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve static files from the root directory
app.use(express.static(path.join(process.cwd())));

// Add specific route for chart viewer
app.get('/view-charts', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'chart-viewer.html'));
});

// Debug route to check if files exist
app.get('/debug/files', (req, res) => {
  const files = [
    '/tests/output/van_westendorp_plotly.json',
    '/tests/output/conjoint_plotly.json',
    '/tests/output/bar_chart_plotly.json'
  ];
  
  const results = {};
  
  for (const file of files) {
    const filePath = path.join(process.cwd(), file.substring(1));
    try {
      const stats = fs.statSync(filePath);
      results[file] = {
        exists: true,
        size: stats.size,
        lastModified: stats.mtime
      };
    } catch (err) {
      results[file] = {
        exists: false,
        error: err.message
      };
    }
  }
  
  res.json(results);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
=== Chart Viewer Server ===
Server running at http://0.0.0.0:${PORT}

View your charts at:
- http://0.0.0.0:${PORT}/public/chart-viewer.html
- Direct link: http://0.0.0.0:${PORT}/view-charts

Debug file availability at:
- http://0.0.0.0:${PORT}/debug/files

The Replit webview should automatically open to show the charts.
If not, click the "Open Website" button in the Replit UI.
  `);
});
