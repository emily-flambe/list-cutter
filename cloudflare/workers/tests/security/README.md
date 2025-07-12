# Security Test Suite

This directory contains comprehensive security tests for the List Cutter application. The security test suite validates all critical security mechanisms and protection systems.

## Test Categories

### 1. Authentication Bypass Tests (`auth-bypass.test.ts`)
- JWT token manipulation attempts
- Authorization header bypass attempts
- Token signature tampering
- Expired token usage attempts
- Blacklisted token usage attempts
- Secret key security validation
- User context header manipulation

### 2. File Access Control Tests (`file-access-control.test.ts`)
- Unauthorized file access attempts
- Path traversal attacks
- File permission escalation attempts
- Cross-user file access attempts
- Directory listing attempts
- File metadata manipulation
- Quota bypass attempts

### 3. Rate Limiting Tests (`rate-limiting.test.ts`)
- API endpoint flooding attacks
- Distributed rate limit bypass attempts
- IP spoofing for rate limit evasion
- User-based rate limit violations
- Burst attack patterns
- Rate limit reset exploitation
- Different endpoint rate limits

### 4. JWT Security Tests (`jwt-security.test.ts`)
- Token expiration handling
- Secret key security validation
- Token structure manipulation
- Cryptographic signature validation
- Time-based attack prevention
- Token blacklisting security
- Refresh token rotation security

### 5. API Key Security Tests (`api-key-security.test.ts`)
- API key generation security
- Key format validation and tampering
- Hash security and salt validation
- Permission escalation prevention
- Key expiration handling
- Key revocation and reactivation
- Usage tracking security
- Brute force protection

### 6. Input Validation Tests (`input-validation.test.ts`)
- SQL injection prevention
- XSS (Cross-Site Scripting) prevention
- Command injection prevention
- Path traversal prevention
- File upload validation
- JSON injection prevention
- Header injection prevention
- Parameter pollution attacks
- Buffer overflow prevention
- Unicode and encoding attacks

### 7. Security Headers Tests (`security-headers.test.ts`)
- Content Security Policy (CSP) validation
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options protection
- X-Content-Type-Options validation
- X-XSS-Protection headers
- Referrer-Policy enforcement
- Permissions-Policy controls
- Cross-Origin policies (CORS, COOP, COEP)
- Security header bypass attempts
- Header injection prevention

### 8. Threat Detection Tests (`threat-detection.test.ts`)
- Malware detection in file uploads
- PII (Personally Identifiable Information) detection
- Suspicious pattern recognition
- Threat intelligence integration
- Automated response mechanisms
- False positive handling
- Real-time threat monitoring
- Threat scoring and classification
- Incident response workflows

## Running Security Tests

### Run All Security Tests
```bash
npm test tests/security/
```

### Run Individual Test Categories
```bash
# Authentication tests
npm test tests/security/auth-bypass.test.ts

# File access control tests
npm test tests/security/file-access-control.test.ts

# Rate limiting tests
npm test tests/security/rate-limiting.test.ts

# JWT security tests
npm test tests/security/jwt-security.test.ts

# API key security tests
npm test tests/security/api-key-security.test.ts

# Input validation tests
npm test tests/security/input-validation.test.ts

# Security headers tests
npm test tests/security/security-headers.test.ts

# Threat detection tests
npm test tests/security/threat-detection.test.ts
```

### Run Security Tests in CI/CD
```bash
# Run with coverage
npm run test:security:coverage

# Run with detailed reporting
npm run test:security:report
```

## Test Environment Setup

The security tests use a mock Cloudflare Workers environment with:
- Mock KV stores for caching and session data
- Mock D1 database for structured data
- Mock R2 storage for file operations
- Mock analytics engine for metrics
- Isolated test environment variables

## Security Test Principles

### 1. Comprehensive Coverage
- Tests cover all attack vectors and edge cases
- Validates both positive and negative scenarios
- Includes realistic attack simulations

### 2. Realistic Attack Simulation
- Uses actual attack patterns and payloads
- Simulates sophisticated multi-stage attacks
- Tests against known vulnerability patterns

### 3. Performance Validation
- Ensures security measures don't degrade performance
- Tests under high load conditions
- Validates response times for security operations

### 4. False Positive Management
- Tests legitimate use cases to prevent false positives
- Validates context-aware threat detection
- Ensures usability is not compromised

## Security Test Data

### Mock Attack Payloads
The tests include realistic attack payloads for:
- SQL injection variants
- XSS attack vectors
- Command injection attempts
- Path traversal sequences
- Malformed data inputs
- Encoding-based evasion

### Threat Intelligence Data
Mock threat intelligence includes:
- Known malicious domains
- Suspicious IP addresses
- Malware signatures
- Attack patterns
- Behavioral indicators

## Continuous Security Testing

### Pre-commit Hooks
Security tests are integrated into pre-commit hooks to:
- Validate security configurations
- Test new code for vulnerabilities
- Ensure security standards compliance

### CI/CD Integration
Security tests run automatically on:
- Pull request creation
- Code merges to main branch
- Production deployments
- Scheduled security assessments

## Security Test Reporting

### Test Results
Security test results include:
- Pass/fail status for each security control
- Performance metrics for security operations
- Coverage reports for attack scenarios
- Detailed vulnerability assessments

### Security Metrics
Key security metrics tracked:
- Authentication bypass attempt detection rate
- File access control violation prevention
- Rate limiting effectiveness
- Threat detection accuracy
- Response time for security operations

## Maintenance and Updates

### Regular Updates
Security tests are updated regularly to:
- Include new attack vectors
- Cover emerging threats
- Test latest security features
- Maintain effectiveness

### Threat Intelligence Updates
Mock threat data is updated to reflect:
- Current threat landscape
- New attack techniques
- Evolving security challenges
- Industry best practices

## Security Test Guidelines

### Writing New Security Tests
When adding new security tests:
1. Follow existing test patterns and structure
2. Include both positive and negative test cases
3. Document attack vectors and expected outcomes
4. Ensure tests are deterministic and reliable
5. Add appropriate error handling and cleanup

### Test Data Security
- Use only mock/synthetic data in tests
- Never include real credentials or sensitive data
- Sanitize any external data used in tests
- Maintain data isolation between test runs

### Performance Considerations
- Design tests to complete within reasonable time limits
- Use efficient mock implementations
- Avoid resource-intensive operations in tests
- Optimize test setup and teardown procedures

---

This security test suite provides comprehensive validation of all security mechanisms in the List Cutter application, ensuring robust protection against various attack vectors and maintaining security standards across all components.