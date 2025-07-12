# Phase 6: Authentication & Security - Updated for R2 Integration

## Overview

This phase implements comprehensive authentication and security for the unified Cloudflare Workers deployment, building on the completed R2 storage migration. The unified architecture simplifies security by providing a single authentication layer that protects both the React frontend and API endpoints, with integrated R2 file access controls.

## Prerequisites

**CRITICAL:** Must complete Phase 5.5 before starting Phase 6:
- ✅ Issue #64: D1 database tables for R2 operations
- ✅ Issue #67: Security hardening for R2 file operations

## Implementation Strategy

### 1. JWT Authentication System

**JWT Service Implementation:**
```typescript
// Enhanced JWT service with R2 integration
export class JWTService {
  async generateTokenPair(user: User, env: Env): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    // Generate access token (10 minutes)
    const access_token = await this.generateJWT({
      user_id: user.id,
      username: user.username,
      email: user.email,
      permissions: user.permissions,
      token_type: 'access'
    }, env.JWT_SECRET, '10m');

    // Generate refresh token (1 day)
    const refresh_token = await this.generateJWT({
      user_id: user.id,
      username: user.username,
      token_type: 'refresh'
    }, env.JWT_SECRET, '1d');

    // Store refresh token in KV
    await this.storeRefreshToken(refresh_token, user.id, env);

    return { access_token, refresh_token };
  }
}
```

### 2. Unified Authentication Middleware

**Integrated Auth with R2 File Access:**
```typescript
// Authentication middleware that works with R2 operations
export async function authMiddleware(
  request: Request,
  env: Env,
  next: () => Promise<Response>
): Promise<Response> {
  const url = new URL(request.url);
  
  // Skip auth for public endpoints
  if (isPublicEndpoint(url.pathname)) {
    return next();
  }

  // Validate JWT token
  const user = await validateJWTToken(request, env);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Add user context to request
  request.headers.set('X-User-ID', user.id.toString());
  request.headers.set('X-User-Role', user.role);

  return next();
}
```

### 3. R2 File Access Control

**Integrated File Security:**
```typescript
// File access control leveraging Phase 5.5 security work
export class R2FileAccessControl {
  async validateFileAccess(
    fileId: string,
    userId: string,
    operation: 'read' | 'write' | 'delete',
    env: Env
  ): Promise<{ authorized: boolean; reason?: string }> {
    // Get file metadata from D1 (Issue #64 tables)
    const file = await env.DB.prepare(`
      SELECT user_id, filename, r2_key 
      FROM files 
      WHERE id = ?
    `).bind(fileId).first();

    if (!file) {
      return { authorized: false, reason: 'File not found' };
    }

    // Check ownership
    if (file.user_id !== userId) {
      await this.logFileAccess(fileId, userId, operation, false, 'Access denied', env);
      return { authorized: false, reason: 'Access denied' };
    }

    // Log successful access (Issue #67 audit logging)
    await this.logFileAccess(fileId, userId, operation, true, null, env);
    
    return { authorized: true };
  }

  private async logFileAccess(
    fileId: string,
    userId: string,
    operation: string,
    success: boolean,
    error: string | null,
    env: Env
  ): Promise<void> {
    await env.DB.prepare(`
      INSERT INTO file_access_logs (
        file_id, user_id, action, success, error_message, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      fileId,
      userId,
      operation,
      success ? 1 : 0,
      error,
      new Date().toISOString()
    ).run();
  }
}
```

### 4. User Registration & Login

**Enhanced User Management:**
```typescript
// User registration with R2 quota setup
export async function handleUserRegistration(
  request: Request,
  env: Env
): Promise<Response> {
  const { username, email, password, password2 } = await request.json();

  // Validate input
  if (!username || !email || !password || password !== password2) {
    return new Response('Invalid input', { status: 400 });
  }

  // Check for existing user
  const existingUser = await env.DB.prepare(`
    SELECT id FROM users WHERE username = ? OR email = ?
  `).bind(username, email).first();

  if (existingUser) {
    return new Response('User already exists', { status: 409 });
  }

  // Create user with default quotas
  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO users (id, username, email, password, created_at, storage_quota_bytes, file_quota_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    userId,
    username,
    email,
    passwordHash,
    new Date().toISOString(),
    1073741824, // 1GB default quota
    1000        // 1000 files default quota
  ).run();

  // Generate tokens
  const tokens = await generateTokenPair({ id: userId, username, email }, env);

  return new Response(JSON.stringify({
    message: 'User created successfully',
    user: { id: userId, username, email },
    ...tokens
  }), { 
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### 5. Security Headers and CORS

**Unified Security Configuration:**
```typescript
// Security headers for unified Worker
export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  
  // Core security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Content Security Policy for unified app
  headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "frame-ancestors 'none'"
  ].join('; '));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
```

### 6. Rate Limiting

**Integrated Rate Limiting:**
```typescript
// Rate limiting for all endpoints including file operations
export class RateLimiter {
  async checkRateLimit(
    request: Request,
    env: Env,
    limits: { requests: number; window: number }
  ): Promise<{ allowed: boolean; remaining: number }> {
    const key = this.generateRateLimitKey(request);
    const window = Math.floor(Date.now() / (limits.window * 1000));
    const rateLimitKey = `rate_limit:${key}:${window}`;

    const current = await env.AUTH_TOKENS.get(rateLimitKey);
    const currentCount = current ? parseInt(current) : 0;

    if (currentCount >= limits.requests) {
      return { allowed: false, remaining: 0 };
    }

    // Increment counter
    await env.AUTH_TOKENS.put(
      rateLimitKey,
      (currentCount + 1).toString(),
      { expirationTtl: limits.window }
    );

    return { 
      allowed: true, 
      remaining: limits.requests - currentCount - 1 
    };
  }

  private generateRateLimitKey(request: Request): string {
    // Use IP address for anonymous users, user ID for authenticated
    const userId = request.headers.get('X-User-ID');
    const ip = request.headers.get('CF-Connecting-IP');
    
    return userId ? `user:${userId}` : `ip:${ip}`;
  }
}
```

## Implementation Timeline

### Week 1: Core Authentication (Days 1-5)
- **Days 1-2:** Implement JWT service with R2 integration
- **Days 3-4:** Create authentication middleware
- **Day 5:** Build user registration and login endpoints

### Week 2: Security Integration (Days 6-10)
- **Days 6-7:** Implement R2 file access controls
- **Days 8-9:** Add security headers and CORS
- **Day 10:** Implement rate limiting

### Week 3: Testing and Validation (Days 11-15)
- **Days 11-12:** Unit tests for authentication
- **Days 13-14:** Integration tests with R2
- **Day 15:** Security testing and validation

## Success Criteria

**Phase 6 Complete When:**
- [ ] JWT authentication system operational
- [ ] User registration and login working
- [ ] R2 file access controls implemented
- [ ] Security headers configured
- [ ] Rate limiting functional
- [ ] All security tests passing
- [ ] Integration with Phase 5.5 R2 work validated

## Integration Benefits

**With Phase 5.5 R2 Work:**
- File access controls use Phase 5.5 security framework
- Audit logging integrates with Phase 5.5 monitoring
- User quotas leverage Phase 5.5 storage tracking

**With Unified Workers:**
- Single authentication layer for frontend and API
- No CORS complexity (same origin)
- Shared security context across all operations
- Simplified token management

## Security Validation

**Required Security Tests:**
- JWT token validation and expiration
- File access control enforcement
- Rate limiting effectiveness
- SQL injection prevention
- XSS protection validation
- CSRF protection (where applicable)

This phase builds directly on the completed R2 storage migration and Phase 5.5 security work to provide comprehensive authentication and security for the unified Cloudflare Workers deployment.