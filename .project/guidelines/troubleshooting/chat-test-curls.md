# Assistant API Test Commands

## Test the Public Assistant Endpoint

### Basic Query (No Authentication)
```bash
curl -X POST https://cutty-dev.emilycogsdill.com/api/v1/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is Cutty?"}'
```

### Pretty JSON Response
```bash
curl -X POST https://cutty-dev.emilycogsdill.com/api/v1/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I upload a CSV file?"}' \
  2>/dev/null | jq '.'
```

### Test Different Queries
```bash
# Test basic product info
curl -X POST https://cutty-dev.emilycogsdill.com/api/v1/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What features does Cutty have?"}'

# Test getting started
curl -X POST https://cutty-dev.emilycogsdill.com/api/v1/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I get started with Cutty?"}'

# Test CSV operations
curl -X POST https://cutty-dev.emilycogsdill.com/api/v1/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I process a CSV file?"}'

# Test segmentation
curl -X POST https://cutty-dev.emilycogsdill.com/api/v1/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is segmentation in Cutty?"}'
```

### Check Response Fields
```bash
# Check just the answer
curl -X POST https://cutty-dev.emilycogsdill.com/api/v1/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Tell me about Cutty"}' \
  2>/dev/null | jq '.answer'

# Check sources
curl -X POST https://cutty-dev.emilycogsdill.com/api/v1/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query": "CSV upload process"}' \
  2>/dev/null | jq '.sources'

# Check intent detection
curl -X POST https://cutty-dev.emilycogsdill.com/api/v1/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I upload files?"}' \
  2>/dev/null | jq '.intent'
```

### With Authentication (If Logged In)
```bash
# Replace YOUR_JWT_TOKEN with actual token from localStorage
curl -X POST https://cutty-dev.emilycogsdill.com/api/v1/assistant/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"query": "What is my usage limit?"}'
```

### Test Conversation Context
```bash
# First message (creates conversation)
curl -X POST https://cutty-dev.emilycogsdill.com/api/v1/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is CSV processing?"}' \
  2>/dev/null | jq '.conversation_id'

# Follow-up with conversation ID
curl -X POST https://cutty-dev.emilycogsdill.com/api/v1/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Tell me more about that", "conversation_id": "CONVERSATION_ID_HERE"}'
```

### Health Check
```bash
curl https://cutty-dev.emilycogsdill.com/api/v1/assistant/health
```

### Test Rate Limiting
```bash
# Run this multiple times quickly to test rate limiting
for i in {1..15}; do
  echo "Request $i:"
  curl -X POST https://cutty-dev.emilycogsdill.com/api/v1/assistant/query \
    -H "Content-Type: application/json" \
    -d '{"query": "test"}' \
    -w "\nHTTP Status: %{http_code}\n"
  sleep 0.5
done
```

## Expected Response Structure

### Successful Response
```json
{
  "answer": "The response from AutoRAG",
  "intent": {
    "intent": "how_to",
    "confidence": 0.9,
    "keywords": ["upload", "csv"],
    "context_type": "technical",
    "action_required": true
  },
  "sources": [
    {
      "filename": "getting-started.md",
      "title": "Getting Started Guide",
      "relevance": 0.95,
      "snippet": "..."
    }
  ],
  "actions": [
    {
      "type": "navigate",
      "description": "Go to upload page",
      "target": "/files/upload",
      "confidence": 0.9,
      "priority": "high"
    }
  ],
  "conversation_id": "unique-id-here",
  "metadata": {
    "response_time_ms": 234,
    "source_count": 2,
    "confidence_score": 0.85
  }
}
```

### Current Issue Response (AutoRAG not returning docs)
```json
{
  "answer": "I couldn't find a specific answer to your question. Please try rephrasing or ask a different question.",
  "intent": {...},
  "sources": [],
  "actions": [...],
  "conversation_id": "...",
  "metadata": {...}
}
```

## Debugging Tips

1. **Check if response is empty**: If `answer` is null or empty, the frontend will show blank bubbles
2. **Check sources array**: If empty, AutoRAG isn't finding documentation
3. **Check HTTP status**: Should be 200 for success, 429 for rate limit, 401 for auth required
4. **Check response time**: Should be <2 seconds for good UX

## Production Testing
Replace `cutty-dev.emilycogsdill.com` with `cutty.emilycogsdill.com` for production testing.