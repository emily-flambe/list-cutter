# Testing Procedures

## Testing Philosophy
@include ../.claude/CLAUDE.md#TestingPhilosophy

## Test Suite Overview

### Coverage Targets
- **Lines**: 90%
- **Functions**: 90% 
- **Branches**: 85%
- **Statements**: 90%

### Test Categories
1. **Unit Tests**: Individual component testing
2. **Integration Tests**: Service interaction testing
3. **Security Tests**: Authentication, authorization, threat detection
4. **Performance Tests**: Load testing and benchmarks
5. **E2E Tests**: Complete user journey testing with Playwright

## Running Tests

### All Tests
```bash
cd cloudflare/workers

# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run in CI mode
npm run test:ci
```

### Specific Test Suites
```bash
# Authentication tests
npm run test:auth

# Performance tests
npm run test:performance
npm run test:performance:watch

# Security tests
npm test tests/security/

# E2E tests
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:headed
npm run test:e2e:debug
```

### Performance Benchmarks
```bash
# Run benchmark suite
npm run test:benchmark

# Load testing
artillery run tests/performance/load-test.yml
```

## Test Structure

### Unit Tests
- Located in `tests/` directory
- Use Vitest framework
- Focus on individual functions/services
- Mock external dependencies

### Integration Tests  
- Test service interactions
- Use real database connections (test DBs)
- Validate API endpoints
- Test middleware chains

### Security Tests
- Authentication bypass attempts
- Authorization validation
- Input validation testing
- Rate limiting verification
- File access control
- JWT security validation

### Performance Tests
- File upload/download performance
- Concurrent operations testing
- Memory usage validation
- Response time benchmarks
- Database query optimization

### E2E Tests
- Use Playwright framework
- Test complete user journeys
- Cross-browser compatibility
- UI interaction validation
- File processing workflows

## Test Debugging

### Failed Test Investigation
```bash
# Run single test file
npx vitest run tests/specific-test.test.ts

# Debug mode
npm run test:e2e:debug

# Verbose output
npx vitest run --reporter=verbose

# Watch specific file
npx vitest --watch tests/auth/
```

### Common Test Issues
- **Timeout Issues**: Increase timeout for heavy operations
- **Mock Problems**: Ensure mocks match actual implementations
- **Database State**: Use proper test isolation and cleanup
- **Async Handling**: Proper await/async usage in tests

## Test Environment Setup

### Environment Variables
```bash
# Test environment
NODE_ENV=test

# Test database
TEST_DB_NAME=cutty-test

# Test R2 bucket  
TEST_R2_BUCKET=cutty-test-files
```

### Test Data Management
- Use fixtures in `tests/fixtures/`
- Generate test data with `test-data-generator.ts`
- Clean up after each test
- Use isolated test databases