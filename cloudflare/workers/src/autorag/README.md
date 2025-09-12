# CuttyAssistant - AutoRAG Integration

This module provides an intelligent chatbot assistant for the Cutty application using Cloudflare AutoRAG. The assistant helps users with documentation queries, provides contextual action suggestions, and offers troubleshooting support.

## Features

- **Intent Detection**: Automatically analyzes user queries to determine intent (documentation, troubleshooting, how-to, etc.)
- **AutoRAG Integration**: Leverages Cloudflare AutoRAG for documentation lookup and intelligent responses
- **Action Suggestions**: Provides contextual suggestions for actions users can take in the Cutty application
- **Conversation Management**: Tracks conversation history and context for better user experience
- **Rate Limiting**: Built-in rate limiting to prevent abuse of the AutoRAG service
- **Authentication**: JWT-based authentication for secure access

## API Endpoints

### POST /api/v1/assistant/query
Process a user query and return an enhanced response with intent analysis, sources, and action suggestions.

**Request:**
```json
{
  "query": "How do I upload a CSV file?",
  "conversation_id": "optional-conversation-id"
}
```

**Response:**
```json
{
  "answer": "To upload a CSV file...",
  "intent": {
    "intent": "how_to",
    "confidence": 0.9,
    "keywords": ["upload", "csv", "file"],
    "context_type": "business",
    "action_required": true
  },
  "sources": [
    {
      "content": "Documentation excerpt...",
      "title": "File Upload Guide",
      "relevance_score": 0.95,
      "document_type": "documentation"
    }
  ],
  "actions": [
    {
      "type": "navigate",
      "description": "Go to file upload page",
      "target": "/files/upload",
      "confidence": 0.9,
      "priority": "high"
    }
  ],
  "conversation_id": "conv_123",
  "metadata": {
    "response_time_ms": 1234,
    "source_count": 3,
    "confidence_score": 0.9
  }
}
```

### GET /api/v1/assistant/conversations/:id
Retrieve conversation history for a specific conversation.

### DELETE /api/v1/assistant/conversations/:id
Clear conversation history for a specific conversation.

### GET /api/v1/assistant/health
Health check endpoint that verifies AutoRAG service availability.

### GET /api/v1/assistant/config
Get assistant configuration (admin only).

### POST /api/v1/assistant/feedback
Submit feedback on assistant responses.

## Environment Variables

Required environment variables for AutoRAG configuration:

```bash
# AutoRAG instance configuration
AUTORAG_INSTANCE_NAME=your-autorag-instance
AUTORAG_API_KEY=your-api-key

# Optional configuration (defaults provided)
AUTORAG_TIMEOUT_MS=30000
AUTORAG_MAX_SOURCES=5
AUTORAG_MIN_CONFIDENCE=0.3
AUTORAG_RATE_LIMIT=60
AUTORAG_BURST_LIMIT=10
```

## Intent Types

The assistant recognizes the following intent types:

- **documentation**: General documentation queries
- **feature_request**: Requests for new features or functionality
- **troubleshooting**: Error reports and problem-solving requests
- **how_to**: Step-by-step guidance requests
- **api_usage**: API-related questions and integration help
- **general_question**: General informational queries

## Action Types

The assistant can suggest the following action types:

- **navigate**: Navigate to a specific page or section
- **create**: Create new resources (files, segments, etc.)
- **edit**: Modify existing resources or settings
- **view**: View or browse existing resources
- **search**: Search for specific information or data

## Rate Limiting

The assistant implements per-user rate limiting:

- 30 requests per minute per authenticated user
- Rate limit counters stored in KV storage
- Graceful handling of rate limit exceeded scenarios

## Security Features

- JWT-based authentication required for all endpoints
- Input sanitization to prevent XSS and injection attacks
- Sensitive information detection in queries
- User isolation (users can only access their own conversations)
- Admin-only endpoints for configuration access

## Error Handling

The implementation includes comprehensive error handling with specific error types:

- `AutoRAGError`: Base error class with error codes
- `AutoRAGTimeoutError`: Request timeout errors
- `AutoRAGRateLimitError`: Rate limiting errors
- `IntentDetectionError`: Intent analysis failures

## Usage Examples

### Basic Query Processing
```typescript
import { CuttyAssistant } from './autorag/CuttyAssistant';

const assistant = new CuttyAssistant(env);
const response = await assistant.processQuery(
  "How do I create a new segment?",
  "user123"
);
```

### Health Check
```typescript
const healthStatus = await assistant.healthCheck();
console.log(`AutoRAG status: ${healthStatus.status}`);
```

### Conversation Management
```typescript
// Get conversation history
const history = await assistant.getConversationHistory("conv_123");

// Clear conversation
await assistant.clearConversation("conv_123");
```

## Development

### File Structure

- `types.ts` - TypeScript type definitions for AutoRAG integration
- `utils.ts` - Utility functions for intent detection and processing
- `CuttyAssistant.ts` - Main assistant class with AutoRAG integration
- `../routes/assistant.ts` - API route handlers for assistant endpoints

### Testing

The implementation includes comprehensive error handling and logging for debugging. Monitor the Cloudflare Workers logs for detailed error information and performance metrics.

### Performance Considerations

- Conversation history is cached in memory with KV storage backup
- Rate limiting prevents service abuse
- Configurable timeouts for AutoRAG requests
- Source processing limits to maintain response speed

## Integration with Cutty Frontend

The assistant API can be integrated with the Cutty frontend to provide:

- In-app chat widget for user support
- Contextual help based on current page/feature
- Guided onboarding workflows
- Smart search and discovery features

Example frontend integration:
```javascript
// Query the assistant
const response = await fetch('/api/v1/assistant/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    query: userInput,
    conversation_id: currentConversationId
  })
});

const result = await response.json();
// Display result.answer and result.actions to user
```