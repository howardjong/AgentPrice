const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve static files from the root directory
app.use(express.static(path.join(process.cwd())));

// Check if output directory exists, create it if not
const outputDir = path.join(process.cwd(), 'tests', 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Created output directory: ${outputDir}`);
}

// Create sample files if they don't exist
const createSampleFiles = () => {
  const files = ['van_westendorp_plotly.json', 'conjoint_plotly.json', 'bar_chart_plotly.json'];
  const sampleData = {
    plotlyConfig: {
      data: [{x: [1, 2, 3], y: [3, 1, 5], type: 'scatter', name: 'Sample Data'}],
      layout: {title: 'Sample Chart'},
      config: {responsive: true}
    },
    insights: ['This is a sample insight', 'Another insight point']
  };

  let createdCount = 0;
  for (const file of files) {
    const filePath = path.join(outputDir, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(sampleData, null, 2));
      createdCount++;
    }
  }

  if (createdCount > 0) {
    console.log(`Created ${createdCount} sample chart files`);
  }
};

createSampleFiles();

// Debug API for checking files
app.get('/api/debug/files', (req, res) => {
  try {
    const files = fs.readdirSync(outputDir);
    const fileInfo = files.map(file => {
      const filePath = path.join(outputDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        path: `/tests/output/${file}`,
        exists: true,
        url: `${req.protocol}://${req.get('host')}/tests/output/${file}`
      };
    });

    res.json({
      success: true,
      outputDir,
      files: fileInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Redirect root to chart viewer
app.get('/', (req, res) => {
  res.redirect('/public/chart-viewer.html');
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
=== Chart Viewer Server ===
Server running at http://0.0.0.0:${PORT}

Chart files location: ${outputDir}
Available endpoints:
- Chart Viewer: http://0.0.0.0:${PORT}/public/chart-viewer.html
- Debug API: http://0.0.0.0:${PORT}/api/debug/files

Sample chart files have been created if they didn't exist.
  `);
});