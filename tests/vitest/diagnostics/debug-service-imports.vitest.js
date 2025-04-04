/**
 * Debugging Service Imports
 * 
 * This file is used to debug how imports work with the service modules
 */

import { describe, it, expect } from 'vitest';

// Direct imports from the service without any mocking
import claudeService, { processText, processConversation, generateClarifyingQuestions } from '../../../services/claudeService.js';

describe('Service Import Structure', () => {
  it('should log the structure of claudeService', () => {
    // Log what we imported
    console.log('claudeService (default import):', Object.keys(claudeService || {}));
    console.log('processText (named import):', typeof processText);
    console.log('processConversation (named import):', typeof processConversation);
    console.log('generateClarifyingQuestions (named import):', typeof generateClarifyingQuestions);
    
    // Verify existence of imported functions
    expect(claudeService).toBeDefined();
    expect(typeof processText).toBe('function');
    expect(typeof processConversation).toBe('function');
    expect(typeof generateClarifyingQuestions).toBe('function');
  });
});