
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

// Specific route for chart viewer
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

// Create redirect at root to the chart viewer
app.get('/', (req, res) => {
  res.redirect('/view-charts');
});

// Create empty chart files if they don't exist (for testing)
app.get('/create-test-files', (req, res) => {
  const outputDir = path.join(process.cwd(), 'tests', 'output');
  
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const files = [
      'van_westendorp_plotly.json',
      'conjoint_plotly.json',
      'bar_chart_plotly.json'
    ];
    
    const sampleData = {
      plotlyConfig: {
        data: [{x: [1, 2, 3], y: [1, 2, 3], type: 'scatter'}],
        layout: {title: 'Sample Chart'},
        config: {responsive: true}
      },
      insights: ['This is a sample insight']
    };
    
    for (const file of files) {
      const filePath = path.join(outputDir, file);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(sampleData, null, 2));
      }
    }
    
    res.json({success: true, message: 'Test files created successfully'});
  } catch (err) {
    res.status(500).json({success: false, error: err.message});
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
=== Chart Viewer Server ===

View your charts at:
- http://0.0.0.0:${PORT}/view-charts
- Direct link: http://0.0.0.0:${PORT}/

Debug file availability at:
- http://0.0.0.0:${PORT}/debug/files

Create test files if needed:
- http://0.0.0.0:${PORT}/create-test-files

The Replit webview should automatically open to show the charts.
If not, click the "Open Website" button in the Replit UI.
`);
});
