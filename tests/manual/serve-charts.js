
// Simple express server to serve the chart viewer
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the root directory
app.use(express.static(path.join(process.cwd())));

// Add specific route for chart viewer
app.get('/view-charts', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'chart-viewer.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
=== Chart Viewer Server ===
Server running at http://0.0.0.0:${PORT}

View your charts at:
- http://0.0.0.0:${PORT}/public/chart-viewer.html

The Replit webview should automatically open to show the charts.
If not, click the "Open Website" button in the Replit UI.
  `);
});
