import React from 'react';
import VanWestendorpChart from './VanWestendorp';
import ConjointAnalysisChart from './ConjointAnalysis';

interface VisualizationRendererProps {
  type: 'van_westendorp' | 'conjoint_analysis';
  data?: any;
  title?: string;
  description?: string;
  width?: number;
  height?: number;
}

export function VisualizationRenderer({
  type,
  data,
  title,
  description,
  width = 700,
  height = 450
}: VisualizationRendererProps) {
  const renderVisualization = () => {
    switch (type) {
      case 'van_westendorp':
        return (
          <VanWestendorpChart 
            data={data} 
            title={title} 
            description={description}
            width={width}
            height={height}
          />
        );
      case 'conjoint_analysis':
        return (
          <ConjointAnalysisChart 
            data={data} 
            title={title} 
            description={description}
            width={width}
            height={height}
          />
        );
      default:
        return (
          <div className="error-message p-4 bg-red-50 border border-red-200 rounded-md">
            <h3 className="text-red-600 font-bold">Unsupported Visualization Type</h3>
            <p>The visualization type '{type}' is not supported.</p>
          </div>
        );
    }
  };

  return (
    <div className="visualization-container border border-gray-200 rounded-lg p-4 shadow-sm">
      {renderVisualization()}
    </div>
  );
}

export default VisualizationRenderer;