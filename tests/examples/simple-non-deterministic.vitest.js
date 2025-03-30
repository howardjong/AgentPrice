/**
 * Simple test for non-deterministic error handling
 */

import { describe, it, expect } from 'vitest';
import { NonDeterministicErrorSimulator } from '../utils/non-deterministic-error-simulator';

describe('Simple Non-Deterministic Error Handling Tests', () => {
  it('should handle network flakiness with 0% failure rate', async () => {
    // This test should always pass because we set the failure rate to 0
    const result = await NonDeterministicErrorSimulator.simulateNetworkFlakiness(
      async () => 'success',
      { failureRate: 0 }
    );
    
    expect(result).toBe('success');
  });
});