import { describe, it, expect, vi } from 'vitest'; 
describe('Simple test', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
  // Cleanup event listeners after each test
  afterEach(() => {
    // Ensure proper cleanup of event listeners
    io?.removeAllListeners();
    socket?.removeAllListeners();
    mockClient?.removeAllListeners();
  });
});
