# Technology Stack

## Core Technologies
- **Language**: TypeScript 5.7+ (strict mode)
- **Backend Framework**: Hono.js v4.6+ on Cloudflare Workers
- **Frontend Framework**: React 18.3+ with Vite 6.0+
- **Database**: Cloudflare D1 (distributed SQLite)
- **Object Storage**: Cloudflare R2 (S3-compatible)
- **Cache**: Cloudflare KV + Cache API
- **Hosting**: Cloudflare Workers + CDN

## Key Dependencies

### Backend
- `hono`: ^4.6.16 - Lightweight web framework for Workers
- `jose`: ^5.10.0 - JWT token handling
- `zod`: ^3.24.1 - Runtime validation and type safety
- `wrangler`: ^4.24.3 - Cloudflare deployment tool (v4+ required)
- `bcrypt`: ^5.1.0 - Password hashing
- `papaparse`: ^5.4.0 - CSV parsing

### Frontend
- `react`: ^18.3.1 - UI framework
- `@mui/material`: ^6.4.2 - Material Design components
- `axios`: ^1.7.9 - HTTP client
- `react-router-dom`: ^6.20.0 - Client-side routing
- `vite`: ^6.0.5 - Build tool and dev server

### Development
- `typescript`: ^5.7.3 - Type safety
- `vitest`: ^2.0.5 - Unit testing framework
- `@playwright/test`: ^1.48.2 - E2E testing
- `eslint`: ^8.50.0 - Code linting
- `prettier`: ^3.0.0 - Code formatting

## Development Setup

### Prerequisites
- Node.js v18.0.0+ (LTS recommended)
- npm v9.0.0+
- Wrangler CLI v4.0.0+ (critical requirement)
- Cloudflare account with Workers enabled

### Environment Variables
```env
# Required in .dev.vars
JWT_SECRET=your-secret-key-min-32-chars
API_KEY_SALT=your-salt-value-min-16-chars
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-secret
GOOGLE_REDIRECT_URI=http://localhost:8787/api/v1/auth/google/callback
```

### Commands
```bash
# Install dependencies
npm install

# Development (requires 2 terminals)
# Terminal 1: Backend
cd cloudflare/workers && npm run dev

# Terminal 2: Frontend
cd app/frontend && npm run dev

# Testing
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:e2e           # E2E tests

# Build
npm run build              # Build everything
make build-frontend        # Frontend only
make build-backend         # Backend only

# Deploy
make deploy-dev            # Deploy to development
make deploy-prod           # Deploy to production
```

## Code Patterns

### API Route Pattern
```typescript
// Simple, direct route handler
app.get('/api/v1/resource/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  
  const resource = await c.env.DB
    .prepare('SELECT * FROM resources WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first();
    
  if (!resource) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  return c.json({ data: resource });
});
```

### Component Pattern
```typescript
// Simple, functional React component
interface Props {
  data: Item[];
  onSelect: (item: Item) => void;
}

export function ItemList({ data, onSelect }: Props) {
  return (
    <List>
      {data.map(item => (
        <ListItem key={item.id} onClick={() => onSelect(item)}>
          {item.name}
        </ListItem>
      ))}
    </List>
  );
}
```

### Database Query Pattern
```typescript
// Direct SQL queries, no ORM
const user = await env.DB
  .prepare('SELECT * FROM users WHERE email = ?')
  .bind(email)
  .first();

// Use transactions for multiple operations
await env.DB.batch([
  env.DB.prepare('INSERT INTO users ...').bind(...),
  env.DB.prepare('INSERT INTO profiles ...').bind(...)
]);
```

## Architecture Decisions

### Edge-First Architecture
**Context**: Need global low-latency performance
**Decision**: Use Cloudflare Workers for compute at the edge
**Rationale**: Sub-50ms response times globally without managing servers
**Trade-offs**: Limited to Worker constraints (10ms CPU, 128MB memory)

### Simple Direct SQL
**Context**: Database access patterns
**Decision**: Use direct SQL queries instead of ORM
**Rationale**: D1 is SQLite-based, ORMs add unnecessary complexity
**Trade-offs**: More SQL to write, but clearer and more performant

### JWT Authentication
**Context**: Stateless authentication needed
**Decision**: JWT tokens with 24-hour expiry
**Rationale**: Works well with edge architecture, no session storage needed
**Trade-offs**: Tokens can't be revoked before expiry

### Monorepo Structure
**Context**: Frontend and backend in same repository
**Decision**: Use npm workspaces with shared dependencies
**Rationale**: Simplified deployment and dependency management
**Trade-offs**: Larger repository, all changes in one place

## Performance Considerations
- Bundle splitting for frontend (Vite automatic)
- Lazy loading for React routes
- Image optimization via Cloudflare Polish
- API response caching with Cache API
- Database query optimization with proper indexes
- KV for session storage instead of D1 queries

## Security Practices
- JWT tokens with strong secret (32+ characters)
- Input validation with Zod schemas
- SQL parameterization for all queries
- Rate limiting at Worker level
- CORS configured for specific origins
- Security headers (CSP, HSTS, etc.)
- OAuth 2.0 for third-party authentication

## Testing Strategy
- Unit tests for business logic (Vitest)
- Integration tests for API endpoints
- Component tests for React (Testing Library)
- E2E tests for critical user flows (Playwright)
- No local D1 database - use remote for testing
- Analytics Engine must be disabled in tests

## Deployment Configuration

### Development Environment
- **Worker Name**: `cutty-dev` (exact name required)
- **Database**: `cutty-dev` (D1 instance)
- **Domain**: `cutty-dev.emilycogsdill.com`
- **Config**: `wrangler.toml`

### Production Environment
- **Worker Name**: `cutty` (exact name required)  
- **Database**: `cutty-prod` (D1 instance)
- **Domain**: `cutty.emilycogsdill.com`
- **Config**: `wrangler.prod.toml`

### Critical Configuration Rules
- **NO STAGING ENVIRONMENT** - Only dev and prod exist
- **NO LOCAL DATABASE** - Always use `--remote` flag
- **EXACT NAMING** - Worker and database names must match exactly
- **WRANGLER v4+** - Required for D1 bindings

## Common Gotchas
- Frontend must be built before deployment (`make build-frontend`)
- Wrangler v3 is incompatible - must use v4+
- D1 local database doesn't work properly - use `--remote`
- Analytics Engine must be disabled in vitest.config.ts
- Workers have 10ms CPU limit - optimize accordingly
- R2 has 5GB file size limit
- KV values limited to 25MB

---

*Technical decisions prioritize simplicity, performance, and maintainability over complex abstractions.*