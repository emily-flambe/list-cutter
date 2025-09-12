
---

## PRD 2: Dynamic Segmentation Engine - Performance & Scale

### Overview
Building on the MVP segmentation (Spec 1.5), enhance the system to handle enterprise-scale data volumes, add multi-platform activation, and achieve true real-time performance.

### Prerequisites
- Spec 1.5 fully implemented and working
- D1-based segmentation proven successful
- Google Ads integration validated

### Goals
- Scale from 100K to 10M+ records
- Reduce update latency from minutes to seconds
- Add Facebook and TikTok activation
- Enable true real-time UI updates

### User Stories

**Data Analyst**
- As an analyst, I want to create a segment of "customers in California who made purchases in the last 30 days" without writing code
- As an analyst, I want my segments to automatically update when new data is imported
- As an analyst, I want to save and reuse segment definitions
- As an analyst, I want to see segment size in real-time as I build queries

**List Manager**
- As a list manager, I want to create complex segments combining multiple conditions (AND/OR logic)
- As a list manager, I want to track how segment sizes change over time
- As a list manager, I want to export filtered segments as CSV files

### Enhancements from Spec 1.5

**Performance Optimizations**
- Migrate hot segments to Durable Objects for sub-second updates
- Implement change data capture for real-time processing
- Add WebSocket support for live UI updates
- Optimize D1 queries with materialized views

**Query Builder Enhancements** (building on 1.5)
- Nested condition groups (was flat AND/OR)
- Custom formula fields
- Segment composition (combine segments)
- Time-based conditions ("in last X days")
- Cross-file segment joins

**Segment Management**
- Save segments with:
  - Name and description
  - Tags for organization
  - Owner assignment
  - Created/modified timestamps
- Segment templates for common use cases:
  - "High-value customers from last quarter"
  - "Inactive users for re-engagement"
  - "Records with missing email addresses"
- Duplicate segment functionality
- Version history for segment definitions

**Multi-Platform Activation** (new in 2.0)
- Add Facebook Custom Audiences
- Add TikTok Audience Partners
- Unified field mapping interface
- Platform-specific compliance (hashing, consent)
- Sync status dashboard across all platforms

**Real-time Infrastructure** (upgrade from 1.5)
- WebSocket replaces Server-Sent Events
- Durable Objects for distributed processing
- Queue system replaces simple activation_queue table
- Sub-second updates for segments under 100K members

**Performance Optimization**
- Segment calculation strategies:
  - Materialized views for complex queries
  - Incremental updates when possible
  - Query optimization hints
- Background processing for large segments
- Progress indicators for long-running calculations

**Segment Analytics**
- Dashboard showing:
  - Segment size over time (line chart)
  - Overlap analysis between segments
  - Engagement metrics by segment
  - Segment performance (query execution time)

**Export & Integration**
- Export formats:
  - CSV with selected fields
  - JSON for API consumption
  - Direct integration with connected platforms
- Scheduled exports (daily, weekly)
- Export history and audit trail

### Non-Functional Requirements

**Performance** (improvements from 1.5)
- Segment updates in < 100ms (was 1 minute)
- Handle 10M+ records (was 100K)
- Support 1000+ active segments (was 100)
- Platform sync in < 5 seconds (was 5 minutes)

**Usability**
- No SQL knowledge required for 90% of use cases
- Tooltips and inline help for all features
- Keyboard shortcuts for power users
- Mobile-responsive design

**Scalability**
- Support segments up to 5M records
- Handle 1000+ concurrent segment queries
- Automatic query optimization for complex conditions

### Success Metrics
- Average segment creation time < 3 minutes
- 80% of users create 5+ segments in first month
- < 1% error rate in segment calculations
- 95% of segments update within SLA

### Migration from 1.5 to 2.0

**Data Migration**
- Keep D1 as primary storage (proven in 1.5)
- Add Durable Objects for hot segments only
- Maintain backward compatibility

**Feature Migration**
- SSE endpoints remain, add WebSocket option
- Simple queue table remains, add advanced queue for scale
- Google Ads stays primary, add other platforms

### Out of Scope (v2)
- Machine learning-based segment suggestions
- Predictive segment sizing
- Natural language query creation
- Complete rewrite of 1.5 architecture
