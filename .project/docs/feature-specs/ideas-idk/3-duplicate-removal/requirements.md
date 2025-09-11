## PRD 3: Duplicate Removal During Import

### Overview
Add a simple, automatic duplicate removal option to Cutty's CSV import process to clean lists before they're saved.

### Goals
- Remove exact duplicate records during import
- Provide clear feedback on duplicates found and removed
- Zero configuration required - it just works
- No performance impact on import process

### User Stories

**List Manager**
- As a list manager, I want duplicate records automatically removed when I import a CSV
- As a list manager, I want to see how many duplicates were removed
- As a list manager, I want the option to keep duplicates if needed

### Functional Requirements

**Duplicate Detection**
- Detect exact matches on email address (case-insensitive)
- Detect exact matches on phone number (normalized)
- Option to detect on name + address combination
- Process happens during import, not as separate step

**User Interface**
- Single checkbox on import screen: "Remove duplicate records"
- Post-import summary: "Imported 1,234 records (89 duplicates removed)"
- Checkbox remembers user's last preference

**Duplicate Rules**
- Email match: Exact match after lowercasing and trimming
- Phone match: Exact match after removing all non-digits
- When duplicate found, keep the first occurrence
- Count duplicates but don't show individual records

### Non-Functional Requirements

**Performance**
- No noticeable slowdown for imports up to 100k records
- Less than 1 second additional processing time
- Memory efficient - stream processing, not loading all in memory

**Simplicity**
- No configuration screens
- No review process
- No confidence scores
- No manual intervention

### Success Metrics
- 80% of users enable duplicate removal
- Average 5-10% duplicates removed per import
- Zero support tickets about the feature

### Out of Scope
- Fuzzy matching (similar names, typos)
- Manual review of duplicates
- Merge strategies (which record to keep)
- Cross-list deduplication
- Household detection
- Any form of identity resolution