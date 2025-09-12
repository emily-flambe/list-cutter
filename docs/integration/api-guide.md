---
title: API Integration Guide
category: Integration
keywords: api, integration, automation, programmatic access, rest api
difficulty: advanced
---

# API Integration Guide

## Programmatic Access to Cutty

Learn how to integrate Cutty's CSV processing capabilities into your applications using our REST API.

## Getting Started

### API Endpoint
All API requests go to:
```
https://cutty.emilycogsdill.com/api/v1/
```

### Authentication
Most endpoints require authentication using JWT tokens.

#### Get Authentication Token
```bash
curl -X POST https://cutty.emilycogsdill.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-uuid",
    "email": "your-email@example.com"
  }
}
```

#### Using the Token
Include the token in all authenticated requests:
```bash
-H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Core API Endpoints

### File Operations

#### Upload File
```bash
curl -X POST https://cutty.emilycogsdill.com/api/v1/files/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@your-file.csv"
```

Response:
```json
{
  "fileId": "file-uuid",
  "filename": "your-file.csv",
  "size": 1024567,
  "rows": 1500,
  "columns": 12
}
```

#### List Files
```bash
curl -X GET https://cutty.emilycogsdill.com/api/v1/files \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Download File
```bash
curl -X GET https://cutty.emilycogsdill.com/api/v1/files/{fileId} \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o output.csv
```

#### Delete File
```bash
curl -X DELETE https://cutty.emilycogsdill.com/api/v1/files/{fileId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Processing Operations

#### Process CSV with Filters
```bash
curl -X POST https://cutty.emilycogsdill.com/api/v1/files/process \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "file-uuid",
    "columns": ["name", "email", "date"],
    "filters": [
      {
        "column": "date",
        "operator": ">",
        "value": "2024-01-01"
      }
    ]
  }'
```

#### Export Processed Data
```bash
curl -X POST https://cutty.emilycogsdill.com/api/v1/files/export \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "file-uuid",
    "format": "csv",
    "includeHeaders": true
  }'
```

### Analysis Operations

#### Get File Statistics
```bash
curl -X GET https://cutty.emilycogsdill.com/api/v1/analysis/stats/{fileId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "rows": 1500,
  "columns": 12,
  "columnStats": [
    {
      "name": "age",
      "type": "number",
      "min": 18,
      "max": 65,
      "mean": 34.5,
      "nullCount": 5
    }
  ]
}
```

#### Generate Crosstab
```bash
curl -X POST https://cutty.emilycogsdill.com/api/v1/files/crosstab \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "file-uuid",
    "rowVariable": "region",
    "columnVariable": "product"
  }'
```

### Synthetic Data Generation

#### Generate Test Data
```bash
curl -X POST https://cutty.emilycogsdill.com/api/v1/synthetic-data/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rows": 1000,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "name",
        "type": "fullName"
      },
      {
        "name": "email",
        "type": "email"
      },
      {
        "name": "age",
        "type": "number",
        "min": 18,
        "max": 65
      }
    ]
  }'
```

## Public Endpoints (No Auth Required)

### Assistant Query
```bash
curl -X POST https://cutty.emilycogsdill.com/api/v1/assistant/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I upload a CSV file?"
  }'
```

### Health Check
```bash
curl -X GET https://cutty.emilycogsdill.com/api/v1/health
```

## Common Integration Patterns

### Pattern 1: Automated Daily Processing
```javascript
// Node.js example
const axios = require('axios');

async function dailyProcessing() {
  // 1. Login
  const loginResponse = await axios.post(
    'https://cutty.emilycogsdill.com/api/v1/auth/login',
    { email: 'user@example.com', password: 'password' }
  );
  const token = loginResponse.data.token;

  // 2. Upload file
  const formData = new FormData();
  formData.append('file', fs.createReadStream('daily-data.csv'));
  
  const uploadResponse = await axios.post(
    'https://cutty.emilycogsdill.com/api/v1/files/upload',
    formData,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const fileId = uploadResponse.data.fileId;

  // 3. Process with filters
  const processResponse = await axios.post(
    'https://cutty.emilycogsdill.com/api/v1/files/process',
    {
      fileId: fileId,
      filters: [
        { column: 'status', operator: '=', value: 'active' }
      ]
    },
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  // 4. Export results
  const exportResponse = await axios.post(
    'https://cutty.emilycogsdill.com/api/v1/files/export',
    { fileId: processResponse.data.fileId, format: 'csv' },
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  console.log('Processing complete:', exportResponse.data);
}
```

### Pattern 2: Python Integration
```python
import requests
import pandas as pd

class CuttyAPI:
    def __init__(self, email, password):
        self.base_url = 'https://cutty.emilycogsdill.com/api/v1'
        self.token = self.login(email, password)
        self.headers = {'Authorization': f'Bearer {self.token}'}
    
    def login(self, email, password):
        response = requests.post(
            f'{self.base_url}/auth/login',
            json={'email': email, 'password': password}
        )
        return response.json()['token']
    
    def upload_file(self, filepath):
        with open(filepath, 'rb') as f:
            files = {'file': f}
            response = requests.post(
                f'{self.base_url}/files/upload',
                files=files,
                headers=self.headers
            )
        return response.json()['fileId']
    
    def process_file(self, file_id, filters=None):
        data = {'fileId': file_id}
        if filters:
            data['filters'] = filters
        
        response = requests.post(
            f'{self.base_url}/files/process',
            json=data,
            headers=self.headers
        )
        return response.json()
    
    def download_result(self, file_id, output_path):
        response = requests.get(
            f'{self.base_url}/files/{file_id}',
            headers=self.headers
        )
        with open(output_path, 'wb') as f:
            f.write(response.content)

# Usage
cutty = CuttyAPI('user@example.com', 'password')
file_id = cutty.upload_file('data.csv')
result = cutty.process_file(file_id, filters=[
    {'column': 'amount', 'operator': '>', 'value': 100}
])
cutty.download_result(result['fileId'], 'filtered_data.csv')
```

### Pattern 3: Bash Script Automation
```bash
#!/bin/bash

# Configuration
EMAIL="user@example.com"
PASSWORD="password"
API_URL="https://cutty.emilycogsdill.com/api/v1"

# Login and get token
TOKEN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" \
  | jq -r '.token')

# Upload file
FILE_ID=$(curl -s -X POST "${API_URL}/files/upload" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@input.csv" \
  | jq -r '.fileId')

# Process file
PROCESSED_ID=$(curl -s -X POST "${API_URL}/files/process" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileId\": \"${FILE_ID}\",
    \"columns\": [\"name\", \"email\", \"amount\"],
    \"filters\": [
      {\"column\": \"amount\", \"operator\": \">\", \"value\": 100}
    ]
  }" | jq -r '.fileId')

# Download result
curl -s -X GET "${API_URL}/files/${PROCESSED_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -o "output.csv"

echo "Processing complete. Result saved to output.csv"
```

## Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "error": "Invalid or expired token"
}
```
**Solution**: Re-authenticate and get a new token.

#### 400 Bad Request
```json
{
  "error": "Invalid file format",
  "details": "File must be CSV, TSV, or TXT"
}
```
**Solution**: Check file format and request parameters.

#### 413 Payload Too Large
```json
{
  "error": "File too large",
  "maxSize": "50MB"
}
```
**Solution**: Split file into smaller chunks.

#### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```
**Solution**: Implement exponential backoff.

### Retry Logic Example
```javascript
async function apiCallWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response.json();
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 60;
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      throw new Error(`API error: ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

## Rate Limits

### Current Limits
- **Requests**: 100 per minute per user
- **Upload Size**: 50MB per file
- **Concurrent Uploads**: 5 files
- **Processing**: 10 concurrent operations

### Rate Limit Headers
Response headers include:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

## Best Practices

### Authentication
- Store tokens securely (environment variables, secure storage)
- Implement token refresh before expiry (24 hours)
- Never hardcode credentials in source code

### File Handling
- Validate files before upload
- Use streaming for large files
- Clean up temporary files after processing
- Implement progress tracking for uploads

### Error Handling
- Implement comprehensive error handling
- Log errors for debugging
- Provide user-friendly error messages
- Use exponential backoff for retries

### Performance
- Batch operations when possible
- Use async/parallel processing
- Cache frequently accessed data
- Monitor API usage and limits

## WebSocket Support (Coming Soon)

Future support for real-time operations:
```javascript
const ws = new WebSocket('wss://cutty.emilycogsdill.com/ws');
ws.on('message', (data) => {
  const update = JSON.parse(data);
  console.log('Processing progress:', update.progress);
});
```

## SDK Development

We're working on official SDKs for:
- JavaScript/TypeScript
- Python
- Go
- Ruby

Check our GitHub repository for updates.

## Support

For API support:
- Check API documentation
- Test with curl first
- Review error messages
- Contact support with request/response details