# Architecture

## System Overview

### Current State (Hybrid)
- **Frontend**: React 18 (Vite) → Can connect to either backend
- **Backend Option 1**: Django (Legacy) - Being phased out
- **Backend Option 2**: Cloudflare Workers (New) - Migration target
- **Database**: Cloudflare D1 (SQLite at edge)
- **Storage**: Cloudflare R2 (S3-compatible object storage)

### Target Architecture (100% Cloudflare)
```
Users → Cloudflare Edge → Workers → D1 Database
                      ↓
                    R2 Storage (CDN)
```

## Technology Stack

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

## Database Schema (D1)

### Core Tables
```sql
-- Users & Authentication
users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  provider TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- API Keys
api_keys (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT,
  permissions TEXT,
  last_used DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
)

-- Lists & Data
lists (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  settings TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
)

-- List Items
list_items (
  id INTEGER PRIMARY KEY,
  list_id INTEGER NOT NULL,
  content TEXT,
  metadata TEXT,
  position INTEGER,
  FOREIGN KEY (list_id) REFERENCES lists(id)
)

-- File Uploads
uploads (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size INTEGER,
  mimetype TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

### OAuth & Security Tables
```sql
-- OAuth State Management
oauth_states (
  state TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- Security Event Logging
oauth_security_events (
  id INTEGER PRIMARY KEY,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id INTEGER,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- Rate Limiting
oauth_rate_limits (
  id INTEGER PRIMARY KEY,
  ip_address TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

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

## Migration Status

### Completed ✅
- User authentication (JWT + OAuth)
- Basic CRUD operations
- File upload/download
- Security implementation
- Monitoring endpoints

### In Progress 🚧
- Full Django API compatibility
- Advanced list features
- Batch operations
- Performance optimization

### Planned 📋
- Real-time collaboration
- Advanced analytics
- Mobile app API
- WebSocket support