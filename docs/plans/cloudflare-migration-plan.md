# Cloudflare Migration Plan: Docker to Cloudflare Deployment

## Executive Summary

This document outlines the migration strategy for converting the List Cutter application from a Docker-based deployment on AWS EC2 to a modern Cloudflare deployment using Cloudflare Pages (frontend) and Cloudflare Workers (backend). The backend will be completely rewritten from Django (Python) to TypeScript for optimal Workers compatibility.

## Current Architecture Analysis

### Tech Stack
- **Backend**: Django 5.1.5 (Python) with Gunicorn
- **Frontend**: React 18.3.1 SPA with Vite
- **Databases**: PostgreSQL 15, Neo4j
- **Infrastructure**: Docker containers on AWS EC2
- **Storage**: Local filesystem for uploaded CSVs
- **Deployment**: GitHub Actions → Docker Hub → EC2

### Key Application Features
1. CSV file upload and processing
2. SQL-like filtering on CSV data
3. User authentication with JWT
4. File management with tagging
5. Large file handling with streaming

## Migration Strategy Overview

### Target Architecture
- **Frontend**: Cloudflare Pages (static hosting)
- **Backend**: Cloudflare Workers with TypeScript
- **Database**: Cloudflare D1 (SQLite)
- **Object Storage**: Cloudflare R2 for file uploads
- **Authentication**: JWT validation with Workers KV for token storage
- **CDN**: Cloudflare's global network
- **Background Jobs**: Cloudflare Queues for async processing

### Migration Challenges

1. **Backend Rewrite**: Django → TypeScript Workers
   - Extract business logic from Django views/models
   - Reimplement REST API endpoints in TypeScript
   - Maintain API compatibility for frontend
   - Handle Django-specific features (middleware, auth, ORM)

2. **Database Migration**: PostgreSQL → D1
   - Convert schema from PostgreSQL to SQLite
   - Handle PostgreSQL-specific features (arrays → JSON, custom types)
   - Migrate from Django ORM to direct SQL queries
   - Design efficient query patterns for D1

3. **File Storage**: Local filesystem → R2
   - Implement R2 integration for file uploads/downloads
   - Migrate existing files with metadata preservation
   - Update file reference system

4. **Authentication System**: Django Auth → JWT
   - Move from session-based to token-based auth
   - Implement JWT validation in Workers
   - Migrate user passwords and permissions

5. **Neo4j Dependency**: 
   - Assess if graph database features are used
   - Remove if unused or implement alternative

## Implementation Phases

### Phase 1: Development Environment Setup
**Duration**: 1 day

1. **Cloudflare Setup**
   - Install Wrangler CLI
   - Create Cloudflare account
   - Setup Workers and Pages projects
   - Configure local development environment

2. **TypeScript Project Structure**
   - Initialize Workers TypeScript project
   - Setup build tooling and linting
   - Configure testing framework
   - Create project structure for API migration

### Phase 2: Frontend Migration
**Duration**: 2-3 days

1. **Prepare Frontend Build**
   - Update Vite configuration for static export
   - Configure environment variables for API endpoints
   - Update API calls for new backend URL structure

2. **Cloudflare Pages Setup**
   - Create Pages project
   - Configure build settings
   - Setup custom domain (if applicable)
   - Configure redirects and headers

3. **Deploy and Test**
   - Deploy to Pages
   - Test static asset serving
   - Verify client-side routing works

### Phase 3: Backend Migration - Django to TypeScript
**Duration**: 7-10 days

1. **API Analysis and Planning**
   - Document all Django endpoints and their contracts
   - Map Django views to Workers routes
   - Create TypeScript interfaces for data models
   - Design error handling strategy

2. **Core API Implementation**
   ```typescript
   // Structure: workers/src/routes/[endpoint].ts
   ```
   - Auth endpoints (login, register, refresh, logout)
   - CSV processing endpoints (upload, filter, download)
   - File management endpoints (list, save, delete)
   - User profile endpoints

3. **Business Logic Migration**
   - Extract CSV processing from Django views
   - Implement SQL-like filtering in TypeScript
   - Port data validation rules
   - Create utility functions for common operations

4. **Django Feature Replacements**
   - Replace Django middleware with Workers middleware pattern
   - Implement request validation (replace Django forms)
   - Create error handling utilities
   - Setup CORS handling in Workers

5. **Testing Strategy**
   - Unit tests for business logic
   - Integration tests for API endpoints
   - Parallel testing against Django API
   - Performance benchmarking

### Phase 4: Database Migration to D1
**Duration**: 3-4 days

1. **Schema Migration**
   - Convert PostgreSQL schema to D1 (SQLite)
   - Handle data type differences (arrays → JSON, etc.)
   - Create migration scripts
   - Design indexes for performance

2. **Data Migration**
   - Export existing PostgreSQL data
   - Transform PostgreSQL-specific types to SQLite
   - Import into D1 database
   - Verify data integrity

3. **Update Database Access**
   - Implement D1 bindings in Workers
   - Update all queries for SQLite syntax
   - Replace PostgreSQL-specific features
   - Optimize for D1 query patterns

### Phase 5: File Storage Migration
**Duration**: 2-3 days

1. **R2 Integration**
   - Setup R2 bucket
   - Implement upload/download handlers
   - Configure public access policies

2. **Migrate Existing Files**
   - Download files from EC2
   - Upload to R2 with metadata
   - Update file references in database

### Phase 6: Authentication & Security
**Duration**: 2-3 days

1. **JWT Implementation**
   - Implement JWT validation in Workers
   - Setup Workers KV for refresh tokens
   - Configure CORS policies

2. **Security Headers**
   - Implement CSP headers
   - Setup rate limiting with Workers
   - Configure WAF rules if needed

### Phase 7: Testing & Optimization
**Duration**: 3-4 days

1. **End-to-End Testing**
   - Test all user workflows
   - Verify file upload/download
   - Test authentication flows

2. **Performance Optimization**
   - Implement caching strategies
   - Optimize Worker bundle size
   - Configure Cloudflare settings

3. **Load Testing**
   - Test concurrent users
   - Verify large file handling
   - Check rate limits

### Phase 8: Deployment & Cutover
**Duration**: 1-2 days

1. **Production Setup**
   - Configure production environment
   - Setup monitoring and alerts
   - Document deployment process

2. **Migration Execution**
   - Deploy all components
   - Migrate production data
   - Update DNS records

3. **Verification**
   - Test production deployment
   - Monitor for issues
   - Keep rollback plan ready

### Phase 9: Cleanup
**Duration**: 1-2 days

1. **Remove Docker Infrastructure**
   - Delete Dockerfiles
   - Remove docker-compose files
   - Clean up Docker-specific scripts

2. **Update Documentation**
   - Update README
   - Document new deployment process
   - Create runbooks

3. **Decommission Old Infrastructure**
   - Terminate EC2 instances
   - Clean up Docker Hub repositories
   - Archive old deployment scripts

## Technical Considerations

### Wrangler Configuration Structure
```
list-cutter/
├── wrangler.toml          # Main configuration
├── apps/
│   ├── frontend/          # Pages project
│   │   └── wrangler.toml
│   └── backend/           # Workers project
│       ├── wrangler.toml
│       └── src/
└── packages/
    └── shared/            # Shared types/utilities
```

### Environment Variables Migration
- Current: `.env` files
- Target: Wrangler secrets and vars
- Need to map all variables to Cloudflare equivalents

### API Endpoint Structure
- Current: `https://app.example.com/api/*`
- Target: `https://api.example.com/*` (Workers)
- Frontend: `https://app.example.com` (Pages)

## Risk Mitigation

1. **Data Loss Prevention**
   - Full backup before migration
   - Incremental migration approach
   - Maintain rollback capability

2. **Downtime Minimization**
   - Parallel deployment strategy
   - Feature flag for gradual rollout
   - Blue-green deployment if possible

3. **Feature Parity**
   - Comprehensive testing checklist
   - User acceptance testing
   - Performance benchmarking

## Success Criteria

1. All features working on Cloudflare
2. Performance equal or better than Docker
3. Simplified deployment process
4. Reduced operational costs
5. Improved global performance via CDN

## Migration Architecture Details

### TypeScript Project Structure
```
workers/
├── src/
│   ├── routes/           # API endpoints
│   │   ├── auth/
│   │   ├── csv/
│   │   └── files/
│   ├── services/         # Business logic
│   │   ├── csvProcessor.ts
│   │   ├── sqlFilter.ts
│   │   └── auth.ts
│   ├── db/              # Database access
│   │   ├── schema.ts
│   │   └── queries/
│   ├── middleware/       # Request processing
│   └── utils/           # Shared utilities
├── test/
└── wrangler.toml
```

### API Migration Strategy
1. **Incremental Migration**: Run Django and Workers in parallel
2. **Feature Flags**: Route specific endpoints to Workers
3. **Shared Database**: Both systems use same D1 during transition
4. **Monitoring**: Track performance and errors in both systems

## Timeline Summary

- **Total Duration**: 20-28 days
- **Phase 1**: Setup (1 day)
- **Phase 2-3**: Frontend + Backend Migration (9-13 days)
- **Phase 4-6**: Data + Storage + Auth (7-10 days)
- **Phase 7-9**: Testing + Deployment + Cleanup (4-6 days)

## Next Steps

1. Setup Cloudflare account and Wrangler CLI
2. Create TypeScript project structure
3. Begin frontend migration to Pages
4. Start TypeScript API development in parallel