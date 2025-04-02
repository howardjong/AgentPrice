# Model Naming Standardization

This document outlines the standardized model naming convention implemented in the Multi-LLM Research System.

## Overview

To ensure consistency across the codebase and prevent issues with deprecated model names, we've standardized all LLM model references across services, tests, and documentation.

## Current Standards

### Perplexity Models

| Use Case | Standard Model Name | Notes |
|----------|---------------------|-------|
| Basic queries | `sonar` | Default model for most queries |
| Deep research | `sonar-deep-research` | Used only when deep research is explicitly requested |

**Important**: We've removed all references to deprecated model names like `llama-3.1-sonar-small-128k-online` which are no longer supported by the Perplexity API.

### Claude Models

| Use Case | Standard Model Name | Notes |
|----------|---------------------|-------|
| Primary model | `claude-3-7-sonnet-20250219` | Default model for all Claude operations |
| Fallback model | `claude-3-5-haiku-20241022` | Used when primary model is unavailable |

## Implementation Details

The standardization process included:

1. Updating model references in all service files:
   - `perplexityService.js`
   - `claudeService.js`

2. Updating test files to use the standardized model names:
   - Created a new test file for `claudeService.js`
   - Ensured all tests pass with the updated model names

3. Removing redundant files:
   - Removed `fixed-anthropicService.js`
   - Removed `fixed-perplexityService.js`
   - Updated `apply-fixes.js` to remove references to these files

4. Documentation updates:
   - Added standardized model information to README.md
   - Created this standardization document

## Consistency Verification

The codebase has been verified to consistently use the standardized model names throughout:

- All 98 tests are passing with the standardized model names
- The `researchService.js` uses the correct imports for `claudeService.js` and `perplexityService.js`
- No references to deprecated model names remain in the active codebase

## Future Considerations

When adding new models or services:

1. Add the new model to the appropriate section in this document
2. Use the standardized naming pattern established here
3. Update all relevant tests to reflect the new models
4. Ensure backward compatibility with existing code

## Implementation Status

- The system has been consolidated to use only `claudeService.js` for all Anthropic API interactions
- All references to the deprecated `anthropicService.js` have been removed
- All tests have been verified to work with `claudeService.js`