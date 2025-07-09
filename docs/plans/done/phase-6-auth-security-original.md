# Phase 6: Authentication & Security - Unified Workers Implementation

## Overview

This document provides a comprehensive technical implementation plan for migrating Django's authentication and security system to our unified Cloudflare Workers deployment. Following the single Worker architecture serving both frontend and backend, this plan leverages Workers KV for session management, D1 for user data, and Cloudflare's built-in security features. The unified approach simplifies security by having a single authentication layer protecting both the React frontend and API endpoints.

## Table of Contents

1. [Unified Workers Security Architecture](#unified-workers-security-architecture)
2. [Current Django Authentication Analysis](#current-django-authentication-analysis)
3. [JWT Implementation Strategy](#jwt-implementation-strategy)
4. [Password Security Migration](#password-security-migration)
5. [Workers KV Session Management](#workers-kv-session-management)
6. [User Registration & Login Flow](#user-registration--login-flow)
7. [Security Middleware Implementation](#security-middleware-implementation)
8. [CORS Configuration](#cors-configuration)
9. [Rate Limiting Implementation](#rate-limiting-implementation)
10. [API Key Management](#api-key-management)
11. [Security Headers Configuration](#security-headers-configuration)
12. [Implementation Code](#implementation-code)
13. [Testing Strategy](#testing-strategy)
14. [Migration Checklist](#migration-checklist)
15. [Phase 5 R2 Security Integration](#phase-5-r2-security-integration)

## Unified Workers Security Architecture

### Security Benefits of Unified Deployment

With our single Worker serving both frontend and backend, security is simplified and enhanced:

1. **Single Entry Point**: All requests go through one Worker, enabling centralized security
2. **No CORS Issues**: Frontend and API share the same origin
3. **Unified Auth Layer**: One authentication system protects all resources
4. **Edge Security**: Cloudflare's DDoS protection and WAF cover everything
5. **Simplified Secrets**: One set of environment variables and secrets

### Integrated Security Stack

```toml
# wrangler.toml - Security-related bindings
name = "list-cutter"
main = "src/index.ts"
compatibility_date = "2024-12-30"

# KV for session/token management
[[kv_namespaces]]
binding = "AUTH_TOKENS"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-id"

# D1 for user data
[[d1_databases]]
binding = "DB"
database_name = "cutty-db"
database_id = "your-d1-database-id"

# Rate limiting
[[unsafe.bindings]]
name = "RATE_LIMITER"
type = "ratelimit"
namespace_id = "1"
simple = { limit = 60, period = 60 }  # 60 requests per minute

# Secrets (set via wrangler secret)
# - JWT_SECRET
# - ENCRYPTION_KEY
# - API_KEY_SALT
```

### Security Flow in Unified Architecture

```typescript
// src/middleware/security.ts
export async function securityMiddleware(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  const url = new URL(request.url);
  
  // 1. Apply security headers to all responses
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': generateCSP(url.pathname)
  };
  
  // 2. Check rate limits
  const { success } = await env.RATE_LIMITER.limit({ key: getClientId(request) });
  if (!success) {
    return new Response('Too Many Requests', { 
      status: 429,
      headers: securityHeaders 
    });
  }
  
  // 3. Route-based security
  if (url.pathname.startsWith('/api/')) {
    // API routes may require authentication
    if (requiresAuth(url.pathname)) {
      const authResult = await validateJWT(request, env);
      if (!authResult.valid) {
        return new Response('Unauthorized', { 
          status: 401,
          headers: { ...securityHeaders, 'WWW-Authenticate': 'Bearer' }
        });
      }
      // Attach user context for downstream handlers
      request.headers.set('X-User-ID', authResult.userId);
    }
  } else if (url.pathname.startsWith('/assets/')) {
    // Static assets get cache headers
    securityHeaders['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else {
    // SPA routes get no-cache for HTML
    securityHeaders['Cache-Control'] = 'no-cache';
  }
  
  // Continue to route handler with security context
  return null;
}

function generateCSP(pathname: string): string {
  const isAPI = pathname.startsWith('/api/');
  
  if (isAPI) {
    // Strict CSP for API endpoints
    return "default-src 'none'; frame-ancestors 'none';";
  }
  
  // CSP for frontend
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // For React
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",  // API calls to same origin
    "frame-ancestors 'none'"
  ].join('; ');
}
```

### Authentication State Management

In the unified architecture, authentication state is shared between frontend and backend:

1. **Login**: API sets secure HTTP-only cookie + returns JWT
2. **Frontend**: Stores JWT in memory for API calls
3. **API Calls**: Include JWT in Authorization header
4. **Static Assets**: Protected by cookie-based auth when needed
5. **Logout**: Clears both cookie and client-side token

## Current Django Authentication Analysis

### Django JWT Configuration
```python
# Current Django settings (base.py)
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=10),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_COOKIE": "access_token",
    "AUTH_COOKIE_HTTP_ONLY": True,
    "AUTH_COOKIE_SECURE": True,
}
```

### Current Authentication Flow
1. User registers with username/email/password
2. Login generates JWT access token (10min) + refresh token (1 day)
3. Refresh tokens rotate on use with blacklisting
4. Authentication via Bearer token in Authorization header
5. User data retrieved via authenticated `/api/accounts/user/` endpoint

### Security Features to Migrate
- JWT token validation and generation
- Password hashing (Django's PBKDF2)
- CORS configuration (`CORS_ALLOW_ALL_ORIGINS = True`)
- Rate limiting (60 requests/minute)
- CSRF protection (currently disabled for API)
- Session management

## JWT Implementation Strategy

### Token Structure
Workers will use the same JWT structure as Django for compatibility:

```typescript
interface JWTPayload {
  user_id: number;
  username: string;
  email?: string;
  exp: number;
  iat: number;
  jti: string;  // JWT ID for token tracking
  token_type: 'access' | 'refresh';
}
```

### Token Lifecycle Management
- **Access tokens**: 10-minute lifetime, stored in memory
- **Refresh tokens**: 1-day lifetime, stored in Workers KV
- **Token rotation**: New refresh token generated on each use
- **Blacklisting**: Old tokens stored in KV with expiration

## Password Security Migration

### Current Django Password Hashing
Django uses PBKDF2 with SHA256 by default:
```python
# Django format: pbkdf2_sha256$iterations$salt$hash
# Example: pbkdf2_sha256$600000$salt$hash
```

### Workers Password Hashing Strategy
Use Web Crypto API for PBKDF2 implementation to maintain compatibility:

```typescript
// Maintain Django-compatible password format
async function hashPassword(password: string): Promise<string> {
  const iterations = 600000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    key,
    256
  );
  
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(derived)));
  
  return `pbkdf2_sha256$${iterations}$${saltBase64}$${hashBase64}`;
}
```

## Workers KV Session Management

### KV Namespace Structure
```typescript
// KV Keys and their purposes
interface KVStructure {
  // Refresh tokens: "refresh_token:{jti}" -> {user_id, expires_at}
  refresh_tokens: {
    key: `refresh_token:${string}`;
    value: {
      user_id: number;
      username: string;
      expires_at: number;
    };
  };
  
  // Blacklisted tokens: "blacklist:{jti}" -> {reason, blacklisted_at}
  blacklisted_tokens: {
    key: `blacklist:${string}`;
    value: {
      reason: string;
      blacklisted_at: number;
    };
  };
  
  // User sessions: "session:{user_id}" -> {last_activity, device_info}
  user_sessions: {
    key: `session:${number}`;
    value: {
      last_activity: number;
      device_info?: string;
      ip_address?: string;
    };
  };
}
```

### KV Operations
```typescript
// Store refresh token
await env.AUTH_KV.put(
  `refresh_token:${jti}`,
  JSON.stringify({
    user_id: user.id,
    username: user.username,
    expires_at: Date.now() + 86400000 // 24 hours
  }),
  { expirationTtl: 86400 } // Auto-expire after 24 hours
);

// Blacklist token
await env.AUTH_KV.put(
  `blacklist:${jti}`,
  JSON.stringify({
    reason: 'token_rotated',
    blacklisted_at: Date.now()
  }),
  { expirationTtl: 86400 } // Keep for 24 hours
);
```

## User Registration & Login Flow

### Registration Flow
1. Validate input data (username, email, password, password2)
2. Check for existing username/email in D1
3. Hash password using PBKDF2
4. Store user in D1
5. Generate JWT access + refresh tokens
6. Store refresh token in KV
7. Return tokens to client

### Login Flow
1. Validate credentials against D1
2. Verify password using PBKDF2
3. Generate new JWT tokens
4. Store refresh token in KV
5. Update user session in KV
6. Return tokens to client

### Token Refresh Flow
1. Validate refresh token from KV
2. Check if token is blacklisted
3. Generate new access + refresh tokens
4. Blacklist old refresh token
5. Store new refresh token in KV
6. Return new tokens to client

## Security Middleware Implementation

### Authentication Middleware
```typescript
// src/middleware/auth.ts
export async function authMiddleware(
  request: Request,
  env: Env,
  next: () => Promise<Response>
): Promise<Response> {
  const url = new URL(request.url);
  
  // Skip auth for public endpoints
  const publicPaths = [
    '/api/accounts/register',
    '/api/accounts/login',
    '/api/list_cutter/csv_cutter',
    '/api/list_cutter/export_csv'
  ];
  
  if (publicPaths.includes(url.pathname)) {
    return next();
  }
  
  // Extract and validate JWT token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.substring(7);
  const user = await verifyJWT(token, env);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Add user to request context
  return next();
}
```

### Security Headers Middleware
```typescript
// src/middleware/security.ts
export function securityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  
  // Security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Content-Security-Policy', 
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );
  
  // HSTS for HTTPS
  if (new URL(response.url).protocol === 'https:') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
```

## CORS Configuration

### CORS in Unified Workers Architecture

One of the major benefits of our unified Workers deployment is the elimination of CORS complexity:

```typescript
// src/middleware/cors.ts
export function corsMiddleware(request: Request): Response | null {
  // In the unified architecture, frontend and API share the same origin
  // CORS is only needed for external API access
  
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  
  // No CORS needed for same-origin requests (our frontend calling our API)
  if (!origin || origin === url.origin) {
    return null;
  }
  
  // Handle external API access (if we expose public APIs in the future)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',  // Or specific allowed origins
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  
  // For actual requests from external origins
  return null;  // Let the request continue with CORS headers added in response
}

// Simplified approach - no CORS middleware needed for internal use
export function addCorsHeaders(response: Response, request: Request): Response {
  const origin = request.headers.get('Origin');
  
  // Only add CORS headers for external origins
  if (origin && origin !== new URL(request.url).origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  return response;
}

### Benefits of Unified CORS Approach

1. **No CORS Errors**: Frontend and API on same origin eliminates CORS issues
2. **Simplified Development**: No need to configure CORS for local development
3. **Better Security**: No need to allow wildcard origins or credentials
4. **Improved Performance**: No preflight requests for same-origin calls
5. **Easier Debugging**: One less layer of complexity to troubleshoot

export function addCorsHeaders(response: Response, origin?: string): Response {
  const headers = new Headers(response.headers);
  
  const allowedOrigins = [
    'https://list-cutter.emilyflam.be',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
```

## Rate Limiting Implementation

### KV-Based Rate Limiting
```typescript
// src/middleware/rateLimit.ts
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (request: Request) => string;
}

export async function rateLimit(
  request: Request,
  env: Env,
  config: RateLimitConfig
): Promise<Response | null> {
  const key = config.keyGenerator(request);
  const window = Math.floor(Date.now() / config.windowMs);
  const rateLimitKey = `rate_limit:${key}:${window}`;
  
  // Get current request count
  const currentCountStr = await env.AUTH_KV.get(rateLimitKey);
  const currentCount = currentCountStr ? parseInt(currentCountStr) : 0;
  
  if (currentCount >= config.maxRequests) {
    return new Response(JSON.stringify({ 
      error: 'Rate limit exceeded. Please try again later.' 
    }), {
      status: 429,
      headers: { 
        'Content-Type': 'application/json',
        'Retry-After': (config.windowMs / 1000).toString()
      }
    });
  }
  
  // Increment counter
  await env.AUTH_KV.put(
    rateLimitKey,
    (currentCount + 1).toString(),
    { expirationTtl: Math.ceil(config.windowMs / 1000) }
  );
  
  return null; // Continue to next middleware
}

// Usage examples
export const userRateLimit = (request: Request, env: Env) => 
  rateLimit(request, env, {
    windowMs: 60000, // 1 minute
    maxRequests: 60,
    keyGenerator: (req) => `user:${getUserFromToken(req)?.id || 'anonymous'}`
  });

export const ipRateLimit = (request: Request, env: Env) =>
  rateLimit(request, env, {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    keyGenerator: (req) => `ip:${req.headers.get('CF-Connecting-IP') || 'unknown'}`
  });
```

## API Key Management

### Optional API Key System
```typescript
// src/services/auth/apiKeys.ts
interface ApiKey {
  key_id: string;
  user_id: number;
  name: string;
  key_hash: string;
  permissions: string[];
  created_at: number;
  last_used?: number;
  expires_at?: number;
}

export async function generateApiKey(
  user_id: number,
  name: string,
  permissions: string[],
  env: Env
): Promise<{ key_id: string; api_key: string }> {
  const key_id = crypto.randomUUID();
  const api_key = `lc_${btoa(crypto.randomUUID()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)}`;
  
  // Hash the API key
  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(api_key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyBuffer);
  const key_hash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  
  // Store in D1
  await env.DB.prepare(`
    INSERT INTO api_keys (key_id, user_id, name, key_hash, permissions, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    key_id,
    user_id,
    name,
    key_hash,
    JSON.stringify(permissions),
    Date.now()
  ).run();
  
  return { key_id, api_key };
}

export async function validateApiKey(
  api_key: string,
  env: Env
): Promise<ApiKey | null> {
  // Hash the provided key
  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(api_key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyBuffer);
  const key_hash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  
  // Look up in D1
  const result = await env.DB.prepare(`
    SELECT * FROM api_keys 
    WHERE key_hash = ? AND (expires_at IS NULL OR expires_at > ?)
  `).bind(key_hash, Date.now()).first();
  
  if (!result) return null;
  
  // Update last_used
  await env.DB.prepare(`
    UPDATE api_keys SET last_used = ? WHERE key_id = ?
  `).bind(Date.now(), result.key_id).run();
  
  return {
    key_id: result.key_id as string,
    user_id: result.user_id as number,
    name: result.name as string,
    key_hash: result.key_hash as string,
    permissions: JSON.parse(result.permissions as string),
    created_at: result.created_at as number,
    last_used: result.last_used as number,
    expires_at: result.expires_at as number
  };
}
```

## Security Headers Configuration

### Comprehensive Security Headers
```typescript
// src/middleware/headers.ts
export function applySecurityHeaders(response: Response, env: Env): Response {
  const headers = new Headers(response.headers);
  
  // Content security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  const cspPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://*.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  
  headers.set('Content-Security-Policy', cspPolicy);
  
  // HSTS for HTTPS
  if (env.ENVIRONMENT === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Permissions Policy
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
```

## Implementation Code

### JWT Service Implementation

```typescript
// src/services/auth/jwt.ts
import { SignJWT, jwtVerify } from 'jose';

interface JWTPayload {
  user_id: number;
  username: string;
  email?: string;
  exp: number;
  iat: number;
  jti: string;
  token_type: 'access' | 'refresh';
}

export async function generateJWT(
  payload: Omit<JWTPayload, 'exp' | 'iat' | 'jti'>,
  secret: string,
  expiresIn: string
): Promise<string> {
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseExpiresIn(expiresIn);
  
  const jwt = await new SignJWT({
    ...payload,
    jti,
    exp,
    iat: now
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(new TextEncoder().encode(secret));
  
  return jwt;
}

export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    
    return payload as JWTPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

export async function generateTokenPair(
  user: { id: number; username: string; email?: string },
  env: Env
): Promise<{ access_token: string; refresh_token: string }> {
  const access_token = await generateJWT(
    {
      user_id: user.id,
      username: user.username,
      email: user.email,
      token_type: 'access'
    },
    env.JWT_SECRET,
    '10m'
  );
  
  const refresh_token = await generateJWT(
    {
      user_id: user.id,
      username: user.username,
      email: user.email,
      token_type: 'refresh'
    },
    env.JWT_SECRET,
    '1d'
  );
  
  // Store refresh token in KV
  const refreshPayload = await verifyJWT(refresh_token, env.JWT_SECRET);
  if (refreshPayload) {
    await env.AUTH_KV.put(
      `refresh_token:${refreshPayload.jti}`,
      JSON.stringify({
        user_id: user.id,
        username: user.username,
        expires_at: refreshPayload.exp * 1000
      }),
      { expirationTtl: 86400 }
    );
  }
  
  return { access_token, refresh_token };
}

function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error('Invalid expiresIn format');
  
  const [, value, unit] = match;
  const num = parseInt(value);
  
  switch (unit) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: throw new Error('Invalid time unit');
  }
}
```

### Authentication Routes

```typescript
// src/routes/accounts/register.ts
export async function handleRegister(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json();
  const { username, email, password, password2 } = body;
  
  // Validate input
  if (!username || !password || !password2) {
    return new Response(JSON.stringify({ 
      error: 'Username, password, and password confirmation are required' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (password !== password2) {
    return new Response(JSON.stringify({ 
      error: 'Passwords do not match' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if user exists
  const existingUser = await env.DB.prepare(`
    SELECT id FROM users WHERE username = ? OR email = ?
  `).bind(username, email).first();
  
  if (existingUser) {
    return new Response(JSON.stringify({ 
      error: 'User with this username or email already exists' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Hash password
  const passwordHash = await hashPassword(password);
  
  // Create user
  const result = await env.DB.prepare(`
    INSERT INTO users (username, email, password, created_at)
    VALUES (?, ?, ?, ?)
    RETURNING id, username, email
  `).bind(username, email, passwordHash, new Date().toISOString()).first();
  
  if (!result) {
    return new Response(JSON.stringify({ 
      error: 'Failed to create user' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Generate tokens
  const tokens = await generateTokenPair({
    id: result.id as number,
    username: result.username as string,
    email: result.email as string
  }, env);
  
  return new Response(JSON.stringify({
    message: 'User created successfully',
    user: {
      id: result.id,
      username: result.username,
      email: result.email
    },
    ...tokens
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

```typescript
// src/routes/accounts/login.ts
export async function handleLogin(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json();
  const { username, password } = body;
  
  if (!username || !password) {
    return new Response(JSON.stringify({ 
      error: 'Username and password are required' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Get user from database
  const user = await env.DB.prepare(`
    SELECT id, username, email, password FROM users 
    WHERE username = ? OR email = ?
  `).bind(username, username).first();
  
  if (!user) {
    return new Response(JSON.stringify({ 
      error: 'Invalid credentials' 
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Verify password
  const isValidPassword = await verifyPassword(password, user.password as string);
  if (!isValidPassword) {
    return new Response(JSON.stringify({ 
      error: 'Invalid credentials' 
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Generate tokens
  const tokens = await generateTokenPair({
    id: user.id as number,
    username: user.username as string,
    email: user.email as string
  }, env);
  
  // Update last login
  await env.DB.prepare(`
    UPDATE users SET last_login = ? WHERE id = ?
  `).bind(new Date().toISOString(), user.id).run();
  
  return new Response(JSON.stringify({
    message: 'Login successful',
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    },
    ...tokens
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

```typescript
// src/routes/accounts/refresh.ts
export async function handleTokenRefresh(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json();
  const { refresh_token } = body;
  
  if (!refresh_token) {
    return new Response(JSON.stringify({ 
      error: 'Refresh token is required' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Verify refresh token
  const payload = await verifyJWT(refresh_token, env.JWT_SECRET);
  if (!payload || payload.token_type !== 'refresh') {
    return new Response(JSON.stringify({ 
      error: 'Invalid refresh token' 
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if token exists in KV and is not blacklisted
  const storedToken = await env.AUTH_KV.get(`refresh_token:${payload.jti}`);
  const blacklisted = await env.AUTH_KV.get(`blacklist:${payload.jti}`);
  
  if (!storedToken || blacklisted) {
    return new Response(JSON.stringify({ 
      error: 'Refresh token is invalid or has been revoked' 
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Get user from database
  const user = await env.DB.prepare(`
    SELECT id, username, email FROM users WHERE id = ?
  `).bind(payload.user_id).first();
  
  if (!user) {
    return new Response(JSON.stringify({ 
      error: 'User not found' 
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Blacklist old refresh token
  await env.AUTH_KV.put(
    `blacklist:${payload.jti}`,
    JSON.stringify({
      reason: 'token_rotated',
      blacklisted_at: Date.now()
    }),
    { expirationTtl: 86400 }
  );
  
  // Generate new tokens
  const tokens = await generateTokenPair({
    id: user.id as number,
    username: user.username as string,
    email: user.email as string
  }, env);
  
  return new Response(JSON.stringify({
    message: 'Token refreshed successfully',
    ...tokens
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Database Schema

```sql
-- D1 Database Schema
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_login TEXT,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE api_keys (
  key_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  permissions TEXT NOT NULL, -- JSON array
  created_at INTEGER NOT NULL,
  last_used INTEGER,
  expires_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

### Main Worker Entry Point

```typescript
// src/index.ts
import { corsMiddleware, addCorsHeaders } from './middleware/cors';
import { authMiddleware } from './middleware/auth';
import { securityHeaders } from './middleware/security';
import { ipRateLimit } from './middleware/rateLimit';
import { handleRegister } from './routes/accounts/register';
import { handleLogin } from './routes/accounts/login';
import { handleTokenRefresh } from './routes/accounts/refresh';
import { handleUserInfo } from './routes/accounts/user';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // CORS preflight
      const corsResponse = corsMiddleware(request);
      if (corsResponse) return corsResponse;
      
      // Rate limiting
      const rateLimitResponse = await ipRateLimit(request, env);
      if (rateLimitResponse) return rateLimitResponse;
      
      const url = new URL(request.url);
      const origin = request.headers.get('Origin');
      
      let response: Response;
      
      // Route handling
      if (url.pathname === '/api/accounts/register' && request.method === 'POST') {
        response = await handleRegister(request, env);
      } else if (url.pathname === '/api/accounts/login' && request.method === 'POST') {
        response = await handleLogin(request, env);
      } else if (url.pathname === '/api/accounts/token/refresh' && request.method === 'POST') {
        response = await handleTokenRefresh(request, env);
      } else if (url.pathname === '/api/accounts/user' && request.method === 'GET') {
        // Apply auth middleware
        const authResponse = await authMiddleware(request, env, async () => {
          return handleUserInfo(request, env);
        });
        response = authResponse;
      } else {
        response = new Response('Not Found', { status: 404 });
      }
      
      // Apply security headers
      response = securityHeaders(response);
      
      // Add CORS headers
      response = addCorsHeaders(response, origin);
      
      return response;
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
```

## Testing Strategy

### Unit Tests

```typescript
// tests/auth/jwt.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { generateJWT, verifyJWT } from '../../src/services/auth/jwt';

describe('JWT Service', () => {
  const secret = 'test-secret-key';
  const payload = {
    user_id: 1,
    username: 'testuser',
    email: 'test@example.com',
    token_type: 'access' as const
  };
  
  it('should generate and verify JWT tokens', async () => {
    const token = await generateJWT(payload, secret, '10m');
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    
    const verified = await verifyJWT(token, secret);
    expect(verified).toBeDefined();
    expect(verified?.user_id).toBe(payload.user_id);
    expect(verified?.username).toBe(payload.username);
  });
  
  it('should reject invalid tokens', async () => {
    const invalidToken = 'invalid.token.here';
    const verified = await verifyJWT(invalidToken, secret);
    expect(verified).toBeNull();
  });
  
  it('should reject tokens with wrong secret', async () => {
    const token = await generateJWT(payload, secret, '10m');
    const verified = await verifyJWT(token, 'wrong-secret');
    expect(verified).toBeNull();
  });
});
```

### Integration Tests

```typescript
// tests/auth/integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { unstable_dev } from 'wrangler';

describe('Authentication Integration', () => {
  let worker: any;
  
  beforeEach(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true }
    });
  });
  
  afterEach(async () => {
    await worker.stop();
  });
  
  it('should register a new user', async () => {
    const response = await worker.fetch('/api/accounts/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: 'test@example.com',
        password: 'testpass123',
        password2: 'testpass123'
      })
    });
    
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.access_token).toBeDefined();
    expect(data.refresh_token).toBeDefined();
  });
  
  it('should login existing user', async () => {
    // Register first
    await worker.fetch('/api/accounts/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'testpass123',
        password2: 'testpass123'
      })
    });
    
    // Login
    const response = await worker.fetch('/api/accounts/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser2',
        password: 'testpass123'
      })
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.access_token).toBeDefined();
    expect(data.refresh_token).toBeDefined();
  });
});
```

### Load Testing

```javascript
// tests/load/auth-load.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 0 }
  ]
};

export default function() {
  // Test login endpoint
  let response = http.post('https://your-worker.your-subdomain.workers.dev/api/accounts/login', 
    JSON.stringify({
      username: 'testuser',
      password: 'testpass123'
    }),
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has access token': (r) => JSON.parse(r.body).access_token !== undefined
  });
}
```

## Migration Checklist

### Environment Setup
- [ ] Create Workers KV namespace for authentication (`AUTH_KV`)
- [ ] Set up D1 database with user tables
- [ ] Configure environment variables (`JWT_SECRET`, `BCRYPT_ROUNDS`, etc.)
- [ ] Set up Wrangler configuration with bindings

### Database Migration
- [ ] Create D1 database schema
- [ ] Export user data from Django PostgreSQL
- [ ] Transform password hashes to maintain compatibility
- [ ] Import user data to D1
- [ ] Verify data integrity

### Authentication Implementation
- [ ] Implement JWT service with signing/verification
- [ ] Create password hashing utilities (PBKDF2)
- [ ] Build user registration endpoint
- [ ] Build user login endpoint
- [ ] Implement token refresh mechanism
- [ ] Add user info endpoint

### Security Implementation
- [ ] Implement rate limiting middleware
- [ ] Add CORS configuration
- [ ] Set up security headers
- [ ] Configure CSP policies
- [ ] Add authentication middleware

### Testing
- [ ] Write unit tests for JWT service
- [ ] Write unit tests for password hashing
- [ ] Create integration tests for auth endpoints
- [ ] Test rate limiting functionality
- [ ] Perform load testing
- [ ] Security penetration testing

### Production Deployment
- [ ] Deploy to staging environment
- [ ] Test with frontend integration
- [ ] Monitor error rates and performance
- [ ] Set up alerts for authentication failures
- [ ] Create backup procedures for KV data
- [ ] Deploy to production

### Monitoring & Maintenance
- [ ] Set up authentication analytics
- [ ] Monitor token usage patterns
- [ ] Track rate limiting effectiveness
- [ ] Regular security audits
- [ ] Token cleanup procedures

## Success Metrics

### Performance Targets
- Authentication response time < 100ms
- Token generation/validation < 50ms
- Rate limiting overhead < 10ms
- KV operation response time < 25ms

### Security Metrics
- Zero successful brute force attacks
- JWT token security (no unauthorized access)
- Rate limiting effectiveness (>95% malicious traffic blocked)
- Password security (PBKDF2 with 600k iterations)

### Availability Targets
- 99.9% uptime for authentication services
- Graceful degradation during high load
- Recovery time < 5 minutes for auth failures
- Zero data loss during migrations

## Next Steps

1. **Week 1**: Set up KV namespace and D1 database
2. **Week 2**: Implement JWT service and password hashing
3. **Week 3**: Build authentication endpoints
4. **Week 4**: Add security middleware and testing
5. **Week 5**: Integration testing and security audit
6. **Week 6**: Production deployment and monitoring setup

## Unified Architecture Security Benefits

The unified Workers deployment transforms authentication and security:

### Architectural Advantages
1. **Single Security Perimeter**: One Worker protects all resources
2. **Simplified Auth Flow**: No cross-origin token management
3. **Unified Session Management**: Shared auth state between frontend and API
4. **Edge-Native Security**: Cloudflare's security features protect everything
5. **Reduced Attack Surface**: Single deployment eliminates many attack vectors

### Implementation Benefits
- **No CORS Complexity**: Same-origin eliminates cross-origin issues
- **Shared Security Context**: Middleware applies to all routes
- **Centralized Rate Limiting**: One rate limiter for entire application
- **Simplified Secrets**: One set of environment variables
- **Better Performance**: No additional network hops for auth

### Operational Benefits
- **Single Monitoring Point**: One dashboard for all security metrics
- **Unified Logging**: All security events in one stream
- **Simplified Deployment**: Security updates deploy with application
- **Cost Efficiency**: One Worker, one set of security services
- **Global Protection**: Cloudflare's edge security everywhere

This unified approach provides enterprise-grade security while dramatically simplifying the implementation and maintenance of authentication and security features.

## Phase 5 R2 Security Integration

### Critical Dependencies from Phase 5 Follow-up

**⚠️ PREREQUISITE**: Phase 6 implementation depends on completing Phase 5 follow-up tasks for R2 security integration.

#### Required Phase 5 Follow-up Completions

**🔴 CRITICAL - Must Complete First:**
- **Issue #64**: Missing D1 database tables for R2 operations
  - Required for user-based file access controls
  - Blocks authentication integration with R2StorageService
  - **Status**: BLOCKS Phase 6 - complete immediately

**🟡 HIGH PRIORITY - Integrate with Phase 6:**
- **Issue #67**: Comprehensive security measures for R2 file operations
  - File access control middleware needed for auth integration
  - User quota management aligns with Phase 6 user management
  - Audit logging complements Phase 6 security logging

#### R2 Authentication Integration Points

**1. File Access Control Middleware**
```typescript
// Integrates with Phase 6 JWT middleware
export async function validateR2FileAccess(
  c: Context,
  fileId: string,
  operation: 'read' | 'write' | 'delete'
): Promise<{ authorized: boolean; user: User | null }> {
  // Uses Phase 6 JWT validation
  const user = await validateJWTToken(c);
  
  // Check file ownership using Issue #64 database tables
  const fileRecord = await c.env.DB.prepare(`
    SELECT user_id FROM files WHERE id = ?
  `).bind(fileId).first();
  
  const authorized = fileRecord && fileRecord.user_id === user.id;
  
  // Log using Issue #67 audit system
  await logFileAccess(fileId, user.id, operation, authorized);
  
  return { authorized, user };
}
```

**2. Unified Security Headers**
```typescript
// Extends Phase 6 security headers for R2 file responses
export function addR2SecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  
  // Phase 6 standard security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // R2-specific headers from Issue #67
  headers.set('Content-Security-Policy', "default-src 'none'");
  headers.set('X-Download-Options', 'noopen');
  
  return new Response(response.body, { ...response, headers });
}
```

**3. User Quota Integration**
```typescript
// Integrates R2 quotas with Phase 6 user management
export class UserQuotaService {
  async checkUploadQuota(userId: string, fileSize: number): Promise<QuotaCheckResult> {
    // Get user tier from Phase 6 user management
    const user = await getUserById(userId);
    
    // Check against Issue #67 quota tables
    const quota = await this.getUserQuota(userId, user.tier);
    
    return {
      allowed: quota.currentStorage + fileSize <= quota.maxStorage,
      remaining: quota.maxStorage - quota.currentStorage,
      userTier: user.tier
    };
  }
}
```

#### Implementation Sequence for Phase 6

**Week 1: Complete Phase 5 Prerequisites**
1. Complete Issue #64 (database tables) - CRITICAL
2. Begin Issue #67 (R2 security measures)

**Week 2: Integrate R2 Auth with Phase 6**
1. Extend Phase 6 JWT middleware to support R2 file operations
2. Implement unified file access control
3. Add R2 operations to Phase 6 audit logging

**Week 3: Complete Integration**
1. Test end-to-end auth flow with R2 operations
2. Validate security controls across all file operations
3. Complete Issue #67 R2 security implementation

### Updated Phase 6 Success Criteria

**Authentication Integration:**
- [ ] JWT authentication protects all R2 file operations
- [ ] File ownership validation using D1 database (Issue #64)
- [ ] User quota enforcement integrated with auth system

**Security Integration:**
- [ ] Unified security headers for all responses (app + files)
- [ ] Complete audit logging for auth and file operations
- [ ] Rate limiting covers both API and file operations

**Testing Requirements:**
- [ ] End-to-end tests cover authenticated file upload/download
- [ ] Security tests validate file access controls
- [ ] Performance tests include R2 operations with auth overhead

### Migration Notes

The unified Workers architecture greatly simplifies this integration since both authentication and file operations happen in the same Worker context. This eliminates cross-service communication and provides stronger security guarantees than a traditional microservices approach.