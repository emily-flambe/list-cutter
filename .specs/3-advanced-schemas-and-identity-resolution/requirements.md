
---

## PRD 3: Advanced Identity Resolution & Schema Management

### Overview
Extend Cutty's list management capabilities with intelligent duplicate detection and flexible field mapping to handle diverse data sources while maintaining the simplicity of the existing platform.

### Goals
- Achieve 90%+ accuracy in identifying duplicate records within uploaded lists
- Support flexible field mapping from common CSV formats
- Reduce manual deduplication effort by 80%
- Maintain Cutty's ease of use while adding power features

### User Stories

**Data Administrator**
- As a data admin, I want the system to automatically identify when "John Smith" in NGP VAN is the same person as "Johnny Smith" in MobilizeAmerica
- As a data admin, I want to review and adjust identity matches with confidence scores
- As a data admin, I want to define matching rules specific to my organization's needs
- As a data admin, I want to handle household vs. individual record relationships

**Campaign Operations**
- As ops staff, I want to map custom fields from our canvassing app to standard fields without engineering help
- As ops staff, I want to preserve all source data even when fields don't map perfectly
- As ops staff, I want to create computed fields based on multiple source fields

### Functional Requirements

**Identity Resolution Engine**

*Matching Algorithm*
- Multi-factor matching with simple configuration:
  - Name similarity (basic fuzzy matching)
  - Email matching (case-insensitive, trim whitespace)
  - Phone normalization (basic formatting)
  - Simple address matching
- Confidence scoring (0-100%) for each match
- Rule-based improvements based on user feedback

*Match Management Interface*
- Review queue for matches below confidence threshold
- Bulk actions for accepting/rejecting matches
- Match history and audit trail
- Ability to manually merge/unmerge records
- Household relationship detection and management

*Matching Rules Configuration*
- Simple toggle switches for matching criteria
- Pre-built templates for common use cases
- Basic rule priority ordering

**Flexible Schema Management**

*Dynamic Field Discovery*
- Automatic detection of new fields from source systems
- Field type inference (string, number, date, boolean, array)
- Field statistics (uniqueness, null percentage, value distribution)
- Change detection when source schemas evolve

*Field Mapping Interface*
- Simple dropdown mapping between CSV columns and Cutty fields
- Basic transformation functions:
  - Type conversion
  - String manipulation (uppercase, trim)
  - Date formatting
  - Simple value mapping
- Mapping templates for common formats (NGP VAN, MobilizeAmerica)
- Preview mapped data before import

*Custom Field Management*
- Create organization-specific fields
- Field grouping and categorization
- Field-level permissions
- Field usage analytics
- Deprecation workflow for unused fields

*Schema Versioning*
- Track schema changes over time
- Migration tools for schema updates
- Backwards compatibility for API consumers
- Schema documentation generation

**Data Quality Management**
- Automated data quality checks:
  - Email validation
  - Phone number formatting
  - Address standardization via USPS API
  - Duplicate detection within single source
- Data quality dashboard with scores by field
- Configurable validation rules
- Bulk data cleanup tools

**Conflict Resolution**
- Sophisticated merge strategies:
  - Most recent wins
  - Source priority ordering
  - Field-level merge rules
  - Manual override capability
- Conflict detection and notification
- Preview merge results before applying
- Undo/redo functionality

### Non-Functional Requirements

**Performance**
- Identity resolution for 100K records < 5 minutes
- Incremental matching for new records < 200ms
- Schema mapping UI responsive with 100+ fields
- Support schemas with 50+ custom fields per source

**Accuracy**
- 90%+ precision in identity matching
- 85%+ recall in finding true duplicates
- < 1% false positive rate for high-confidence matches

**Flexibility**
- Support any JSON-compatible data type
- Handle nested objects and arrays
- No hard limits on number of custom fields
- API-first design for all schema operations

### Success Metrics
- Duplicate record reduction of 85%+
- 90% of custom fields successfully mapped on first attempt
- Time to onboard new data source reduced by 75%
- Data quality scores improve by 40% on average

### Out of Scope (v1)
- Probabilistic record linkage with external data sources
- Automated schema mapping using AI
- Real-time streaming data ingestion
- Graph-based identity resolution
- Complex machine learning models
- Address standardization via external APIs (USPS)
- A/B testing for matching rules