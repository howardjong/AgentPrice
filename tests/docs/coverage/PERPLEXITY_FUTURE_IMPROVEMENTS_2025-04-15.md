# Perplexity Service Future Improvements

**Date:** April 15, 2025  
**Module:** PerplexityService (server/services/perplexity.ts)

## Overview

This document outlines future testing improvements for the Perplexity service. The service has reached our base target of 80% coverage across all metrics, but there are still specific areas that could benefit from additional testing to improve robustness and ensure complete feature coverage.

## Current Coverage Status

As of April 11, 2025, the Perplexity service has the following coverage:
- Statement Coverage: ~85-90%
- Branch Coverage: ~80-85%
- Function Coverage: 100%
- Line Coverage: ~85-90%

## Future Improvement Areas

### 1. Model Selection Logic

**Current Status:** Basic model selection is tested, but edge cases need more coverage.

**Planned Improvements:**
- Test model selection fallback when model names change or become unsupported
- Test with additional legacy model mappings
- Test model extraction with partial or malformed model information in responses
- Test behavior when switching between models during a conversation

### 2. Retry Mechanism Edge Cases

**Current Status:** Basic retry functionality is tested, but complex retry patterns need better coverage.

**Planned Improvements:**
- Test exponential backoff timing with more precision using time mocking
- Test retries with various combinations of error types:
  - Network errors followed by rate limiting
  - Transient errors that resolve after X retries
  - Permanent errors that don't resolve
- Test retry exhaustion scenarios
- Test interaction between retries and circuit breaker pattern

### 3. Message Format Edge Cases

**Current Status:** Standard message validation is tested, but complex edge cases need more coverage.

**Planned Improvements:**
- Test with extremely long messages and verify truncation
- Test with special characters and Unicode edge cases
- Test with malformed messages containing valid JSON but incorrect structure
- Test with messages missing required fields but having other optional fields
- Test behavior when message history exceeds token limits

## Implementation Approach

The implementation will follow our established testing patterns:
1. Identify specific scenarios to test
2. Create controlled tests with precise mock data
3. Verify both the happy path and error conditions
4. Document the patterns used for future reference

## Expected Timeline

These improvements are considered lower priority since the service meets our base coverage targets. We plan to implement them after addressing other services that are still below the 80% threshold.

Estimated completion: May 2025