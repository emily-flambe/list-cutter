# List Cutter Unified Worker

This is the unified Cloudflare Workers implementation for List Cutter that serves both the frontend React application and backend API from a single Worker.

## Architecture

### Unified Deployment Benefits
- **Single Deployment Unit**: One Worker serves everything
- **Atomic Deployments**: Frontend and backend always in sync
- **Simplified DNS**: One domain points to one Worker
- **Unified Rollback**: Revert entire application with one command
- **Consistent Environments**: Dev, staging, and prod are identical

### Technology Stack
- **Runtime**: Cloudflare Workers
- **Framework**: Hono (lightweight web framework)
- **Language**: TypeScript
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Session Store**: Cloudflare KV
- **Frontend**: React (served as static assets)

## Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Wrangler CLI

### Setup
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build the application
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

### Project Structure
```
src/
├── index.ts              # Main Worker entry point
├── types/
│   └── env.ts            # TypeScript environment types
├── middleware/
│   ├── security.ts       # Security headers and HTTPS enforcement
│   ├── rateLimit.ts      # Rate limiting middleware
│   ├── requestId.ts      # Request ID tracking
│   └── staticAssets.ts   # Frontend asset serving
└── routes/
    ├── health.ts         # Health check endpoints
    ├── auth.ts           # Authentication endpoints
    ├── files.ts          # File management endpoints
    ├── csv.ts            # CSV processing endpoints
    └── admin.ts          # Admin and monitoring endpoints

public/                   # Frontend static assets
migrations/               # D1 database migrations
tests/                    # Test files
```

## API Endpoints

### Health & Monitoring
- `GET /health` - Basic health check
- `GET /api/v1/health/detailed` - Detailed health check
- `GET /api/v1/health/ready` - Readiness probe
- `GET /api/v1/health/live` - Liveness probe
- `GET /metrics` - System metrics

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Token refresh
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/user` - Get current user

### File Management
- `POST /api/v1/files/upload` - Upload file
- `GET /api/v1/files/list` - List user files
- `GET /api/v1/files/:fileId` - Get file details
- `GET /api/v1/files/:fileId/download` - Download file
- `DELETE /api/v1/files/:fileId` - Delete file
- `PATCH /api/v1/files/:fileId/tags` - Update file tags

### CSV Processing
- `POST /api/v1/csv/process` - Process CSV with filters
- `POST /api/v1/csv/export` - Export filtered CSV
- `GET /api/v1/csv/:fileId/metadata` - Get CSV metadata
- `GET /api/v1/csv/:fileId/preview` - Preview CSV data
- `POST /api/v1/csv/:fileId/filters` - Save filter configuration
- `GET /api/v1/csv/:fileId/filters` - Get saved filters

### Admin
- `GET /api/v1/admin/deployment/status` - Deployment status
- `POST /api/v1/admin/deployment/switch` - Switch deployment version
- `GET /api/v1/admin/metrics` - System metrics
- `GET /api/v1/admin/migration/status` - Migration status

## Deployment

### Environments
- **Development**: Local development with `wrangler dev`
- **Staging**: `staging.list-cutter.com`
- **Production**: `list-cutter.com`

### Deployment Commands
```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production

# Rollback production deployment
wrangler rollback --env production
```

### Environment Configuration
Each environment has its own configuration in `wrangler.toml`:
- Database bindings (D1)
- Storage bindings (R2)
- KV namespace bindings
- Environment variables
- Domain routing

## Security

### Features Implemented
- HTTPS enforcement
- Security headers (HSTS, CSP, etc.)
- Rate limiting
- CORS configuration
- Input validation
- Error handling without information leakage

### Security Headers
- `Strict-Transport-Security`
- `Content-Security-Policy`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `X-XSS-Protection`
- `Referrer-Policy`
- `Permissions-Policy`

## Monitoring

### Health Checks
The application includes comprehensive health checks:
- Database connectivity and latency
- Storage accessibility and latency
- Memory usage monitoring
- Response time tracking

### Metrics
- Request/response metrics
- Error rates
- System performance
- Database query performance

### Logging
- Structured logging with request IDs
- Error tracking and reporting
- Performance monitoring
- Security event logging

## Production Considerations

### Performance
- Edge caching for static assets
- Database connection pooling
- Optimized SQL queries with indexes
- Efficient static asset serving

### Reliability
- Circuit breaker patterns
- Graceful error handling
- Automatic retries for transient failures
- Health check endpoints for load balancer

### Scalability
- Automatic scaling with Cloudflare Workers
- Stateless architecture
- Database optimization
- CDN distribution

## Migration from Separate Workers

This unified Worker replaces the previous architecture that had separate Workers for frontend and backend. The migration provides:

1. **Simplified Deployment**: Single `wrangler deploy` command
2. **Atomic Updates**: No version mismatches between frontend and backend
3. **Unified Monitoring**: Single dashboard for entire application
4. **Reduced Complexity**: One configuration file, one deployment pipeline
5. **Better Performance**: Reduced latency from edge co-location

## Contributing

1. Follow TypeScript best practices
2. Add tests for new functionality
3. Update documentation for API changes
4. Ensure all linting passes
5. Test in staging before production deployment