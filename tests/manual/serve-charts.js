
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable console logging for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve static files from the entire project directory
app.use(express.static(process.cwd()));

// Specific route for the chart viewer
app.get('/', (req, res) => {
  res.redirect('/public/chart-viewer.html');
});

// Debug API to check file availability
app.get('/api/debug/files', (req, res) => {
  const outputDir = path.join(process.cwd(), 'tests', 'output');
  const results = { 
    outputDir, 
    exists: fs.existsSync(outputDir),
    files: []
  };
  
  if (results.exists) {
    try {
      const files = fs.readdirSync(outputDir);
      files.forEach(file => {
        const filePath = path.join(outputDir, file);
        const stats = fs.statSync(filePath);
        results.files.push({
          name: file,
          path: `/tests/output/${file}`,
          size: stats.size,
          isFile: stats.isFile()
        });
      });
    } catch (err) {
      results.error = err.message;
    }
  }
  
  res.json(results);
});

// Create sample chart files if they don't exist
app.get('/api/create-samples', (req, res) => {
  const outputDir = path.join(process.cwd(), 'tests', 'output');
  const results = { created: [] };
  
  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    results.dirCreated = outputDir;
  }
  
  const files = ['van_westendorp_plotly.json', 'conjoint_plotly.json', 'bar_chart_plotly.json'];
  const sampleData = {
    plotlyConfig: {
      data: [{x: [1, 2, 3], y: [1, 2, 3], type: 'scatter', name: 'Sample Data'}],
      layout: {title: 'Sample Chart'},
      config: {responsive: true}
    },
    insights: ['This is a sample insight']
  };
  
  files.forEach(file => {
    const filePath = path.join(outputDir, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(sampleData, null, 2));
      results.created.push(file);
    }
  });
  
  res.json(results);
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  // Create sample files on startup
  const outputDir = path.join(process.cwd(), 'tests', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const files = ['van_westendorp_plotly.json', 'conjoint_plotly.json', 'bar_chart_plotly.json'];
  const sampleData = {
    plotlyConfig: {
      data: [{x: [1, 2, 3], y: [1, 2, 3], type: 'scatter', name: 'Sample Data'}],
      layout: {title: 'Sample Chart'},
      config: {responsive: true}
    },
    insights: ['This is a sample insight']
  };
  
  files.forEach(file => {
    const filePath = path.join(outputDir, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(sampleData, null, 2));
      console.log(`Created sample file: ${file}`);
    }
  });
  
  console.log(`
=== Chart Viewer Server ===

Server running at http://0.0.0.0:${PORT}

You can access:
- Chart viewer: http://0.0.0.0:${PORT}/public/chart-viewer.html
- Direct link: http://0.0.0.0:${PORT}/
- Debug API: http://0.0.0.0:${PORT}/api/debug/files
- Create samples: http://0.0.0.0:${PORT}/api/create-samples

The Replit webview should automatically open to show the charts.
  `);
});
