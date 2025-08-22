# Coding Standards

## General Principles
- **Simplicity over complexity** - Choose the most straightforward approach
- **Clarity over cleverness** - Code should be self-explanatory
- **Working code over perfect code** - Ship functional solutions
- **Flat over nested** - Avoid deep hierarchies and complex structures
- **Explicit over implicit** - Make everything obvious

## TypeScript Standards

### Style Guide
- TypeScript strict mode enabled
- Prefer simple types over complex unions
- Use type inference where possible
- Runtime validation with Zod for API inputs

### Naming Conventions
- Variables: `camelCase`
- Functions: `camelCase`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `kebab-case.ts` for routes, `camelCase.ts` for services

### Type Conversions
```typescript
// Preferred safe conversions
const count = Number(value) || 0;
const name = String(value) || '';
const items = Array.isArray(data) ? data : [];

// Build success > type perfection
// Use 'any' when necessary to unblock progress
```

## Code Patterns

### Preferred Patterns
```typescript
// Good: Simple async/await
export async function getUser(id: string) {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!user) throw new Error('User not found');
  return user;
}

// Good: Early returns
function validateEmail(email: string) {
  if (!email) return false;
  if (!email.includes('@')) return false;
  return true;
}
```

### Anti-Patterns to Avoid
```typescript
// Bad: Over-abstraction
class AbstractUserRepositoryFactory { } // NO

// Bad: Deep nesting
if (condition1) {
  if (condition2) {
    if (condition3) { } // NO - flatten with early returns
  }
}

// Bad: Complex type gymnastics
type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T; // NO
```

## React Components

### Component Standards
- Function components only (no class components)
- Simple props interfaces
- One component per file
- Co-locate styles with components

### Component Structure
```typescript
interface UserListProps {
  users: User[];
  onSelect: (user: User) => void;
}

export function UserList({ users, onSelect }: UserListProps) {
  return (
    <div>
      {users.map(user => (
        <div key={user.id} onClick={() => onSelect(user)}>
          {user.name}
        </div>
      ))}
    </div>
  );
}
```

## API Development

### Route Patterns
```typescript
// Simple, direct route handler
app.get('/api/v1/users/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    
    if (!user) return c.json({ error: 'Not found' }, 404);
    return c.json(user);
  } catch (error) {
    return c.json({ error: 'Internal error' }, 500);
  }
});
```

### Response Format
```typescript
// Success
{ data: {...} }

// Error
{ error: "Error message" }

// List with pagination
{ 
  data: [...],
  pagination: {
    page: 1,
    pageSize: 20,
    total: 100
  }
}
```

## Error Handling
- Always handle errors explicitly
- Log errors with context (without secrets)
- Return meaningful error messages
- Use try/catch for async operations
- Fail fast with clear messages

## Testing Requirements
- Minimum coverage: 70% for critical paths
- Test naming: `describe('ComponentName', () => { it('does something', ...) })`
- Test structure: Arrange-Act-Assert pattern
- Focus on happy path and critical edge cases
- Use Vitest for unit tests

## Documentation Standards
- Functions: Brief comment explaining purpose if not obvious
- Complex logic: Inline comments explaining why
- APIs: Basic endpoint documentation in code
- No elaborate JSDoc unless necessary

## Performance Guidelines
- Measure before optimizing
- Focus on user-perceived performance
- Basic caching with simple get/set patterns
- Pagination with LIMIT/OFFSET for lists
- Bundle size awareness for frontend

## Security Practices
- Never log sensitive data (passwords, tokens, keys)
- Always use environment variables for secrets
- Input validation on all user inputs
- SQL parameterization for all queries
- Hash passwords with bcrypt or argon2
- Escape output when rendering user content

## Git Conventions

### Worktree Management
- **MANDATORY**: Create worktrees only in `worktrees/` folder
- Command: `git worktree add worktrees/branch-name branch-name`

### Commit Messages
Format: `type: brief description`

Examples:
- `feat: add user authentication`
- `fix: resolve login error`
- `refactor: simplify config structure`
- `docs: update API documentation`

### Branch Naming
- Feature: `feature/description`
- Bug fix: `fix/description`
- Refactor: `refactor/description`

## Development Workflow
- Make it work first
- Make it right (refactor if needed)
- Make it fast (only if necessary)
- Test critical paths
- Document what's not obvious

## Complexity Limits
- Files: Max 200 lines
- Functions: Max 20 lines
- Parameters: Max 4 per function
- Nesting: Max 3 levels deep
- Dependencies: Only essential ones

---

*Focus on shipping working code. Simplicity and maintainability over engineering perfection.*