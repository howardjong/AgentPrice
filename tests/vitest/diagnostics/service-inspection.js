/**
 * Service Module Inspection Utility
 * 
 * This utility analyzes the structure of a service module and provides
 * recommendations on the appropriate mocking strategy to use in tests.
 * 
 * Usage:
 *   node tests/vitest/diagnostics/service-inspection.js <path-to-module>
 * 
 * Example:
 *   node tests/vitest/diagnostics/service-inspection.js services/claudeService.js
 */

import fs from 'fs/promises';
import path from 'path';
import util from 'util';

// Module export pattern types
const MODULE_PATTERNS = {
  DEFAULT_ONLY: 'DEFAULT_ONLY',
  NAMED_ONLY: 'NAMED_ONLY',
  MIXED: 'MIXED',
  SHARED_OBJECT: 'SHARED_OBJECT',
  SEPARATE_OBJECTS: 'SEPARATE_OBJECTS',
  UNKNOWN: 'UNKNOWN'
};

// Function to extract export information from a module file
async function analyzeModule(filePath) {
  try {
    // Read the file content
    const absolutePath = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(absolutePath, 'utf8');
    
    // Extract information
    const result = {
      path: filePath,
      absolutePath,
      exportPattern: MODULE_PATTERNS.UNKNOWN,
      hasDefaultExport: false,
      namedExports: [],
      mockingSuggestion: '',
      moduleType: 'unknown' // ESM or CommonJS
    };
    
    // Detect module type
    if (content.includes('module.exports =') || content.includes('exports.')) {
      result.moduleType = 'CommonJS';
    } else if (content.includes('export default') || content.includes('export const') || content.includes('export function')) {
      result.moduleType = 'ESM';
    }
    
    // Parse exports based on module type
    if (result.moduleType === 'CommonJS') {
      // Look for default export (module.exports = ...)
      const defaultExportMatch = content.match(/module\.exports\s*=\s*([^;]+)/);
      if (defaultExportMatch) {
        result.hasDefaultExport = true;
        
        // Check if it exports an object directly or a variable
        const exportValue = defaultExportMatch[1].trim();
        if (exportValue.startsWith('{') || exportValue.match(/^[a-zA-Z0-9_]+$/)) {
          result.defaultExportType = 'object/variable';
        } else {
          result.defaultExportType = 'other';
        }
      }
      
      // Look for named exports (exports.name = ...)
      const namedExportsMatches = content.matchAll(/exports\.([a-zA-Z0-9_]+)\s*=\s*([^;]+)/g);
      for (const match of namedExportsMatches) {
        result.namedExports.push({
          name: match[1],
          value: match[2].trim()
        });
      }
    } else if (result.moduleType === 'ESM') {
      // Look for default export (export default ...)
      const defaultExportMatch = content.match(/export\s+default\s+([^;]+)/);
      if (defaultExportMatch) {
        result.hasDefaultExport = true;
        
        // Check if it exports an object directly or a variable
        const exportValue = defaultExportMatch[1].trim();
        if (exportValue.startsWith('{') || exportValue.match(/^[a-zA-Z0-9_]+$/)) {
          result.defaultExportType = 'object/variable';
        } else {
          result.defaultExportType = 'other';
        }
      }
      
      // Look for named exports (export const/function/class name = ...)
      const namedExportsMatches = content.matchAll(/export\s+(const|let|var|function|class)\s+([a-zA-Z0-9_]+)/g);
      for (const match of namedExportsMatches) {
        result.namedExports.push({
          name: match[2],
          type: match[1]
        });
      }
    }
    
    // Determine export pattern
    if (result.hasDefaultExport && result.namedExports.length === 0) {
      result.exportPattern = MODULE_PATTERNS.DEFAULT_ONLY;
    } else if (!result.hasDefaultExport && result.namedExports.length > 0) {
      result.exportPattern = MODULE_PATTERNS.NAMED_ONLY;
    } else if (result.hasDefaultExport && result.namedExports.length > 0) {
      result.exportPattern = MODULE_PATTERNS.MIXED;
      
      // Try to determine if it's using shared object or separate objects
      if (result.moduleType === 'CommonJS') {
        // Check for patterns like module.exports = {...}; exports.name = ...
        if (content.includes('module.exports = {') && content.includes('exports.')) {
          result.exportPattern = MODULE_PATTERNS.SEPARATE_OBJECTS;
        } 
        // Check for pattern where exports.* properties are added to an object that's also default exported
        else if (content.match(/module\.exports\s*=\s*[a-zA-Z0-9_]+/) && content.includes('exports.')) {
          result.exportPattern = MODULE_PATTERNS.SHARED_OBJECT;
        }
      }
    }
    
    // Generate mocking suggestion
    result.mockingSuggestion = generateMockingSuggestion(result);
    
    return result;
  } catch (error) {
    console.error(`Error analyzing module: ${error.message}`);
    return {
      path: filePath,
      error: error.message
    };
  }
}

// Generate mocking suggestion based on module analysis
function generateMockingSuggestion(moduleInfo) {
  const { exportPattern, namedExports, moduleType } = moduleInfo;
  
  let suggestion = '';
  
  // Example setup
  suggestion += '// Mock setup\n';
  
  // Generate mock function declarations
  if (exportPattern === MODULE_PATTERNS.DEFAULT_ONLY || exportPattern === MODULE_PATTERNS.MIXED) {
    suggestion += 'const mockDefaultFn = vi.fn();\n';
  }
  
  if (exportPattern === MODULE_PATTERNS.NAMED_ONLY || exportPattern === MODULE_PATTERNS.MIXED) {
    namedExports.forEach(exp => {
      suggestion += `const mock${capitalize(exp.name)} = vi.fn();\n`;
    });
  }
  
  suggestion += '\n// Mock implementation\n';
  
  // Generate vi.mock implementation
  const relativePath = moduleInfo.path.startsWith('/') 
    ? moduleInfo.path 
    : `./${moduleInfo.path.replace(/^\.\//, '')}`;
    
  suggestion += `vi.mock('${relativePath}', () => {\n`;
  
  if (exportPattern === MODULE_PATTERNS.DEFAULT_ONLY) {
    suggestion += '  return {\n';
    suggestion += '    default: mockDefaultFn\n';
    suggestion += '  };\n';
  } else if (exportPattern === MODULE_PATTERNS.NAMED_ONLY) {
    suggestion += '  return {\n';
    namedExports.forEach((exp, i) => {
      const comma = i < namedExports.length - 1 ? ',' : '';
      suggestion += `    ${exp.name}: mock${capitalize(exp.name)}${comma}\n`;
    });
    suggestion += '  };\n';
  } else if (exportPattern === MODULE_PATTERNS.MIXED) {
    if (moduleInfo.exportPattern === MODULE_PATTERNS.SHARED_OBJECT) {
      suggestion += '  // This module uses a shared object pattern\n';
      suggestion += '  const mockObj = {\n';
      suggestion += '    mainMethod: mockDefaultFn\n';
      suggestion += '  };\n\n';
      suggestion += '  return {\n';
      suggestion += '    default: mockObj,\n';
      namedExports.forEach((exp, i) => {
        const comma = i < namedExports.length - 1 ? ',' : '';
        suggestion += `    ${exp.name}: mock${capitalize(exp.name)}${comma}\n`;
      });
      suggestion += '  };\n';
    } else {
      suggestion += '  return {\n';
      suggestion += '    default: mockDefaultFn,\n';
      namedExports.forEach((exp, i) => {
        const comma = i < namedExports.length - 1 ? ',' : '';
        suggestion += `    ${exp.name}: mock${capitalize(exp.name)}${comma}\n`;
      });
      suggestion += '  };\n';
    }
  } else {
    suggestion += '  // Unable to determine appropriate mock structure\n';
    suggestion += '  return {\n';
    suggestion += '    default: vi.fn(),\n';
    suggestion += '    // Add named exports as needed\n';
    suggestion += '  };\n';
  }
  
  suggestion += '});\n\n';
  
  // Import example
  suggestion += '// Import example\n';
  if (exportPattern === MODULE_PATTERNS.DEFAULT_ONLY) {
    suggestion += `import serviceModule from '${relativePath}';\n`;
  } else if (exportPattern === MODULE_PATTERNS.NAMED_ONLY) {
    suggestion += `import { ${namedExports.map(e => e.name).join(', ')} } from '${relativePath}';\n`;
  } else if (exportPattern === MODULE_PATTERNS.MIXED) {
    suggestion += `import serviceModule, { ${namedExports.map(e => e.name).join(', ')} } from '${relativePath}';\n`;
  }
  
  return suggestion;
}

// Helper function to capitalize first letter
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Main function
async function main() {
  // Get module path from command line argument
  const modulePath = process.argv[2];
  
  if (!modulePath) {
    console.error('Please provide a path to the module to analyze.');
    console.error('Usage: node service-inspection.js <path-to-module>');
    process.exit(1);
  }
  
  try {
    // Analyze the module
    const analysis = await analyzeModule(modulePath);
    
    // Print results
    console.log('\n=== Module Analysis Results ===\n');
    console.log(`Module Path: ${analysis.path}`);
    console.log(`Module Type: ${analysis.moduleType}`);
    console.log(`Export Pattern: ${analysis.exportPattern}`);
    console.log(`Has Default Export: ${analysis.hasDefaultExport}`);
    
    if (analysis.namedExports.length > 0) {
      console.log(`Named Exports (${analysis.namedExports.length}):`);
      analysis.namedExports.forEach(exp => {
        console.log(`  - ${exp.name}`);
      });
    } else {
      console.log('Named Exports: None');
    }
    
    console.log('\n=== Mocking Suggestion ===\n');
    console.log(analysis.mockingSuggestion);
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);

// Export for testing
export {
  analyzeModule,
  generateMockingSuggestion,
  MODULE_PATTERNS
};