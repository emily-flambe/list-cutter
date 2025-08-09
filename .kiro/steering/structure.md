# Project Structure & Organization

## Repository Layout

```
cutty/
├── app/
│   └── frontend/              # React frontend application
│       ├── src/
│       │   ├── components/    # React components
│       │   ├── context/       # React context providers
│       │   ├── themes/        # MUI theme configuration
│       │   └── utils/         # Frontend utilities
│       ├── public/            # Static assets
│       └── dist/              # Build output
├── cloudflare/
│   └── workers/               # Cloudflare Workers backend
│       ├── src/
│       │   ├── routes/        # API route handlers
│       │   ├── services/      # Business logic
│       │   ├── middleware/    # Request middleware
│       │   ├── types/         # TypeScript definitions
│       │   └── config/        # Configuration files
│       ├── migrations/        # Database migrations
│       ├── tests/             # Unit and integration tests
│       └── e2e/               # End-to-end tests
├── .project/                  # Unified AI assistant config
│   ├── contexts/              # Modular documentation
│   ├── api-docs/              # API documentation
│   └── scripts/               # Utility scripts
├── .kiro/                     # Kiro AI assistant config
│   └── steering/              # AI steering rules
├── worktrees/                 # Git worktrees (MANDATORY)
└── logs/                      # Application logs
```

## Frontend Structure (`app/frontend/`)

### Component Organization
```
src/components/
├── CSVCutter.jsx              # Core CSV processing component
├── SyntheticDataGenerator.jsx # Data generation feature
├── FileUpload.jsx             # File upload handling
├── ManageFiles.jsx            # File management interface
├── Layout.jsx                 # Main layout wrapper
├── Home.jsx                   # Landing page
└── auth/                      # Authentication components
    ├── Login.jsx
    ├── Register.jsx
    └── GoogleSignInButton.jsx
```

### Key Frontend Files
- `App.jsx` - Main application component
- `main.jsx` - Application entry point
- `api.js` - API client configuration
- `auth.js` - Authentication utilities
- `vite.config.js` - Build configuration

## Backend Structure (`cloudflare/workers/`)

### API Routes (`src/routes/`)
```
routes/
├── auth/                      # Authentication endpoints
├── files/                     # File operations
├── lists/                     # List management
├── monitoring/                # Health and metrics
└── synthetic-data/            # Data generation API
```

### Services (`src/services/`)
```
services/
├── auth/                      # Authentication logic
│   └── jwt.ts                 # JWT token handling
├── storage/                   # Database operations
│   └── d1.ts                  # D1 database service
├── security/                  # Security utilities
└── synthetic-data-generator.ts # Data generation service
```

### Middleware (`src/middleware/`)
- `auth.ts` - Authentication middleware
- `error.ts` - Error handling
- `file-auth.ts` - File access control
- `hybridAuth.ts` - Multi-auth strategy

### Database (`migrations/`)
- Sequential numbered SQL files
- D1-compatible SQLite syntax
- Managed via Wrangler CLI

## Configuration Files

### Environment-Specific
- `wrangler.toml` - Development worker config
- `wrangler.prod.toml` - Production worker config
- `.dev.vars` - Local development secrets
- `.env.example` - Environment template

### Build & Development
- `package.json` - Root workspace configuration
- `Makefile` - Development commands
- `tsconfig.json` - TypeScript configuration
- `vitest.config.ts` - Test configuration

## AI Assistant Configuration

### Unified Config (`.project/`)
- `config.md` - Main AI instructions
- `settings.json` - Project settings
- `contexts/` - Modular documentation
- `api-docs/` - API specifications

### Kiro-Specific (`.kiro/`)
- `steering/` - AI steering rules
- Auto-generated from project analysis

## Critical Organizational Rules

### Git Worktrees
- **MANDATORY**: All worktrees must be in `worktrees/` folder
- **Command**: `git worktree add worktrees/branch-name branch-name`
- **Forbidden**: Creating worktrees anywhere else
- **Cleanup**: Use `make branch-cleanup` for maintenance

### Environment Naming
- **Development**: `cutty-dev` worker, `cutty-dev` database
- **Production**: `cutty` worker, `cutty-prod` database
- **No Staging**: Only two environments exist
- **Exact Compliance**: Names must match exactly

### File Naming Conventions
- **Components**: PascalCase (e.g., `UserList.jsx`)
- **Services**: camelCase (e.g., `userService.ts`)
- **Routes**: kebab-case (e.g., `user-profile.ts`)
- **Migrations**: numbered (e.g., `0001_create_users.sql`)

## Development Workflow

### Local Development
1. Two terminal setup required
2. Backend: `make backend` (connects to remote DB)
3. Frontend: `make frontend`
4. No local database setup needed

### Testing Structure
```
tests/
├── fixtures/                  # Test data and utilities
├── services/                  # Service layer tests
├── routes/                    # API endpoint tests
├── middleware/                # Middleware tests
└── e2e/                       # End-to-end tests
```

### Build Artifacts
- `app/frontend/dist/` - Frontend build output
- `cloudflare/workers/dist/` - Worker build output
- `.tsbuildinfo` - TypeScript build cache
- `node_modules/` - Dependencies (gitignored)

## Monorepo Management

### Workspace Configuration
- Root `package.json` defines workspaces
- Shared dependencies at root level
- Environment-specific deps in subdirectories
- Parallel build support via npm scripts

### Dependency Management
- Lock files committed for reproducible builds
- Regular security audits via `npm audit`
- Version constraints documented in dependencies.md

This structure prioritizes simplicity and maintainability while supporting the full-stack Cloudflare Workers application architecture.