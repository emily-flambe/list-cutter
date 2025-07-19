# Design Document

## Overview

The synthetic data generator will be implemented as a new feature within the existing Cloudflare Workers application. It will provide users with the ability to generate realistic but completely fake voter file data for testing and development purposes. The feature will integrate seamlessly with the existing file management system using D1 database and R2 storage, allowing generated data to be saved, managed, and used with the existing CSV cutting functionality.

## Architecture

### Backend Architecture

The synthetic data generator will follow the existing Cloudflare Workers + Hono.js pattern:

- **Routes**: New Hono.js route handlers for data generation endpoints
- **Services**: Core data generation logic in TypeScript service classes
- **Storage**: Generated CSV files stored in R2 bucket with metadata in D1 database
- **Integration**: Generated files integrate with existing file management system

### Frontend Architecture

The frontend will add a new React component integrated into the existing Material-UI based interface:

- **New Route**: `/generate_data` for the synthetic data generator interface
- **Component**: `SyntheticDataGenerator.jsx` with form controls for customization
- **Integration**: Generated files will appear in the existing file management interface

## Components and Interfaces

### Backend Components

#### 1. Synthetic Data Generation Service (`cloudflare/workers/src/services/synthetic-data-service.ts`)

```typescript
export class SyntheticDataService {
  constructor(
    private db: D1Database,
    private storage: R2Bucket,
    private analytics?: AnalyticsEngineDataset
  ) {}

  async generateVoterData(options: GenerationOptions): Promise<VoterRecord[]>
  async generateNames(count: number, diversity: boolean = true): Promise<NameData[]>
  async generateAddresses(count: number, stateFilter?: string): Promise<AddressData[]>
  async generateContactInfo(count: number): Promise<ContactData[]>
  async exportToCsv(data: VoterRecord[], filename: string): Promise<string>
  async saveGeneratedFile(csvContent: string, metadata: GenerationMetadata, userId: string): Promise<FileRecord>
}
```

#### 2. Route Handler (`cloudflare/workers/src/routes/synthetic-data.ts`)

```typescript
import { Hono } from 'hono';
import type { CloudflareEnv } from '../types/env';

const app = new Hono<{ Bindings: CloudflareEnv }>();

app.post('/api/v1/synthetic-data/generate', async (c) => {
  // Generate synthetic data with validation and security checks
});

app.get('/api/v1/synthetic-data/options', async (c) => {
  // Return available generation options and limits
});

export default app;
```

#### 3. Data Models

Extend existing D1 database schema to include synthetic data generation metadata:

```sql
-- Add columns to saved_files table for synthetic data
ALTER TABLE saved_files ADD COLUMN generation_type TEXT;
ALTER TABLE saved_files ADD COLUMN generation_params TEXT; -- JSON string

-- Example metadata structure
{
  "generation_type": "synthetic_voter_data",
  "generation_params": {
    "count": 1000,
    "state_filter": "CA",
    "include_fields": ["name", "address", "phone", "email"],
    "generated_at": "2025-01-16T10:00:00Z",
    "diversity_enabled": true,
    "data_version": "v1.0"
  }
}
```

### Frontend Components

#### 1. Synthetic Data Generator Component

```jsx
// Frontend component integrated with existing Material-UI theme
const SyntheticDataGenerator = () => {
    // Form controls for:
    // - Record count selection (1-10,000)
    // - Geographic filtering (state selection)
    // - Field selection checkboxes
    // - Data distribution options
    // - Generation and download buttons
}
```

#### 2. Navigation Integration

Update existing navigation to include synthetic data generation option in the main menu.

## Data Models

### Synthetic Voter Record Structure

```csv
voter_id,first_name,last_name,middle_initial,suffix,date_of_birth,gender,party_affiliation,registration_date,street_address,city,state,zip_code,phone_number,email_address,precinct,district,status
```

### Field Specifications

- **voter_id**: Sequential numeric ID with random prefix
- **Names**: Diverse first/last names from multiple cultural backgrounds
- **Addresses**: Realistic street addresses with proper formatting
- **Geographic**: Valid city/state/ZIP combinations
- **Contact**: Properly formatted phone numbers and email addresses
- **Political**: Realistic party affiliations and registration dates
- **Demographics**: Age-appropriate birth dates and gender distribution

### Data Sources

The service will use embedded datasets for:
- Common first names (diverse cultural backgrounds)
- Common last names (diverse cultural backgrounds)  
- US cities and ZIP codes by state
- Street name patterns and address formats
- Email domain patterns for realistic addresses

## Error Handling

### Input Validation

- Record count limits (1-10,000 records per generation)
- State code validation against valid US state abbreviations
- Field selection validation against available columns
- Rate limiting for large dataset generation

### Error Responses

```typescript
// Standard error response format
{
  "error": "Invalid record count. Must be between 1 and 10,000.",
  "code": "INVALID_COUNT", 
  "details": {"provided": 50000, "max_allowed": 10000}
}
```

### Resource Management

- Progress tracking for large dataset generation
- Cleanup of temporary files on generation failure
- Memory management for large dataset processing
- Timeout handling for long-running operations

## Testing Strategy

### Unit Tests

- **Data Generation Logic**: Test individual data generation functions
- **Validation**: Test input validation and error handling
- **CSV Export**: Test CSV formatting and file creation
- **API Endpoints**: Test request/response handling

### Integration Tests

- **R2 Storage Integration**: Test file saving and retrieval from R2 bucket
- **D1 Database Integration**: Test saved_files record creation and queries
- **Authentication**: Test JWT token validation and user permissions
- **End-to-End**: Test complete generation workflow from API to storage

### Test Data Scenarios

- Small datasets (< 100 records)
- Medium datasets (1,000 records)
- Large datasets (10,000 records)
- Various geographic filters
- Different field combinations
- Error conditions and edge cases

### Performance Testing

- Generation time benchmarks for different dataset sizes
- Memory usage monitoring during generation
- Concurrent request handling
- File system performance with large files

## Security Considerations

### Data Privacy

- All generated data must be clearly synthetic and non-identifiable
- No real personal information should be used as source data
- Generated data should not accidentally match real individuals

### Access Control

- Feature requires user authentication
- Generated files are associated with the creating user
- Standard file access permissions apply

### Rate Limiting

- Limit generation requests per user per time period
- Prevent abuse through large dataset generation
- Monitor system resource usage

## Performance Considerations

### Generation Optimization

- Batch processing for large datasets
- Efficient random data generation algorithms
- Memory-efficient CSV writing for large files
- Progress indicators for user feedback

### Caching Strategy

- Cache common data sources (names, addresses)
- Reuse geographic data across generations
- Optimize repeated pattern generation

### Resource Management

- Streaming CSV generation for large datasets
- Temporary file cleanup
- Memory usage monitoring
- Background processing for large requests

## Integration Points

### Existing File Management

- Generated files integrate with existing `SavedFile` model
- Files appear in standard file listing interfaces
- Standard file operations (delete, download, tag) apply
- File lineage tracking for generated data

### CSV Cutting Integration

- Generated CSV files work with existing CSV cutting functionality
- Standard column detection and filtering apply
- Generated files can be used as source data for list cutting

### User Interface Integration

- New navigation option for synthetic data generation
- Consistent styling with existing Material-UI theme
- Standard error handling and user feedback patterns
- Integration with existing authentication flow