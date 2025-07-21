# Synthetic Data Generator API Documentation

## Overview
The Synthetic Data Generator API provides endpoints for generating realistic fake voter data for testing purposes. The API supports both authenticated and anonymous usage.

## Base URL
```
https://api.cutty.app/api/v1/synthetic-data
```

## Endpoints

### Generate Synthetic Data
Generate synthetic voter records with customizable parameters.

**Endpoint:** `POST /api/v1/synthetic-data/generate`

**Authentication:** Optional (anonymous users allowed)

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer <token> (optional)
```

**Request Body:**
```json
{
  "count": 100,        // Required: Number of records (1-1000)
  "states": ["CA", "TX"]  // Optional: Array of 2-letter state codes
}
```

**Response (Success - 200):**
```json
{
  "file": {
    "id": "uuid-string",
    "fileName": "synthetic_data_2025-01-21.csv",
    "fileSize": 12345,
    "downloadUrl": "/api/v1/synthetic-data/download/uuid-string"
  },
  "metadata": {
    "recordCount": 100,
    "states": ["CA", "TX"],
    "generatedAt": "2025-01-21T10:30:00Z"
  }
}
```

**Response (Error - 400):**
```json
{
  "error": "Count must be between 1 and 1000"
}
```

**Generated CSV Format:**
```csv
voter_id,first_name,last_name,middle_name,date_of_birth,gender,street_address,city,state,zip_code,phone_number,email
CA-2025-000001,John,Smith,Michael,1975-03-15,M,123 Main St,Los Angeles,CA,90001,213-555-0123,john.smith@email.com
```

**Field Descriptions:**
- `voter_id`: State-prefixed unique identifier (format: XX-YYYY-NNNNNN)
- `first_name`: Common first name
- `last_name`: Common surname
- `middle_name`: Middle name or initial
- `date_of_birth`: Date between 1930-2005
- `gender`: M or F
- `street_address`: Realistic street address
- `city`: Real city name for the state
- `state`: 2-letter state code
- `zip_code`: Valid ZIP code for city/state
- `phone_number`: Area code matching the location
- `email`: Generated from name

### Download Synthetic Data
Download a previously generated synthetic data file.

**Endpoint:** `GET /api/v1/synthetic-data/download/{fileId}`

**Authentication:** Not required

**Response:** CSV file download

**Error Response (404):**
```json
{
  "error": "File not found"
}
```

### Get Supported States
Retrieve list of states with available location data.

**Endpoint:** `GET /api/v1/synthetic-data/supported-states`

**Authentication:** Not required

**Response (Success - 200):**
```json
{
  "states": [
    {"code": "AL", "name": "Alabama"},
    {"code": "CA", "name": "California"},
    {"code": "TX", "name": "Texas"}
    // ... all supported states
  ]
}
```

## Rate Limiting
- Anonymous users: No current rate limiting (recommended: 5 requests/minute)
- Authenticated users: Standard API rate limits apply

## Error Codes
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (file does not exist)
- `500` - Internal Server Error

## Usage Examples

### Generate 100 Records for California
```bash
curl -X POST https://api.cutty.app/api/v1/synthetic-data/generate \
  -H "Content-Type: application/json" \
  -d '{"count": 100, "states": ["CA"]}'
```

### Generate 500 Records Across Multiple States
```bash
curl -X POST https://api.cutty.app/api/v1/synthetic-data/generate \
  -H "Content-Type: application/json" \
  -d '{"count": 500, "states": ["CA", "TX", "FL", "NY"]}'
```

### Download Generated File
```bash
curl -O https://api.cutty.app/api/v1/synthetic-data/download/your-file-id
```

## Notes
- Files are stored temporarily and may be deleted after 24 hours
- For anonymous users, file metadata is not persisted to the database
- Geographic data (cities, ZIP codes, area codes) uses real location data for realism
- Records are evenly distributed across selected states