/**
 * Service Module Inspection Test
 * 
 * This test demonstrates how to use the service inspection tool
 * to analyze service modules and generate appropriate mocks.
 */

import { describe, it, expect } from 'vitest';
import inspect, { generateMockCode } from './service-inspection.js';

// Import the service modules for analysis
import claudeService, { 
  processText as claudeProcessText,
  processConversation as claudeProcessConversation,
  generateClarifyingQuestions
} from '../../../services/claudeService.js';

// Perplexity service appears to only have default export
import perplexityService from '../../../services/perplexityService.js';

describe('Service Inspection Tool', () => {
  it('should analyze claudeService structure', () => {
    // Analyze using the tool
    const analysis = inspect(claudeService, {
      processText: claudeProcessText,
      processConversation: claudeProcessConversation,
      generateClarifyingQuestions
    });
    
    // Log the analysis for debugging
    console.log('Claude Service Analysis:', JSON.stringify(analysis, null, 2));
    
    // Generate and log mock code
    const mockCode = generateMockCode(analysis, '../../../services/claudeService.js');
    console.log('Generated Claude Service Mock:\n', mockCode);
    
    // Basic verification
    expect(analysis.defaultExportFunctionCount).toBeGreaterThan(0);
    expect(analysis.namedExportFunctionCount).toBeGreaterThan(0);
    expect(analysis.isAliasingPattern).toBe(true);
    expect(analysis.recommendedMockPattern).toBe('SHARED_OBJECT');
  });
  
  it('should analyze perplexityService structure', () => {
    // Analyze using the tool - Note: perplexityService might not have named exports
    const analysis = inspect(perplexityService, {});
    
    // Log the analysis for debugging
    console.log('Perplexity Service Analysis:', JSON.stringify(analysis, null, 2));
    
    // Create our own custom mock code for default-export-only modules
    let customMockCode = `// Custom mock for perplexityService (default-export-only module)\n`;
    customMockCode += `vi.mock('../../../services/perplexityService.js', () => {\n`;
    customMockCode += `  // Create mock functions\n`;
    
    // Generate function mocks for default export functions
    for (const [funcName, info] of Object.entries(analysis.defaultExportFunctions)) {
      const returnValue = info.async ? 
        `mockResolvedValue({ content: "Mock ${funcName} response" })` : 
        `mockReturnValue({ status: "ok" })`;
      
      customMockCode += `  const ${funcName}Mock = vi.fn().${returnValue};\n`;
    }
    
    customMockCode += `\n  // Create service object with all functions\n`;
    customMockCode += `  const serviceMock = {\n`;
    
    // Add functions to service object
    for (const funcName of Object.keys(analysis.defaultExportFunctions)) {
      customMockCode += `    ${funcName}: ${funcName}Mock,\n`;
    }
    
    customMockCode += `  };\n\n`;
    customMockCode += `  // Return only default export since there are no named exports\n`;
    customMockCode += `  return {\n`;
    customMockCode += `    default: serviceMock\n`;
    customMockCode += `  };\n`;
    customMockCode += `});\n`;
    
    console.log('Custom Perplexity Service Mock:\n', customMockCode);
    
    // Basic verification - different expectations for perplexityService
    expect(analysis.defaultExportFunctionCount).toBeGreaterThan(0);
    expect(analysis.isAliasingPattern).toBe(false); // No named exports pattern
  });
});