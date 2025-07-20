# Coding Standards

## TypeScript

### General Rules
- **Strict Mode**: Always use TypeScript strict mode
- **Explicit Types**: Prefer explicit return types for functions
- **Type Safety**: Avoid `any` type except when absolutely necessary
- **Interfaces**: Prefer interfaces over type aliases for object shapes
- **Enums**: Use const enums for better performance

### Type Conversions
```typescript
// Safe conversions (preferred)
const count = Number(result?.count) || 0;
const name = String(user?.name) || 'Unknown';
const items = Array.isArray(data) ? data : [];

// Avoid unsafe assertions
// BAD: const count = result.count as number;
// BAD: const user = data as User;
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

### Testing Philosophy
- Simple, focused tests
- Mock external dependencies
- Test behavior, not implementation
- Aim for 80%+ coverage on critical paths

## Git Conventions

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