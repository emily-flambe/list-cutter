# Testing Framework Documentation

This directory contains the comprehensive testing framework for the Cutty Workers project, implemented by Twilight Sparkle to ensure robust authentication and core functionality.

## Structure

```
tests/
├── auth/                    # Authentication-specific tests
│   ├── jwt-validation.test.ts      # JWT token generation, verification, blacklisting
│   ├── login-flow.test.ts          # User login endpoint and validation
│   ├── register-flow.test.ts       # User registration and validation
│   └── auth-middleware.test.ts     # Authentication middleware tests
├── fixtures/                # Test data and fixtures
│   ├── users.ts                    # User test data and credentials
│   ├── tokens.ts                   # JWT tokens and auth fixtures
│   ├── requests.ts                 # HTTP request fixtures
│   ├── responses.ts                # Expected response fixtures
│   ├── environments.ts             # Environment configurations
│   └── index.ts                    # Consolidated exports
├── utils/                   # Testing utilities and helpers
│   ├── test-env.ts                 # Mock environment and context creation
│   ├── auth-helpers.ts             # Authentication testing utilities
│   ├── test-patterns.ts            # Common testing patterns
│   └── index.ts                    # Consolidated exports
├── performance/             # Performance and load testing
│   ├── load-test.yml              # Artillery load testing configuration
│   └── benchmark.js               # Performance benchmarks
└── README.md               # This documentation
```

## Test Coverage Goals

The testing framework is configured with strict coverage thresholds:

- **Lines**: 90%
- **Functions**: 90%
- **Branches**: 85%
- **Statements**: 90%

## Running Tests

### Basic Test Commands

```bash
# Run all tests
npm test

# Run tests in CI mode
npm run test:ci

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run only authentication tests
npm run test:auth
```

### Performance Testing

```bash
# Run load tests (requires running worker)
npm run test:performance

# Run performance benchmarks
npm run test:benchmark
```

## Test Categories

### 1. Authentication Tests (`tests/auth/`)

#### JWT Validation (`jwt-validation.test.ts`)
- Token generation with various payloads
- Token verification and signature validation
- Token expiration handling
- Token blacklisting and revocation
- Refresh token rotation
- Error handling for invalid tokens

#### Login Flow (`login-flow.test.ts`)
- Valid credential authentication
- Invalid username/password rejection
- Input validation and sanitization
- SQL injection and XSS prevention
- Rate limiting implementation
- Security event logging
- CORS handling

#### Registration Flow (`register-flow.test.ts`)
- User registration with valid data
- Email format validation
- Username length and format validation
- Password strength requirements
- Password confirmation matching
- Duplicate username/email detection
- Input sanitization
- Rate limiting for registrations

#### Authentication Middleware (`auth-middleware.test.ts`)
- Bearer token extraction and validation
- User context setting
- Token blacklist checking
- Authorization header case handling
- Optional authentication for public endpoints
- Permission-based access control
- Resource ownership verification

### 2. Test Utilities (`tests/utils/`)

#### Environment Utilities (`test-env.ts`)
- Mock Cloudflare environment creation
- Mock KV, D1, R2, and Analytics bindings
- Request and context mocking
- Response helper functions
- User and JWT payload creation

#### Authentication Helpers (`auth-helpers.ts`)
- Test token generation (valid, expired, malformed)
- Authentication header creation
- Token blacklist simulation
- Authentication scenario testing
- Rate limit simulation

#### Common Patterns (`test-patterns.ts`)
- HTTP method testing
- CORS header validation
- Error response format checking
- Input validation patterns
- Pagination testing
- Performance measurement
- Memory usage monitoring

### 3. Test Fixtures (`tests/fixtures/`)

#### User Fixtures (`users.ts`)
- Test user accounts with various roles
- Valid and invalid registration data
- Login credentials and edge cases
- Security attack payloads (SQL injection, XSS)

#### Token Fixtures (`tokens.ts`)
- JWT payload templates
- Malformed token examples
- Token pairs and refresh data
- Blacklisted token scenarios
- Different JWT secrets for testing

#### Request/Response Fixtures
- HTTP request body templates
- Expected response formats
- Security headers configurations
- Error response structures

## Performance Testing

### Load Testing (Artillery)

The `load-test.yml` configuration tests:
- Authentication flows under load
- File upload/download operations
- Dashboard access patterns
- Token refresh operations

**Load Test Phases:**
1. Warm up: 10 requests/second for 60 seconds
2. Ramp up: 20 requests/second for 120 seconds
3. Sustained: 50 requests/second for 60 seconds
4. Peak: 100 requests/second for 60 seconds

### Benchmarking

The `benchmark.js` script measures:
- JWT generation/verification performance
- Password hashing/verification speed
- Database query performance
- JSON parsing operations
- String and object manipulations

**Performance Thresholds:**
- JWT Generation: ≥1,000 ops/sec
- JWT Verification: ≥2,000 ops/sec
- Password Hashing: ≥50 ops/sec
- Database Queries: ≥500 ops/sec

## Configuration

### Vitest Configuration

The test runner is configured with:
- Cloudflare Workers pool for realistic testing
- Mock bindings for KV, D1, R2, Analytics
- Coverage reporting with V8 provider
- 30-second test timeout
- Global test utilities

### Dependencies

**Testing Framework:**
- `vitest` - Fast test runner
- `@cloudflare/vitest-pool-workers` - Workers environment
- `@vitest/coverage-v8` - Coverage reporting

**Performance Testing:**
- `artillery` - Load testing framework
- `benchmark` - Micro-benchmarking library

## Security Testing

The framework includes comprehensive security testing:

### Input Validation
- SQL injection attempt prevention
- XSS payload sanitization
- Path traversal protection
- Malformed input handling

### Authentication Security
- Token signature verification
- Token expiration enforcement
- Blacklist checking
- Rate limiting implementation

### Authorization Testing
- Permission-based access control
- Resource ownership verification
- Role-based restrictions
- CORS policy enforcement

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Test both positive and negative cases
- Include edge cases and error conditions

### Mock Usage
- Create realistic mock environments
- Test with various data scenarios
- Simulate external service failures
- Use fixtures for consistent test data

### Performance Considerations
- Set appropriate test timeouts
- Use setup/teardown for expensive operations
- Mock external dependencies
- Measure critical path performance

## Continuous Integration

The testing framework supports CI/CD with:
- Deterministic test execution
- Coverage reporting
- Performance regression detection
- Security vulnerability scanning

Run the full test suite before deploying:

```bash
npm run test:ci && npm run test:coverage
```

This ensures all tests pass and coverage thresholds are met before production deployment.