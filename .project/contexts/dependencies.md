# Dependencies & Versions

## Runtime Requirements

### Node.js & Package Managers
- **Node.js**: v18.0.0 or higher (LTS recommended)
- **npm**: v9.0.0 or higher
- **Wrangler**: v4.0.0+ (CRITICAL - must be v4+)

### Cloudflare Platform
- **Workers**: Compatibility date 2023-05-18 or later
- **D1 Database**: SQLite compatible
- **R2 Storage**: S3-compatible API
- **KV Namespace**: For session storage

## Backend Dependencies

### Core Framework
```json
{
  "hono": "^4.6.0",
  "wrangler": "^4.0.0"
}
```

### Authentication & Security
```json
{
  "jose": "^5.0.0",          // JWT handling
  "bcrypt": "^5.1.0",        // Password hashing
  "zod": "^3.20.0"           // Input validation
}
```

### Database & Storage
```json
{
  "@cloudflare/workers-types": "^4.0.0",
  "drizzle-orm": "^0.29.0",   // Optional ORM
  "drizzle-kit": "^0.20.0"    // Migration tool
}
```

### Utilities
```json
{
  "date-fns": "^2.30.0",      // Date manipulation
  "nanoid": "^5.0.0",         // ID generation
  "papaparse": "^5.4.0"       // CSV parsing
}
```

### Development Dependencies
```json
{
  "typescript": "^5.3.0",
  "vitest": "^1.6.0",
  "@types/node": "^20.0.0",
  "tsx": "^4.0.0",
  "prettier": "^3.0.0",
  "eslint": "^8.50.0",
  "@typescript-eslint/parser": "^6.0.0",
  "@typescript-eslint/eslint-plugin": "^6.0.0"
}
```

## Frontend Dependencies

### Core Framework
```json
{
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "vite": "^5.3.0",
  "@vitejs/plugin-react": "^4.3.0"
}
```

### UI & Styling
```json
{
  "@mui/material": "^5.14.0",
  "@mui/icons-material": "^5.14.0",
  "@emotion/react": "^11.11.0",
  "@emotion/styled": "^11.11.0"
}
```

### State & Data Management
```json
{
  "axios": "^1.6.0",          // HTTP client
  "react-query": "^3.39.0",   // Server state
  "zustand": "^4.4.0"         // Client state (optional)
}
```

### Routing & Navigation
```json
{
  "react-router-dom": "^6.20.0"
}
```

### Development Tools
```json
{
  "@types/react": "^18.3.0",
  "@types/react-dom": "^18.3.0",
  "vite-plugin-pwa": "^0.17.0"
}
```

## Testing Dependencies

### Test Frameworks
```json
{
  "vitest": "^1.6.0",
  "@testing-library/react": "^14.0.0",
  "@testing-library/jest-dom": "^6.0.0",
  "@testing-library/user-event": "^14.0.0",
  "playwright": "^1.40.0"      // E2E testing
}
```

### Mocking & Utilities
```json
{
  "msw": "^2.0.0",            // API mocking
  "@faker-js/faker": "^8.0.0", // Test data generation
  "c8": "^8.0.0"              // Code coverage
}
```

## CI/CD Dependencies

### GitHub Actions
- Node.js setup action: `actions/setup-node@v4`
- Wrangler action: `cloudflare/wrangler-action@v3`
- Cache action: `actions/cache@v3`

### Pre-commit Hooks
```json
{
  "husky": "^8.0.0",
  "lint-staged": "^15.0.0"
}
```

## Version Constraints

### Critical Version Requirements
1. **Wrangler v4+**: Required for proper D1 bindings and deployment
2. **Node.js 18+**: Required for native fetch API
3. **TypeScript 5+**: Required for latest type features
4. **React 18+**: Required for concurrent features

### Compatibility Matrix
| Package | Min Version | Max Version | Notes |
|---------|------------|-------------|-------|
| wrangler | 4.0.0 | latest | v4+ required |
| hono | 4.0.0 | 4.x | Stable API |
| react | 18.0.0 | 18.x | No breaking changes |
| typescript | 5.0.0 | 5.x | Strict mode required |

## Environment-Specific Requirements

### Development
- `.dev.vars` file with:
  - `JWT_SECRET`
  - `API_KEY_SALT`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`

### Production
- Cloudflare secrets configured via `wrangler secret put`
- Minimum secrets required:
  - `JWT_SECRET`
  - `API_KEY_SALT`
  - OAuth credentials (if enabled)

## Package Management

### Lock File Requirements
- Always commit `package-lock.json`
- Use `npm ci` for CI/CD environments
- Regenerate lock file after major updates

### Update Strategy
1. Security updates: Apply immediately
2. Minor updates: Monthly review
3. Major updates: Quarterly planning
4. Breaking changes: Careful migration

### Dependency Audit
```bash
# Regular security checks
npm audit

# Fix vulnerabilities
npm audit fix

# Check outdated packages
npm outdated
```

## Platform-Specific Notes

### Cloudflare Workers Limitations
- No Node.js APIs (fs, path, etc.)
- 10ms CPU limit per request
- 128MB memory limit
- 1MB request/response size limit

### D1 Database Constraints
- SQLite syntax compatibility
- 500MB database size limit
- Transaction size limits
- No stored procedures

### R2 Storage Limits
- 5GB max object size
- 100MB multipart chunk size
- S3-compatible API subset

---
*Keep dependencies updated for security and performance. Always test updates in development first.*