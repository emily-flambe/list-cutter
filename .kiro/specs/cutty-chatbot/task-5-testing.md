# Task 5: Basic Testing

## Overview
Comprehensive testing checklist to ensure the ChatBot feature works correctly across all scenarios.

## Backend API Testing

### 1. Test Chat Endpoint Manually

#### Basic Success Case
```bash
# From cloudflare/workers directory
# Start the dev server
npm run dev

# In another terminal, test the endpoint
curl -X POST http://localhost:8788/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Cutty!"}'

# Expected response:
{
  "response": "Hello! I'm Cutty the Cuttlefish, your friendly assistant..."
}

# Check response headers for rate limiting
curl -I -X POST http://localhost:8788/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Cutty!"}'
# Look for: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

#### Test Input Validation
```bash
# Empty message
curl -X POST http://localhost:8788/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": ""}'
# Expected: {"error": "Message is required"}

# Missing message field
curl -X POST http://localhost:8788/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: {"error": "Message is required"}

# Very long message (over 4000 chars)
curl -X POST http://localhost:8788/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "This is a very long message that exceeds 4000 characters..."}'
# Expected: {"error": "Message too long (max 4000 characters)"}
```

### 2. Test AI Worker Authentication

#### Test with Invalid API Key
```bash
# Temporarily modify .dev.vars to have wrong API key
# Then restart the worker and test
curl -X POST http://localhost:8788/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Test auth"}'
# Expected: Error response about AI service being unavailable
```

#### Test Direct AI Worker Connection
```bash
# Test the AI worker directly (requires valid API key)
curl -X POST https://ai.emilycogsdill.com/api/v1/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello",
    "systemPrompt": "You are Cutty the Cuttlefish, a helpful assistant for the Cutty app."
  }'
# Should return: {"response": "..."}
```

### 3. Write Integration Tests
Create a test file:

```typescript
// cloudflare/workers/tests/routes/chat.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import app from '../../src/index';

describe('Chat Route', () => {
  const env = {
    AI_WORKER_URL: 'https://test-ai-worker.com',
    AI_WORKER_API_KEY: 'test-key',
    // ... other required env vars
  };

  it('should respond to valid chat messages', async () => {
    // Mock the AI worker response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Test response from AI' })
    });

    const response = await app.request(
      '/api/v1/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello' })
      },
      env
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.response).toBe('Test response from AI');
  });

  it('should validate message input', async () => {
    const response = await app.request(
      '/api/v1/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '' })
      },
      env
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Message is required');
  });

  it('should handle AI worker errors gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500
    });

    const response = await app.request(
      '/api/v1/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Test error handling' })
      },
      env
    );

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('encountered an error');
  });
});
```

Run the tests:
```bash
cd cloudflare/workers
npm test
```

## Frontend UI Testing

### 1. Manual UI Testing Checklist

#### Initial Load
- [ ] Page loads without errors
- [ ] ChatBot button visible in bottom-right corner
- [ ] Button has proper styling and icon
- [ ] No console errors

#### Chat Interaction
- [ ] Click button opens chat window
- [ ] Welcome message appears
- [ ] Can type in input field
- [ ] Send button enables when text entered
- [ ] Send button disabled when input empty
- [ ] Enter key sends message
- [ ] Shift+Enter creates new line (doesn't send)

#### Message Flow
- [ ] User message appears on right side
- [ ] Loading indicator shows while waiting
- [ ] AI response appears on left side
- [ ] Messages scroll to bottom automatically
- [ ] Long messages wrap properly
- [ ] Timestamps or message styling correct

#### Error Handling
- [ ] Disconnect network and try sending message
- [ ] Error message displays gracefully
- [ ] Can retry sending after reconnecting
- [ ] No app crashes or freezes

#### Mobile Testing
- [ ] Test on real mobile device
- [ ] Chat button accessible
- [ ] Chat window full screen on mobile
- [ ] Keyboard doesn't cover input
- [ ] Can scroll messages while keyboard open
- [ ] Touch targets are large enough

### 2. Browser Compatibility Testing

Test on these browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### 3. Performance Testing

```javascript
// Run in browser console
// Check initial load performance
console.time('ChatBot Mount');
// Click chat button
console.timeEnd('ChatBot Mount');
// Should be < 100ms

// Check message send performance
console.time('Send Message');
// Send a message
console.timeEnd('Send Message');
// Should show loading immediately
```

### 4. Accessibility Testing

Using browser DevTools:
- [ ] Tab navigation works
- [ ] Screen reader announces button
- [ ] ARIA labels present and correct
- [ ] Keyboard shortcuts work
- [ ] Color contrast passes WCAG AA

## End-to-End Testing

### Full User Flow Test

1. **New User Journey**
   ```
   - Open app
   - See ChatBot button
   - Click to open
   - See welcome message
   - Ask "What can you do?"
   - Receive helpful response about app features
   - Ask about synthetic data generation
   - Get specific guidance
   ```

2. **Feature Discovery Flow**
   ```
   - User asks "How do I generate data?"
   - Cutty explains the synthetic data feature
   - User asks "What states are available?"
   - Cutty lists the filtering options
   ```

3. **Error Recovery Flow**
   ```
   - Turn off network
   - Send message
   - See error message
   - Turn on network
   - Send message again
   - Receive normal response
   ```

## Production Testing

### Pre-Deployment Checklist
- [ ] All tests passing locally
- [ ] API endpoint works with production AI worker URL
- [ ] Frontend build succeeds
- [ ] No console errors in production build
- [ ] Environment variables configured correctly

### Post-Deployment Verification
```bash
# Test production endpoint
curl -X POST https://cutty.emilycogsdill.com/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from production test"}'

# Check worker logs
wrangler tail --env production
```

## Load Testing (Optional)

Simple load test to ensure the chat can handle multiple users:

```javascript
// Simple concurrent request test
async function loadTest() {
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(
      fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Test message ${i}` })
      })
    );
  }
  
  const start = Date.now();
  const results = await Promise.all(promises);
  const end = Date.now();
  
  console.log(`10 requests completed in ${end - start}ms`);
  console.log(`Success: ${results.filter(r => r.ok).length}/10`);
}
```

## Monitoring & Debugging

### Add Logging for Production
```typescript
// In chat route
console.log('Chat request received:', {
  timestamp: new Date().toISOString(),
  messageLength: message.length,
  ip: c.req.header('CF-Connecting-IP')
});
```

### Monitor with Wrangler
```bash
# Watch real-time logs
wrangler tail --env production --format pretty

# Filter for chat logs
wrangler tail --env production | grep "chat"
```

## Success Criteria

The ChatBot feature is ready when:
- [x] All manual tests pass
- [x] Integration tests pass
- [x] Works on mobile devices
- [x] Handles errors gracefully
- [x] Performance is acceptable (<1s response time)
- [x] No security vulnerabilities
- [x] Accessible to all users
- [x] Deployed successfully to production