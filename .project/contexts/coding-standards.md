# Coding Standards

🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨
🔴 🚨 ANTI-OVERENGINEERING MANDATE - SIMPLICITY ABOVE ALL 🚨 🔴
🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨

## 🛑 CORE PHILOSOPHY: RADICAL SIMPLICITY 🛑

### ⚡ SIMPLICITY COMMANDMENTS ⚡
1. **SIMPLE WORKS** - Complex solutions are FORBIDDEN unless absolutely necessary
2. **BORING IS BEAUTIFUL** - Use the most obvious, straightforward approach first
3. **NO CLEVER CODE** - If it needs explanation, it's too complex
4. **ONE THING WELL** - Each function/component does exactly one thing
5. **COPY-PASTE > ABSTRACTION** - Duplication is better than premature abstraction
6. **FLAT OVER NESTED** - Avoid deep nesting, hierarchies, or complex structures
7. **EXPLICIT OVER IMPLICIT** - Make everything obvious and readable
8. **DELETE BEFORE ADD** - Remove complexity before adding features

### 🚫 OVERENGINEERING WARNING SIGNS 🚫
**STOP IMMEDIATELY if you're considering:**
- Abstract base classes or inheritance hierarchies
- Complex design patterns (Factory, Builder, Strategy, etc.)
- Generic type systems with multiple constraints
- Middleware chains longer than 2 functions
- Configuration systems with multiple layers
- "Future-proofing" for hypothetical requirements
- Dynamic code generation or metaprogramming
- Complex state machines or orchestrators
- Multi-layered abstraction frameworks
- Custom dependency injection systems

### ⚠️ COMPLEXITY BUDGET ⚠️
- **Files**: Max 200 lines (if longer, split into smaller files)
- **Functions**: Max 20 lines (if longer, extract smaller functions)
- **Parameters**: Max 4 per function (use objects for more)
- **Nesting**: Max 3 levels deep (flatten with early returns)
- **Dependencies**: Only add if absolutely essential
- **Abstractions**: Only after 3+ identical implementations exist

## TypeScript

### 🎯 SIMPLICITY-FIRST RULES (Build Success > Type Perfection) 🎯
- **SIMPLE TYPES**: Use basic types (`string`, `number`, `boolean`) over complex unions
- **NO TYPE GYMNASTICS**: Avoid mapped types, conditional types, template literals
- **ANY IS OK**: Use `any` freely during development; perfectionism is forbidden
- **BASIC INTERFACES**: Simple object shapes only, no inheritance or generics
- **RUNTIME VALIDATION**: Prefer Zod validation over type system complexity
- **BUILD FIRST**: Get it working, then improve types if time permits

### 🔧 DEAD SIMPLE TYPE CONVERSIONS 🔧
```typescript
// SIMPLE CONVERSIONS - No overthinking!
const count = Number(data) || 0;
const name = String(data) || '';
const items = Array.isArray(data) ? data : [];

// SIMPLE VALIDATION - Keep it obvious
const status = ['active', 'inactive'].includes(data) ? data : 'active';

// SIMPLE SAFETY - Use `any` and validate at runtime
const row = result as any;
const field = String(row.field_name || '');

// ✅ GOOD: Simple, obvious, works
// ❌ BAD: Complex type gymnastics that nobody understands
```

### 🚀 SHIP-FIRST PHILOSOPHY 🚀
```typescript
// RULE #1: WORKING CODE > PERFECT CODE
// If it builds and works, ship it!

// Step 1: Make it work (use `any` liberally)
const data: any = await fetchData();
const result: any = processData(data);

// Step 2: Make sure it builds
npm run build  // Must pass or you can't ship

// Step 3: Deploy and test
npx wrangler versions upload --dry-run

// Step 4: ONLY improve types if you have time and it's easy
// Don't block shipping for type perfection!
```

### 💥 SIMPLE ERROR HANDLING 💥
```typescript
// SIMPLE: Catch it, log it, return something useful
try {
  const result = await operation();
  return result;
} catch (error: any) {
  console.error('Failed:', error);
  return null; // or throw error, whatever's simpler
}

// AVOID: Complex error hierarchies, custom error classes, error boundaries
// KEEP IT SIMPLE: try/catch, log, return/throw
```

## React - KEEP IT SIMPLE

### 🎨 ANTI-OVERENGINEERING REACT RULES 🎨
- **FUNCTIONS ONLY**: No class components, no HOCs, no complex patterns
- **BASIC PROPS**: Simple objects, avoid complex prop drilling solutions
- **MINIMAL HOOKS**: Use built-in hooks, avoid complex custom hooks
- **NO MAGIC**: If a component does more than one thing, split it
- **FLAT STRUCTURE**: Avoid deep component hierarchies

### 📝 DEAD SIMPLE COMPONENTS 📝
```typescript
// SIMPLE PROPS - No complex interfaces
interface Props {
  users: any[];
  onSelect: (user: any) => void;
}

// SIMPLE COMPONENT - Does one thing only
export function UserList({ users, onSelect }: Props) {
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

// ✅ GOOD: Simple, obvious, no magic
// ❌ BAD: Complex state management, custom hooks, abstractions
```

### 🚫 UI EMOJI PROHIBITION 🚫
- **NEVER ADD EMOJIS TO UI**: Do not add emojis to user interface elements unless specifically requested
- **TEXT CONTENT ONLY**: Keep UI text clean and professional
- **EXCEPTIONS**: Only add emojis when explicitly asked by the user
- **APPLIES TO**: Button text, labels, headings, messages, placeholders, etc.

## API Development - BRUTALLY SIMPLE

### 🛣️ SIMPLE ROUTES 🛣️
```typescript
// SIMPLE ENDPOINT - One thing, obvious result
app.get('/api/v1/users/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    
    if (!user) return c.json({ error: 'Not found' }, 404);
    return c.json(user);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// ✅ GOOD: Direct SQL, simple logic, obvious flow
// ❌ BAD: Service layers, repositories, complex abstractions
```

### 🔐 SIMPLE MIDDLEWARE 🔐
```typescript
// SIMPLE AUTH - Check token, set user, done
export async function requireAuth(c: any, next: any) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) return c.json({ error: 'No token' }, 401);
  
  try {
    const user = jwt.verify(token, SECRET);
    c.set('user', user);
    await next();
  } catch {
    return c.json({ error: 'Bad token' }, 401);
  }
}

// ✅ GOOD: One function, clear purpose, no complexity
// ❌ BAD: Middleware chains, complex auth systems, role hierarchies
```

## Database - RAW AND SIMPLE

### 🗄️ DEAD SIMPLE QUERIES 🗄️
```typescript
// SIMPLE SELECT - Direct query, no abstractions
const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();

// SIMPLE INSERT - Straightforward, no magic
const result = await db.prepare('INSERT INTO users (name, email) VALUES (?, ?)')
  .bind(name, email).run();

// SIMPLE UPDATE - Update and done
await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, id).run();

// ✅ GOOD: Raw SQL, obvious intent, no ORM complexity
// ❌ BAD: Query builders, ORMs, complex abstractions
```

### 📋 SIMPLE MIGRATIONS 📋
- Filename: `001_add_table.sql` (simple numbers)
- One change per file
- Plain SQL only, no fancy migration tools

## Testing - BASIC AND EFFECTIVE

### 🧪 STUPIDLY SIMPLE TESTS 🧪
```typescript
// SIMPLE TEST - Call function, check result
it('creates user', async () => {
  const user = await createUser({ name: 'Test', email: 'test@test.com' });
  expect(user.name).toBe('Test');
});

// SIMPLE MOCK - Replace function with fake
vi.mock('./database', () => ({
  getUser: () => ({ id: 1, name: 'Test' })
}));

// ✅ GOOD: Basic assertions, simple mocks
// ❌ BAD: Complex test frameworks, elaborate setup/teardown
```

### 🎯 ANTI-OVERENGINEERING TEST RULES 🎯
- **TEST HAPPY PATH ONLY** - Don't test every edge case
- **SIMPLE MOCKS** - Mock the minimum needed to make tests pass
- **NO TEST FRAMEWORKS** - Use built-in test runner, basic assertions
- **NO ELABORATE SETUP** - Each test should be independent and simple
- **FOCUS ON CORE FEATURES** - Test what matters, ignore the rest

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

### ⚡ SIMPLE PERFORMANCE RULES ⚡
1. **DON'T OPTIMIZE** - Make it work first, optimize only if needed
2. **SIMPLE CACHING** - Basic cache.get/set, no complex strategies
3. **BASIC PAGINATION** - Simple LIMIT/OFFSET, no fancy cursors
4. **MEASURE LAST** - Only after users complain about speed

### 📦 DEAD SIMPLE PATTERNS 📦
```typescript
// SIMPLE PAGINATION - Just offset and limit
const page = Number(req.query.page) || 1;
const items = await db.prepare('SELECT * FROM items LIMIT 20 OFFSET ?')
  .bind((page - 1) * 20).all();

// SIMPLE CACHE - Check cache, fetch if needed, cache result
const cached = await cache.get(key);
if (cached) return cached;
const data = await fetchData();
cache.set(key, data);
return data;

// ✅ GOOD: Obvious, works, easy to understand
// ❌ BAD: Complex pagination cursors, cache invalidation strategies
```

## Security - BASIC BUT SECURE

### 🔒 SIMPLE SECURITY RULES 🔒
```typescript
// SIMPLE VALIDATION - Basic checks, no complex schemas
const email = String(input.email);
const password = String(input.password);

if (!email.includes('@')) return { error: 'Bad email' };
if (password.length < 8) return { error: 'Password too short' };

// SIMPLE SANITIZATION - Escape what you need to escape
const cleanName = input.name.replace(/[<>&"]/g, '');

// ✅ GOOD: Basic validation, obvious checks
// ❌ BAD: Complex validation libraries, elaborate schemas
```

### 🛡️ ESSENTIAL SECURITY 🛡️
- **DON'T LOG SECRETS** - No passwords, tokens, keys in logs
- **USE ENV VARS** - Secrets go in environment variables
- **HASH PASSWORDS** - Use bcrypt, argon2, or similar
- **ESCAPE OUTPUT** - Sanitize anything shown to users

## Bug Fixing - SOLVE DON'T SIDESTEP

### 🐛 BUG RESOLUTION MANDATE 🐛
- **NEVER COMMENT OUT** - Never resolve a bug by just commenting out problematic code
- **NEVER MOCK AWAY** - Never resolve a bug by mocking the failing component
- **FIX THE ROOT CAUSE** - Always identify and fix the actual problem
- **EXCEPTIONS ONLY ON REQUEST** - Only comment out or mock if explicitly requested
- **UNDERSTAND BEFORE FIXING** - Debug to understand why it's failing first

## Quality Assurance - CRITICAL SELF-REVIEW

### 🔍 MANDATORY SELF-REVIEW PROCESS 🔍
- **ALWAYS REVIEW YOUR WORK** - Critically examine every change before declaring completion
- **TEST THOROUGHLY** - Verify functionality works as expected
- **CHECK FOR REGRESSIONS** - Ensure existing features still work
- **VALIDATE EDGE CASES** - Consider boundary conditions and error states
- **SCREENSHOT VERIFICATION** - Take screenshots to confirm UI changes work properly
- **CODE QUALITY CHECK** - Review for simplicity, readability, and adherence to standards
- **NEVER RUSH TO COMPLETE** - Take time to verify quality before marking tasks done

## Documentation - MINIMAL AND USEFUL

### 📝 SIMPLE COMMENTS 📝
```typescript
// Creates a user - that's it
export async function createUser(data: any) {
  return await db.prepare('INSERT INTO users (name, email) VALUES (?, ?)')
    .bind(data.name, data.email).run();
}

// ✅ GOOD: Brief, explains what it does
// ❌ BAD: JSDoc comments, type documentation, elaborate descriptions
```

### 📖 BASIC DOCS 📖
- **README ONLY** - One file with setup instructions
- **NO ELABORATE DOCS** - Code should be self-explanatory
- **SIMPLE COMMENTS** - Explain why, not what
- **EXAMPLES OVER DESCRIPTIONS** - Show, don't tell

---

🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨
🔴 **FINAL REMINDER: WHEN IN DOUBT, CHOOSE SIMPLE** 🔴
🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨

*These standards prioritize shipping working code over engineering perfection.*