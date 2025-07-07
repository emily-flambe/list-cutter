# Phase 1: Development Environment Setup - Technical Implementation Plan

## Overview
This document provides exact implementation steps for setting up the Cloudflare Workers development environment for the List Cutter migration. All commands and configurations are prescriptive and ready for execution by a Claude agent.

## Prerequisites Validation

### Step 1.1: Verify Node.js Version
```bash
node --version
```
**Expected Output**: v20.x.x or higher (LTS version recommended)
**Error Handling**: If Node.js is not installed or version < 20:
```bash
# macOS with Homebrew
brew install node@20

# Verify installation
node --version
npm --version
```

### Step 1.2: Verify Git Repository
```bash
git status
```
**Expected Output**: Should show clean working tree on main branch
**Error Handling**: If not on main branch:
```bash
git checkout main
git pull origin main
```

## Cloudflare Account Setup

### Step 2.1: Install Wrangler CLI
```bash
npm install -g wrangler@latest
```
**Expected Output**: Installation complete without errors
**Validation**:
```bash
wrangler --version
```
**Expected Version**: 3.x.x or higher

### Step 2.2: Authenticate with Cloudflare
```bash
wrangler login
```
**Expected Behavior**: Opens browser for OAuth authentication
**Validation**:
```bash
wrangler whoami
```
**Expected Output**: Shows authenticated user email

## Project Structure Creation

### Step 3.1: Create Cloudflare Project Structure
```bash
# Create main cloudflare directory
mkdir -p cloudflare/{workers,pages,packages/shared,migrations}

# Create workers subdirectories
mkdir -p cloudflare/workers/{src/{routes/{auth,csv,files,users},services,db,middleware,utils,types},tests,scripts}

# Create pages subdirectory (for frontend)
mkdir -p cloudflare/pages
```

### Step 3.2: Initialize Workers Project
```bash
cd cloudflare/workers

# Initialize TypeScript project
npm init -y

# Update package.json
cat > package.json << 'EOF'
{
  "name": "cutty-workers",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "deploy:staging": "wrangler deploy --env staging",
    "deploy:production": "wrangler deploy --env production",
    "types": "wrangler types",
    "test": "vitest",
    "test:ci": "vitest run",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write \"src/**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "build": "esbuild src/index.ts --bundle --format=esm --outfile=dist/index.js --platform=node --target=es2022",
    "cf-typegen": "wrangler types --env-interface CloudflareEnv"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.38",
    "@cloudflare/workers-types": "^4.20241230.0",
    "@types/node": "^22.10.6",
    "@typescript-eslint/eslint-plugin": "^8.20.0",
    "@typescript-eslint/parser": "^8.20.0",
    "esbuild": "^0.24.2",
    "eslint": "^9.17.0",
    "prettier": "^3.4.2",
    "typescript": "^5.7.3",
    "vitest": "^2.1.8",
    "wrangler": "^3.98.0"
  },
  "dependencies": {
    "@hono/hono": "^4.6.16",
    "drizzle-orm": "^0.38.4",
    "jose": "^5.10.0",
    "zod": "^3.24.1"
  }
}
EOF
```

### Step 3.3: Install Dependencies
```bash
npm install
```
**Expected Output**: All dependencies installed successfully
**Validation**:
```bash
npm ls --depth=0
```

## TypeScript Configuration

### Step 4.1: Create TypeScript Config
```bash
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "WebWorker"],
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "allowImportingTsExtensions": true,
    "strict": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "allowJs": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "newLine": "lf",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "types": [
      "@cloudflare/workers-types/2024"
    ],
    "paths": {
      "@/*": ["./src/*"],
      "@types/*": ["./src/types/*"],
      "@routes/*": ["./src/routes/*"],
      "@services/*": ["./src/services/*"],
      "@db/*": ["./src/db/*"],
      "@middleware/*": ["./src/middleware/*"],
      "@utils/*": ["./src/utils/*"]
    }
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
EOF
```

### Step 4.2: Create ESLint Configuration
```bash
cat > eslint.config.js << 'EOF'
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': typescript
    },
    rules: {
      ...typescript.configs['recommended'].rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  }
];
EOF
```

### Step 4.3: Create Prettier Configuration
```bash
cat > .prettierrc.json << 'EOF'
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
EOF

cat > .prettierignore << 'EOF'
node_modules
dist
.wrangler
coverage
*.min.js
EOF
```

## Wrangler Configuration

### Step 5.1: Create Main Wrangler Configuration
```bash
cat > wrangler.toml << 'EOF'
name = "cutty-api"
main = "src/index.ts"
compatibility_date = "2024-12-30"
compatibility_flags = ["nodejs_compat"]
workers_dev = true

# Development configuration
[dev]
port = 8788
local_protocol = "http"
ip = "127.0.0.1"

# Build configuration
[build]
command = "npm run build"

# Environment variables (non-sensitive)
[vars]
ENVIRONMENT = "development"
API_VERSION = "v1"
CORS_ORIGIN = "http://localhost:5173"
MAX_FILE_SIZE = "52428800" # 50MB in bytes
JWT_ISSUER = "cutty"
JWT_AUDIENCE = "cutty-api"

# D1 Database bindings
[[d1_databases]]
binding = "DB"
database_name = "cutty-dev"
database_id = "PLACEHOLDER_DB_ID"
migrations_dir = "../../migrations"

# R2 Storage bindings
[[r2_buckets]]
binding = "FILE_STORAGE"
bucket_name = "cutty-files-dev"
<<<<<<< HEAD
preview_bucket_name = "cutty-files-dev"
=======
preview_bucket_name = "cutty-files-preview"
>>>>>>> origin/main

# KV Namespace bindings (for JWT refresh tokens)
[[kv_namespaces]]
binding = "AUTH_TOKENS"
id = "PLACEHOLDER_KV_ID"
preview_id = "PLACEHOLDER_KV_PREVIEW_ID"

# Queue bindings (for async processing)
[[queues.producers]]
binding = "CSV_QUEUE"
queue = "csv-processing"

[[queues.consumers]]
queue = "csv-processing"

# Analytics Engine binding
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "list_cutter_analytics"

# Staging environment
[env.staging]
name = "cutty-api-staging"
vars = { ENVIRONMENT = "staging", CORS_ORIGIN = "https://staging.cutty.com" }

[[env.staging.d1_databases]]
binding = "DB"
database_name = "cutty-staging"
database_id = "PLACEHOLDER_STAGING_DB_ID"

[[env.staging.r2_buckets]]
binding = "FILE_STORAGE"
bucket_name = "cutty-files-staging"

[[env.staging.kv_namespaces]]
binding = "AUTH_TOKENS"
id = "PLACEHOLDER_STAGING_KV_ID"

# Production environment
[env.production]
name = "cutty-api-production"
vars = { ENVIRONMENT = "production", CORS_ORIGIN = "https://cutty.com" }
routes = [
  { pattern = "api.cutty.com/*", zone_name = "cutty.com" }
]

[[env.production.d1_databases]]
binding = "DB"
database_name = "cutty-production"
database_id = "PLACEHOLDER_PROD_DB_ID"

[[env.production.r2_buckets]]
binding = "FILE_STORAGE"
<<<<<<< HEAD
bucket_name = "cutty-files-prod"
=======
bucket_name = "cutty-files-production"
>>>>>>> origin/main

[[env.production.kv_namespaces]]
binding = "AUTH_TOKENS"
id = "PLACEHOLDER_PROD_KV_ID"

# Service bindings for microservices architecture (future)
# [[services]]
# binding = "AUTH_SERVICE"
# service = "cutty-auth"

# Rate limiting rules
[[unsafe.bindings]]
name = "RATE_LIMITER"
type = "ratelimit"
namespace_id = "1"
simple = { limit = 100, period = 60 }
EOF
```

### Step 5.2: Create Development Variables File
```bash
cat > .dev.vars << 'EOF'
# JWT Secrets (generate new ones for production)
JWT_SECRET="development-secret-change-this-in-production"
JWT_REFRESH_SECRET="development-refresh-secret-change-this"

# Database encryption key
DB_ENCRYPTION_KEY="development-encryption-key-32-chars"

# External API keys (if needed)
# SENDGRID_API_KEY="your-sendgrid-key"
# SENTRY_DSN="your-sentry-dsn"

# Development flags
DEBUG_MODE="true"
LOG_LEVEL="debug"
EOF

# Add to .gitignore
echo ".dev.vars" >> .gitignore
echo ".dev.vars.*" >> .gitignore
```

## Testing Setup

### Step 6.1: Create Vitest Configuration
```bash
cat > vitest.config.ts << 'EOF'
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        'tests/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80
      }
    },
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts']
  },
  miniflare: {
    compatibilityDate: '2024-12-30',
    compatibilityFlags: ['nodejs_compat'],
    kvNamespaces: ['AUTH_TOKENS'],
    d1Databases: ['DB'],
    r2Buckets: ['FILE_STORAGE'],
    bindings: {
      ENVIRONMENT: 'test',
      API_VERSION: 'v1',
      JWT_SECRET: 'test-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret'
    }
  }
});
EOF
```

### Step 6.2: Create Test Setup File
```bash
mkdir -p tests
cat > tests/setup.ts << 'EOF'
import { beforeAll, afterAll, beforeEach } from 'vitest';

// Global test setup
beforeAll(() => {
  console.log('Starting test suite...');
});

afterAll(() => {
  console.log('Test suite completed.');
});

beforeEach(() => {
  // Reset any mocks or test data
});

// Add custom matchers if needed
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeValidJWT(): T;
    toBeValidUUID(): T;
  }
}
EOF
```

## Initial Source Files

### Step 7.1: Create Main Worker Entry Point
```bash
cat > src/index.ts << 'EOF'
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';
import type { CloudflareEnv } from './types/env';

// Import route handlers
// import authRoutes from '@routes/auth';
// import csvRoutes from '@routes/csv';
// import fileRoutes from '@routes/files';
// import userRoutes from '@routes/users';

const app = new Hono<{ Bindings: CloudflareEnv }>();

// Global middleware
app.use('*', timing());
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', prettyJSON());

// CORS configuration
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN || 'http://localhost:5173',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['X-Request-Id', 'X-Response-Time'],
    credentials: true,
    maxAge: 86400,
  });
  return corsMiddleware(c, next);
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    version: c.env.API_VERSION || 'v1',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
  });
});

// API version prefix
const v1 = app.basePath('/api/v1');

// Mount routes
// v1.route('/auth', authRoutes);
// v1.route('/csv', csvRoutes);
// v1.route('/files', fileRoutes);
// v1.route('/users', userRoutes);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: 'The requested resource does not exist',
      path: c.req.path,
    },
    404
  );
});

// Global error handler
app.onError((err, c) => {
  console.error(`Error: ${err.message}`, err.stack);
  
  const status = err instanceof Error && 'status' in err 
    ? (err as any).status 
    : 500;
    
  return c.json(
    {
      error: err.message || 'Internal Server Error',
      message: 'An unexpected error occurred',
      ...(c.env.ENVIRONMENT === 'development' && { stack: err.stack }),
    },
    status
  );
});

export default app;
EOF
```

### Step 7.2: Create Environment Types
```bash
cat > src/types/env.ts << 'EOF'
export interface CloudflareEnv {
  // Environment variables
  ENVIRONMENT: 'development' | 'staging' | 'production';
  API_VERSION: string;
  CORS_ORIGIN: string;
  MAX_FILE_SIZE: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  
  // Secrets (from .dev.vars or Wrangler secrets)
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  DB_ENCRYPTION_KEY: string;
  
  // Bindings
  DB: D1Database;
  FILE_STORAGE: R2Bucket;
  AUTH_TOKENS: KVNamespace;
  CSV_QUEUE: Queue;
  ANALYTICS: AnalyticsEngineDataset;
  
  // Optional bindings
  RATE_LIMITER?: any;
}

// Re-export for convenience
export type { D1Database, R2Bucket, KVNamespace, Queue, AnalyticsEngineDataset } from '@cloudflare/workers-types';
EOF
```

### Step 7.3: Create Initial Test
```bash
cat > tests/index.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json).toHaveProperty('status', 'healthy');
    expect(json).toHaveProperty('version');
    expect(json).toHaveProperty('environment');
    expect(json).toHaveProperty('timestamp');
  });
  
  it('should return 404 for unknown routes', async () => {
    const res = await app.request('/unknown');
    expect(res.status).toBe(404);
    
    const json = await res.json();
    expect(json).toHaveProperty('error', 'Not Found');
  });
});
EOF
```

## Database Setup

### Step 8.1: Create D1 Database
```bash
# Create development database
wrangler d1 create cutty-dev

# Expected output will include database_id
# Copy the database_id and update wrangler.toml
```

### Step 8.2: Create Initial Migration
```bash
mkdir -p migrations
cat > migrations/0001_initial_schema.sql << 'EOF'
-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    is_active BOOLEAN DEFAULT 1,
    is_admin BOOLEAN DEFAULT 0,
    email_verified BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Files table
CREATE TABLE files (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    r2_key TEXT UNIQUE NOT NULL,
    upload_status TEXT DEFAULT 'pending' CHECK (upload_status IN ('pending', 'processing', 'completed', 'failed')),
    processing_error TEXT,
    row_count INTEGER,
    column_count INTEGER,
    columns_metadata TEXT, -- JSON
    tags TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_created_at ON files(created_at);
CREATE INDEX idx_files_status ON files(upload_status);

-- Saved filters table
CREATE TABLE saved_filters (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    filter_config TEXT NOT NULL, -- JSON
    result_count INTEGER,
    is_public BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_saved_filters_user_id ON saved_filters(user_id);
CREATE INDEX idx_saved_filters_file_id ON saved_filters(file_id);

-- API keys table (for future use)
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]', -- JSON array
    last_used_at DATETIME,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- Audit log table
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata TEXT, -- JSON
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Create triggers for updated_at
CREATE TRIGGER update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_files_timestamp 
AFTER UPDATE ON files
BEGIN
    UPDATE files SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_saved_filters_timestamp 
AFTER UPDATE ON saved_filters
BEGIN
    UPDATE saved_filters SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
EOF
```

### Step 8.3: Apply Initial Migration
```bash
# Apply to local development database
wrangler d1 migrations apply cutty-dev --local

# Verify migration
wrangler d1 execute cutty-dev --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

## R2 Bucket Setup

### Step 9.1: Create R2 Buckets
```bash
# Create development bucket
wrangler r2 bucket create cutty-files-dev

# Create preview bucket
<<<<<<< HEAD
wrangler r2 bucket create cutty-files-staging
=======
wrangler r2 bucket create cutty-files-preview
>>>>>>> origin/main

# List buckets to verify
wrangler r2 bucket list
```

## KV Namespace Setup

### Step 10.1: Create KV Namespaces
```bash
# Create KV namespace for auth tokens
wrangler kv namespace create "AUTH_TOKENS"

# Create preview namespace
wrangler kv namespace create "AUTH_TOKENS" --preview

# The output will show the namespace IDs to add to wrangler.toml
```

## Validation Steps

### Step 11.1: Generate TypeScript Types
```bash
npm run types
```
**Expected Output**: Creates `worker-configuration.d.ts` file
**Validation**:
```bash
test -f worker-configuration.d.ts && echo "Types generated successfully" || echo "Types generation failed"
```

### Step 11.2: Run TypeScript Check
```bash
npm run typecheck
```
**Expected Output**: No TypeScript errors

### Step 11.3: Run Linter
```bash
npm run lint
```
**Expected Output**: No linting errors

### Step 11.4: Run Tests
```bash
npm test
```
**Expected Output**: All tests pass

### Step 11.5: Start Development Server
```bash
npm run dev
```
**Expected Output**: 
- Server starts on http://localhost:8788
- Health check accessible at http://localhost:8788/health

### Step 11.6: Test Health Endpoint
```bash
curl http://localhost:8788/health | jq .
```
**Expected Output**:
```json
{
  "status": "healthy",
  "version": "v1",
  "environment": "development",
  "timestamp": "2025-01-05T..."
}
```

## Common Issues and Solutions

### Issue 1: Wrangler Authentication Fails
**Error**: "You need to be logged in to use Wrangler"
**Solution**:
```bash
wrangler logout
wrangler login
```

### Issue 2: D1 Database Creation Fails
**Error**: "Failed to create database"
**Solution**:
- Ensure you have the correct Cloudflare account permissions
- Check if database name already exists
- Try with a different name

### Issue 3: TypeScript Types Not Generated
**Error**: "Cannot find module './worker-configuration'"
**Solution**:
```bash
rm -f worker-configuration.d.ts
npm run types
```

### Issue 4: Port Already in Use
**Error**: "Port 8788 is already in use"
**Solution**:
```bash
# Find process using port
lsof -i :8788
# Kill the process or use different port in wrangler.toml
```

## Next Steps Checklist

- [ ] All validation steps pass successfully
- [ ] Development server runs without errors
- [ ] Health endpoint returns expected response
- [ ] TypeScript types are generated
- [ ] D1 database is created and migrations applied
- [ ] R2 buckets are created
- [ ] KV namespaces are created
- [ ] Environment variables are properly configured
- [ ] Git repository has proper .gitignore entries

## Directory Structure Verification
```
cloudflare/
├── workers/
│   ├── src/
│   │   ├── index.ts
│   │   ├── types/
│   │   │   └── env.ts
│   │   ├── routes/
│   │   │   ├── auth/
│   │   │   ├── csv/
│   │   │   ├── files/
│   │   │   └── users/
│   │   ├── services/
│   │   ├── db/
│   │   ├── middleware/
│   │   └── utils/
│   ├── tests/
│   │   ├── setup.ts
│   │   └── index.test.ts
│   ├── migrations/
│   │   └── 0001_initial_schema.sql
│   ├── package.json
│   ├── tsconfig.json
│   ├── wrangler.toml
│   ├── vitest.config.ts
│   ├── eslint.config.js
│   ├── .prettierrc.json
│   ├── .prettierignore
│   ├── .dev.vars
│   └── worker-configuration.d.ts (generated)
├── pages/
├── packages/
│   └── shared/
└── migrations/
```

## Security Checklist

- [ ] `.dev.vars` is in `.gitignore`
- [ ] No secrets in `wrangler.toml`
- [ ] JWT secrets are strong and unique
- [ ] Database encryption key is 32 characters
- [ ] CORS origin is properly configured
- [ ] Rate limiting is configured
- [ ] Secure headers middleware is active

## Performance Baseline

After setup, record initial metrics:
- Cold start time: < 50ms
- Health endpoint response time: < 10ms
- Memory usage: < 128MB
- Bundle size: < 1MB

This completes Phase 1 environment setup. The development environment is now ready for Phase 2: Frontend Migration.