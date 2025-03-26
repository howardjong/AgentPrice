
// Simple chart server with explicit path mappings
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Enable detailed request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve the chart viewer HTML directly
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'chart-viewer.html'));
});

// Serve static files with explicit CORS headers
app.use('/public', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  express.static(path.join(process.cwd(), 'public'))(req, res, next);
});

// Serve the output directory with explicit CORS headers
app.use('/tests/output', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  express.static(path.join(process.cwd(), 'tests', 'output'))(req, res, next);
});

// Create test files API endpoint
app.get('/api/create-samples', (req, res) => {
  console.log('Creating sample chart files...');
  const outputDir = path.join(process.cwd(), 'tests', 'output');
  const created = [];
  
  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }
  
  // Create sample files
  const files = ['van_westendorp_plotly.json', 'conjoint_plotly.json', 'bar_chart_plotly.json'];
  const sampleData = {
    plotlyConfig: {
      data: [{x: [1, 2, 3], y: [1, 2, 3], type: 'scatter', name: 'Sample Data'}],
      layout: {title: 'Sample Chart', width: 800, height: 500},
      config: {responsive: true}
    },
    insights: ['This is a sample insight']
  };
  
  files.forEach(file => {
    const filePath = path.join(outputDir, file);
    fs.writeFileSync(filePath, JSON.stringify(sampleData, null, 2));
    created.push(file);
    console.log(`Created/updated file: ${file}`);
  });
  
  res.json({ success: true, files: created });
});

// API to check what files exist
app.get('/api/files', (req, res) => {
  const outputDir = path.join(process.cwd(), 'tests', 'output');
  const files = [];
  
  try {
    if (fs.existsSync(outputDir)) {
      fs.readdirSync(outputDir).forEach(file => {
        const filePath = path.join(outputDir, file);
        const stats = fs.statSync(filePath);
        files.push({
          name: file,
          path: `/tests/output/${file}`,
          size: stats.size,
          modifiedAt: stats.mtime
        });
      });
    }
    
    res.json({ 
      success: true, 
      directory: outputDir,
      directoryExists: fs.existsSync(outputDir),
      files 
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Start the server and create sample files
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
=============================================
       Chart Viewer Server Running
=============================================

Server started on http://0.0.0.0:${PORT}

You can access:
- Chart viewer: http://0.0.0.0:${PORT}/
- Files list: http://0.0.0.0:${PORT}/api/files
- Create samples: http://0.0.0.0:${PORT}/api/create-samples

=============================================
`);

  // Create sample files on startup
  const outputDir = path.join(process.cwd(), 'tests', 'output');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
  }
  
  const files = ['van_westendorp_plotly.json', 'conjoint_plotly.json', 'bar_chart_plotly.json'];
  const sampleData = {
    plotlyConfig: {
      data: [{x: [1, 2, 3], y: [1, 2, 3], type: 'scatter', name: 'Sample Data'}],
      layout: {title: 'Sample Chart', width: 800, height: 500},
      config: {responsive: true}
    },
    insights: ['This is a sample insight']
  };
  
  files.forEach(file => {
    const filePath = path.join(outputDir, file);
    fs.writeFileSync(filePath, JSON.stringify(sampleData, null, 2));
    console.log(`Created/updated sample file: ${file}`);
  });
});
