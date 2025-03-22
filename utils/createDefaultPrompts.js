
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function writePrompt(filePath, content) {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    // Write the prompt file
    await fs.writeFile(filePath, content);
    logger.info(`Created prompt: ${filePath}`);
  } catch (error) {
    logger.error(`Failed to create prompt: ${filePath}`, { error: error.message });
  }
}

async function createDefaultPrompts() {
  const promptsDir = path.join(__dirname, '..', 'prompts');
  
  // Create Claude prompt templates
  await writePrompt(
    path.join(promptsDir, 'claude', 'clarifying_questions.txt'),
    `You are an expert at generating clarifying research questions. Generate 5 specific, non-redundant questions that would help provide better context for deep research on the user's query. Return only a JSON array of questions.`
  );
  
  await writePrompt(
    path.join(promptsDir, 'claude', 'response_generation.txt'),
    `You are a deep research assistant. Provide comprehensive, accurate, and well-structured responses based on the provided context. Include relevant facts and insights, organizing information in clear sections.`
  );
  
  await writePrompt(
    path.join(promptsDir, 'claude', 'chart_data', 'van_westendorp.txt'),
    `You are an expert in pricing analysis. Based on the provided research results, extract or generate appropriate data for a Van Westendorp Price Sensitivity Model. Return ONLY a JSON object with the following structure:
{
  "chartType": "vanWestendorp",
  "data": {
    "tooExpensive": [{"price": number, "percentage": number}, ...],
    "expensive": [{"price": number, "percentage": number}, ...],
    "bargain": [{"price": number, "percentage": number}, ...],
    "tooCheap": [{"price": number, "percentage": number}, ...]
  },
  "optimalPricePoint": number,
  "priceRange": { "min": number, "max": number }
}`
  );
  
  await writePrompt(
    path.join(promptsDir, 'claude', 'chart_data', 'conjoint.txt'),
    `You are an expert in conjoint analysis. Based on the provided research results, extract or generate appropriate data for a conjoint analysis visualization. Return ONLY a JSON object with the following structure:
{
  "chartType": "conjoint",
  "attributes": ["attribute1", "attribute2", ...],
  "utilities": [
    {
      "attribute": "attribute1",
      "levels": [
        {"name": "level1", "utility": number},
        {"name": "level2", "utility": number}
      ]
    }
  ],
  "importances": [
    {"attribute": "attribute1", "importance": number}
  ]
}`
  );
  
  // Create Perplexity prompt templates
  await writePrompt(
    path.join(promptsDir, 'perplexity', 'deep_research.txt'),
    `{{query}}`
  );
  
  logger.info('Default prompts created successfully');
}

export default createDefaultPrompts;
