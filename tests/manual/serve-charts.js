
// Simple express server to serve the chart viewer
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the root directory
app.use(express.static(path.join(process.cwd())));

// Add specific route for chart viewer
app.get('/view-charts', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'chart-viewer.html'));
});

// Root route to redirect to chart viewer
app.get('/', (req, res) => {
  res.redirect('/public/chart-viewer.html');
});

// Debug endpoint to check file availability
app.get('/debug/files', (req, res) => {
  const outputDir = path.join(process.cwd(), 'tests', 'output');
  const results = { outputDir, files: [] };
  
  try {
    if (fs.existsSync(outputDir)) {
      results.outputDirExists = true;
      const files = fs.readdirSync(outputDir);
      
      files.forEach(file => {
        try {
          const filePath = path.join(outputDir, file);
          const stats = fs.statSync(filePath);
          results.files.push({
            name: file,
            size: stats.size,
            isDirectory: stats.isDirectory(),
            exists: true
          });
        } catch (err) {
          results.files.push({
            name: file,
            exists: false,
            error: err.message
          });
        }
      });
    } else {
      results.outputDirExists = false;
    }
  } catch (err) {
    results.error = err.message;
  }
  
  res.json(results);
});

// Create test files endpoint
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

Server running at http://0.0.0.0:${PORT}

View your charts at:
- http://0.0.0.0:${PORT}/public/chart-viewer.html
- Direct link: http://0.0.0.0:${PORT}/

Debug file availability at:
- http://0.0.0.0:${PORT}/debug/files

Create test files if needed:
- http://0.0.0.0:${PORT}/create-test-files
  `);
});
