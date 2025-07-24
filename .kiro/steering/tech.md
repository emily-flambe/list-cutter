# Technology Stack & Build System

## Tech Stack Overview

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6.0+ for fast development and builds
- **UI Library**: Material-UI (MUI) v6 for consistent design
- **HTTP Client**: Axios for API communication
- **Routing**: React Router DOM v6
- **State Management**: React Context + hooks (no complex state libraries)

### Backend
- **Runtime**: Cloudflare Workers (V8 isolates)
- **Framework**: Hono.js v4+ (lightweight web framework)
- **Language**: TypeScript with strict mode
- **Authentication**: JWT with jose library + Google OAuth
- **Validation**: Zod for input validation

### Infrastructure
- **Database**: Cloudflare D1 (distributed SQLite)
- **Storage**: Cloudflare R2 (S3-compatible object storage)
- **Cache**: Cloudflare KV + Cache API
- **Hosting**: Cloudflare Workers + Pages
- **DNS & CDN**: Cloudflare global network

### Development Tools
- **Package Manager**: npm (workspaces for monorepo)
- **Testing**: Vitest for unit tests, Playwright for E2E
- **Linting**: ESLint with TypeScript rules
- **Type Checking**: TypeScript 5.7+
- **CI/CD**: GitHub Actions

## Build System

### Project Structure
```
├── app/frontend/          # React frontend application
├── cloudflare/workers/    # Cloudflare Workers backend
├── .project/             # Unified AI assistant configuration
└── worktrees/            # Git worktrees (MANDATORY location)
```

### Common Commands

#### Development (requires 2 terminals)
```bash
# Terminal 1 - Backend
make backend
# or: cd cloudflare/workers && npm run dev

# Terminal 2 - Frontend  
make frontend
# or: cd app/frontend && npm run dev
```

#### Build & Deploy
```bash
# Build everything
npm run build

# Deploy to development
cd cloudflare/workers && npm run deploy

# Deploy to production
cd cloudflare/workers && npm run deploy:production
```

#### Testing
```bash
# Run all tests
npm test

# Backend tests only
cd cloudflare/workers && npm test

# E2E tests
cd cloudflare/workers && npm run test:e2e
```

#### Database Operations
```bash
# Run migrations on development
make migrations ENV=dev

# Run migrations on production (with confirmation)
make migrations ENV=prod
```

## Environment Configuration

### Development Environment
- **Worker**: `cutty-dev` (EXACT name required)
- **Database**: `cutty-dev` (remote D1 instance)
- **Domain**: `cutty-dev.emilycogsdill.com`
- **Local Dev**: Uses `wrangler dev --remote` (no local DB)

### Production Environment
- **Worker**: `cutty` (EXACT name required)
- **Database**: `cutty-prod` (remote D1 instance)
- **Domain**: `cutty.emilycogsdill.com`
- **Config**: Uses `wrangler.prod.toml`

### Critical Rules
- **NO STAGING**: Only dev and prod environments exist
- **NO LOCAL DB**: Always use remote D1 with `--remote` flag
- **EXACT NAMES**: Worker and DB names must match exactly
- **WORKTREES**: Must be created in `worktrees/` folder only

## Key Dependencies

### Backend Core
- `hono`: ^4.6.16 (web framework)
- `jose`: ^5.10.0 (JWT handling)
- `zod`: ^3.24.1 (validation)
- `wrangler`: ^4.24.3 (deployment tool)

### Frontend Core
- `react`: ^18.3.1
- `@mui/material`: ^6.4.2
- `axios`: ^1.7.9
- `vite`: ^6.0.5

### Development
- `typescript`: ^5.7.3
- `vitest`: 2.0.5 (testing)
- `@playwright/test`: ^1.48.2 (E2E testing)

## Build Optimization

The build system is optimized for speed and simplicity:
- Parallel builds for frontend and backend
- Vite for fast frontend builds
- esbuild for optimized worker bundles
- Minimal dependencies to reduce build time
- Makefile for common operations

## Deployment Strategy

### Automated Deployment
- Push to `main` triggers development deployment
- Production deployments use separate command
- Zero-downtime deployments via Cloudflare Workers
- Automatic health checks post-deployment

### Manual Deployment
```bash
# Development
cd cloudflare/workers && npm run deploy

# Production (requires confirmation)
cd cloudflare/workers && npm run deploy:production
```

## Performance Considerations

- **Edge Computing**: Global distribution via Cloudflare
- **Bundle Size**: Optimized builds with tree-shaking
- **Caching**: Multi-layer caching strategy
- **Database**: Connection pooling and query optimization
- **Assets**: CDN delivery for static files