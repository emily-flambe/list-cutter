# PRD 1.5: Segmentation MVP - Fast Track to Real-time

## Overview
Bridge the gap between simple CSV storage and full real-time segmentation by building a working MVP that demonstrates incremental processing and platform activation without over-engineering.

## Goals
- Ship working segmentation in 1-2 weeks
- Prove incremental processing concept
- Demo platform activation with Google Ads
- Avoid premature optimization

## Core Features

### 1. Simple Segment Builder
- Basic UI with field/operator/value inputs
- AND/OR logic (flat, no nesting)
- Save segment definitions to D1
- Real-time count preview (scan up to 10K rows)

### 2. Smart Change Tracking
- On CSV upload: Store each row in D1 with `created_at`
- On row update: Set `updated_at` timestamp
- Simple index on timestamps for fast queries

### 3. Incremental Processing (The Magic)
```typescript
// Instead of complex Durable Objects, use simple SQL
async function processRecentChanges() {
  // Get segments that need updating
  const segments = await db.prepare(`
    SELECT * FROM segments 
    WHERE last_processed < datetime('now', '-1 minute')
  `).all();
  
  for (const segment of segments) {
    // Only look at records changed since last run
    const newMembers = await db.prepare(`
      SELECT * FROM csv_data 
      WHERE file_id = ? 
      AND updated_at > ?
      AND ${buildWhereClause(segment.query)}
    `).all(segment.file_id, segment.last_processed);
    
    // Update membership table
    await updateMemberships(segment.id, newMembers);
    
    // Queue for platform sync
    if (segment.activation_enabled) {
      await queueActivation(segment.id, newMembers);
    }
  }
}
```

### 4. Google Ads Activation Only
- Single platform to start
- Use Customer Match API
- Batch uploads every 5 minutes
- Simple OAuth flow

### 5. Basic Real-time UI
- Server-Sent Events (simpler than WebSocket)
- Update counts every 10 seconds
- Show "last synced" timestamp

## What We're NOT Building (Yet)
- ❌ Durable Objects
- ❌ Complex queueing systems  
- ❌ Multiple platform integrations
- ❌ Streaming CSV processing
- ❌ Sub-second updates

## Database Schema (Simplified)

```sql
-- Store CSV data in D1 for querying
CREATE TABLE csv_data (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id)
);

CREATE INDEX idx_csv_timestamps ON csv_data(file_id, updated_at);

-- Simple membership tracking
CREATE TABLE segment_members (
  segment_id TEXT,
  record_id TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (segment_id, record_id)
);

-- Activation queue (simple)
CREATE TABLE activation_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segment_id TEXT,
  record_ids TEXT, -- JSON array
  platform TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Implementation Timeline

### Day 1-2: Data Foundation
- Modify CSV upload to store rows in D1
- Add change tracking columns
- Create indexes for performance

### Day 3-4: Segment Engine
- Query builder UI (use existing React components)
- Segment evaluation logic
- Membership tracking

### Day 5-6: Incremental Processing
- Cron job for processing changes
- Update membership tables
- Basic count caching

### Day 7-8: Google Ads Integration
- OAuth flow (use existing auth patterns)
- Customer Match API client
- Batch upload from queue

### Day 9-10: Polish
- Server-Sent Events for UI updates
- Error handling
- Basic monitoring

## Why This Works

1. **D1 can handle it**: Modern SQLite is fast for <10M rows
2. **Incremental by default**: Timestamp-based queries are simple
3. **No distributed systems**: Everything runs in one Worker
4. **Proven patterns**: Similar to how Segment started
5. **Demo-able quickly**: Shows real value without complexity

## Success Metrics
- Process 100K row changes in <30 seconds
- Sync to Google Ads within 5 minutes
- Handle 10 segments updating concurrently
- Zero external dependencies

## Next Steps After MVP
Once this works, THEN add:
- More platforms (Facebook, TikTok)
- Real-time WebSocket updates
- Durable Objects for scale
- Streaming processing
- Complex nested queries

The key: Ship something that works, then iterate based on real usage.