# List Cutter Workers Backend

A complete Cloudflare Workers TypeScript backend for the List Cutter application, providing CSV processing, user authentication, and file management capabilities.

## Features

### Phase 3.1: Core CSV Operations
- ✅ Home endpoint (`/`)
- ✅ CSV file upload with column extraction (`POST /api/list_cutter/csv_cutter`)
- ✅ CSV filtering and export (`POST /api/list_cutter/export_csv`)
- ✅ File download (`GET /api/list_cutter/download/:filename`)

### Phase 3.2: Authentication System
- ✅ User registration (`POST /api/accounts/register`)
- ✅ User login (`POST /api/accounts/login`)
- ✅ JWT token refresh (`POST /api/accounts/token/refresh`)
- ✅ Get user info (`GET /api/accounts/user`)

### Phase 3.3: Authenticated File Operations
- ✅ Secure file upload (`POST /api/list_cutter/upload`)
- ✅ List user files (`GET /api/list_cutter/list_saved_files`)
- ✅ Delete files (`DELETE /api/list_cutter/delete/:file_id`)
- ✅ Save generated files (`POST /api/list_cutter/save_generated_file`)
- ✅ Fetch file content (`GET /api/list_cutter/fetch_saved_file/:file_id`)
- ✅ Update file tags (`PATCH /api/list_cutter/update_tags/:file_id`)

### Phase 3.4: Advanced Features
- ✅ File lineage tracking (`GET /api/list_cutter/fetch_file_lineage/:file_id`)
- ✅ System and user tag management
- ✅ File relationship mapping

## Architecture

### Core Services
- **CSV Processing**: Parse, filter, and generate CSV files with SQL-like filtering
- **Authentication**: JWT-based auth with secure password hashing
- **Storage**: R2 for file storage, D1 for metadata and relationships
- **Validation**: File upload validation, type checking, and size limits

### Security Features
- JWT token expiration and refresh
- User-scoped data access
- File ownership validation
- Password strength requirements
- CORS support for frontend integration

## Setup and Deployment

### Prerequisites
- Node.js 18+
- Wrangler CLI
- Cloudflare account with Workers, R2, and D1 access

### Installation

```bash
cd workers
npm install
```

### Development

```bash
# Run linter
npm run lint

# Type checking
npm run type-check

# Build project
npm run build

# Local development
npm run dev
```

### Database Setup

1. Create D1 database:
```bash
wrangler d1 create list-cutter-db
```

2. Update `wrangler.toml` with your database ID

3. Apply schema:
```bash
wrangler d1 execute list-cutter-db --file=schema.sql
```

### R2 Setup

1. Create R2 bucket:
```bash
wrangler r2 bucket create cutty-files-dev
```

2. Update `wrangler.toml` with your bucket name

### Environment Configuration

Update `wrangler.toml` with your values:

```toml
[vars]
JWT_SECRET = "your-secure-jwt-secret-here"
MAX_FILE_SIZE = "10485760"  # 10MB
ENVIRONMENT = "production"
```

### Deployment

```bash
# Deploy to production
npm run deploy

# Deploy to staging
wrangler deploy --env staging
```

## API Documentation

### Authentication Flow
1. Register: `POST /api/accounts/register`
2. Login: `POST /api/accounts/login` → returns JWT token
3. Include token in requests: `Authorization: Bearer <token>`

### File Processing Flow
1. Upload CSV: `POST /api/list_cutter/csv_cutter` (no auth) or `POST /api/list_cutter/upload` (with auth)
2. Process/filter: `POST /api/list_cutter/export_csv`
3. Save result: `POST /api/list_cutter/save_generated_file` (creates lineage)
4. View lineage: `GET /api/list_cutter/fetch_file_lineage/:file_id`

### Error Handling
All endpoints return consistent error responses:
```json
{
  "error": "Error message",
  "details": "Additional context (optional)"
}
```

### Rate Limiting
Configure rate limiting in Cloudflare dashboard as needed.

## Development Guidelines

### Code Quality
- TypeScript strict mode enabled
- ESLint with comprehensive rules
- No `any` types (use proper interfaces)
- Comprehensive error handling

### Testing
- Unit tests for core logic (CSV parsing, filtering)
- Integration tests with Miniflare
- API compatibility tests with Django backend

### Performance
- Response times < 100ms for file operations
- Efficient D1 queries with proper indexing
- R2 streaming for large files
- Memory-efficient CSV processing

## Migration from Django

This Workers backend maintains full API compatibility with the existing Django backend, enabling seamless frontend integration. Key differences:

- **Database**: PostgreSQL → D1 (SQLite)
- **Storage**: Local filesystem → R2
- **Graph DB**: Neo4j → D1 relationships table
- **Auth**: Django sessions → JWT tokens
- **Runtime**: Python/Django → TypeScript/Workers

## Monitoring and Logging

- All errors logged to Workers analytics
- Custom metrics for file operations
- Performance monitoring via Cloudflare dashboard
- OpenTelemetry integration available

## Cost Optimization

- Workers: Pay per request (included in most plans)
- R2: $0.015/GB storage, minimal egress for same-zone access
- D1: Generous free tier, $0.001 per 1K reads after limits
- Estimated cost: <$10/month for moderate usage

## Support

For issues and questions:
1. Check the troubleshooting section in wrangler.toml
2. Review Cloudflare Workers documentation
3. Check application logs in Cloudflare dashboard