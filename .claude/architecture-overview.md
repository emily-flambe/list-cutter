# Architecture Overview

## System Architecture

### Current State (Hybrid)
- **Frontend**: React (Vite) → Can connect to either backend
- **Backend Option 1**: Django (Legacy) - Being phased out
- **Backend Option 2**: Cloudflare Workers (New) - Migration target
- **Database**: D1 (SQLite at edge)
- **Storage**: R2 object storage with CDN

### Target Architecture (100% Cloudflare)
```
Users → Cloudflare Edge → Workers → D1 Database
                      ↓
                    R2 Storage
```

## Technology Stack

### Backend (Cloudflare Workers)
- Runtime: Cloudflare Workers v8 isolates
- Framework: Hono.js (lightweight web framework)
- Language: TypeScript
- Database: D1 (distributed SQLite)
- Storage: R2 (S3-compatible object storage)
- Cache: Workers KV + Cache API

### Frontend
- Framework: React 18 with Vite
- UI: Material-UI (MUI)
- State: React Context + hooks
- HTTP: Axios with interceptors
- Auth: JWT stored in localStorage

### Infrastructure
- Hosting: Cloudflare (Workers + R2 + D1)
- DNS: Cloudflare
- SSL: Cloudflare automatic
- CDN: Cloudflare global network

## Database Schema (D1)

### Core Tables
```sql
-- Users & Authentication
users (id, username, email, password_hash, google_id, created_at)
api_keys (id, user_id, key_hash, name, permissions, last_used)

-- Lists & Data
lists (id, user_id, name, type, settings, created_at)
list_items (id, list_id, content, metadata, position)
uploads (id, user_id, filename, r2_key, size, mimetype)

-- OAuth & Security
oauth_states (state, nonce, expires_at, created_at)
oauth_security_events (id, event_type, ip_address, user_agent, created_at)
oauth_rate_limits (id, ip_address, event_type, created_at)
```

## API Routes

### Authentication
- POST /api/v1/auth/login
- POST /api/v1/auth/register
- POST /api/v1/auth/logout
- GET /api/v1/auth/google
- GET /api/v1/auth/google/callback

### Lists Management
- GET /api/v1/lists
- POST /api/v1/lists
- GET /api/v1/lists/:id
- PUT /api/v1/lists/:id
- DELETE /api/v1/lists/:id

### File Operations
- POST /api/v1/files/upload
- GET /api/v1/files/:id
- DELETE /api/v1/files/:id

### Monitoring
- GET /api/health
- GET /api/monitoring/metrics
- GET /api/monitoring/dashboard

## Security Layers

1. **Authentication**: JWT tokens with 24h expiry
2. **Authorization**: Role-based access control
3. **Rate Limiting**: Per-endpoint limits
4. **Input Validation**: Zod schemas
5. **CORS**: Configured for frontend domain
6. **Headers**: Security headers (CSP, HSTS, etc.)

## Performance Optimizations

1. **Edge Caching**: Static assets cached at edge
2. **Database**: Connection pooling, query optimization
3. **File Processing**: Streaming for large files
4. **API**: Response compression, pagination
5. **Frontend**: Code splitting, lazy loading

## Deployment Pipeline

### Development
1. Local development with Wrangler
2. Automated tests on commit
3. Deploy to cutty-dev worker

### Production
1. PR review required
2. CI/CD via GitHub Actions
3. Deploy to cutty worker
4. Automatic rollback on errors

## Migration Status

### Completed ✅
- User authentication (JWT)
- Google OAuth integration
- Basic list operations
- File upload to R2
- Monitoring endpoints

### In Progress 🚧
- Full Django API compatibility
- Advanced list features
- Batch operations

### Planned 📋
- Real-time collaboration
- Advanced analytics
- Mobile app API