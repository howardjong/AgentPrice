# Visualization Capabilities

This document outlines the visualization capabilities implemented in the Multi-LLM Research System.

## Overview

Our system leverages Claude AI to generate interactive data visualizations using Plotly.js. These visualizations can be accessed through dedicated API endpoints and are displayed in the web interface.

## Visualization Types

### 1. Van Westendorp Price Sensitivity Analysis

The Van Westendorp Price Sensitivity Meter is a market research technique used to determine consumer price preferences and identify optimal price points for products or services.

#### Key Features
- **Four Price Points**: Tracks Too Expensive, Expensive but Reasonable, Good Value, and Too Cheap responses
- **Key Intersections**: Highlights the Optimal Price Point (OPP), Point of Marginal Cheapness (PMC), and Point of Marginal Expensiveness (PME)
- **Range Visualization**: Shows the Range of Acceptable Prices between PMC and PME
- **Interactive Elements**: Includes tooltips showing precise values at each point

#### API Endpoint
```
GET /api/test-visualization/van-westendorp
```

#### Example Data Structure
```json
{
  "data": {
    "prices": [50, 100, 150, 200, 250, 300, 350, 400],
    "tooExpensive": [0.05, 0.15, 0.35, 0.55, 0.7, 0.85, 0.92, 0.97],
    "expensiveButReasonable": [0.03, 0.12, 0.45, 0.72, 0.85, 0.92, 0.95, 0.98],
    "goodValue": [0.97, 0.92, 0.75, 0.55, 0.4, 0.25, 0.15, 0.05],
    "tooCheap": [0.95, 0.85, 0.65, 0.45, 0.3, 0.18, 0.08, 0.03]
  },
  "title": "Price Sensitivity Analysis: Premium Headphones",
  "description": "Consumer price perception across different price points"
}
```

### 2. Conjoint Analysis Visualization

Conjoint Analysis is a statistical technique used to determine how consumers value different features of a product or service.

#### Key Features
- **Attribute Importance**: Displays relative importance of different product attributes
- **Level Utilities**: Shows preference scores for specific options within each attribute
- **Grouped Display**: Organizes by attribute categories for clear comparison
- **Sorted Visualization**: Orders attributes by importance for quick insights

#### API Endpoint
```
GET /api/test-visualization/conjoint
```

#### Example Data Structure
```json
{
  "data": {
    "attributes": [
      {
        "name": "Brand",
        "levels": [
          {"name": "Premium", "utility": 0.85},
          {"name": "Standard", "utility": 0.45},
          {"name": "Economy", "utility": 0.15}
        ],
        "importance": 0.38
      },
      {
        "name": "Storage",
        "levels": [
          {"name": "512GB", "utility": 0.75},
          {"name": "256GB", "utility": 0.53},
          {"name": "128GB", "utility": 0.28}
        ],
        "importance": 0.27
      },
      {
        "name": "Color",
        "levels": [
          {"name": "Black", "utility": 0.55},
          {"name": "Silver", "utility": 0.52},
          {"name": "Gold", "utility": 0.45}
        ],
        "importance": 0.15
      },
      {
        "name": "Warranty",
        "levels": [
          {"name": "2 Years", "utility": 0.65},
          {"name": "1 Year", "utility": 0.35}
        ],
        "importance": 0.20
      }
    ]
  },
  "title": "Smartphone Feature Preference Analysis",
  "description": "Consumer preferences for smartphone features based on conjoint analysis"
}
```

### 3. Bar Chart Visualization

Standard bar charts for simple data comparison across categories.

#### Key Features
- **Multi-series Support**: Display multiple data series for comparison
- **Horizontal/Vertical Options**: Support for both horizontal and vertical bar charts
- **Category Grouping**: Group related categories for better organization
- **Color Customization**: Automatically applies appropriate color schemes

#### Example Data Structure
```json
{
  "data": {
    "categories": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    "series": [
      {
        "name": "Product A",
        "values": [45, 52, 38, 65, 72, 58]
      },
      {
        "name": "Product B",
        "values": [35, 41, 62, 49, 55, 64]
      }
    ]
  },
  "type": "bar",
  "title": "Monthly Sales Comparison",
  "description": "Comparison of product sales over a six-month period"
}
```

### 4. Line Chart Visualization

Line charts for tracking trends over time or across sequential categories.

#### Key Features
- **Multiple Series**: Support for multiple data series
- **Area Fill Option**: Optional area fill below lines
- **Point Markers**: Customizable point markers
- **Trend Lines**: Optional trend line overlays

#### Example Data Structure
```json
{
  "data": {
    "x": ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"],
    "series": [
      {
        "name": "Website A",
        "values": [1200, 1900, 3000, 5000, 8000]
      },
      {
        "name": "Website B",
        "values": [900, 2000, 2500, 4000, 6500]
      }
    ]
  },
  "type": "line",
  "title": "Website Traffic Growth",
  "description": "Weekly traffic growth comparison between two websites"
}
```

## Integration with Research Workflows

Visualizations can be automatically generated based on research content. The system can:

1. Extract data from research text
2. Determine appropriate visualization types
3. Generate interactive visualizations with Plotly.js
4. Provide insights based on the visualized data

### File Analysis for Visualization

The system can analyze uploaded content to extract data for visualization:

#### API Endpoint
```
POST /api/analyze-file
```

This endpoint accepts:
- Raw text content
- CSV data
- JSON data

And returns:
- Plotly.js configuration for visualization
- Extracted data in structured format
- Insights based on the data

## Implementation Details

### 1. Chart Generation Process

Claude's API is used to process data and generate Plotly.js configurations:

1. Data is sent to Claude with specific prompt instructions
2. Claude analyzes the data and determines appropriate visualization
3. Claude generates a complete Plotly.js configuration
4. The configuration is validated and enhanced with interactive features
5. The chart is rendered on the client side using Plotly.js

### 2. Interactive Features

All visualizations include the following interactive features:

- **Tooltips**: Hover information displaying precise data values
- **Zoom**: Ability to zoom in/out of specific chart regions
- **Pan**: Moving the visible area of the chart
- **Download**: Option to download the chart as PNG
- **Responsive Design**: Automatic resizing based on container size

### 3. Client-Side Implementation

Chart rendering uses Plotly.js in the client browser:

```javascript
// Example client-side rendering
function renderChart(plotlyConfig) {
  Plotly.newPlot('chart-container', plotlyConfig.data, plotlyConfig.layout, plotlyConfig.config);
}
```

## Testing Visualization Capabilities

Comprehensive tests validate visualization functionality:

- **Unit Tests**: Verify Claude's ability to generate valid Plotly configurations
- **Component Tests**: Validate specific chart types (Van Westendorp, Conjoint, etc.)
- **Integration Tests**: Ensure end-to-end visualization workflow functions correctly

All test types use mock data to avoid actual API calls, ensuring test efficiency and cost savings.

## Future Enhancements

1. **Additional Chart Types**:
   - Heatmaps for correlation analysis
   - Scatter plots for distribution analysis
   - Radar charts for multi-dimensional comparison
   - Geographic maps for location-based data

2. **Enhanced Interactivity**:
   - Cross-filtering between multiple visualizations
   - Animation capabilities for time-series data
   - Custom theme support

3. **Data Processing**:
   - Advanced data transformation options
   - Statistical analysis overlays
   - Anomaly detection in visualized data