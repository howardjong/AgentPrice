
# Gemini Prompts

This directory contains prompt templates for the Gemini AI models used in the code review application.

## Structure

- `*.txt` - Base prompt files used by default
- `variants/` - Experimental prompt variations for testing
- `versions/` - Stable prompt versions that can be activated

## Available Prompts

- `code_review.txt` - Used for code review functionality

## Usage

Prompts are loaded from these files by the `geminiService.js` file. To modify a prompt, edit the corresponding text file.

To create a new prompt variant for testing:
1. Create a new file in the `variants/` directory
2. Use the naming convention `{prompt_name}_variant_{description}.txt`

To promote a variant to a stable version:
1. Copy the variant to the `versions/` directory
2. Use the naming convention `{prompt_name}_v{version_number}.txt`
