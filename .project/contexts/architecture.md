# Architecture

## System Overview

### Current Architecture (100% Cloudflare)
- **Frontend**: React 18 (Vite)
- **Backend**: Cloudflare Workers + Hono.js
- **Database**: Cloudflare D1 (SQLite at edge)
- **Storage**: Cloudflare R2 (S3-compatible object storage)

### Backend (Cloudflare Workers)
- **Runtime**: Cloudflare Workers v8 isolates
- **Framework**: Hono.js (lightweight web framework)
- **Language**: TypeScript with strict mode
- **Database**: D1 (distributed SQLite)
- **Storage**: R2 (S3-compatible with global CDN)
- **Cache**: Workers KV + Cache API

### Frontend
- **Framework**: React 18 with Vite
- **UI Library**: Material-UI (MUI)
- **State Management**: React Context + hooks
- **HTTP Client**: Axios with interceptors
- **Authentication**: JWT stored in localStorage

### Infrastructure
- **Hosting**: Cloudflare (Workers + R2 + D1)
- **DNS**: Cloudflare
- **SSL**: Cloudflare automatic
- **CDN**: Cloudflare global network
- **CI/CD**: GitHub Actions

## 🚨 DEPLOYMENT ENVIRONMENTS - ABSOLUTE COMPLIANCE REQUIRED 🚨

### 🔴 CRITICAL: Only 2 Environments Exist

#### Development Environment
- **Worker Name**: `cutty-dev` (EXACT - NO VARIATIONS)
- **Database Name**: `cutty-dev` (EXACT - NO VARIATIONS)
- **Domain**: `cutty-dev.emilycogsdill.com`
- **Wrangler Config**: Default `wrangler.toml`
- **Deploy Command**: `wrangler deploy`

#### Production Environment  
- **Worker Name**: `cutty` (EXACT - NO VARIATIONS)
- **Database Name**: `cutty-prod` (EXACT - NO VARIATIONS)
- **Domain**: `cutty.emilycogsdill.com`
- **Wrangler Config**: `wrangler.prod.toml`
- **Deploy Command**: `wrangler deploy --config wrangler.prod.toml`

### 🚫 FORBIDDEN - THESE DO NOT EXIST
- **NO STAGING**: There is no staging environment
- **NO LOCAL DATABASES**: Never create local D1 instances
- **NO VARIANTS**: No test, staging, local, or other named environments
- **NO ADDITIONAL WORKERS**: Only cutty-dev and cutty exist
- **NO ADDITIONAL DATABASES**: Only cutty-dev and cutty-prod exist

### 🔧 Local Development Rules
- **MANDATORY**: Use `--remote` flag to connect to `cutty-dev`
- **FORBIDDEN**: Creating local databases with `wrangler d1 create`
- **COMMAND**: `wrangler dev --remote` (connects to cutty-dev worker)
- **DATABASE**: Always uses remote `cutty-dev` database

### ⚠️ Compliance Warning
**ANY deviation from these exact naming conventions will break:**
- CI/CD pipelines
- Environment configurations  
- OAuth redirect URIs
- Database connections
- API integrations

## Database Schema (D1)

🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨
🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 
🚨 CRITICAL DATABASE SCHEMA MAINTENANCE ALERT 🚨
🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 🔴 🚨 
🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨

🚨 DATABASE SCHEMA IS NOW AUTOMATICALLY MAINTAINED! 🚨

✅ **AUTOMATED DOCUMENTATION**: Schema docs are auto-generated from live D1 database
✅ **ALWAYS CURRENT**: Documentation reflects the actual deployed database state  
✅ **NO MANUAL WORK**: GitHub Actions handles all schema documentation updates
✅ **COMPREHENSIVE**: Full table structures, indexes, constraints, and relationships

📖 **VIEW COMPLETE SCHEMA DOCUMENTATION**: [d1_schema.md](./d1_schema.md)

🤖 The schema documentation is automatically updated whenever:
- Migration files are changed and pushed to main branch
- Manual workflow trigger is activated via GitHub Actions
- Database structure changes are detected

🚨 NEVER EDIT THE SCHEMA DOCS MANUALLY - They are auto-generated! 🚨

🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨

## API Routes (v1)

### Authentication (`/api/v1/auth/*`)
- `POST /login` - Email/password login
- `POST /register` - New user registration
- `POST /logout` - Session termination
- `GET /google` - Initiate Google OAuth
- `GET /google/callback` - OAuth callback
- `POST /google/link` - Link Google account
- `DELETE /google/unlink` - Unlink Google account
- `GET /google/status` - OAuth connection status

### Lists Management (`/api/v1/lists/*`)
- `GET /` - Get user's lists
- `POST /` - Create new list
- `GET /:id` - Get specific list
- `PUT /:id` - Update list
- `DELETE /:id` - Delete list
- `POST /:id/items` - Add items
- `PUT /:id/items/:itemId` - Update item
- `DELETE /:id/items/:itemId` - Delete item

### File Operations (`/api/v1/files/*`)
- `POST /upload` - Upload file to R2
- `GET /:id` - Download file
- `DELETE /:id` - Delete file
- `POST /process` - Process CSV file

### Monitoring (`/api/monitoring/*`)
- `GET /health` - System health check
- `GET /metrics` - Performance metrics
- `GET /dashboard` - Admin dashboard data
- `GET /database-health` - D1 health status

## Security Architecture

### Authentication Layers
1. **JWT Tokens**: 24-hour expiry, RS256 signing
2. **API Keys**: Hashed with salt, scoped permissions
3. **OAuth 2.0**: Google provider with PKCE flow

### Authorization
- Role-based access control (RBAC)
- Resource-level permissions
- API key scoping

### Security Measures
- **Rate Limiting**: Multi-layered (general, failure, burst)
- **Input Validation**: Zod schemas for all inputs
- **CORS**: Configured for specific domains
- **Headers**: CSP, HSTS, X-Frame-Options
- **CSRF Protection**: State tokens for OAuth

## Performance Optimizations

### Edge Computing
- Global distribution via Cloudflare network
- Sub-50ms response times globally
- Automatic geographic routing

### Caching Strategy
1. **Browser Cache**: Static assets (1 year)
2. **Edge Cache**: API responses (5-60 minutes)
3. **Workers KV**: Session data
4. **Cache API**: Computed results

### Database Optimization
- Connection pooling
- Query optimization with indexes
- Prepared statements
- Read replicas for scaling

### File Processing
- Streaming for large CSV files
- Chunked processing
- R2 multipart uploads
- CDN delivery for downloads

## Deployment Architecture

### Environments
1. **Development**
   - Worker: `cutty-dev`
   - Database: `cutty-dev`
   - Domain: `cutty-dev.emilycogsdill.com`

2. **Production**
   - Worker: `cutty`
   - Database: `cutty-prod`
   - Domain: `cutty.emilycogsdill.com`

### CI/CD Pipeline
1. Push to GitHub
2. GitHub Actions triggered
3. Run tests (unit, integration, security)
4. Build frontend and backend
5. Deploy to appropriate environment
6. Run post-deployment health checks
7. Automatic rollback on failure

### Zero-Downtime Deployment
- Blue-green deployment strategy
- Gradual traffic shifting
- Health check validation
- Automatic rollback capability

## Development Status

### Completed ✅
- User authentication (JWT + OAuth)
- Basic CRUD operations
- File upload/download
- Security implementation
- Monitoring endpoints
- Core API endpoints
- Database schema implementation

### In Progress 🚧
- Advanced list features
- Batch operations
- Performance optimization
- Enhanced file processing

### Planned 📋
- Real-time collaboration
- Advanced analytics
- Mobile app API
- WebSocket support
- Advanced CSV processing features