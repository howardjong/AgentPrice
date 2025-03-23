/**
 * Environment configuration
 * Loads environment variables from .env file for development
 * or from Replit secrets for production
 */
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Check and log API keys availability (without exposing the actual keys)
const checkApiKeys = () => {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  
  console.log(`ANTHROPIC API KEY is ${anthropicKey ? 'set' : 'NOT SET'}`);
  console.log(`PERPLEXITY API KEY is ${perplexityKey ? 'set' : 'NOT SET'}`);
  
  // Check if API keys look valid (basic validation)
  if (perplexityKey) {
    const keyLength = perplexityKey.length;
    const keyStartWith = perplexityKey.substring(0, 4);
    console.log(`PERPLEXITY KEY appears to be ${keyLength} characters long and starts with: ${keyStartWith}...`);
    
    if (keyLength < 20) {
      console.warn('Warning: PERPLEXITY_API_KEY seems too short to be valid');
    }
    
    if (perplexityKey.includes('$')) {
      console.warn('Warning: PERPLEXITY_API_KEY may contain unexpanded variable reference');
    }
  }
  
  return {
    anthropicAvailable: !!anthropicKey,
    perplexityAvailable: !!perplexityKey
  };
};

export { checkApiKeys };
export default { checkApiKeys };