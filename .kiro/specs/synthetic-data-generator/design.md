# Design Document

## Overview

Synthetic data generator as a first-class feature in Cutty. Generate fake voter data for testing.

## Limits

- Max 1,000 records per request
- Simple rate limiting

## Architecture

### Backend
- Hono.js route: `/api/v1/synthetic-data/generate`
- Generate CSV data
- Save to R2 + D1 like other files

### Frontend
- Route: `/synthetic-data`
- Sidebar navigation item
- Simple form to generate data

## Implementation

### Backend
```typescript
// POST /api/v1/synthetic-data/generate
// Input: { count: number, state?: string }
// Output: CSV file saved to R2, returns file info
```

### Frontend
```jsx
// Simple form:
// - Number input (1-1000)
// - State dropdown (optional)
// - Generate button
// - Download link when done
```

### Navigation
Add to sidebar:
```jsx
{
  path: '/synthetic-data',
  label: 'Generate Data',
  icon: <DatasetIcon />
}
```

## Data Format

Generate CSV with columns:
```csv
voter_id,first_name,last_name,address,city,state,zip,phone,email
```

Use simple random data generation - names, addresses, phone numbers, emails.

## Simple Implementation Notes

- Validate count is 1-1000
- Generate random voter data
- Save as regular file in R2/D1
- Return file info for download