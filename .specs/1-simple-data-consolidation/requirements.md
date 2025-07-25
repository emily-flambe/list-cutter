# Cutty Enhancement - Voter Data Consolidation

## PRD: Simple Data Import from Campaign Platforms

### Overview
Extend Cutty's CSV processing capabilities to import and consolidate voter contact data from 2-3 major campaign platforms, leveraging existing infrastructure for a unified view of records.

### Goals
- Import voter data from 2-3 platforms into Cutty's existing system
- Reduce manual CSV export/import cycles by 80%
- Provide simple consolidated view with 15-minute sync intervals

### User Stories

**Cutty User (Campaign Staff)**
- As a Cutty user, I want to connect my Listomatic and Contactics accounts so I can import voter data without manual CSV exports
- As a Cutty user, I want to see sync status in the existing file management interface
- As a Cutty user, I want to use Cutty's existing search to find consolidated voter records

**Data Manager**
- As a data manager, I want imported records to work with Cutty's existing CSV export features
- As a data manager, I want to see data source labels on imported records

### Functional Requirements

**Data Sources (Phase 1: 2 platforms)**
- Support OAuth/API key authentication for:
  - Listomatic (primary) - List management focused platform
  - Contactics (secondary) - Contact engagement platform
- Future: Additional fictional platforms as needed
- Reuse Cutty's existing error handling patterns
- Store credentials in existing user settings

**Data Import**
- Initial import (last 90 days of data)
- Scheduled sync every 15 minutes via Cloudflare Cron
- Manual sync button in file management UI
- Use existing file processing logs

**Platform Data Characteristics**

*Listomatic* - Focuses on list segmentation and targeting:
- Uses "segments" instead of tags
- Tracks "engagement_score" (0-100)
- Has "list_membership" array
- Uses compound names (full_name field)

*Contactics* - Emphasizes contact history and interactions:
- Tracks "interaction_count" and "last_interaction_type"
- Uses "contact_preference" (email/sms/phone)
- Has "activity_timeline" with touchpoints
- Separate mobile/landline phone fields

**Schema Mapping to Cutty's Person Records**
- Map to existing person_records table structure:
  - id → voter_id
  - firstName, lastName → parsed from full_name (Listomatic) or first_name, last_name (Contactics)
  - email → email_address (Listomatic) or primary_email (Contactics)
  - phone → primary_phone (Listomatic) or mobile_phone (Contactics)
  - city, state → city, state
  - Additional fields stored in metadata JSON:
    - engagement_score (Listomatic)
    - segments (Listomatic)
    - interaction_count (Contactics)
    - contact_preference (Contactics)
    - list_membership (Listomatic)
    - activity_timeline (Contactics)

**Data Display**
- Extend existing person records view:
  - Add "Source" column showing platform icon
  - Show last sync timestamp
  - Highlight conflicting data in UI
  
**Search & Filter**
- Use Cutty's existing search functionality
- Add new filter: "Data Source" dropdown
- Existing filters work on imported data

### Non-Functional Requirements

**Performance**
- Maintain Cutty's existing performance standards
- Search returns < 500ms (current Cutty SLA)
- Sync operations run in background workers

**Security**
- Use Cutty's existing JWT authentication
- Encrypt API credentials with Web Crypto API
- Follow existing security patterns

**Reliability**
- Use Cloudflare's infrastructure (existing)
- Leverage Workers retry mechanisms
- Store sync state in D1 for recovery

### Success Metrics
- Time to connect first data source < 3 minutes
- Users save 2+ hours/week on manual imports
- 95% successful sync rate
- Zero data corruption incidents

### Out of Scope (v1)
- Custom field mapping UI
- Complex deduplication beyond email matching
- Real-time webhooks
- More than 2 platform integrations
- Changes to Cutty's core architecture
