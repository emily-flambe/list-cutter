# Design Document

## Overview

The synthetic data generator will be implemented as a new feature within the existing list-cutter Django application. It will provide users with the ability to generate realistic but completely fake voter file data for testing and development purposes. The feature will integrate seamlessly with the existing file management system, allowing generated data to be saved, managed, and used with the existing CSV cutting functionality.

## Architecture

### Backend Architecture

The synthetic data generator will follow the existing Django REST API pattern:

- **Models**: Extend existing `SavedFile` model to handle synthetic data metadata
- **Views**: New API endpoints for data generation and customization
- **Services**: Core data generation logic separated into service classes
- **Integration**: Generated files will be saved using the existing file management system

### Frontend Architecture

The frontend will add a new React component integrated into the existing Material-UI based interface:

- **New Route**: `/generate_data` for the synthetic data generator interface
- **Component**: `SyntheticDataGenerator.jsx` with form controls for customization
- **Integration**: Generated files will appear in the existing file management interface

## Components and Interfaces

### Backend Components

#### 1. Data Generation Service (`app/list_cutter/services/synthetic_data_service.py`)

```python
class SyntheticDataService:
    def generate_voter_data(self, count: int, options: dict) -> List[dict]
    def generate_names(self, count: int, diversity: bool = True) -> List[tuple]
    def generate_addresses(self, count: int, state_filter: str = None) -> List[dict]
    def generate_contact_info(self, count: int) -> List[dict]
    def export_to_csv(self, data: List[dict], filename: str) -> str
```

#### 2. API Views (`app/list_cutter/views_synthetic.py`)

```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_synthetic_data(request)

@api_view(['GET'])
def get_generation_options(request)
```

#### 3. Data Models

Extend existing `SavedFile` model metadata to include synthetic data generation parameters:

```python
# Metadata structure for synthetic files
{
    "generation_type": "synthetic_voter_data",
    "generation_params": {
        "count": 1000,
        "state_filter": "CA",
        "include_fields": ["name", "address", "phone", "email"],
        "generated_at": "2025-01-16T10:00:00Z"
    }
}
```

### Frontend Components

#### 1. Synthetic Data Generator Component

```jsx
// app/frontend/src/components/SyntheticDataGenerator.jsx
const SyntheticDataGenerator = () => {
    // Form controls for:
    // - Record count selection
    // - Geographic filtering
    // - Field selection
    // - Data distribution options
    // - Generation and download
}
```

#### 2. Navigation Integration

Update existing navigation to include synthetic data generation option.

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

```python
# Standard error response format
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

- **File System Integration**: Test file saving and retrieval
- **Database Integration**: Test SavedFile record creation
- **Authentication**: Test permission requirements
- **End-to-End**: Test complete generation workflow

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