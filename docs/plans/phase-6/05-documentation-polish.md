# Phase 6 Documentation & Final Polish Implementation Plan

## Target Audience
This document is designed for a Claude subagent responsible for creating comprehensive documentation, final code polish, and ensuring production readiness of the authentication and security system.

## Current State Analysis

### ✅ What's Already Done
- Complete authentication and security system implemented
- Comprehensive middleware and services
- Database schema and migrations
- Core functionality tested and working

### ❌ Documentation and Polish Gaps
- **No API Documentation**: No comprehensive API documentation for endpoints
- **Limited Code Documentation**: Missing JSDoc comments and inline documentation
- **No Developer Guide**: No guide for developers working with the system
- **No Deployment Guide**: No step-by-step deployment instructions
- **No Troubleshooting Guide**: No common issues and solutions documented
- **Code Polish**: Some code could be refined and optimized

## Implementation Strategy

### Phase 1: API Documentation (Priority: HIGH)

#### 1.1 OpenAPI Specification

**File: `/workers/docs/api/openapi.yaml`**
```yaml
openapi: 3.0.3
info:
  title: Cutty Authentication API
  description: |
    Comprehensive authentication and security API for the Cutty application.
    Supports JWT-based authentication, API key authentication, and secure user management.
  version: 1.0.0
  contact:
    name: API Support
    url: https://cutty.emilycogsdill.com/support
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://cutty.emilycogsdill.com/api
    description: Production server
  - url: https://cutty-staging.emilycogsdill.com/api
    description: Staging server

paths:
  /accounts/register:
    post:
      summary: Register a new user
      description: Create a new user account with username, email, and password
      tags:
        - Authentication
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserRegistration'
            examples:
              valid_registration:
                summary: Valid user registration
                value:
                  username: "newuser"
                  email: "newuser@example.com"
                  password: "SecurePassword123!"
                  password2: "SecurePassword123!"
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthenticationResponse'
        '400':
          description: Invalid input data
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '409':
          description: User already exists
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
      security: []

  /accounts/login:
    post:
      summary: User login
      description: Authenticate user and return JWT tokens
      tags:
        - Authentication
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserLogin'
            examples:
              valid_login:
                summary: Valid user login
                value:
                  username: "existinguser"
                  password: "SecurePassword123!"
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthenticationResponse'
        '401':
          description: Invalid credentials
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
      security: []

  /accounts/logout:
    post:
      summary: User logout
      description: Invalidate current refresh token
      tags:
        - Authentication
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                refresh_token:
                  type: string
                  description: Refresh token to invalidate
      responses:
        '200':
          description: Logout successful
        '401':
          description: Invalid or expired token
      security:
        - JWTAuth: []

  /accounts/token/refresh:
    post:
      summary: Refresh access token
      description: Get new access token using refresh token
      tags:
        - Authentication
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                refresh_token:
                  type: string
                  description: Valid refresh token
      responses:
        '200':
          description: Token refreshed successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenResponse'
        '401':
          description: Invalid or expired refresh token
      security: []

  /accounts/user:
    get:
      summary: Get current user info
      description: Retrieve information about the authenticated user
      tags:
        - User Management
      responses:
        '200':
          description: User information retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserInfo'
        '401':
          description: Not authenticated
      security:
        - JWTAuth: []

  /api-keys:
    get:
      summary: List API keys
      description: Get all API keys for the authenticated user
      tags:
        - API Keys
      responses:
        '200':
          description: API keys retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  api_keys:
                    type: array
                    items:
                      $ref: '#/components/schemas/APIKeyInfo'
      security:
        - JWTAuth: []

    post:
      summary: Create API key
      description: Generate a new API key with specified permissions
      tags:
        - API Keys
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/APIKeyCreate'
      responses:
        '201':
          description: API key created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/APIKeyResponse'
        '400':
          description: Invalid input data
      security:
        - JWTAuth: []

  /api-keys/{keyId}:
    delete:
      summary: Revoke API key
      description: Revoke an existing API key
      tags:
        - API Keys
      parameters:
        - name: keyId
          in: path
          required: true
          schema:
            type: string
          description: API key ID to revoke
      responses:
        '200':
          description: API key revoked successfully
        '404':
          description: API key not found
      security:
        - JWTAuth: []

components:
  securitySchemes:
    JWTAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT access token obtained from login endpoint
    
    APIKeyAuth:
      type: http
      scheme: bearer
      bearerFormat: API Key
      description: API key for programmatic access (prefix: cutty_)

  schemas:
    UserRegistration:
      type: object
      required:
        - username
        - password
        - password2
      properties:
        username:
          type: string
          minLength: 3
          maxLength: 30
          pattern: '^[a-zA-Z0-9_-]+$'
          description: Unique username (alphanumeric, underscore, dash only)
        email:
          type: string
          format: email
          description: Valid email address
        password:
          type: string
          minLength: 8
          description: Password (minimum 8 characters)
        password2:
          type: string
          description: Password confirmation (must match password)

    UserLogin:
      type: object
      required:
        - username
        - password
      properties:
        username:
          type: string
          description: Username or email address
        password:
          type: string
          description: User password

    AuthenticationResponse:
      type: object
      properties:
        message:
          type: string
          description: Success message
        user:
          $ref: '#/components/schemas/UserInfo'
        access_token:
          type: string
          description: JWT access token (10 minute expiry)
        refresh_token:
          type: string
          description: JWT refresh token (1 day expiry)

    TokenResponse:
      type: object
      properties:
        message:
          type: string
        access_token:
          type: string
        refresh_token:
          type: string

    UserInfo:
      type: object
      properties:
        id:
          type: integer
          description: User ID
        username:
          type: string
          description: Username
        email:
          type: string
          description: Email address
        created_at:
          type: string
          format: date-time
          description: Account creation timestamp
        last_login:
          type: string
          format: date-time
          description: Last login timestamp

    APIKeyInfo:
      type: object
      properties:
        key_id:
          type: string
          description: API key identifier
        name:
          type: string
          description: Human-readable name
        permissions:
          type: array
          items:
            type: string
          description: List of granted permissions
        created_at:
          type: integer
          description: Creation timestamp
        last_used:
          type: integer
          description: Last usage timestamp
        expires_at:
          type: integer
          description: Expiration timestamp
        is_active:
          type: boolean
          description: Whether the key is active

    APIKeyCreate:
      type: object
      required:
        - name
        - permissions
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
          description: Human-readable name for the API key
        permissions:
          type: array
          items:
            type: string
            enum:
              - auth:read
              - auth:write
              - files:read
              - files:write
              - files:delete
              - list:process
              - list:export
              - analytics:read
              - admin:read
              - admin:write
          description: List of permissions to grant
        expires_in_days:
          type: integer
          minimum: 1
          maximum: 365
          description: Number of days until expiration
        rate_limit_override:
          type: integer
          minimum: 1
          maximum: 10000
          description: Custom rate limit for this key (requests per minute)

    APIKeyResponse:
      type: object
      properties:
        message:
          type: string
        key_id:
          type: string
        api_key:
          type: string
          description: The actual API key (shown only once)
        name:
          type: string
        permissions:
          type: array
          items:
            type: string

    ErrorResponse:
      type: object
      properties:
        error:
          type: string
          description: Error message
        code:
          type: string
          description: Error code
        details:
          type: object
          description: Additional error details

tags:
  - name: Authentication
    description: User authentication and session management
  - name: User Management
    description: User account operations
  - name: API Keys
    description: API key management for programmatic access
```

#### 1.2 Interactive API Documentation

**File: `/workers/src/routes/docs/api.ts`**
```typescript
export async function serveAPIDocs(request: Request, env: Env): Promise<Response> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cutty API Documentation</title>
      <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
      <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
      <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
      <script>
        window.onload = function() {
          const ui = SwaggerUIBundle({
            url: '/docs/openapi.yaml',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIStandalonePreset
            ],
            plugins: [
              SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout",
            tryItOutEnabled: true,
            requestInterceptor: (request) => {
              // Add auth token if available
              const token = localStorage.getItem('access_token');
              if (token) {
                request.headers.Authorization = 'Bearer ' + token;
              }
              return request;
            }
          });
          
          // Add authentication helper
          const authButton = document.createElement('button');
          authButton.textContent = 'Set Auth Token';
          authButton.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000; padding: 10px; background: #007cba; color: white; border: none; border-radius: 5px; cursor: pointer;';
          authButton.onclick = () => {
            const token = prompt('Enter your JWT access token:');
            if (token) {
              localStorage.setItem('access_token', token);
              alert('Token saved! API calls will now include authentication.');
            }
          };
          document.body.appendChild(authButton);
        };
      </script>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

### Phase 2: Code Documentation (Priority: HIGH)

#### 2.1 JSDoc Comments

**Example for `/workers/src/services/auth/jwt.ts`:**
```typescript
/**
 * JWT Service for authentication token management
 * 
 * Provides secure JWT token generation, validation, and management
 * with support for access tokens, refresh tokens, and token rotation.
 * 
 * @author Cutty Authentication System
 * @version 1.0.0
 */

/**
 * JWT payload structure for authentication tokens
 */
export interface JWTPayload {
  /** User ID from database */
  user_id: number;
  /** Username */
  username: string;
  /** Email address (optional) */
  email?: string;
  /** Token expiration timestamp (Unix) */
  exp: number;
  /** Token issued at timestamp (Unix) */
  iat: number;
  /** JWT ID for token tracking */
  jti: string;
  /** Token type (access or refresh) */
  token_type: 'access' | 'refresh';
}

/**
 * Generates a JWT token with specified payload and expiration
 * 
 * @param payload - Token payload (excluding exp, iat, jti)
 * @param secret - JWT signing secret
 * @param expiresIn - Expiration time (e.g., "10m", "1d")
 * @returns Promise resolving to signed JWT token
 * 
 * @throws {Error} When token generation fails
 * 
 * @example
 * ```typescript
 * const token = await generateJWT(
 *   { user_id: 1, username: 'john', token_type: 'access' },
 *   'secret-key',
 *   '10m'
 * );
 * ```
 */
export async function generateJWT(
  payload: Omit<JWTPayload, 'exp' | 'iat' | 'jti'>,
  secret: string,
  expiresIn: string
): Promise<string> {
  // Implementation...
}

/**
 * Verifies and parses a JWT token
 * 
 * @param token - JWT token string
 * @param secret - JWT verification secret
 * @returns Promise resolving to parsed payload or null if invalid
 * 
 * @example
 * ```typescript
 * const payload = await verifyJWT(token, secret);
 * if (payload) {
 *   console.log('User ID:', payload.user_id);
 * }
 * ```
 */
export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  // Implementation...
}
```

#### 2.2 README Documentation

**File: `/workers/README.md`**
```markdown
# Cutty Authentication System

A comprehensive authentication and security system built on Cloudflare Workers, featuring JWT-based authentication, API key management, security monitoring, and threat detection.

## Features

- **JWT Authentication**: Secure token-based authentication with access/refresh tokens
- **API Key Management**: Programmatic access with granular permissions
- **Security Monitoring**: Real-time threat detection and security analytics
- **Rate Limiting**: Comprehensive rate limiting with IP and user-based controls
- **Session Management**: Secure session handling with Workers KV
- **Password Security**: Django-compatible PBKDF2 password hashing
- **Unified Architecture**: Single Worker serving both frontend and API

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  Workers API    │    │   Cloudflare    │
│                 │    │                 │    │    Services     │
│ • Authentication│◄──►│ • JWT Auth      │◄──►│ • D1 Database   │
│ • API Calls     │    │ • API Keys      │    │ • Workers KV    │
│ • User Management│    │ • Security      │    │ • Rate Limiting │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers access
- Wrangler CLI installed (`npm install -g wrangler`)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/cutty.git
cd cutty/workers

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Create Cloudflare resources
wrangler kv:namespace create "AUTH_KV"
wrangler d1 create cutty-db

# Update wrangler.toml with the IDs from above commands

# Deploy database schema
wrangler d1 execute cutty-db --file=schema.sql

# Set secrets
wrangler secret put JWT_SECRET
wrangler secret put ENCRYPTION_KEY
```

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## API Documentation

Interactive API documentation is available at:
- Production: https://cutty.emilycogsdill.com/docs
- Staging: https://cutty-staging.emilycogsdill.com/docs

## Authentication Flow

### JWT Authentication

1. **Register/Login**: User provides credentials
2. **Token Generation**: Server generates access + refresh tokens
3. **API Access**: Client includes access token in requests
4. **Token Refresh**: Client uses refresh token to get new access token
5. **Logout**: Refresh token is blacklisted

### API Key Authentication

1. **Key Generation**: User creates API key with permissions
2. **API Access**: Client includes API key in Authorization header
3. **Permission Check**: Server validates key and permissions
4. **Usage Tracking**: All API key usage is logged

## Security Features

### Password Security
- PBKDF2 hashing with 600,000 iterations
- Django-compatible password format
- Secure password validation

### Token Security
- Short-lived access tokens (10 minutes)
- Refresh token rotation
- Token blacklisting on logout
- Secure token storage in Workers KV

### Rate Limiting
- IP-based rate limiting (100 req/min)
- User-based rate limiting (60 req/min)
- API key custom rate limits
- Cloudflare native rate limiting

### Threat Detection
- Brute force attack detection
- Account enumeration prevention
- Token manipulation detection
- Automated IP blocking

## Configuration

### Environment Variables

```bash
# Required secrets (set via wrangler secret put)
JWT_SECRET=your-256-bit-secret
ENCRYPTION_KEY=your-encryption-key
API_KEY_SALT=your-api-key-salt

# Optional configuration
ENVIRONMENT=production
```

### Wrangler Configuration

```toml
# wrangler.toml
name = "cutty"
main = "src/index.ts"
compatibility_date = "2024-12-30"

[[kv_namespaces]]
binding = "AUTH_KV"
id = "your-kv-namespace-id"

[[d1_databases]]
binding = "DB"
database_name = "cutty-db"
database_id = "your-database-id"
```

## Database Schema

### Users Table
- `id`: Primary key
- `username`: Unique username
- `email`: Email address
- `password`: PBKDF2 hash
- `created_at`: Registration timestamp
- `last_login`: Last login timestamp

### API Keys Table
- `key_id`: Primary key
- `user_id`: Foreign key to users
- `name`: Human-readable name
- `key_hash`: Hashed API key
- `permissions`: JSON array of permissions
- `created_at`: Creation timestamp
- `expires_at`: Expiration timestamp

### Security Events Table
- `id`: Primary key
- `timestamp`: Event timestamp
- `event_type`: Type of security event
- `user_id`: Associated user (if any)
- `ip_address`: Source IP
- `success`: Whether operation succeeded
- `metadata`: Additional event data

## Monitoring

### Security Analytics
- Authentication success/failure rates
- API key usage statistics
- Threat detection alerts
- Performance metrics

### Health Checks
- `/health`: Basic health check
- `/health/auth`: Authentication system health
- `/health/db`: Database connectivity

## Deployment

### Staging Deployment
```bash
npm run deploy:staging
```

### Production Deployment
```bash
# Run tests first
npm test

# Deploy to production
npm run deploy:production

# Verify deployment
curl https://cutty.emilycogsdill.com/health
```

### Rollback Procedure
```bash
# List recent deployments
wrangler deployments list

# Rollback to specific deployment
wrangler rollback [deployment-id]
```

## Troubleshooting

### Common Issues

**Authentication Errors**
- Check JWT_SECRET is set correctly
- Verify token expiration times
- Check for clock skew between client/server

**Database Connection Issues**
- Verify D1 database ID in wrangler.toml
- Check database schema is deployed
- Verify SQL syntax in queries

**Rate Limiting Problems**
- Check rate limiting configuration
- Verify IP detection headers
- Monitor rate limit metrics

**API Key Issues**
- Verify API key format (cutty_ prefix)
- Check API key permissions
- Verify key hasn't expired

### Debug Mode

Enable debug logging:
```bash
wrangler secret put DEBUG_MODE
# Set value to "true"
```

### Support

For issues and support:
- GitHub Issues: https://github.com/your-org/cutty/issues
- Documentation: https://cutty.emilycogsdill.com/docs
- API Reference: https://cutty.emilycogsdill.com/api-docs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details
```

### Phase 3: Developer Guide (Priority: MEDIUM)

#### 3.1 Development Setup Guide

**File: `/workers/docs/DEVELOPMENT.md`**
```markdown
# Development Guide

## Local Development Setup

### Prerequisites
- Node.js 18+
- Wrangler CLI 3.0+
- Cloudflare account

### Environment Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/your-org/cutty.git
   cd cutty/workers
   npm install
   ```

2. **Configure Wrangler**
   ```bash
   wrangler login
   wrangler whoami
   ```

3. **Create Development Resources**
   ```bash
   # Create dev KV namespace
   wrangler kv:namespace create "AUTH_KV" --preview
   
   # Create dev database
   wrangler d1 create cutty-dev
   
   # Deploy schema
   wrangler d1 execute cutty-dev --file=schema.sql
   ```

4. **Set Development Secrets**
   ```bash
   wrangler secret put JWT_SECRET --env=dev
   wrangler secret put ENCRYPTION_KEY --env=dev
   wrangler secret put API_KEY_SALT --env=dev
   ```

### Development Workflow

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Run Tests**
   ```bash
   # Run all tests
   npm test
   
   # Run specific test file
   npm test -- auth/jwt.test.ts
   
   # Run tests in watch mode
   npm run test:watch
   ```

3. **Code Quality**
   ```bash
   # TypeScript checking
   npm run type-check
   
   # Linting
   npm run lint
   
   # Format code
   npm run format
   ```

### Testing Strategy

#### Unit Tests
- Test individual functions and classes
- Mock external dependencies
- Focus on business logic

#### Integration Tests
- Test complete request/response cycles
- Use real Workers environment
- Test middleware interactions

#### Load Tests
- Test performance under load
- Verify rate limiting works
- Test concurrent user scenarios

### Code Standards

#### TypeScript
- Use strict TypeScript configuration
- Define interfaces for all data structures
- Use enums for constants
- Add JSDoc comments for public APIs

#### Error Handling
- Use consistent error response format
- Log errors with context
- Handle edge cases gracefully
- Provide meaningful error messages

#### Security
- Never log sensitive data
- Validate all inputs
- Use parameterized queries
- Implement proper rate limiting

### Architecture Patterns

#### Service Layer
```typescript
// Services handle business logic
export class AuthService {
  constructor(private env: Env) {}
  
  async authenticateUser(credentials: LoginCredentials): Promise<User> {
    // Implementation
  }
}
```

#### Middleware Pattern
```typescript
// Middleware for cross-cutting concerns
export function authMiddleware(
  request: Request,
  env: Env,
  next: () => Promise<Response>
): Promise<Response> {
  // Authentication logic
  return next();
}
```

#### Repository Pattern
```typescript
// Data access layer
export class UserRepository {
  constructor(private db: D1Database) {}
  
  async findById(id: number): Promise<User | null> {
    // Database queries
  }
}
```

### Performance Considerations

#### Database Optimization
- Use indexes for frequently queried columns
- Limit query result sets
- Use prepared statements
- Implement query caching where appropriate

#### KV Storage
- Use appropriate TTL values
- Batch operations when possible
- Consider data size limits
- Use consistent key naming

#### Response Optimization
- Minimize response payload size
- Use appropriate HTTP status codes
- Implement response compression
- Cache static responses

### Debugging Tips

#### Local Debugging
```bash
# Enable debug logging
wrangler secret put DEBUG_MODE
# Set to "true"

# View logs
wrangler tail --format=pretty
```

#### Production Debugging
```bash
# View production logs
wrangler tail --env=production

# Check deployment status
wrangler deployments list
```

#### Common Debug Scenarios
- JWT token validation failures
- Database connection issues
- KV storage problems
- Rate limiting false positives

### Release Process

1. **Pre-release Checklist**
   - [ ] All tests passing
   - [ ] Code review completed
   - [ ] Documentation updated
   - [ ] Security review done

2. **Staging Deployment**
   ```bash
   npm run deploy:staging
   npm run test:staging
   ```

3. **Production Deployment**
   ```bash
   npm run deploy:production
   npm run test:production
   ```

4. **Post-deployment Verification**
   - [ ] Health checks passing
   - [ ] Authentication working
   - [ ] API endpoints responding
   - [ ] No error rate spikes
```

### Phase 4: Troubleshooting Guide (Priority: MEDIUM)

#### 4.1 Common Issues and Solutions

**File: `/workers/docs/TROUBLESHOOTING.md`**
```markdown
# Troubleshooting Guide

## Authentication Issues

### JWT Token Problems

**Problem**: "Invalid token" errors
**Symptoms**: 401 responses on authenticated endpoints
**Solutions**:
1. Check JWT_SECRET is set correctly
2. Verify token hasn't expired
3. Check for whitespace in token
4. Verify token format (Bearer <token>)

**Problem**: Token validation fails
**Symptoms**: JWTVerifyError in logs
**Solutions**:
1. Ensure JWT_SECRET matches generation secret
2. Check token hasn't been blacklisted
3. Verify token structure and payload
4. Check for clock skew between services

### Login/Registration Issues

**Problem**: "User already exists" on registration
**Symptoms**: 409 errors on valid usernames
**Solutions**:
1. Check database for existing users
2. Verify username/email uniqueness
3. Check for case sensitivity issues
4. Review user table constraints

**Problem**: "Invalid credentials" on login
**Symptoms**: Valid credentials rejected
**Solutions**:
1. Verify password hashing compatibility
2. Check database user record
3. Review password validation logic
4. Check for account lockout

## Database Issues

### Connection Problems

**Problem**: Database connection failures
**Symptoms**: D1 connection errors, query timeouts
**Solutions**:
1. Verify D1 database ID in wrangler.toml
2. Check database exists and is accessible
3. Verify account permissions
4. Check for database limits

**Problem**: Schema deployment fails
**Symptoms**: SQL syntax errors, table creation failures
**Solutions**:
1. Verify SQL syntax in schema.sql
2. Check for conflicting table names
3. Ensure proper foreign key constraints
4. Review index creation statements

### Query Issues

**Problem**: SQL query failures
**Symptoms**: Database query errors, constraint violations
**Solutions**:
1. Use parameterized queries
2. Check column names and types
3. Verify data constraints
4. Review query logic and joins

## Rate Limiting Issues

### False Positives

**Problem**: Legitimate users blocked
**Symptoms**: 429 responses for normal usage
**Solutions**:
1. Review rate limiting thresholds
2. Check IP detection headers
3. Verify user-based rate limiting
4. Adjust limits for legitimate use cases

**Problem**: Rate limiting not working
**Symptoms**: No protection against abuse
**Solutions**:
1. Verify rate limiting middleware is active
2. Check KV storage for rate limit data
3. Review rate limiting configuration
4. Test with automated requests

## API Key Issues

### Key Generation Problems

**Problem**: API key creation fails
**Symptoms**: 500 errors on key generation
**Solutions**:
1. Check API_KEY_SALT is set
2. Verify database schema for api_keys table
3. Review key generation logic
4. Check for duplicate key IDs

**Problem**: API key validation fails
**Symptoms**: Valid keys rejected
**Solutions**:
1. Verify key format (cutty_ prefix)
2. Check key hasn't expired
3. Verify key is active
4. Review hashing algorithm

### Permission Issues

**Problem**: API key permission denied
**Symptoms**: 403 errors with valid keys
**Solutions**:
1. Check key has required permissions
2. Verify permission validation logic
3. Review endpoint permission requirements
4. Check for permission changes

## Performance Issues

### Slow Response Times

**Problem**: API responses are slow
**Symptoms**: High response times, timeouts
**Solutions**:
1. Review database query performance
2. Check for N+1 query problems
3. Optimize KV storage access
4. Review middleware stack

**Problem**: Memory usage high
**Symptoms**: Worker memory limits hit
**Solutions**:
1. Review data structures and caching
2. Check for memory leaks
3. Optimize query result processing
4. Review middleware efficiency

### Database Performance

**Problem**: Database queries slow
**Symptoms**: Query timeout errors
**Solutions**:
1. Add indexes to frequently queried columns
2. Optimize query logic
3. Limit result set sizes
4. Use prepared statements

## Security Issues

### Brute Force Attacks

**Problem**: Account brute force attempts
**Symptoms**: Multiple failed login attempts
**Solutions**:
1. Verify rate limiting is active
2. Check IP blocking functionality
3. Review threat detection rules
4. Implement progressive delays

**Problem**: API abuse
**Symptoms**: Excessive API calls, resource exhaustion
**Solutions**:
1. Implement API rate limiting
2. Add API key restrictions
3. Monitor usage patterns
4. Block abusive IPs

### Token Security

**Problem**: Token compromise suspected
**Symptoms**: Unauthorized access, suspicious activity
**Solutions**:
1. Blacklist compromised tokens
2. Force user re-authentication
3. Review token generation security
4. Check for token leakage

## Monitoring and Debugging

### Debug Mode

Enable debug logging:
```bash
wrangler secret put DEBUG_MODE
# Set to "true"
```

View logs:
```bash
wrangler tail --format=pretty
```

### Health Checks

Check system health:
```bash
curl https://cutty.emilycogsdill.com/health
curl https://cutty.emilycogsdill.com/health/auth
```

### Database Debugging

Check database connectivity:
```bash
wrangler d1 execute cutty-prod --command="SELECT 1"
```

View table structure:
```bash
wrangler d1 execute cutty-prod --command="PRAGMA table_info(users)"
```

### KV Storage Debugging

List KV namespaces:
```bash
wrangler kv:namespace list
```

Check KV values:
```bash
wrangler kv:key list --binding=AUTH_KV
wrangler kv:key get "key_name" --binding=AUTH_KV
```

## Error Codes Reference

### Authentication Errors
- `AUTH_001`: Invalid JWT token
- `AUTH_002`: Token expired
- `AUTH_003`: Token blacklisted
- `AUTH_004`: Invalid credentials
- `AUTH_005`: User not found
- `AUTH_006`: Account locked

### API Key Errors
- `API_001`: Invalid API key format
- `API_002`: API key not found
- `API_003`: API key expired
- `API_004`: API key revoked
- `API_005`: Insufficient permissions

### Database Errors
- `DB_001`: Connection failed
- `DB_002`: Query timeout
- `DB_003`: Constraint violation
- `DB_004`: Transaction failed

### Rate Limiting Errors
- `RATE_001`: IP rate limit exceeded
- `RATE_002`: User rate limit exceeded
- `RATE_003`: API key rate limit exceeded

## Support Escalation

If issues persist after following troubleshooting steps:

1. Gather relevant logs and error messages
2. Document reproduction steps
3. Check system status and metrics
4. File issue with complete details
5. Contact support if critical

## Maintenance Tasks

### Regular Maintenance
- Monitor error rates and response times
- Review security logs for threats
- Clean up expired tokens and keys
- Update dependencies and security patches

### Database Maintenance
- Monitor database size and performance
- Clean up old security events
- Review and optimize indexes
- Backup critical data

### Security Maintenance
- Review and update security rules
- Monitor for new threat patterns
- Update rate limiting thresholds
- Review API key usage patterns
```

### Phase 5: Final Code Polish (Priority: LOW)

#### 5.1 Code Optimization

**Performance Optimizations:**
- Add response caching where appropriate
- Optimize database queries
- Implement connection pooling
- Add request deduplication

**Code Quality Improvements:**
- Add comprehensive error handling
- Implement proper logging
- Add input validation
- Optimize bundle size

#### 5.2 Production Readiness Checklist

**File: `/workers/docs/PRODUCTION_CHECKLIST.md`**
```markdown
# Production Readiness Checklist

## Security
- [ ] All secrets properly configured
- [ ] HTTPS enforced
- [ ] Security headers implemented
- [ ] Rate limiting active
- [ ] Input validation complete
- [ ] SQL injection prevention
- [ ] XSS protection enabled
- [ ] CSRF protection implemented

## Performance
- [ ] Database queries optimized
- [ ] Response times < 200ms
- [ ] Memory usage optimized
- [ ] Caching implemented
- [ ] Bundle size optimized
- [ ] CDN configured

## Monitoring
- [ ] Health checks implemented
- [ ] Error tracking active
- [ ] Performance monitoring
- [ ] Security event logging
- [ ] Alerting configured
- [ ] Metrics collection

## Testing
- [ ] Unit tests > 90% coverage
- [ ] Integration tests passing
- [ ] Load tests completed
- [ ] Security tests passed
- [ ] End-to-end tests passing

## Documentation
- [ ] API documentation complete
- [ ] Developer guide updated
- [ ] Troubleshooting guide
- [ ] Deployment procedures
- [ ] Security procedures

## Compliance
- [ ] Data privacy compliance
- [ ] Security standards met
- [ ] Audit logging enabled
- [ ] Backup procedures
- [ ] Incident response plan
```

## Implementation Checklist

### Phase 1: API Documentation (Day 1-2)
- [ ] Create OpenAPI specification
- [ ] Set up interactive API docs
- [ ] Document all endpoints
- [ ] Add request/response examples

### Phase 2: Code Documentation (Day 3-4)
- [ ] Add JSDoc comments to all services
- [ ] Create comprehensive README
- [ ] Document configuration options
- [ ] Add inline code comments

### Phase 3: Developer Guide (Day 5-6)
- [ ] Create development setup guide
- [ ] Document testing procedures
- [ ] Add coding standards
- [ ] Create release process guide

### Phase 4: Troubleshooting Guide (Day 7-8)
- [ ] Document common issues
- [ ] Create debugging procedures
- [ ] Add error code reference
- [ ] Create support escalation guide

### Phase 5: Final Polish (Day 9-10)
- [ ] Optimize code performance
- [ ] Add comprehensive error handling
- [ ] Complete production checklist
- [ ] Final testing and validation

## Success Criteria

### Documentation Quality
- [ ] Complete API documentation with examples
- [ ] Comprehensive developer guide
- [ ] Clear troubleshooting procedures
- [ ] Up-to-date configuration docs

### Code Quality
- [ ] Comprehensive JSDoc comments
- [ ] Consistent code style
- [ ] Proper error handling
- [ ] Optimized performance

### Production Readiness
- [ ] All security measures implemented
- [ ] Performance benchmarks met
- [ ] Monitoring and alerting active
- [ ] Documentation complete

## Critical Notes for Subagent

- **Documentation Priority**: Focus on user-facing documentation first
- **Code Comments**: Add JSDoc comments to all public APIs
- **Examples**: Include working examples in all documentation
- **Troubleshooting**: Document real issues from development/testing
- **Maintenance**: Keep documentation up-to-date with code changes

This documentation and polish implementation will ensure the authentication system is production-ready with comprehensive documentation and support materials.