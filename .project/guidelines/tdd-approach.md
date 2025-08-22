# Test-Driven Development Approach

## Testing Philosophy
**Pragmatic TDD** - We value working software with reasonable test coverage over perfect test-first development. Tests should support development, not hinder it.

## When We Write Tests

### Test-First (TDD)
These scenarios require writing tests before implementation:
- Critical authentication and authorization logic
- Payment processing or financial calculations
- Data transformation algorithms
- Public API endpoints
- Security-sensitive operations

### Test-During
Tests written alongside code development:
- React components after UI design stabilizes
- Integration points between services
- Database operations and queries
- Middleware and request handlers

### Test-After (Acceptable Cases)
Writing tests after implementation is acceptable for:
- Exploratory/spike work to understand requirements
- Prototypes and proof of concepts
- UI layout and styling changes
- Infrastructure and deployment scripts
- One-off migration scripts

## Test Coverage Standards
- **Minimum coverage**: 70% for critical paths
- **Authentication/Security**: 90% coverage required
- **Public APIs**: 85% coverage required
- **UI Components**: 60% coverage acceptable
- **Utilities**: 80% coverage preferred
- **Migrations**: Manual testing acceptable

## Testing Stack
- **Unit tests**: Vitest with TypeScript
- **Component tests**: Vitest + React Testing Library
- **Integration tests**: Vitest with actual database calls
- **E2E tests**: Playwright for critical user journeys
- **Performance tests**: Basic load testing with k6 (optional)

## Test Patterns

### Naming Convention
```typescript
// Pattern: describe what it does in plain English
describe('UserService', () => {
  it('creates a user with valid data', async () => {});
  it('throws error when email is invalid', async () => {});
  it('prevents duplicate email registration', async () => {});
});
```

### Test Structure
```typescript
// Arrange - Act - Assert pattern
it('calculates discount correctly', () => {
  // Arrange
  const price = 100;
  const discountPercent = 20;
  
  // Act
  const result = calculateDiscount(price, discountPercent);
  
  // Assert
  expect(result).toBe(80);
});
```

### Mocking Strategy
- Mock external services (OAuth providers, email services)
- Mock file system operations
- Use real database for integration tests (test database)
- Use real implementations for pure functions
- Avoid mocking what you own

## AI Assistant Testing Guidelines

### When generating tests:
1. Start with the happy path - the expected success case
2. Add tests for obvious error cases
3. Include edge cases (empty arrays, null values, boundary conditions)
4. Test one behavior per test - keep tests focused
5. Use descriptive test names that explain the scenario

### When implementing features:
1. Write a simple test for the main functionality
2. Implement minimal code to make it pass
3. Add tests for error cases
4. Refactor only after tests pass
5. Keep test output visible during development

### Example Test Generation
```typescript
// For a user registration function
describe('registerUser', () => {
  // Happy path
  it('registers user with valid email and password', async () => {
    const user = await registerUser('test@example.com', 'Password123!');
    expect(user.email).toBe('test@example.com');
    expect(user.id).toBeDefined();
  });
  
  // Error cases
  it('rejects invalid email format', async () => {
    await expect(registerUser('invalid', 'Password123!'))
      .rejects.toThrow('Invalid email');
  });
  
  it('rejects weak password', async () => {
    await expect(registerUser('test@example.com', '123'))
      .rejects.toThrow('Password too weak');
  });
  
  // Edge case
  it('prevents duplicate email registration', async () => {
    await registerUser('test@example.com', 'Password123!');
    await expect(registerUser('test@example.com', 'Different123!'))
      .rejects.toThrow('Email already exists');
  });
});
```

## Common Testing Pitfalls
- **Testing implementation details** - Test behavior, not internal structure
- **Brittle UI tests** - Don't test exact HTML structure, test user interactions
- **Slow test suites** - Keep unit tests fast, separate slow integration tests
- **Flaky tests** - Fix or remove intermittent failures immediately
- **Over-mocking** - Too many mocks make tests meaningless
- **Under-testing** - Missing tests for error paths and edge cases

## Quick Commands
```bash
# Run all tests
npm test

# Run specific test file
npm test user.test.ts

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run only unit tests
npm test -- --grep "unit"

# Run E2E tests
npm run test:e2e
```

## Test Database Setup
```bash
# Create test database
wrangler d1 create cutty-test

# Run migrations on test DB
wrangler d1 migrations apply cutty-test

# Clean test data
wrangler d1 execute cutty-test --command="DELETE FROM users WHERE email LIKE '%test%'"
```

## CI/CD Testing Requirements
- All tests must pass before merge to main
- Coverage reports generated on PR
- E2E tests run on staging deploys
- Performance regression tests on production deploys (optional)

## Testing Best Practices

### DO:
- Write clear test descriptions
- Keep tests independent (no shared state)
- Use beforeEach/afterEach for setup/cleanup
- Test both success and failure paths
- Mock external dependencies
- Use test data factories for consistency

### DON'T:
- Test framework code (React, Hono, etc.)
- Write tests just for coverage numbers
- Use production database for tests
- Rely on test execution order
- Leave console.log in tests
- Commit `.only()` or `.skip()` test modifiers

## Special Considerations for Cloudflare Workers

### Worker Testing
```typescript
// Mock Cloudflare bindings
const env = {
  DB: createD1Mock(),
  KV: createKVMock(),
  R2: createR2Mock(),
  JWT_SECRET: 'test-secret'
};

// Test with mock environment
it('handles request with auth', async () => {
  const request = new Request('http://localhost/api/users');
  const response = await worker.fetch(request, env);
  expect(response.status).toBe(200);
});
```

### D1 Database Testing
- Use `--local` flag for local D1 testing when possible
- Alternative: Use test database with `--remote` flag
- Clean up test data after each test run
- Use transactions for test isolation

### Analytics Engine in Tests
- **MUST BE DISABLED** in vitest.config.ts
- Mock analytics calls in unit tests
- Skip analytics in test environment

---

*Remember: Tests should give confidence that the code works, not slow down development. Pragmatic coverage over perfect coverage.*