# API Agreements

## Overview

The Cutty API provides a comprehensive set of endpoints for list management, CSV processing, and file operations. Built on Cloudflare Workers for edge computing performance, the API follows RESTful principles with JWT-based authentication and robust security measures.

### Key Features
- **Edge Computing**: Sub-50ms response times globally via Cloudflare network
- **Secure Authentication**: JWT tokens with 24-hour expiry and OAuth 2.0 support
- **File Processing**: Handle CSV files up to 50MB with streaming support
- **Rate Limiting**: Multi-layered protection against abuse
- **API Versioning**: Future-proof design with v1 endpoints

## Base URL

### Production
```
https://cutty.emilycogsdill.com/api/v1
```

### Development
```
https://cutty-dev.emilycogsdill.com/api/v1
```

### API Version
All endpoints use versioned routing: `/api/v1/{domain}/{action}`

**Note**: Legacy `/api/{domain}/*` routes are maintained for backward compatibility but new integrations should use v1 endpoints.

## Authentication

### Bearer Token Authentication

Most API endpoints require authentication using JWT bearer tokens.

**Header Format:**
```
Authorization: Bearer {access_token}
```

**Token Structure:**
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "username": "username",
  "role": "user|admin",
  "exp": 1234567890
}
```

### Obtaining Tokens

#### 1. Email/Password Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "role": "user"
  },
  "tokens": {
    "access_token": "jwt_access_token",
    "refresh_token": "jwt_refresh_token"
  }
}
```

#### 2. Google OAuth
Initiate OAuth flow:
```http
GET /api/v1/auth/google
```

Handle callback:
```http
GET /api/v1/auth/google/callback?code={authorization_code}
```

### Token Refresh
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "jwt_refresh_token"
}
```

### Public Endpoints
The following endpoints do not require authentication:
- `GET /health` - Health check
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `GET /api/v1/auth/google` - OAuth initiation
- `GET /api/v1/auth/google/callback` - OAuth callback
- `GET /api/v1/synthetic-data/supported-states` - List supported states
- `POST /api/v1/synthetic-data/generate` - Generate synthetic data
- `GET /api/v1/synthetic-data/download/{fileId}` - Download synthetic data

## Rate Limiting

The API implements multi-layered rate limiting to ensure fair usage and prevent abuse.

### Rate Limit Tiers

#### Global API Rate Limit
- **Limit**: 60 requests per minute per IP address
- **Applies to**: All `/api/*` endpoints
- **Window**: 1 minute sliding window

#### Authentication Endpoints
- **Standard Auth**: 30 requests per minute
  - `/api/v1/auth/login`
  - `/api/v1/auth/register`
  - `/api/v1/auth/logout`
  - `/api/v1/auth/refresh`
- **User Profile**: 100 requests per minute
  - `/api/v1/auth/user` (higher limit for frequent checks)

### Rate Limit Headers

All API responses include rate limit information:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1609459200
```

### Rate Limit Exceeded Response

```json
{
  "error": "RateLimitExceeded",
  "message": "Too many requests",
  "retry_after": 30
}
```

**HTTP Status**: `429 Too Many Requests`

## Error Handling

### Standard Error Response Format

All API errors follow a consistent format:

```json
{
  "error": "ErrorType",
  "message": "Human-readable error description",
  "details": ["Additional context if available"],
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Common Error Codes

| HTTP Status | Error Type | Description |
|-------------|------------|-------------|
| 400 | `ValidationError` | Invalid request parameters or body |
| 401 | `UnauthorizedError` | Missing or invalid authentication token |
| 403 | `ForbiddenError` | Insufficient permissions for requested resource |
| 404 | `NotFoundError` | Resource not found |
| 409 | `ConflictError` | Resource already exists (e.g., duplicate email) |
| 413 | `PayloadTooLargeError` | Request body or file exceeds size limit |
| 429 | `RateLimitExceeded` | Too many requests |
| 500 | `InternalServerError` | Unexpected server error |

### Validation Error Example

```json
{
  "error": "ValidationError",
  "message": "Request validation failed",
  "details": [
    "email must be a valid email address",
    "password must be at least 8 characters"
  ],
  "code": "INVALID_REQUEST",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Request & Response Formats

### Content Types

- **Request**: `application/json` for most endpoints
- **File Upload**: `multipart/form-data`
- **Response**: `application/json` (except file downloads)

### Pagination

Endpoints returning lists support pagination:

**Request Parameters:**
- `limit` - Number of items per page (default: 50, max: 100)
- `offset` - Number of items to skip (default: 0)

**Response Format:**
```json
{
  "data": [...],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 150,
    "has_more": true
  }
}
```

### File Upload Requirements

**Constraints:**
- Maximum file size: 50MB
- Allowed MIME types:
  - `text/csv`
  - `application/vnd.ms-excel`
  - `text/plain`
- Allowed extensions: `.csv`, `.txt`, `.tsv`

**Request Example:**
```http
POST /api/v1/files/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="data.csv"
Content-Type: text/csv

[file content]
------WebKitFormBoundary--
```

## Security Considerations

### CORS Policy

**Development:**
- Allows `http://localhost:3000`
- Allows `http://localhost:5173`
- Credentials included

**Production:**
- Restricted to `https://cutty.emilycogsdill.com`
- Credentials included

### Security Headers

All API responses include security headers:
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### Input Sanitization

- Null bytes are stripped from all inputs
- Maximum input length: 10,000 characters
- Leading/trailing whitespace is trimmed
- File names are sanitized before storage

### Token Security

- Tokens expire after 24 hours
- Refresh tokens have separate expiry
- Tokens can be blacklisted on logout
- Tokens are validated on every request

## API Endpoints Reference

### Authentication (`/api/v1/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/login` | User login | No |
| POST | `/register` | Create account | No |
| POST | `/logout` | End session | Yes |
| POST | `/refresh` | Refresh tokens | No |
| GET | `/user` | Get profile | Yes |
| GET | `/google` | Start OAuth | No |
| GET | `/google/callback` | OAuth callback | No |
| POST | `/google/link` | Link Google account | Yes |
| DELETE | `/google/unlink` | Unlink Google | Yes |
| GET | `/google/status` | OAuth status | Yes |

### File Management (`/api/v1/files`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/upload` | Upload file | Yes |
| GET | `/` | List files | Yes |
| GET | `/{fileId}` | Download file | Yes |
| DELETE | `/{fileId}` | Delete file | Yes |
| POST | `/{fileId}/process` | Process CSV | Yes |

### Admin Operations (`/api/v1/admin`)

All admin endpoints require admin role.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | System statistics |
| GET | `/users` | List all users |
| POST | `/cleanup` | Delete old files |
| GET | `/health` | System health check |

### Synthetic Data (`/api/v1/synthetic-data`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|
| GET | `/supported-states` | List US states | No |
| POST | `/generate` | Generate data | No |
| GET | `/download/{fileId}` | Download data | No |

### System Health

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|
| GET | `/health` | Basic health check | No |
| GET | `/test-r2` | Test R2 storage | No |
| GET | `/test-phase5` | Test services | No |

## Webhooks

Currently, the Cutty API does not support webhooks. All interactions are synchronous request/response.

## API Limits

### Request Limits
- Maximum request body size: 10MB (50MB for file uploads)
- Maximum URL length: 2048 characters
- Maximum header size: 8KB

### Response Limits
- Maximum response size: 10MB
- Timeout: 30 seconds for standard requests
- File processing timeout: 5 minutes

### Account Limits
- Files per user: Unlimited
- API keys per user: 10
- Concurrent requests: 10 per user

## Changelog

### Version 1.0.0 (Current)
- Initial API release
- JWT authentication with refresh tokens
- Google OAuth integration
- File upload and processing
- Admin endpoints
- Synthetic data generation
- Rate limiting and security headers

---

*For implementation details and examples, see the [API Examples](./api-examples.md) documentation.*
