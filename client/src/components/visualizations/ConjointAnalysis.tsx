import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist';

interface ConjointAttribute {
  name: string;
  importance: number;
  levels: {
    name: string;
    partWorth: number;
  }[];
}

interface ConjointAnalysisProps {
  data?: ConjointAttribute[];
  width?: number;
  height?: number;
  title?: string;
  description?: string;
}

// Sample data if none is provided
const sampleData: ConjointAttribute[] = [
  {
    name: 'Price',
    importance: 35,
    levels: [
      { name: '$499', partWorth: -3.5 },
      { name: '$699', partWorth: -1.2 },
      { name: '$899', partWorth: 0.8 },
      { name: '$1099', partWorth: 4.5 }
    ]
  },
  {
    name: 'Storage',
    importance: 25,
    levels: [
      { name: '128GB', partWorth: -2.1 },
      { name: '256GB', partWorth: 0.2 },
      { name: '512GB', partWorth: 2.5 },
      { name: '1TB', partWorth: 3.8 }
    ]
  },
  {
    name: 'Battery Life',
    importance: 20,
    levels: [
      { name: '8 hours', partWorth: -2.8 },
      { name: '10 hours', partWorth: -0.5 },
      { name: '12 hours', partWorth: 1.2 },
      { name: '15 hours', partWorth: 3.0 }
    ]
  },
  {
    name: 'Camera',
    importance: 15,
    levels: [
      { name: '12MP', partWorth: -1.5 },
      { name: '16MP', partWorth: 0.5 },
      { name: '20MP', partWorth: 1.8 },
      { name: '24MP', partWorth: 2.5 }
    ]
  }
];

export function ConjointAnalysisChart({
  data = sampleData,
  width = 700,
  height = 550,
  title = "Conjoint Analysis - Feature Importance and Part-Worth Utilities",
  description = "Analysis showing relative importance of product features and value of different feature levels"
}: ConjointAnalysisProps) {
  const importanceChartRef = useRef<HTMLDivElement>(null);
  const partWorthChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!importanceChartRef.current || !partWorthChartRef.current) return;

    // Feature Importance Chart
    const importanceData = [{
      x: data.map(d => d.name),
      y: data.map(d => d.importance),
      type: 'bar',
      marker: {
        color: ['#3498db', '#2ecc71', '#f39c12', '#9b59b6'],
        opacity: 0.8
      }
    }];

    const importanceLayout = {
      title: 'Feature Importance',
      xaxis: {
        title: 'Features'
      },
      yaxis: {
        title: 'Importance (%)',
        range: [0, Math.max(...data.map(d => d.importance)) * 1.2]
      },
      autosize: true,
      margin: {
        l: 50,
        r: 50,
        b: 60,
        t: 50,
        pad: 4
      }
    };

    Plotly.newPlot(
      importanceChartRef.current,
      importanceData,
      importanceLayout,
      { responsive: true }
    );

    // Part-Worth Utilities Chart
    const partWorthTraces = data.map((attribute, index) => {
      const colors = ['#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
      return {
        x: attribute.levels.map(level => level.name),
        y: attribute.levels.map(level => level.partWorth),
        name: attribute.name,
        type: 'bar',
        marker: {
          color: colors[index % colors.length]
        }
      };
    });

    const partWorthLayout = {
      title: 'Part-Worth Utilities by Feature Level',
      barmode: 'group',
      xaxis: {
        title: 'Feature Levels',
        tickangle: -45
      },
      yaxis: {
        title: 'Part-Worth Utility'
      },
      legend: {
        orientation: 'h',
        y: -0.2
      },
      autosize: true,
      margin: {
        l: 50,
        r: 50,
        b: 100,
        t: 50,
        pad: 4
      }
    };

    Plotly.newPlot(
      partWorthChartRef.current,
      partWorthTraces,
      partWorthLayout,
      { responsive: true }
    );

    // Clean up function
    return () => {
      Plotly.purge(importanceChartRef.current);
      Plotly.purge(partWorthChartRef.current);
    };
  }, [data]);

  return (
    <div className="visualization-container">
      <h2 className="text-xl font-bold text-center my-4">{title}</h2>
      {description && (
        <p className="chart-description text-center mb-4">{description}</p>
      )}
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div ref={importanceChartRef} style={{ height: '300px', width: '100%' }}></div>
        <div ref={partWorthChartRef} style={{ height: '300px', width: '100%' }}></div>
      </div>
      
      <div className="mt-4 p-3 bg-gray-50 rounded-md">
        <h3 className="font-semibold">How to interpret these charts:</h3>
        <ul className="list-disc pl-5 mt-2 text-sm">
          <li><strong>Feature Importance</strong>: Shows the relative importance of each feature in customer decision-making.</li>
          <li><strong>Part-Worth Utilities</strong>: Indicates how much value customers place on specific feature levels.</li>
        </ul>
      </div>
    </div>
  );
}

export default ConjointAnalysisChart;