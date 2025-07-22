# Task 2: Create Backend Chat Route

## Overview
Implement a single POST endpoint that accepts chat messages, forwards them to the external AI worker, and returns responses.

## Implementation Steps

### 1. Create Chat Route File
Create a new file for the chat route:

```typescript
// cloudflare/workers/src/routes/chat.ts
import { Hono } from 'hono';

const chatRoutes = new Hono();

// System prompt defines Cutty's personality and knowledge
const SYSTEM_PROMPT = `You are Cutty the Cuttlefish, a helpful assistant for the Cutty app.
The app helps users generate synthetic person data, filter by US states, and download CSV files.
Be friendly and enthusiastic. You're a playful cuttlefish character.
Focus on the synthetic data generation features.
If asked about features not yet implemented, politely explain they're coming soon.`;

// Main chat endpoint
chatRoutes.post('/', async (c) => {
  try {
    // Parse request body
    const body = await c.req.json();
    const { message } = body;
    
    // Validate input
    if (!message || typeof message !== 'string') {
      return c.json({ error: 'Message is required' }, 400);
    }
    
    if (message.length > 4000) {
      return c.json({ error: 'Message too long (max 4000 characters)' }, 400);
    }

    // Call external AI worker using the correct API format
    const aiResponse = await fetch(`${c.env.AI_WORKER_URL}/api/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${c.env.AI_WORKER_API_KEY}`
      },
      body: JSON.stringify({
        message: message,
        systemPrompt: SYSTEM_PROMPT
      })
    });

    // Handle AI worker response
    if (!aiResponse.ok) {
      console.error('AI worker error:', aiResponse.status, await aiResponse.text());
      throw new Error('AI service unavailable');
    }

    const data = await aiResponse.json();
    
    // The AI worker returns { response: "..." } format
    const responseText = data.response || 'I apologize, I could not process that request.';
    
    return c.json({ response: responseText });
    
  } catch (error) {
    console.error('Chat error:', error);
    
    // User-friendly error message
    return c.json({ 
      error: 'Sorry, I encountered an error. Please try again later.',
      response: 'I apologize, but I\'m having trouble connecting right now. Please try again in a moment.' 
    }, 500);
  }
});

export default chatRoutes;
```

### 2. Register Route in Main App
Update the main index.ts to include the chat routes:

```typescript
// In cloudflare/workers/src/index.ts
import { Hono } from 'hono';
import authRoutes from './routes/auth';
import filesRoutes from './routes/files';
import chatRoutes from './routes/chat'; // Add this import

const app = new Hono<{ Bindings: Env }>();

// Existing routes...
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/files', filesRoutes);

// Add chat routes
app.route('/api/v1/chat', chatRoutes);

export default app;
```

### 3. Add Rate Limiting (Optional but Recommended)
If rate limiting middleware exists, apply it to the chat route:

```typescript
// In the chat route file, before the route definition
import { rateLimiter } from '../middleware/rateLimiter';

// Apply rate limiting - 10 requests per minute per user
chatRoutes.use('/', rateLimiter({ 
  requests: 10, 
  window: '1m',
  keyGenerator: (c) => c.req.header('CF-Connecting-IP') || 'anonymous'
}));
```

## Testing the Endpoint

### 1. Manual Test with cURL
```bash
# Test locally
curl -X POST http://localhost:8788/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Cutty!"}'

# Expected response:
# {"response": "Hello! I'm Cutty the Cuttlefish, your friendly assistant..."}
```

### 2. Test Error Handling
```bash
# Test with missing message
curl -X POST http://localhost:8788/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected response:
# {"error": "Message is required"}
```

### 3. Test with Frontend Console
```javascript
// Run in browser console when frontend is running
fetch('http://localhost:8788/api/v1/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'What can you help me with?' })
})
.then(r => r.json())
.then(console.log);
```

## Error Handling

### Common Errors and Solutions

1. **AI Worker Timeout**
   - Set reasonable timeout (30 seconds to match AI worker)
   - Return graceful error message

2. **Invalid API Key (401)**
   - Check for authentication errors
   - Log for debugging but don't expose to user

3. **Rate Limiting (429)**
   - Default limit: 100 requests per hour per API key
   - Check X-RateLimit headers in response
   - Return appropriate retry message

4. **Network Errors**
   - Catch fetch errors
   - Return user-friendly message

### Enhanced Error Handling Example
```typescript
// Add timeout to fetch
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

try {
  const aiResponse = await fetch(`${c.env.AI_WORKER_URL}/api/v1/chat`, {
    // ... existing options
    signal: controller.signal
  });
  clearTimeout(timeout);
  
  // Check for specific error codes
  if (!aiResponse.ok) {
    const errorData = await aiResponse.json();
    
    switch (aiResponse.status) {
      case 401:
        console.error('Authentication failed:', errorData);
        return c.json({ 
          error: 'Authentication error',
          response: 'I\'m having trouble connecting. Please try again later.' 
        }, 500);
      
      case 429:
        // Extract rate limit info from headers
        const remaining = aiResponse.headers.get('X-RateLimit-Remaining');
        const reset = aiResponse.headers.get('X-RateLimit-Reset');
        console.error('Rate limit exceeded:', { remaining, reset });
        return c.json({ 
          error: 'Too many requests',
          response: 'I\'m a bit overwhelmed right now. Please try again in a few minutes.' 
        }, 429);
      
      default:
        throw new Error(`AI service error: ${aiResponse.status}`);
    }
  }
  
  // ... rest of code
} catch (error) {
  clearTimeout(timeout);
  if (error.name === 'AbortError') {
    return c.json({ 
      error: 'Request timed out',
      response: 'I\'m taking too long to respond. Please try again.' 
    }, 504);
  }
  // ... other error handling
}
```

## Performance Considerations

1. **Response Caching**: Don't cache AI responses - each should be unique
2. **Request Size**: Limit message length to prevent abuse
3. **Timeout**: Set 5-second timeout for AI worker calls
4. **Logging**: Log errors but not message content (privacy)

## Security Checklist

- [x] Validate all inputs
- [x] Use environment variables for sensitive data
- [x] Apply rate limiting
- [x] Don't log user messages
- [x] Sanitize error messages shown to users
- [x] Use HTTPS for AI worker communication