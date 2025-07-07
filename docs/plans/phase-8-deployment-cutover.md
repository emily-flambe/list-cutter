# Phase 8: Deployment & Cutover - Unified Workers Implementation

## Overview

This document provides a comprehensive technical implementation plan for deploying the List Cutter application to production using our unified Cloudflare Workers architecture. With frontend and backend in a single Worker, deployment and cutover are dramatically simplified. This phase focuses on deploying the unified Worker, migrating traffic from the Django-based system, and ensuring zero-downtime cutover with simplified rollback capabilities.

## Table of Contents

1. [Unified Workers Deployment Architecture](#unified-workers-deployment-architecture)
2. [Deployment Strategy Overview](#deployment-strategy-overview)
3. [Environment Configuration](#environment-configuration)
4. [Production Deployment Setup](#production-deployment-setup)
5. [DNS and Domain Configuration](#dns-and-domain-configuration)
6. [SSL/TLS Certificate Management](#ssltls-certificate-management)
7. [Traffic Migration Strategy](#traffic-migration-strategy)
8. [Blue-Green Deployment](#blue-green-deployment)
9. [Monitoring and Alerting](#monitoring-and-alerting)
10. [Rollback Procedures](#rollback-procedures)
11. [Data Migration Execution](#data-migration-execution)
12. [Cutover Execution Plan](#cutover-execution-plan)
13. [Post-Cutover Validation](#post-cutover-validation)
14. [Performance Monitoring](#performance-monitoring)
15. [Incident Response Plan](#incident-response-plan)

## Unified Workers Deployment Architecture

### Deployment Simplification with Unified Workers

The single Worker architecture transforms deployment complexity:

1. **Single Deployment Unit**: One Worker serves everything
2. **Atomic Deployments**: Frontend and backend always in sync
3. **Simplified DNS**: One domain points to one Worker
4. **Unified Rollback**: Revert entire application with one command
5. **Consistent Environments**: Dev, staging, and prod are identical

### Unified Production Configuration

```toml
# wrangler.toml - Unified Production Configuration
name = "list-cutter"
main = "src/index.ts"
compatibility_date = "2024-12-30"
compatibility_flags = ["nodejs_compat"]

# Frontend static assets
[assets]
directory = "./public"
binding = "ASSETS"

# Production environment
[env.production]
name = "list-cutter-production"
vars = { 
  ENVIRONMENT = "production",
  API_VERSION = "v1",
  MAX_FILE_SIZE = "52428800",
  JWT_ISSUER = "list-cutter",
  JWT_AUDIENCE = "list-cutter-api",
  LOG_LEVEL = "info",
  SENTRY_ENVIRONMENT = "production"
}

# Single domain for entire application
routes = [
  { pattern = "list-cutter.com/*", zone_name = "list-cutter.com" },
  { pattern = "www.list-cutter.com/*", zone_name = "list-cutter.com" }
]

# Production bindings
[[env.production.d1_databases]]
binding = "DB"
database_name = "list-cutter-production"
database_id = "PRODUCTION_DB_ID"

[[env.production.r2_buckets]]
binding = "FILE_STORAGE"
bucket_name = "cutty-files-prod"

[[env.production.kv_namespaces]]
binding = "AUTH_TOKENS"
id = "PRODUCTION_KV_ID"

# Rate limiting
[[env.production.unsafe.bindings]]
name = "RATE_LIMITER"
type = "ratelimit"
namespace_id = "1"
simple = { limit = 100, period = 60 }
```

### Deployment Workflow

```bash
# Build frontend
npm run build:frontend
cp -r frontend/dist/* public/

# Run tests
npm test

# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production

# Rollback if needed (instant)
wrangler rollback --env production
```

### Benefits of Unified Deployment

1. **Simplified CI/CD**: One pipeline for everything
2. **Atomic Updates**: No version mismatches between frontend and backend
3. **Instant Rollback**: Revert to previous version in seconds
4. **Global Deployment**: Automatic edge distribution
5. **Zero Downtime**: Workers handles blue-green internally

## Deployment Strategy Overview

### Deployment Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Development   │    │     Staging     │    │   Production    │
│                 │    │                 │    │                 │
│ - Local testing │────│ - Integration   │────│ - Live traffic  │
│ - Unit tests    │    │ - E2E tests     │    │ - Blue/Green    │
│ - Dev database  │    │ - Load testing  │    │ - Monitoring    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Deployment Stages

1. **Staging Deployment**: Full production replica for testing
2. **Canary Deployment**: 5% traffic to new version
3. **Blue-Green Deployment**: Zero-downtime full cutover
4. **Production Deployment**: 100% traffic to new version

## Environment Configuration

### Cloudflare Workers Configuration

```toml
# wrangler.toml - Production Configuration
name = "list-cutter-api"
main = "src/index.ts"
compatibility_date = "2024-12-30"
compatibility_flags = ["nodejs_compat"]

# Production environment
[env.production]
name = "list-cutter-api-production"
vars = { 
  ENVIRONMENT = "production",
  API_VERSION = "v1",
  CORS_ORIGIN = "https://list-cutter.com",
  MAX_FILE_SIZE = "52428800",
  JWT_ISSUER = "list-cutter",
  JWT_AUDIENCE = "list-cutter-api",
  LOG_LEVEL = "info",
  SENTRY_ENVIRONMENT = "production"
}

# Custom domains
routes = [
  { pattern = "api.list-cutter.com/*", zone_name = "list-cutter.com" },
  { pattern = "api.list-cutter.com/health", zone_name = "list-cutter.com" }
]

# D1 Database
[[env.production.d1_databases]]
binding = "DB"
database_name = "list-cutter-production"
database_id = "PRODUCTION_DB_ID"
migrations_dir = "./migrations"

# R2 Storage
[[env.production.r2_buckets]]
binding = "FILE_STORAGE"
bucket_name = "cutty-files-prod"

# KV Namespace
[[env.production.kv_namespaces]]
binding = "AUTH_TOKENS"
id = "PRODUCTION_KV_ID"

# Queue bindings
[[env.production.queues.producers]]
binding = "CSV_QUEUE"
queue = "csv-processing-production"

# Analytics
[[env.production.analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "list_cutter_production"

# Staging environment (identical to production)
[env.staging]
name = "list-cutter-api-staging"
vars = { 
  ENVIRONMENT = "staging",
  CORS_ORIGIN = "https://staging.list-cutter.com"
}

routes = [
  { pattern = "staging-api.list-cutter.com/*", zone_name = "list-cutter.com" }
]

[[env.staging.d1_databases]]
binding = "DB"
database_name = "list-cutter-staging"
database_id = "STAGING_DB_ID"

[[env.staging.r2_buckets]]
binding = "FILE_STORAGE"
bucket_name = "cutty-files-staging"

[[env.staging.kv_namespaces]]
binding = "AUTH_TOKENS"
id = "STAGING_KV_ID"
```

### Environment Variables and Secrets

```bash
# Production secrets setup script
#!/bin/bash

# Set production secrets
wrangler secret put JWT_SECRET --env production
wrangler secret put JWT_REFRESH_SECRET --env production
wrangler secret put DB_ENCRYPTION_KEY --env production
wrangler secret put SENTRY_DSN --env production
wrangler secret put SENDGRID_API_KEY --env production

# Staging secrets
wrangler secret put JWT_SECRET --env staging
wrangler secret put JWT_REFRESH_SECRET --env staging
wrangler secret put DB_ENCRYPTION_KEY --env staging
wrangler secret put SENTRY_DSN --env staging

echo "Secrets configured successfully"
```

### Production Database Setup

```sql
-- Production database migration script
-- migrations/production_setup.sql

-- Create production users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT,
    is_active INTEGER DEFAULT 1,
    is_admin INTEGER DEFAULT 0,
    email_verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_login TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Create files table
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_id TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    r2_key TEXT UNIQUE NOT NULL,
    upload_status TEXT DEFAULT 'completed',
    processing_error TEXT,
    row_count INTEGER,
    column_count INTEGER,
    columns_metadata TEXT,
    tags TEXT,
    checksum TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- File indexes
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_file_id ON files(file_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(upload_status);

-- Create saved filters table
CREATE TABLE IF NOT EXISTS saved_filters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    filter_config TEXT NOT NULL,
    result_count INTEGER,
    is_public INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(file_id) ON DELETE CASCADE
);

-- Filter indexes
CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id ON saved_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_file_id ON saved_filters(file_id);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Performance optimization
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;
```

## Production Deployment Setup

### Deployment Script

```bash
#!/bin/bash
# scripts/deploy-production.sh

set -e

echo "🚀 Starting production deployment..."

# Verify environment
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "❌ CLOUDFLARE_API_TOKEN not set"
    exit 1
fi

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."

# Type checking
npm run typecheck
if [ $? -ne 0 ]; then
    echo "❌ TypeScript type checking failed"
    exit 1
fi

# Linting
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ Linting failed"
    exit 1
fi

# Test suite
npm run test:ci
if [ $? -ne 0 ]; then
    echo "❌ Tests failed"
    exit 1
fi

# Build application
echo "🔨 Building application..."
npm run build

# Deploy to staging first
echo "📦 Deploying to staging..."
wrangler deploy --env staging

# Staging validation
echo "🧪 Running staging validation..."
./scripts/validate-staging.sh

if [ $? -ne 0 ]; then
    echo "❌ Staging validation failed"
    exit 1
fi

# Deploy to production
echo "🌟 Deploying to production..."
wrangler deploy --env production

# Post-deployment validation
echo "✅ Running production validation..."
./scripts/validate-production.sh

if [ $? -eq 0 ]; then
    echo "🎉 Production deployment successful!"
    ./scripts/notify-deployment.sh success
else
    echo "❌ Production validation failed"
    ./scripts/notify-deployment.sh failure
    exit 1
fi
```

### Staging Validation Script

```bash
#!/bin/bash
# scripts/validate-staging.sh

STAGING_URL="https://staging-api.list-cutter.com"
MAX_RETRIES=30
RETRY_DELAY=10

echo "🧪 Validating staging deployment..."

# Wait for deployment to be ready
for i in $(seq 1 $MAX_RETRIES); do
    if curl -f -s "$STAGING_URL/health" > /dev/null; then
        echo "✅ Staging health check passed"
        break
    fi
    
    if [ $i -eq $MAX_RETRIES ]; then
        echo "❌ Staging health check failed after $MAX_RETRIES attempts"
        exit 1
    fi
    
    echo "⏳ Waiting for staging to be ready... ($i/$MAX_RETRIES)"
    sleep $RETRY_DELAY
done

# Run comprehensive tests
echo "🔬 Running staging tests..."

# Health check
HEALTH_RESPONSE=$(curl -s "$STAGING_URL/health")
if echo "$HEALTH_RESPONSE" | jq -e '.status == "healthy"' > /dev/null; then
    echo "✅ Health endpoint working"
else
    echo "❌ Health endpoint failed"
    exit 1
fi

# Authentication test
echo "🔐 Testing authentication..."
REGISTER_RESPONSE=$(curl -s -X POST "$STAGING_URL/api/accounts/register" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "staging_test_user",
        "email": "staging@test.com",
        "password": "testpass123",
        "password2": "testpass123"
    }')

if echo "$REGISTER_RESPONSE" | jq -e '.access_token' > /dev/null; then
    echo "✅ User registration working"
else
    echo "❌ User registration failed"
    echo "$REGISTER_RESPONSE"
    exit 1
fi

# File upload test
echo "📁 Testing file upload..."
ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.access_token')

UPLOAD_RESPONSE=$(curl -s -X POST "$STAGING_URL/api/files/upload" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -F "file=@./test-data/sample.csv")

if echo "$UPLOAD_RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo "✅ File upload working"
else
    echo "❌ File upload failed"
    echo "$UPLOAD_RESPONSE"
    exit 1
fi

echo "🎉 All staging validations passed!"
```

## DNS and Domain Configuration

### Simplified DNS with Unified Workers

With the unified architecture, DNS configuration is dramatically simplified:

```bash
#!/bin/bash
# scripts/setup-dns.sh

ZONE_ID="your_zone_id"
API_TOKEN="$CLOUDFLARE_API_TOKEN"

echo "🌐 Setting up DNS for unified Worker..."

# Main domain - points to unified Worker
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{
        "type": "CNAME",
        "name": "@",
        "content": "list-cutter-production.workers.dev",
        "ttl": 1,
        "proxied": true
    }'

# WWW subdomain - also points to unified Worker
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{
        "type": "CNAME",
        "name": "www",
        "content": "list-cutter-production.workers.dev",
        "ttl": 1,
        "proxied": true
    }'

# Staging environment (optional)
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{
        "type": "CNAME",
        "name": "staging-api",
        "content": "list-cutter-api-staging.your-subdomain.workers.dev",
        "ttl": 300,
        "proxied": true
    }'

echo "✅ DNS records created successfully"
```

### SSL Certificate Configuration

```typescript
// src/middleware/ssl.ts
export function enforceHTTPS(request: Request): Response | null {
  const url = new URL(request.url);
  
  // Redirect HTTP to HTTPS
  if (url.protocol === 'http:') {
    const httpsUrl = url.href.replace('http:', 'https:');
    return Response.redirect(httpsUrl, 301);
  }
  
  return null;
}

export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  
  // HSTS
  headers.set('Strict-Transport-Security', 
    'max-age=31536000; includeSubDomains; preload');
  
  // Other security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
```

## Traffic Migration Strategy

### Gradual Traffic Migration

```typescript
// src/middleware/trafficSplit.ts
export class TrafficSplitter {
  private newVersionPercentage: number = 0;
  
  constructor(percentage: number = 0) {
    this.newVersionPercentage = percentage;
  }
  
  shouldUseNewVersion(request: Request): boolean {
    // Always use new version for staging
    const url = new URL(request.url);
    if (url.hostname.includes('staging')) {
      return true;
    }
    
    // Check if user is in beta program
    const betaHeader = request.headers.get('X-Beta-User');
    if (betaHeader === 'true') {
      return true;
    }
    
    // Use hash of IP for consistent routing
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const hash = this.hashString(ip);
    const hashPercentage = (hash % 100);
    
    return hashPercentage < this.newVersionPercentage;
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  updatePercentage(percentage: number): void {
    this.newVersionPercentage = Math.max(0, Math.min(100, percentage));
  }
}

// Usage in worker
const trafficSplitter = new TrafficSplitter(5); // Start with 5%

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // For gradual migration, route to appropriate version
    if (!trafficSplitter.shouldUseNewVersion(request)) {
      // Route to old Django server
      const djangoUrl = new URL(request.url);
      djangoUrl.hostname = 'old-api.list-cutter.com';
      
      return fetch(djangoUrl.href, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
    }
    
    // Handle request with new Workers version
    return handleRequest(request, env, ctx);
  }
};
```

### Migration Control Dashboard

```typescript
// src/routes/admin/migration.ts
export async function migrationControl(
  request: Request,
  env: Env
): Promise<Response> {
  // Only allow admin users
  const user = await getAuthenticatedUser(request, env);
  if (!user || !user.is_admin) {
    return new Response('Forbidden', { status: 403 });
  }
  
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  switch (action) {
    case 'get_status':
      return getMigrationStatus(env);
    case 'update_percentage':
      const percentage = parseInt(url.searchParams.get('percentage') || '0');
      return updateTrafficPercentage(percentage, env);
    case 'enable_maintenance':
      return enableMaintenanceMode(env);
    case 'disable_maintenance':
      return disableMaintenanceMode(env);
    default:
      return new Response('Invalid action', { status: 400 });
  }
}

async function getMigrationStatus(env: Env): Promise<Response> {
  const status = {
    traffic_percentage: await env.MIGRATION_KV.get('traffic_percentage') || '0',
    maintenance_mode: await env.MIGRATION_KV.get('maintenance_mode') === 'true',
    last_updated: await env.MIGRATION_KV.get('last_updated'),
    active_users: await getActiveUserCount(env),
    error_rate: await getErrorRate(env)
  };
  
  return new Response(JSON.stringify(status), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function updateTrafficPercentage(percentage: number, env: Env): Promise<Response> {
  await env.MIGRATION_KV.put('traffic_percentage', percentage.toString());
  await env.MIGRATION_KV.put('last_updated', new Date().toISOString());
  
  return new Response(JSON.stringify({ 
    success: true, 
    percentage 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## Blue-Green Deployment

### Blue-Green Infrastructure

```typescript
// src/middleware/blueGreen.ts
export class BlueGreenManager {
  private currentVersion: 'blue' | 'green' = 'blue';
  
  constructor(private env: Env) {}
  
  async getCurrentVersion(): Promise<'blue' | 'green'> {
    const stored = await this.env.DEPLOYMENT_KV.get('current_version');
    return (stored as 'blue' | 'green') || this.currentVersion;
  }
  
  async switchToVersion(version: 'blue' | 'green'): Promise<void> {
    await this.env.DEPLOYMENT_KV.put('current_version', version);
    await this.env.DEPLOYMENT_KV.put('switched_at', new Date().toISOString());
    this.currentVersion = version;
  }
  
  async getVersionHealth(version: 'blue' | 'green'): Promise<{
    healthy: boolean;
    responseTime: number;
    errorRate: number;
  }> {
    const endpoint = version === 'blue' 
      ? 'https://blue-api.list-cutter.com/health'
      : 'https://green-api.list-cutter.com/health';
    
    const start = performance.now();
    
    try {
      const response = await fetch(endpoint, { 
        timeout: 5000,
        headers: { 'User-Agent': 'BlueGreen-HealthCheck' }
      });
      
      const responseTime = performance.now() - start;
      const healthy = response.ok;
      
      // Get error rate from health endpoint
      const data = await response.json();
      const errorRate = data.metrics?.error_rate || 0;
      
      return { healthy, responseTime, errorRate };
    } catch (error) {
      return { 
        healthy: false, 
        responseTime: performance.now() - start, 
        errorRate: 100 
      };
    }
  }
  
  async canSwitchToVersion(version: 'blue' | 'green'): Promise<boolean> {
    const health = await this.getVersionHealth(version);
    
    // Health criteria for switching
    return health.healthy && 
           health.responseTime < 1000 && 
           health.errorRate < 1;
  }
}
```

### Automated Blue-Green Deployment

```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

set -e

CURRENT_VERSION=$(curl -s https://api.list-cutter.com/admin/deployment/current | jq -r '.version')
NEW_VERSION=$([[ "$CURRENT_VERSION" == "blue" ]] && echo "green" || echo "blue")

echo "🔄 Starting Blue-Green deployment..."
echo "📊 Current version: $CURRENT_VERSION"
echo "🆕 New version: $NEW_VERSION"

# Deploy to inactive environment
echo "📦 Deploying to $NEW_VERSION environment..."
wrangler deploy --env $NEW_VERSION

# Wait for deployment to be ready
echo "⏳ Waiting for $NEW_VERSION to be ready..."
sleep 30

# Health check new version
echo "🏥 Health checking $NEW_VERSION..."
for i in {1..10}; do
    if curl -f -s "https://${NEW_VERSION}-api.list-cutter.com/health" > /dev/null; then
        echo "✅ $NEW_VERSION is healthy"
        break
    fi
    
    if [ $i -eq 10 ]; then
        echo "❌ $NEW_VERSION health check failed"
        exit 1
    fi
    
    echo "⏳ Attempt $i/10..."
    sleep 10
done

# Run smoke tests on new version
echo "🧪 Running smoke tests on $NEW_VERSION..."
./scripts/smoke-test.sh "https://${NEW_VERSION}-api.list-cutter.com"

if [ $? -ne 0 ]; then
    echo "❌ Smoke tests failed for $NEW_VERSION"
    exit 1
fi

# Switch traffic to new version
echo "🔀 Switching traffic to $NEW_VERSION..."
curl -X POST "https://api.list-cutter.com/admin/deployment/switch" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"version\": \"$NEW_VERSION\"}"

# Monitor for 5 minutes
echo "📊 Monitoring $NEW_VERSION for 5 minutes..."
for i in {1..30}; do
    HEALTH=$(curl -s "https://api.list-cutter.com/health" | jq -r '.status')
    ERROR_RATE=$(curl -s "https://api.list-cutter.com/metrics" | jq -r '.error_rate')
    
    if [ "$HEALTH" != "healthy" ] || (( $(echo "$ERROR_RATE > 5" | bc -l) )); then
        echo "❌ Issues detected with $NEW_VERSION"
        echo "🔄 Rolling back to $CURRENT_VERSION..."
        
        curl -X POST "https://api.list-cutter.com/admin/deployment/switch" \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"version\": \"$CURRENT_VERSION\"}"
        
        exit 1
    fi
    
    echo "✅ $NEW_VERSION healthy (check $i/30)"
    sleep 10
done

echo "🎉 Blue-Green deployment to $NEW_VERSION completed successfully!"
```

## Monitoring and Alerting

### Production Monitoring Setup

```typescript
// src/services/monitoring.ts
export class ProductionMonitor {
  private metrics: Map<string, number> = new Map();
  
  constructor(private env: Env) {}
  
  async recordMetric(name: string, value: number, tags: Record<string, string> = {}): Promise<void> {
    // Store in Analytics Engine
    await this.env.ANALYTICS.writeDataPoint({
      blobs: [name, JSON.stringify(tags)],
      doubles: [value],
      indexes: [new Date().toISOString()]
    });
    
    // Update local metrics
    this.metrics.set(name, value);
  }
  
  async recordError(error: Error, context: Record<string, any> = {}): Promise<void> {
    const errorData = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      context
    };
    
    // Send to external monitoring service (e.g., Sentry)
    if (this.env.SENTRY_DSN) {
      await this.sendToSentry(errorData);
    }
    
    // Store in Analytics Engine
    await this.env.ANALYTICS.writeDataPoint({
      blobs: ['error', error.message, JSON.stringify(context)],
      doubles: [1],
      indexes: [new Date().toISOString()]
    });
  }
  
  async checkSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, any>;
  }> {
    const checks = {
      database: await this.checkDatabase(),
      storage: await this.checkStorage(),
      memory: await this.checkMemory(),
      responseTime: await this.checkResponseTime()
    };
    
    const unhealthyChecks = Object.values(checks).filter(check => !check.healthy);
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyChecks.length === 0) {
      status = 'healthy';
    } else if (unhealthyChecks.length <= 1) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }
    
    return { status, checks };
  }
  
  private async checkDatabase(): Promise<{ healthy: boolean; latency: number }> {
    const start = performance.now();
    
    try {
      await this.env.DB.prepare('SELECT 1').first();
      const latency = performance.now() - start;
      return { healthy: latency < 100, latency };
    } catch (error) {
      return { healthy: false, latency: performance.now() - start };
    }
  }
  
  private async checkStorage(): Promise<{ healthy: boolean; latency: number }> {
    const start = performance.now();
    
    try {
      await this.env.FILE_STORAGE.head('health-check');
      const latency = performance.now() - start;
      return { healthy: latency < 200, latency };
    } catch (error) {
      return { healthy: false, latency: performance.now() - start };
    }
  }
  
  private async checkMemory(): Promise<{ healthy: boolean; usage: number }> {
    // Get memory usage (approximation)
    const usage = (performance as any).memory?.usedJSHeapSize || 0;
    const limit = 128 * 1024 * 1024; // 128MB limit
    
    return { healthy: usage < limit * 0.8, usage };
  }
  
  private async checkResponseTime(): Promise<{ healthy: boolean; avgTime: number }> {
    const avgResponseTime = this.metrics.get('response_time_avg') || 0;
    return { healthy: avgResponseTime < 200, avgTime: avgResponseTime };
  }
  
  private async sendToSentry(errorData: any): Promise<void> {
    try {
      await fetch('https://sentry.io/api/your-project/store/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_key=${this.env.SENTRY_DSN}`
        },
        body: JSON.stringify(errorData)
      });
    } catch (error) {
      console.error('Failed to send error to Sentry:', error);
    }
  }
}
```

### Alert Configuration

```typescript
// src/services/alerting.ts
export class AlertManager {
  private alertThresholds = {
    errorRate: 5, // 5%
    responseTime: 1000, // 1 second
    cpuUsage: 80, // 80%
    memoryUsage: 80, // 80%
    diskUsage: 90 // 90%
  };
  
  constructor(private env: Env) {}
  
  async checkAlerts(): Promise<void> {
    const metrics = await this.getMetrics();
    
    // Check error rate
    if (metrics.errorRate > this.alertThresholds.errorRate) {
      await this.sendAlert('high_error_rate', {
        current: metrics.errorRate,
        threshold: this.alertThresholds.errorRate
      });
    }
    
    // Check response time
    if (metrics.avgResponseTime > this.alertThresholds.responseTime) {
      await this.sendAlert('high_response_time', {
        current: metrics.avgResponseTime,
        threshold: this.alertThresholds.responseTime
      });
    }
    
    // Check memory usage
    if (metrics.memoryUsage > this.alertThresholds.memoryUsage) {
      await this.sendAlert('high_memory_usage', {
        current: metrics.memoryUsage,
        threshold: this.alertThresholds.memoryUsage
      });
    }
  }
  
  private async sendAlert(type: string, data: any): Promise<void> {
    const alert = {
      type,
      severity: this.getAlertSeverity(type),
      timestamp: new Date().toISOString(),
      data,
      environment: this.env.ENVIRONMENT
    };
    
    // Send to multiple channels
    await Promise.all([
      this.sendEmailAlert(alert),
      this.sendSlackAlert(alert),
      this.sendPagerDutyAlert(alert)
    ]);
  }
  
  private async sendEmailAlert(alert: any): Promise<void> {
    // Implementation for email alerts
  }
  
  private async sendSlackAlert(alert: any): Promise<void> {
    // Implementation for Slack alerts
  }
  
  private async sendPagerDutyAlert(alert: any): Promise<void> {
    // Implementation for PagerDuty alerts
  }
  
  private getAlertSeverity(type: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      high_error_rate: 'high',
      high_response_time: 'medium',
      high_memory_usage: 'medium',
      service_down: 'critical'
    };
    
    return severityMap[type] || 'low';
  }
  
  private async getMetrics(): Promise<{
    errorRate: number;
    avgResponseTime: number;
    memoryUsage: number;
  }> {
    // Implementation to fetch current metrics
    return {
      errorRate: 0,
      avgResponseTime: 0,
      memoryUsage: 0
    };
  }
}
```

## Data Migration Execution

### Phase 5 Follow-up Prerequisites ⚠️

**🔴 CRITICAL DEPENDENCY**: Phase 8 deployment requires completion of Phase 5 follow-up tasks for data migration capabilities.

#### Required Phase 5 Follow-up Completions

**BLOCKING Phase 8 Deployment:**
- **Issue #64**: Missing D1 database tables for R2 operations
  - **Impact**: Cannot migrate user files without proper database schema
  - **Status**: BLOCKS Phase 8 - must complete before any migration work
  
- **Issue #66**: Create data migration tools for existing files to R2 storage
  - **Impact**: No tools to migrate Django filesystem files to R2
  - **Status**: BLOCKS cutover - production cannot access existing user data

**SUPPORTING Phase 8 Operations:**
- **Issue #65**: R2 storage monitoring and cost management
  - **Impact**: No visibility into production R2 operations and costs
  - **Recommendation**: Complete before production cutover for operational safety

- **Issue #68**: Disaster recovery and backup procedures for R2 storage
  - **Impact**: No backup/recovery capabilities for production file data
  - **Recommendation**: Complete before production cutover for business continuity

#### Updated Phase 8 Prerequisites

**Before Starting Phase 8:**
1. **Complete Issue #64** - Database tables (CRITICAL)
2. **Complete Issue #66** - Migration tools (REQUIRED)
3. **Complete Issue #65** - Monitoring setup (RECOMMENDED)
4. **Complete Issue #68** - Backup procedures (RECOMMENDED)

**Migration Tool Integration:**
Phase 8 will leverage the migration tools from Issue #66:
- File migration assessment and planning scripts
- Batch migration workers with integrity verification
- Progress tracking and reporting systems
- Rollback capabilities for failed migrations

See [GitHub Issues #64-69](https://github.com/emily-flambe/list-cutter/issues?q=is%3Aissue+is%3Aopen+label%3Aphase-5-followup) for complete implementation details.

### Production Data Migration

```typescript
// scripts/production-migration.ts
export class ProductionDataMigration {
  private batchSize = 100;
  private maxRetries = 3;
  
  constructor(
    private sourceDB: any, // Django PostgreSQL
    private targetDB: D1Database,
    private targetStorage: R2Bucket
  ) {}
  
  async executeFullMigration(): Promise<{
    success: boolean;
    usersmigrated: number;
    filesMigrated: number;
    errors: string[];
  }> {
    const result = {
      success: true,
      usersmigrated: 0,
      filesMigrated: 0,
      errors: [] as string[]
    };
    
    try {
      console.log('🚀 Starting production data migration...');
      
      // Phase 1: Migrate users
      result.usersmigrated = await this.migrateUsers();
      console.log(`✅ Migrated ${result.usersM igrated} users`);
      
      // Phase 2: Migrate files metadata
      const filesMigration = await this.migrateFiles();
      result.filesMigrated = filesMigration.count;
      result.errors.push(...filesMigration.errors);
      console.log(`✅ Migrated ${result.filesMigrated} files`);
      
      // Phase 3: Migrate file data to R2
      await this.migrateFileData();
      console.log('✅ File data migration completed');
      
      // Phase 4: Migrate saved filters
      await this.migrateSavedFilters();
      console.log('✅ Saved filters migration completed');
      
      // Phase 5: Validation
      await this.validateMigration();
      console.log('✅ Migration validation completed');
      
    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
      console.error('❌ Migration failed:', error);
    }
    
    return result;
  }
  
  private async migrateUsers(): Promise<number> {
    let offset = 0;
    let totalMigrated = 0;
    
    while (true) {
      const users = await this.sourceDB.query(`
        SELECT id, username, email, password, date_joined, last_login, is_active, is_staff
        FROM auth_user
        ORDER BY id
        LIMIT ${this.batchSize} OFFSET ${offset}
      `);
      
      if (users.rows.length === 0) break;
      
      for (const user of users.rows) {
        await this.migrateUser(user);
        totalMigrated++;
      }
      
      offset += this.batchSize;
      console.log(`Migrated ${totalMigrated} users...`);
    }
    
    return totalMigrated;
  }
  
  private async migrateUser(sourceUser: any): Promise<void> {
    const stmt = this.targetDB.prepare(`
      INSERT INTO users (
        id, username, email, password, created_at, last_login, is_active, is_admin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.bind(
      sourceUser.id,
      sourceUser.username,
      sourceUser.email,
      sourceUser.password, // Already hashed
      sourceUser.date_joined,
      sourceUser.last_login,
      sourceUser.is_active ? 1 : 0,
      sourceUser.is_staff ? 1 : 0
    ).run();
  }
  
  private async migrateFiles(): Promise<{ count: number; errors: string[] }> {
    let offset = 0;
    let totalMigrated = 0;
    const errors: string[] = [];
    
    while (true) {
      const files = await this.sourceDB.query(`
        SELECT f.*, u.id as user_id
        FROM list_cutter_savedfile f
        JOIN auth_user u ON f.user_id = u.id
        ORDER BY f.id
        LIMIT ${this.batchSize} OFFSET ${offset}
      `);
      
      if (files.rows.length === 0) break;
      
      for (const file of files.rows) {
        try {
          await this.migrateFile(file);
          totalMigrated++;
        } catch (error) {
          errors.push(`Failed to migrate file ${file.file_id}: ${error.message}`);
        }
      }
      
      offset += this.batchSize;
      console.log(`Migrated ${totalMigrated} files...`);
    }
    
    return { count: totalMigrated, errors };
  }
  
  private async migrateFile(sourceFile: any): Promise<void> {
    // Generate R2 key
    const r2Key = `uploads/user-${sourceFile.user_id}/${sourceFile.file_id}.csv`;
    
    const stmt = this.targetDB.prepare(`
      INSERT INTO files (
        user_id, file_id, filename, original_filename, file_size, 
        mime_type, r2_key, upload_status, created_at, updated_at,
        tags, row_count, column_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.bind(
      sourceFile.user_id,
      sourceFile.file_id,
      sourceFile.file_name,
      sourceFile.file_name,
      sourceFile.file_size || 0,
      'text/csv',
      r2Key,
      'completed',
      sourceFile.uploaded_at,
      sourceFile.uploaded_at,
      JSON.stringify(sourceFile.system_tags || []),
      null, // Row count to be calculated
      null  // Column count to be calculated
    ).run();
  }
  
  private async migrateFileData(): Promise<void> {
    // Get all files that need data migration
    const files = await this.targetDB.prepare(`
      SELECT user_id, file_id, r2_key, filename
      FROM files
      WHERE upload_status = 'completed'
    `).all();
    
    for (const file of files.results) {
      try {
        await this.migrateFileToR2(file);
      } catch (error) {
        console.error(`Failed to migrate file data for ${file.file_id}:`, error);
      }
    }
  }
  
  private async migrateFileToR2(file: any): Promise<void> {
    // Read file from Django media directory
    const localPath = `./django_media/uploads/${file.filename}`;
    const fileData = await this.readLocalFile(localPath);
    
    if (!fileData) {
      throw new Error(`File not found: ${localPath}`);
    }
    
    // Upload to R2
    await this.targetStorage.put(file.r2_key, fileData, {
      httpMetadata: {
        contentType: 'text/csv',
        cacheControl: 'public, max-age=3600'
      },
      customMetadata: {
        originalName: file.filename,
        userId: file.user_id.toString(),
        fileId: file.file_id,
        migratedAt: new Date().toISOString()
      }
    });
    
    console.log(`✅ Migrated ${file.filename} to R2`);
  }
  
  private async readLocalFile(path: string): Promise<ArrayBuffer | null> {
    // Implementation depends on migration environment
    // This would be different in Node.js vs browser environment
    try {
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(path);
      return buffer.buffer;
    } catch (error) {
      console.error(`Failed to read file ${path}:`, error);
      return null;
    }
  }
  
  private async validateMigration(): Promise<void> {
    // Validate user migration
    const userCount = await this.targetDB.prepare('SELECT COUNT(*) as count FROM users').first();
    console.log(`Total users in target DB: ${userCount.count}`);
    
    // Validate file migration
    const fileCount = await this.targetDB.prepare('SELECT COUNT(*) as count FROM files').first();
    console.log(`Total files in target DB: ${fileCount.count}`);
    
    // Sample validation - check random files exist in R2
    const sampleFiles = await this.targetDB.prepare(`
      SELECT r2_key FROM files ORDER BY RANDOM() LIMIT 10
    `).all();
    
    for (const file of sampleFiles.results) {
      const exists = await this.targetStorage.head(file.r2_key);
      if (!exists) {
        throw new Error(`File missing in R2: ${file.r2_key}`);
      }
    }
    
    console.log('✅ Migration validation passed');
  }
}
```

## Cutover Execution Plan

### Cutover Runbook

```bash
#!/bin/bash
# scripts/execute-cutover.sh

set -e

echo "🚀 Starting List Cutter Production Cutover"
echo "============================================"

# Pre-cutover checklist
echo "📋 Pre-cutover checklist:"
echo "- [ ] All tests passing"
echo "- [ ] Staging environment validated"
echo "- [ ] Data migration completed"
echo "- [ ] Rollback plan ready"
echo "- [ ] Team notifications sent"

read -p "Continue with cutover? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cutover cancelled"
    exit 1
fi

# Record cutover start
CUTOVER_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "🕐 Cutover started at: $CUTOVER_START"

# Step 1: Enable maintenance mode on Django
echo "🛠️  Step 1: Enabling maintenance mode..."
curl -X POST "https://old-api.list-cutter.com/admin/maintenance/enable" \
    -H "Authorization: Bearer $ADMIN_TOKEN"

if [ $? -ne 0 ]; then
    echo "❌ Failed to enable maintenance mode"
    exit 1
fi

sleep 10 # Allow time for requests to complete

# Step 2: Final data sync
echo "🔄 Step 2: Final data synchronization..."
./scripts/final-data-sync.sh

if [ $? -ne 0 ]; then
    echo "❌ Final data sync failed"
    echo "🔄 Disabling maintenance mode..."
    curl -X POST "https://old-api.list-cutter.com/admin/maintenance/disable" \
        -H "Authorization: Bearer $ADMIN_TOKEN"
    exit 1
fi

# Step 3: Update DNS records
echo "🌐 Step 3: Updating DNS records..."
./scripts/update-dns-to-workers.sh

if [ $? -ne 0 ]; then
    echo "❌ DNS update failed"
    echo "🔄 Rolling back..."
    ./scripts/rollback-cutover.sh
    exit 1
fi

# Step 4: Verify new system
echo "✅ Step 4: Verifying new system..."
sleep 30 # Wait for DNS propagation

# Health check
for i in {1..5}; do
    if curl -f -s "https://api.list-cutter.com/health" > /dev/null; then
        echo "✅ New system is healthy"
        break
    fi
    
    if [ $i -eq 5 ]; then
        echo "❌ New system health check failed"
        echo "🔄 Rolling back..."
        ./scripts/rollback-cutover.sh
        exit 1
    fi
    
    echo "⏳ Waiting for new system... ($i/5)"
    sleep 30
done

# Step 5: Smoke tests
echo "🧪 Step 5: Running production smoke tests..."
./scripts/production-smoke-tests.sh

if [ $? -ne 0 ]; then
    echo "❌ Smoke tests failed"
    echo "🔄 Rolling back..."
    ./scripts/rollback-cutover.sh
    exit 1
fi

# Step 6: Monitor for 10 minutes
echo "📊 Step 6: Monitoring for 10 minutes..."
for i in {1..60}; do
    # Check health
    HEALTH=$(curl -s "https://api.list-cutter.com/health" | jq -r '.status')
    ERROR_RATE=$(curl -s "https://api.list-cutter.com/metrics" | jq -r '.error_rate')
    
    if [ "$HEALTH" != "healthy" ]; then
        echo "❌ System unhealthy at minute $((i/6))"
        echo "🔄 Rolling back..."
        ./scripts/rollback-cutover.sh
        exit 1
    fi
    
    if (( $(echo "$ERROR_RATE > 5" | bc -l) )); then
        echo "❌ High error rate detected: $ERROR_RATE%"
        echo "🔄 Rolling back..."
        ./scripts/rollback-cutover.sh
        exit 1
    fi
    
    if [ $((i % 6)) -eq 0 ]; then
        echo "✅ Minute $((i/6))/10: Health=$HEALTH, Error Rate=$ERROR_RATE%"
    fi
    
    sleep 10
done

# Step 7: Cutover complete
CUTOVER_END=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "🎉 Cutover completed successfully!"
echo "🕐 Duration: $CUTOVER_START to $CUTOVER_END"

# Step 8: Post-cutover tasks
echo "📝 Step 8: Post-cutover tasks..."
./scripts/post-cutover-tasks.sh

echo "✅ List Cutter is now running on Cloudflare Workers!"
```

### Rollback Procedure

```bash
#!/bin/bash
# scripts/rollback-cutover.sh

set -e

echo "🔄 EMERGENCY ROLLBACK - Reverting to Django system"
echo "=================================================="

# Step 1: Revert DNS records
echo "🌐 Step 1: Reverting DNS records..."
./scripts/revert-dns-to-django.sh

# Step 2: Disable maintenance mode on Django
echo "🛠️  Step 2: Disabling maintenance mode on Django..."
curl -X POST "https://old-api.list-cutter.com/admin/maintenance/disable" \
    -H "Authorization: Bearer $ADMIN_TOKEN"

# Step 3: Verify Django system
echo "✅ Step 3: Verifying Django system..."
sleep 30 # Wait for DNS propagation

for i in {1..5}; do
    if curl -f -s "https://api.list-cutter.com/health" > /dev/null; then
        echo "✅ Django system is healthy"
        break
    fi
    
    if [ $i -eq 5 ]; then
        echo "❌ Django system health check failed"
        echo "🚨 CRITICAL: Both systems may be down!"
        exit 1
    fi
    
    echo "⏳ Waiting for Django system... ($i/5)"
    sleep 30
done

# Step 4: Sync any data created during cutover
echo "🔄 Step 4: Syncing data created during cutover window..."
./scripts/reverse-data-sync.sh

echo "✅ Rollback completed - Django system restored"
```

## Implementation Timeline

### Phase 8 Schedule (1 week)

#### Day 1-2: Environment Setup
- Production environment configuration
- DNS and SSL setup
- Monitoring and alerting configuration

#### Day 3-4: Staging Deployment
- Deploy to staging environment
- Comprehensive staging testing
- Performance benchmarking

#### Day 5: Blue-Green Setup
- Blue-green infrastructure setup
- Traffic splitting implementation
- Automated deployment scripts

#### Day 6: Data Migration
- Execute production data migration
- Validation and verification
- Final data synchronization

#### Day 7: Production Cutover
- Execute cutover plan
- Monitor system performance
- Post-cutover validation

### Success Criteria

- **Zero Downtime**: Complete cutover with no service interruption
- **Data Integrity**: 100% data migration with validation
- **Performance**: Response times <100ms post-cutover
- **Monitoring**: Full observability and alerting operational
- **Rollback Ready**: Tested rollback procedures available

## Unified Architecture Deployment Benefits

The unified Workers deployment transforms the deployment and cutover process:

### Deployment Advantages
1. **Single Deployment Command**: Deploy entire application with `wrangler deploy`
2. **Atomic Updates**: Frontend and backend always deployed together
3. **Instant Rollback**: Revert entire application in seconds
4. **Simplified DNS**: One domain configuration instead of multiple
5. **Unified Monitoring**: Single dashboard for entire application

### Cutover Simplification
- **One Service to Migrate**: Replace Django monolith with Workers monolith
- **Single DNS Switch**: Point domain to Workers and done
- **Unified Testing**: Test entire application as one unit
- **Simplified Validation**: One health check covers everything
- **Reduced Risk**: Fewer moving parts mean fewer failure points

### Operational Benefits
1. **Simplified CI/CD**: One pipeline, one build, one deploy
2. **Consistent Environments**: Dev, staging, and prod are identical
3. **Better Observability**: All logs and metrics in one place
4. **Cost Efficiency**: One Worker, one bill, no complex pricing
5. **Global Performance**: Automatic edge deployment everywhere

### Risk Reduction
- **Atomic Rollback**: Revert everything instantly if issues arise
- **Blue-Green Simplicity**: Workers handles it automatically
- **No Version Mismatch**: Frontend and backend always in sync
- **Unified Testing**: Catch issues before production
- **Single Point of Monitoring**: Detect problems faster

This comprehensive deployment and cutover plan leverages the unified Workers architecture to ensure a smooth, low-risk transition from Django while dramatically simplifying the deployment process and ongoing operations.