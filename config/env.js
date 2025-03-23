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
  
  return {
    anthropicAvailable: !!anthropicKey,
    perplexityAvailable: !!perplexityKey
  };
};

export { checkApiKeys };
export default { checkApiKeys };