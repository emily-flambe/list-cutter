# Design Document

## Overview

Real-time segmentation API exposing Cutty's dynamic audience engine, platform activation status, and streaming updates via WebSocket.

## Limits

- Standard API: 1000 requests/hour per key
- Segment members: 100 requests/hour (heavy queries)
- WebSocket: 10 concurrent connections per key
- Pagination: 1000 members per page
- Webhook retry: 3 attempts with exponential backoff
- API keys per user: 10 max

## Architecture

### Backend
- Extend Hono.js with `/api/v1/public/*` routes
- API key middleware with segment-level permissions
- WebSocket handlers via Durable Objects (reuse from UI)
- Cloudflare Queue for reliable webhook delivery
- Leverage existing segment engine from specs 1.5/2.0

### Frontend  
- API Keys management in settings with permissions UI
- Interactive API explorer at `/developers`
- Webhook configuration and testing interface
- API usage analytics dashboard

## Implementation

### Backend Routes

```typescript
// Segment API endpoints
GET  /api/v1/public/segments                    // List segments with metadata
GET  /api/v1/public/segments/:id                // Segment details + query definition
GET  /api/v1/public/segments/:id/members        // Members (cursor pagination + delta)
GET  /api/v1/public/segments/:id/count          // Real-time count
GET  /api/v1/public/segments/:id/activations    // Platform sync status
POST /api/v1/public/segments/:id/export         // Export as CSV/JSON

// WebSocket endpoints
WS   /api/v1/public/segments/:id/stream         // Real-time member changes
WS   /api/v1/public/segments/updates            // All segment notifications

// Webhook management (authenticated)
POST   /api/v1/webhooks                         // Register webhook
GET    /api/v1/webhooks                         // List webhooks  
DELETE /api/v1/webhooks/:id                     // Remove webhook
POST   /api/v1/webhooks/:id/test                // Send test event

// API key management (authenticated)
POST   /api/v1/auth/api-keys                    // Generate with permissions
GET    /api/v1/auth/api-keys                    // List keys + usage stats
PATCH  /api/v1/auth/api-keys/:id                // Update permissions
DELETE /api/v1/auth/api-keys/:id                // Revoke key
```

### Database Schema

```sql
-- API Keys table with permissions
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  permissions TEXT NOT NULL, -- JSON array of permissions
  segment_ids TEXT, -- JSON array of allowed segment IDs (null = all)
  rate_limit INTEGER DEFAULT 1000,
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Webhooks table with filtering
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT NOT NULL, -- JSON array of event types
  segment_ids TEXT, -- JSON array to filter events (null = all)
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- API usage tracking
CREATE TABLE api_usage (
  api_key_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  segment_id TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  response_time_ms INTEGER,
  INDEX idx_usage_key_time (api_key_id, timestamp)
);
```

### API Authentication

```typescript
// Enhanced API key middleware with permissions
export const apiKeyAuth = async (c: Context, next: Next) => {
  const apiKey = c.req.header('X-API-Key');
  if (!apiKey) return c.json({ error: 'Missing API key' }, 401);
  
  // Verify key and get permissions
  const hashedKey = await hashApiKey(apiKey, c.env.API_KEY_SALT);
  const keyData = await c.env.DB.prepare(`
    SELECT user_id, id, permissions, segment_ids, rate_limit 
    FROM api_keys WHERE key_hash = ?
  `).bind(hashedKey).first();
  
  if (!keyData) return c.json({ error: 'Invalid API key' }, 401);
  
  // Check segment-level access if applicable
  const segmentId = c.req.param('id');
  if (segmentId && keyData.segment_ids) {
    const allowedSegments = JSON.parse(keyData.segment_ids);
    if (!allowedSegments.includes(segmentId)) {
      return c.json({ error: 'Access denied to this segment' }, 403);
    }
  }
  
  // Track usage asynchronously
  c.executionCtx.waitUntil(
    trackApiUsage(c.env.DB, keyData.id, c.req.path, segmentId)
  );
  
  c.set('userId', keyData.user_id);
  c.set('apiKeyId', keyData.id);
  c.set('permissions', JSON.parse(keyData.permissions));
  await next();
};
```

### Webhook Events

```typescript
// Segment-focused webhook events
type WebhookEvent = {
  type: 'segment.created' | 'segment.updated' | 'segment.members.added' | 
        'segment.members.removed' | 'segment.count.changed' |
        'activation.started' | 'activation.completed' | 'activation.failed';
  userId: string;
  segmentId: string;
  data: {
    segmentName?: string;
    memberIds?: string[];
    oldCount?: number;
    newCount?: number;
    platform?: 'google_ads' | 'facebook' | 'tiktok';
    activationId?: string;
    error?: string;
  };
  timestamp: string;
};

// Trigger webhooks with filtering
export const triggerSegmentWebhook = async (
  env: CloudflareEnv, 
  event: WebhookEvent
) => {
  // Get webhooks that match this event
  const webhooks = await env.DB.prepare(`
    SELECT * FROM webhooks 
    WHERE user_id = ? 
    AND active = 1
    AND (segment_ids IS NULL OR json_array_contains(segment_ids, ?))
    AND json_array_contains(events, ?)
  `).bind(event.userId, event.segmentId, event.type).all();
  
  // Queue for delivery with signature
  for (const webhook of webhooks.results) {
    const payload = JSON.stringify(event);
    const signature = await createHmacSignature(payload, webhook.secret);
    
    await env.WEBHOOK_QUEUE.send({
      webhookId: webhook.id,
      url: webhook.url,
      headers: {
        'X-Cutty-Signature': signature,
        'X-Cutty-Event': event.type
      },
      payload,
      attempt: 0
    });
  }
};
```

## Frontend Components

### API Key Management (Enhanced Settings)
```jsx
// Enhanced API key section in settings:
// - Table with: name, permissions, segments, usage stats, last used
// - "Generate API Key" modal with:
//   - Permission checkboxes (segments:read, activations:read, etc)
//   - Segment selector (all or specific segments)
//   - Rate limit override option
// - Copy key on creation (one-time view)
// - Edit permissions for existing keys
// - Usage sparkline chart per key
```

### Developer Portal
```jsx
// Interactive developer portal at /developers:
// - Live API explorer (try endpoints with test data)
// - Segment query language documentation
// - WebSocket connection examples
// - Webhook endpoint tester
// - SDK downloads and examples
// - Platform activation requirements (Google/FB/TikTok)
```

### Webhook Configuration
```jsx  
// Webhook management UI:
// - Add webhook URL with event selection
// - Test webhook delivery with sample payloads
// - View delivery history and retry failed webhooks
// - Segment filtering options
```

## Security

- API keys hashed with per-user salt + global API_KEY_SALT
- Webhook signatures using HMAC-SHA256 with timestamp
- Granular rate limiting per endpoint type
- Row-level security for segment data access
- PII compliance for member data (hashing for platforms)
- Audit logging for all data access

## Implementation Notes

### Phase 1: Core Segment API
1. Extend existing segment routes for public access
2. Add API key auth with basic permissions
3. Implement cursor pagination for large segments
4. Add segment count caching layer

### Phase 2: Real-time Features  
1. Expose existing WebSocket infrastructure from UI
2. Add WebSocket auth via API key
3. Implement webhook delivery queue
4. Add event batching for efficiency

### Phase 3: Platform Integration
1. Expose activation status endpoints
2. Add platform-specific compliance (hashing)
3. Implement incremental sync endpoints
4. Add activation webhook events

### Reuse from Existing Specs
- Segment engine from spec 1.5/2.0
- WebSocket infrastructure from spec 2.0
- Durable Objects for real-time updates
- Platform activation queues
- Existing security middleware patterns