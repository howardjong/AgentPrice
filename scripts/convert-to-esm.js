
#!/usr/bin/env node

/**
 * This script helps convert CommonJS modules to ES modules
 * It focuses on replacing require() with import statements
 * and module.exports with export statements
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Get all JS files in the project
const jsFiles = globSync('**/*.js', {
  cwd: rootDir,
  ignore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/build/**',
    '**/.git/**'
  ]
});

/**
 * Convert require statements to import statements
 */
function convertRequireToImport(content) {
  // Convert const X = require('Y') to import X from 'Y'
  let result = content.replace(
    /const\s+(\w+)\s*=\s*require\s*\(['"]([@\w\/-\.]+)['"]\)\s*;?/g,
    'import $1 from \'$2\';'
  );

  // Convert destructuring require: const { a, b } = require('Y')
  result = result.replace(
    /const\s+\{\s*([\w\s,]+)\s*\}\s*=\s*require\s*\(['"]([@\w\/-\.]+)['"]\)\s*;?/g,
    (match, imports, module) => {
      const importList = imports.split(',').map(i => i.trim()).join(', ');
      return `import { ${importList} } from '${module}';`;
    }
  );

  // Convert let/var with require (less common)
  result = result.replace(
    /(let|var)\s+(\w+)\s*=\s*require\s*\(['"]([@\w\/-\.]+)['"]\)\s*;?/g,
    'import $2 from \'$3\';'
  );

  // Convert inline requires within code to dynamic imports
  // This is more complex and may need manual review
  result = result.replace(
    /require\s*\(['"]([@\w\/-\.]+)['"]\)/g, 
    'await import(\'$1\')'
  );

  return result;
}

/**
 * Convert module.exports to export statements
 */
function convertExports(content) {
  // Handle module.exports = X
  let result = content.replace(
    /module\.exports\s*=\s*(\w+)\s*;?/g,
    'export default $1;'
  );

  // Handle module.exports = { a, b, c }
  result = result.replace(
    /module\.exports\s*=\s*\{([^}]+)\}\s*;?/g,
    (match, exports) => {
      // Check if all exports are simple identifiers
      const exportItems = exports.split(',').map(i => i.trim());
      const allIdentifiers = exportItems.every(item => /^\w+$/.test(item));
      
      if (allIdentifiers) {
        return `export { ${exportItems.join(', ')} };`;
      } else {
        return `export default { ${exports} };`;
      }
    }
  );

  // Handle exports.X = Y
  const exportMatches = result.match(/exports\.(\w+)\s*=\s*([^;]+);?/g);
  if (exportMatches) {
    const namedExports = [];
    
    exportMatches.forEach(match => {
      const [_, name, value] = match.match(/exports\.(\w+)\s*=\s*([^;]+);?/);
      // Replace the exports.X = Y with a normal declaration
      result = result.replace(match, '');
      if (name === value.trim()) {
        namedExports.push(name);
      } else {
        // For different name and value, we need to export after declaration
        result += `export const ${name} = ${value};\n`;
      }
    });
    
    if (namedExports.length > 0) {
      result += `export { ${namedExports.join(', ')} };\n`;
    }
  }

  return result;
}

/**
 * Add file extensions to local imports
 */
function addFileExtensions(content) {
  // Add .js extension to local imports that don't have one
  return content.replace(
    /import\s+.*?\s+from\s+['"]([./][^'"]*?)(?:\.js)?['"]/g,
    (match, path) => {
      // Skip if already has an extension or ends with /
      if (/\.\w+$/.test(path) || path.endsWith('/')) {
        return match;
      }
      return match.replace(`'${path}'`, `'${path}.js'`).replace(`"${path}"`, `"${path}.js"`);
    }
  );
}

/**
 * Process a file and convert it to ES module
 */
async function processFile(filePath) {
  try {
    console.log(`Processing: ${filePath}`);
    
    // Read file content
    const fullPath = path.join(rootDir, filePath);
    const content = await fs.readFile(fullPath, 'utf8');
    
    // Skip if file already has ES module imports
    if (content.includes('import ') && !content.includes('require(')) {
      console.log(`  Already using ES modules: ${filePath}`);
      return;
    }
    
    // Perform conversions
    let newContent = convertRequireToImport(content);
    newContent = convertExports(newContent);
    newContent = addFileExtensions(newContent);
    
    // Skip if no changes
    if (content === newContent) {
      console.log(`  No changes needed: ${filePath}`);
      return;
    }
    
    // Write the changes
    await fs.writeFile(fullPath, newContent, 'utf8');
    console.log(`  Converted: ${filePath}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`Found ${jsFiles.length} JavaScript files to process`);
  
  // Create a backup directory
  const backupDir = path.join(rootDir, 'esm-conversion-backup');
  try {
    await fs.mkdir(backupDir, { recursive: true });
  } catch (err) {
    console.error('Error creating backup directory:', err);
  }
  
  // Process files in batches to avoid memory issues
  const batchSize = 50;
  for (let i = 0; i < jsFiles.length; i += batchSize) {
    const batch = jsFiles.slice(i, i + batchSize);
    
    // Process each file in the batch
    await Promise.all(batch.map(async (file) => {
      try {
        // Backup the file
        const content = await fs.readFile(path.join(rootDir, file), 'utf8');
        const backupPath = path.join(backupDir, file);
        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        await fs.writeFile(backupPath, content, 'utf8');
        
        // Process the file
        await processFile(file);
      } catch (err) {
        console.error(`Error processing ${file}:`, err);
      }
    }));
    
    console.log(`Processed batch ${i / batchSize + 1}/${Math.ceil(jsFiles.length / batchSize)}`);
  }
  
  console.log('\nConversion completed!');
  console.log('Note: You may need to manually review some files, especially those with complex require patterns or circular dependencies.');
  console.log('A backup of all files was created in the esm-conversion-backup directory.');
}

main().catch(err => {
  console.error('Conversion failed:', err);
  process.exit(1);
});
