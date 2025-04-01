# Claude Service Coverage Improvement Plan

**Date:** April 15, 2025  
**Module:** ClaudeService (server/services/claude.ts)

## Current Coverage Status

The Claude service currently has approximately 65% coverage. This service provides integration with Anthropic's Claude API and handles conversation processing and visualization generation. 

**Important Note**: Our primary workflow depends on the functions implemented in the earlier `claudeService.js` version. While we've begun the transition to the newer `claude.ts` TypeScript implementation, we need to ensure our tests reflect the actual workflow model used in `tests-single-query-workflow`, which still references the older implementation.

## Coverage Improvement Goals

Our goal is to increase coverage to at least 80% across all metrics (statements, branches, functions, and lines) by implementing comprehensive tests for:

1. Model extraction and identification
2. Specialized visualization types
3. Content block handling
4. Error handling and edge cases
5. SVG validation and processing

## Test Enhancement Strategy

### 1. Model Extraction and Identification

**Current Status:** Limited testing of model information handling.

**Planned Improvements:**
- Test model identification from SVG comments
- Test model base name extraction and comparison
- Test warning generation for model mismatches (both severe and minor)
- Test handling of missing model information

Example test pattern:
```javascript
// Test model extraction from SVG
it('should extract model information from SVG comments', async () => {
  // Mock SVG with model comment
  const svgWithModel = '<svg><!-- content --></svg><!-- model: claude-3-5-sonnet-20250117 -->';
  
  // Setup mock with this SVG response
  claudeService.client.messages.create.mockResolvedValueOnce({
    content: [{ type: 'text', text: svgWithModel }]
  });
  
  // Execute
  const result = await claudeService.generateVisualization({}, 'bar');
  
  // Verify model extraction
  expect(result.modelUsed).toBe('claude-3-5-sonnet-20250117');
  // Verify model comment is removed
  expect(result.svg).not.toContain('<!-- model:');
});
```

### 2. Specialized Visualization Types

**Current Status:** Only basic visualization types are tested.

**Planned Improvements:**
- Test Van Westendorp visualization type handling
- Test Conjoint Analysis visualization type handling
- Verify specialized prompt templates for each visualization type
- Test visualization settings and options

Example test pattern:
```javascript
// Test Van Westendorp visualization
it('should use special prompt for Van Westendorp price sensitivity visualization', async () => {
  // Execute with Van Westendorp type
  await claudeService.generateVisualization(testData, 'van_westendorp');
  
  // Extract the prompt from the API call
  const prompt = claudeService.client.messages.create.mock.calls[0][0].messages[0].content;
  
  // Verify Van Westendorp specific content
  expect(prompt).toContain('Van Westendorp Price Sensitivity');
  expect(prompt).toContain('Too Expensive (Red Line)');
  expect(prompt).toContain('Optimal Price Point (OPP)');
});
```

### 3. Content Block Handling

**Current Status:** Basic content handling is tested, but not edge cases.

**Planned Improvements:**
- Test content with multiple blocks
- Test handling of empty or malformed content blocks
- Test different content type handling

Example test pattern:
```javascript
// Test handling of empty content arrays
it('should handle empty content arrays gracefully', async () => {
  // Mock response with empty content array
  claudeService.client.messages.create.mockResolvedValueOnce({
    content: []
  });
  
  // Execute and verify exception is thrown
  await expect(claudeService.processConversation([{ role: 'user', content: 'test' }]))
    .rejects.toThrow();
});
```

### 4. Error Handling and Edge Cases

**Current Status:** Basic error handling is tested, but not comprehensive.

**Planned Improvements:**
- Test API errors with different status codes
- Test network errors and timeouts
- Test rate limiting response handling
- Test with invalid or malformed API responses

Example test pattern:
```javascript
// Test handling of rate limit errors
it('should handle rate limit errors appropriately', async () => {
  // Mock a rate limit error with retry header
  const rateLimitError = new Error('Rate limit exceeded');
  rateLimitError.status = 429;
  rateLimitError.headers = {
    'retry-after': '5'
  };
  
  claudeService.client.messages.create.mockRejectedValueOnce(rateLimitError);
  
  // Execute and verify the error handling
  await expect(claudeService.processConversation([{ role: 'user', content: 'test' }]))
    .rejects.toThrow(/rate limit/i);
  
  // Verify appropriate logging
  expect(console.error).toHaveBeenCalledWith(
    expect.stringContaining('Error processing conversation with Claude'),
    expect.anything()
  );
});
```

### 5. SVG Validation and Processing

**Current Status:** Basic validation exists, but edge cases aren't tested.

**Planned Improvements:**
- Test with partial SVG content
- Test with malformed SVG
- Test SVG processing and cleaning
- Test with SVG edge cases (extra large, minimal valid, etc.)

Example test pattern:
```javascript
// Test handling of malformed SVG
it('should detect and reject malformed SVG content', async () => {
  // Mock response with broken SVG (missing closing tag)
  claudeService.client.messages.create.mockResolvedValueOnce({
    content: [{ 
      type: 'text',
      text: '<svg width="400" height="300"><rect x="10" y="10" width="50" height="50">' 
    }]
  });
  
  // Execute and verify exception
  await expect(claudeService.generateVisualization({}, 'bar'))
    .rejects.toThrow('Claude did not generate valid SVG visualization');
});
```

## Implementation Plan

1. **Complement Existing Tests**:
   We already have several test files for Claude service, including:
   - `claudeService.vitest.js` - Basic unit tests
   - `improved-claude-chart-generation.vitest.js` - Chart generation workflow tests
   - `claude-chart-workflow-nock.vitest.js` - Network mocking tests
   
   Our new `claudeService-workflow-coverage.vitest.js` file complements these by targeting specific coverage gaps.

2. **Focus on Workflow Core Functions**:
   Our testing focuses on the functions actually used in `tests-single-query-workflow`:
   - `processText`
   - `processMultimodal`
   - `processConversation`
   - `generatePlotlyVisualization`

3. **Target Code Path Gaps**:
   Prioritize tests for uncovered code paths, particularly:
   - Plotly visualization generation for specialized chart types (Van Westendorp, Conjoint Analysis)
   - Error handling for rate limits and API failures
   - Circuit breaker integration
   - Content block handling
   - JSON parsing edge cases

4. **Track Coverage Progress**:
   Use coverage reports to iteratively focus on remaining gaps and verify improvement.

5. **Maintain Workflow Compatibility**:
   Ensure that tests maintain compatibility with the actual functional flows in the single query workflow, focusing on:
   - Query routing
   - Service integration
   - Visualization handling
   - Error recovery

## Expected Results

After implementing the enhanced test suite, we expect to achieve:
- Statement coverage: >85%
- Branch coverage: >80%
- Function coverage: 100%
- Line coverage: >85%

This improved coverage will provide better confidence in the Claude service's reliability, particularly for:
- Handling of model discrepancies
- Generation of specialized visualizations
- Robustness against API errors and malformed responses
- Processing and validation of SVG content

## Timeline

Estimated implementation: 3 days
Planned completion: April 18, 2025