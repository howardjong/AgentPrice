#!/bin/bash

# Test the sonar-deep-research model with curl
echo "Testing sonar-deep-research model with curl..."

# Replace token with environment variable
curl --request POST \
  --url https://api.perplexity.ai/chat/completions \
  --header "Authorization: Bearer $PERPLEXITY_API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
  "model": "sonar-deep-research",
  "messages": [
    {"role": "user", "content": "Provide an in-depth analysis of the impact of AI on global job markets over the next decade."}
  ],
  "max_tokens": 500
}' > curl-response.json

echo "Response saved to curl-response.json"