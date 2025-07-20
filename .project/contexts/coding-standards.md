# Coding Standards

## TypeScript

### Pragmatic Rules (Build Success > Type Perfection)
- **Strict Mode**: Use when practical; prioritize build success over perfect types
- **Explicit Types**: Add when helpful, but don't block progress for type perfection
- **Type Safety**: Use `any` during migration/prototyping; improve incrementally
- **Runtime Validation**: Prefer Zod validation over type assertions for real safety
- **Migration-First**: Get builds working, then iteratively improve types

### Type Conversions (Proven Safe Patterns)
```typescript
// Runtime-safe conversions (from project lessons learned)
const count = Number(result?.count) || 0;
const name = String(user?.name) || 'Unknown';
const items = Array.isArray(data) ? data : [];

// Safe enum validation
const severity = (['low','medium','high'].includes(event.severity) 
  ? event.severity 
  : 'medium') as 'low' | 'medium' | 'high';

// Safe database result handling
const row = result as Record<string, unknown>;
const safeField = String(row.field_name);

// AVOID: Unsafe assertions without runtime validation
// BAD: const count = result.count as number;
// BAD: const user = data as User;
```

### Build-First Philosophy (Lessons Learned)
```typescript
// PRIORITY: Working builds > Perfect types
// Based on debugging lessons from Issues #65, #67

// 1. Get builds working first
npm run build  // Must pass

// 2. Then validate deployment
npx wrangler versions upload --dry-run  // Must succeed

// 3. Incrementally improve types
npx tsc --noEmit  // Fix when practical, don't block builds
```

### Error Handling
```typescript
// Always handle errors explicitly
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return { success: false, error: error.message };
}
```

## React

### Component Guidelines
- **Functional Components**: Use hooks, no class components
- **File Naming**: PascalCase for components (e.g., `UserList.tsx`)
- **Props**: Define with TypeScript interfaces
- **Hooks**: Custom hooks start with `use` (e.g., `useAuth`)

### Component Structure
```typescript
interface UserListProps {
  users: User[];
  onSelect: (user: User) => void;
}

export function UserList({ users, onSelect }: UserListProps) {
  // Hooks at the top
  const [selected, setSelected] = useState<string | null>(null);
  
  // Event handlers
  const handleSelect = (user: User) => {
    setSelected(user.id);
    onSelect(user);
  };
  
  // Render
  return (
    <div>
      {users.map(user => (
        <UserItem key={user.id} user={user} onClick={handleSelect} />
      ))}
    </div>
  );
}
```

## API Development (Hono.js)

### Route Structure
```typescript
// Consistent error responses
app.get('/api/v1/users/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const user = await getUserById(id);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json({ data: user });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});
```

### Middleware Pattern
```typescript
// Authentication middleware
export async function requireAuth(c: Context, next: Next) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  try {
    const user = await verifyToken(token);
    c.set('user', user);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
}
```

## Database (D1)

### Query Patterns
```typescript
// Use prepared statements
const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
const result = await stmt.bind(email).first();

// Batch operations
const batch = users.map(user => 
  db.prepare('INSERT INTO users (name, email) VALUES (?, ?)')
    .bind(user.name, user.email)
);
await db.batch(batch);
```

### Migration Standards
- Filename: `NNNN_description.sql` (e.g., `0001_create_users.sql`)
- Always include rollback comments
- One logical change per migration

## Testing

### Test Structure
```typescript
describe('UserService', () => {
  it('should create a user with valid data', async () => {
    // Arrange
    const userData = { name: 'Test', email: 'test@example.com' };
    
    // Act
    const user = await createUser(userData);
    
    // Assert
    expect(user).toBeDefined();
    expect(user.email).toBe(userData.email);
  });
});
```

### Testing Philosophy (Keep It Simple)
- **Simple, practical, maintainable tests** - Never overengineer
- **Focus on core functionality** - Test essential behavior only
- **Use realistic mocks** - Match actual implementations, not theoretical perfection
- **CRITICAL**: Analytics Engine MUST be disabled in test config
- **Avoid complex custom error types** - Keep expectations realistic for test environments

## Git Conventions

### 🚨 CRITICAL: Worktree Management
- **MANDATORY**: New worktrees MUST ONLY be created in the `worktrees/` folder
- **COMMAND**: `git worktree add worktrees/branch-name branch-name`
- **FORBIDDEN**: Creating worktrees anywhere else in the project structure
- **REASON**: Maintains clean project organization and prevents conflicts
- **NO EXCEPTIONS**: This rule applies to all development work

### 🚨 CRITICAL: Deployment Environment Names
- **WORKERS**: Only `cutty-dev` (dev) and `cutty` (prod) exist
- **DATABASES**: Only `cutty-dev` (dev) and `cutty-prod` (prod) exist
- **NO STAGING**: There is no staging environment, never create one
- **LOCAL DEV**: MUST use `wrangler dev --remote` with cutty-dev
- **FORBIDDEN**: Creating local databases, staging variants, or additional workers
- **EXACT COMPLIANCE**: Any deviation breaks CI/CD and integrations

### Commit Messages
Format: `[Persona] 🔸 Brief description`

Examples:
- `[Builder] 🔨 Add user authentication endpoint`
- `[Guardian] 🛡️ Fix SQL injection vulnerability`
- `[Guide] 📖 Update API documentation`

### Branch Naming
- Feature: `feature/add-user-export`
- Bug fix: `fix/authentication-error`
- Refactor: `refactor/simplify-config`

## Code Organization

### Directory Structure
```
src/
├── routes/          # API route handlers
├── services/        # Business logic
├── middleware/      # Express/Hono middleware
├── utils/          # Shared utilities
├── types/          # TypeScript type definitions
└── config/         # Configuration files
```

### Import Order
1. Node.js built-ins
2. External dependencies
3. Internal dependencies
4. Types
5. Constants

```typescript
// Example
import { readFile } from 'fs/promises';
import { Hono } from 'hono';
import { UserService } from '../services/user';
import type { User } from '../types';
import { API_VERSION } from '../constants';
```

## Performance Guidelines

### Optimization Rules
1. Measure before optimizing
2. Optimize critical paths first
3. Use caching strategically
4. Prefer streaming for large data
5. Implement pagination for lists

### Common Patterns
```typescript
// Pagination
const page = Number(c.req.query('page')) || 1;
const limit = Math.min(Number(c.req.query('limit')) || 20, 100);
const offset = (page - 1) * limit;

// Caching
const cached = await cache.get(key);
if (cached) return cached;

const data = await fetchData();
await cache.set(key, data, { expirationTtl: 300 });
return data;
```

## Security Best Practices

### Input Validation
```typescript
// Use Zod for validation
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100)
});

// Validate input
const result = UserSchema.safeParse(input);
if (!result.success) {
  return c.json({ error: result.error.issues }, 400);
}
```

### Sensitive Data
- Never log passwords or tokens
- Use environment variables for secrets
- Hash passwords with bcrypt/argon2
- Sanitize user input in responses

## Documentation

### Code Comments
```typescript
/**
 * Creates a new user in the database
 * @param userData - User information to create
 * @returns Newly created user or throws on error
 */
export async function createUser(userData: CreateUserInput): Promise<User> {
  // Implementation
}
```

### API Documentation
- Document all endpoints
- Include request/response examples
- Specify error conditions
- Note rate limits

---
*These standards ensure consistent, maintainable, and secure code across the project.*