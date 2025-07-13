# System Architecture Overview

## Project Identity
@include ../.claude/project-config.yml#ProjectIdentity

## High-Level Architecture

### Current State (Phase 7)
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Django Backend │    │ Cloudflare Edge │
│                 │    │   (Legacy)      │    │    (Primary)    │
│  - Vite Build   │    │                 │    │                 │
│  - Material UI  │    │  - REST API     │    │  - Hono.js      │
│  - Auth Context │    │  - PostgreSQL   │    │  - D1 Database  │
│                 │    │  - File Storage │    │  - R2 Storage   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Migration     │
                    │   In Progress   │
                    │                 │
                    │ Django → Workers│
                    └─────────────────┘
```

### Target Architecture (Post-Migration)
```
┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │ Cloudflare Edge │
│                 │    │                 │
│  - Pages Deploy │    │  - Workers API  │
│  - Material UI  │    │  - D1 Database  │
│  - Auth Context │    │  - R2 Storage   │
│  - Edge Caching │    │  - Edge Caching │
└─────────────────┘    └─────────────────┘
         │                       │
         └───────────────────────┘
              Global CDN
```

## Technology Stack

### Frontend
- **Framework**: React 18.3.1
- **Build Tool**: Vite 6.0.5
- **UI Library**: Material-UI 6.4.2
- **Routing**: React Router 6.28.2
- **HTTP Client**: Axios 1.7.9
- **Deployment**: Cloudflare Pages

### Backend (Current - Cloudflare Workers)
- **Runtime**: Cloudflare Workers (V8)
- **Framework**: Hono.js 4.6.16
- **Language**: TypeScript 5.7.3
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Authentication**: JWT + API Keys
- **Testing**: Vitest 2.0.5 + Playwright 1.48.2
- **Deployment**: Wrangler 4.24.3+ (v4+ required)

### Backend (Legacy - Django)
- **Framework**: Django + DRF
- **Language**: Python 3.11+
- **Database**: PostgreSQL
- **Package Manager**: Poetry
- **Status**: Being migrated to Workers

### Infrastructure
- **CDN**: Cloudflare Global Network
- **Edge Compute**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite at edge)
- **Object Storage**: Cloudflare R2
- **DNS**: Cloudflare DNS
- **SSL**: Cloudflare SSL/TLS

## Data Architecture

### Database Schema (D1)
```sql
-- Users and Authentication
users (id, email, password_hash, created_at, updated_at)
api_keys (id, user_id, key_hash, name, created_at, last_used)
user_sessions (id, user_id, token_hash, expires_at)

-- File Management
saved_files (id, user_id, filename, original_name, size, created_at)
file_metadata (file_id, content_type, processing_status, r2_key)
file_lineage (id, parent_file_id, child_file_id, operation_type)

-- Security and Monitoring
security_events (id, event_type, user_id, ip_address, timestamp)
usage_metrics (id, user_id, operation, size_bytes, timestamp)
alert_events (id, alert_type, severity, message, timestamp)
```

### Storage Structure (R2)
```
cutty-files-{env}/
├── users/
│   └── {user_id}/
│       ├── uploads/
│       │   └── {file_id}.{ext}
│       └── processed/
│           └── {file_id}_cut.{ext}
├── temp/
│   └── {temp_id}.{ext}
└── backups/
    └── {backup_date}/
```

## Security Architecture

### Authentication Flow
```
1. User Login → JWT Token + Refresh Token
2. API Requests → Bearer Token Validation
3. Token Refresh → New JWT + Rotate Refresh
4. Logout → Token Blacklist
```

### Authorization Layers
- **Route Protection**: JWT middleware
- **API Key Auth**: Alternative auth method
- **File Access Control**: User ownership validation
- **Rate Limiting**: Per-user and per-IP limits
- **Input Validation**: Zod schema validation

### Security Monitoring
- **Threat Detection**: Automated security event analysis
- **Audit Logging**: All security events logged
- **Incident Response**: Automated threat response
- **Compliance**: OWASP Top 10 compliance

## Performance Architecture

### Caching Strategy
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser       │    │   Edge Cache    │    │   Workers       │
│                 │    │                 │    │                 │
│  - Local Cache  │    │  - Response     │    │  - Memory Cache │
│  - Service      │    │    Cache        │    │  - Computed     │
│    Worker       │    │  - Static       │    │    Results      │
│                 │    │    Assets       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   D1 Database   │
                    │                 │
                    │  - Query Cache  │
                    │  - Connection   │
                    │    Pool         │
                    └─────────────────┘
```

### Performance Monitoring
- **Response Time Tracking**: All endpoints monitored
- **Database Performance**: Query optimization
- **Cache Hit Rates**: Cache effectiveness metrics
- **Resource Usage**: Memory and CPU monitoring
- **User Experience**: Core Web Vitals tracking

## Deployment Architecture

### Environment Strategy
```
Development → Staging → Production
    │           │           │
    ├─ Local    ├─ Preview  ├─ cutty.emilycogsdill.com
    │  Testing  │   Testing │   
    └─ Feature  └─ Load     └─ Global Distribution
       Branches    Testing
```

### CI/CD Pipeline
```
GitHub Push → Actions → Tests → Security → Deploy → Validate
     │            │        │        │         │         │
     └─ Lint      └─ Unit  └─ SAST  └─ Blue-  └─ Health
        Type         E2E      Audit    Green     Checks
        Check        Perf     Scan     Deploy    Monitor
```

## Migration Architecture

### Current Migration Status
@include ../.claude/project-config.yml#ProjectStructure

### Migration Strategy
1. **Phase 7** (Current): Testing & Optimization
2. **Phase 8**: Deployment & Cutover  
3. **Phase 9**: Cleanup & Documentation

### Data Migration
- **User Data**: Automated migration scripts
- **File Migration**: Batch R2 transfer with validation
- **Configuration**: Environment variable mapping
- **DNS Cutover**: Gradual traffic shifting

## Monitoring and Observability

### Health Monitoring
- **Application Health**: `/health` endpoints
- **Database Health**: Connection and query health
- **Storage Health**: R2 bucket accessibility
- **Authentication Health**: Auth service validation

### Metrics Collection
- **Business Metrics**: User engagement, file processing
- **Technical Metrics**: Response times, error rates
- **Security Metrics**: Failed auth attempts, threats
- **Performance Metrics**: Cache hit rates, resource usage

### Alerting
- **Critical Alerts**: Service down, security incidents
- **Warning Alerts**: Performance degradation, quota limits
- **Info Alerts**: Deployment completion, maintenance