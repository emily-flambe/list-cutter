## PRD 4: Cutty Segmentation API Platform

### Overview
Expose Cutty's powerful real-time segmentation engine via public API, enabling partners to access dynamic segments, monitor platform activations, and receive real-time updates on audience changes.

### Goals
- Enable partners to access dynamic segments and their members via API
- Provide real-time updates via WebSocket and webhooks for segment changes
- Share platform activation status (Google Ads, Facebook, TikTok)
- Support both batch and streaming access patterns

### User Stories

**Third-party Developer**
- As a developer, I want to query dynamic segments via API to sync audiences with my platform
- As a developer, I want real-time updates when segment membership changes
- As a developer, I want to know when segments are synced to advertising platforms
- As a developer, I want to subscribe to specific segments for streaming updates

**Campaign Platform Partner**  
- As a partner, I want to pull segment members incrementally to minimize data transfer
- As a partner, I want to check activation status across Google/Facebook/TikTok
- As a partner, I want webhooks for critical segment events

**Cutty Power User**
- As a power user, I want API access to create and manage segments programmatically
- As a user, I want to monitor API usage across my segments
- As a user, I want fine-grained control over which segments are exposed via API

### Functional Requirements

**API Design**

*RESTful Endpoints*
- Segments:
  - GET /api/v1/public/segments - List all segments with metadata
  - GET /api/v1/public/segments/{id} - Get segment details and query definition
  - GET /api/v1/public/segments/{id}/members - Get segment members (paginated, with changes since timestamp)
  - GET /api/v1/public/segments/{id}/count - Get real-time member count
  - GET /api/v1/public/segments/{id}/activations - Platform sync status
  - POST /api/v1/public/segments/{id}/export - Export segment as CSV
  - POST /api/v1/public/segments - Create new segment (v1.1)
  - PATCH /api/v1/public/segments/{id} - Update segment query (v1.1)

- Lists (backward compatibility):
  - GET /api/v1/public/lists - Get static lists
  - GET /api/v1/public/lists/{id}/items - Get list items

*WebSocket Endpoints*
- WS /api/v1/public/segments/{id}/stream - Real-time member updates
- WS /api/v1/public/segments/updates - All segment change notifications

*Webhook System*
- Event types:
  - segment.created
  - segment.updated (query changed)
  - segment.members.added (with member IDs)
  - segment.members.removed (with member IDs) 
  - segment.count.changed (with old/new count)
  - activation.started (platform sync began)
  - activation.completed (with success/failure status)
  - activation.failed (with error details)
- Advanced webhook features:
  - Filter by segment IDs
  - Batch multiple events
  - Include change deltas in payload

**Developer Experience**

*Documentation*
- Interactive API docs at /developers with real-time testing
- Segment query language reference
- Platform activation guide (Google/FB/TikTok requirements)
- Code examples: JavaScript/Python SDKs, webhook handlers
- Migration guide from static lists to dynamic segments

*API Key Management*
- Generate up to 10 API keys with custom permissions
- Scope keys to specific segments or all segments
- Monitor usage per segment and endpoint
- Set rate limits per key
- API key analytics dashboard

**Authentication & Authorization**

*Authentication*
- API keys in X-API-Key header for REST
- API key as query param for WebSocket connections
- Optional JWT tokens for user-delegated access (v1.1)

*Permissions Model*
- Read permissions:
  - segments:read - View segment definitions
  - segments:members:read - Access member data
  - activations:read - View platform sync status
- Write permissions (v1.1):
  - segments:write - Create/update segments
  - segments:delete - Delete segments
- Granular segment-level permissions

*Security*
- API keys hashed with per-user salt
- Segment data includes PII - enforce HTTPS
- Rate limiting by endpoint type
- Audit log with data access tracking

**Performance & Reliability**

*Rate Limiting*
- Standard endpoints: 1000 requests/hour
- Segment member endpoints: 100 requests/hour (data intensive)
- WebSocket connections: 10 concurrent per key
- Activation status: 5000 requests/hour (lightweight)
- Burst allowance for webhook receipt confirmation

*Response Format*
- JSON responses with consistent structure
- Cursor-based pagination for large segments
- Include ETag for efficient caching
- Streaming JSON for bulk exports
- Delta responses for incremental syncs

*Real-time Performance*
- WebSocket latency < 100ms for segment updates
- Webhook delivery < 1 second from event
- Support 10,000+ concurrent WebSocket connections

### Non-Functional Requirements

**Performance**
- Leverage Durable Objects for real-time segment queries
- Use D1 for segment definitions and metadata
- WebSocket connections via Durable Objects
- Queue webhook delivery for reliability
- Cache segment counts aggressively

**Scalability**
- Support 1000+ API consumers
- Handle 1M+ segment member queries/day
- Stream updates to 10K+ WebSocket clients
- Process 100K+ webhook events/hour

**Security**
- End-to-end encryption for PII data
- Row-level security for segment access
- GDPR-compliant data access logs
- Platform-specific compliance (FB/Google hashing)

**Monitoring**
- Real-time API performance dashboard
- Segment access heat map
- WebSocket connection metrics
- Platform activation success rates
- Webhook delivery analytics

### Success Metrics
- 25+ platform integrations using segmentation API
- < 500ms p95 latency for segment queries
- 99.9% webhook delivery success rate
- 50% of API traffic using real-time features
- Average segment sync time < 30 seconds

### Out of Scope (v1)
- Natural language segment creation
- Segment performance predictions
- Custom webhook transformations
- GraphQL API
- Segment sharing between accounts