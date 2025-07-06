# Phase 6: Detailed Authentication & Security Migration Implementation Plan

## Executive Summary

This document provides a comprehensive implementation plan for migrating Django's authentication and security system to Cloudflare Workers. The plan covers JWT-based authentication, secure password handling, session management, and implementing robust security measures using Workers KV, D1, and Cloudflare's security features.

## Table of Contents

1. [Django Authentication System Analysis](#django-authentication-system-analysis)
2. [JWT Implementation in Workers](#jwt-implementation-in-workers)
3. [Workers KV for Session Storage](#workers-kv-for-session-storage)
4. [Security Headers and CORS Configuration](#security-headers-and-cors-configuration)
5. [Rate Limiting and Abuse Prevention](#rate-limiting-and-abuse-prevention)
6. [Password Security and Hashing](#password-security-and-hashing)
7. [Token Rotation and Refresh Mechanisms](#token-rotation-and-refresh-mechanisms)
8. [Security Auditing and Monitoring](#security-auditing-and-monitoring)
9. [OWASP Security Best Practices](#owasp-security-best-practices)
10. [Migration from Django Sessions to JWT](#migration-from-django-sessions-to-jwt)
11. [Complete Implementation Code](#complete-implementation-code)
12. [Testing and Validation](#testing-and-validation)
13. [Deployment and Monitoring](#deployment-and-monitoring)

---

## 1. Django Authentication System Analysis

### Current Authentication Architecture

Based on the codebase analysis, the current Django system uses:

```python
# Current Django JWT Configuration
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

### Current Authentication Flow Analysis

1. **User Registration**: Django's `UserCreationForm` creates users with username/password
2. **Login Process**: Returns JWT access token (10min) + refresh token (1 day)
3. **Token Management**: Refresh tokens rotate with blacklisting
4. **Frontend Integration**: React context manages tokens in localStorage
5. **API Authentication**: Bearer tokens in Authorization header

### Security Features to Preserve

- JWT token validation and generation
- Password hashing (Django's PBKDF2)
- Token rotation and blacklisting
- CORS configuration
- Rate limiting (60 requests/minute)
- Session-based authentication for web views

### Migration Challenges Identified

1. **Password Hash Compatibility**: Django uses PBKDF2 with specific format
2. **Token Blacklisting**: Need KV-based blacklist implementation
3. **Session Management**: Replace Django sessions with KV storage
4. **CORS Complexity**: Frontend expects specific CORS headers
5. **Rate Limiting**: Move from Django middleware to Workers

---

## 2. JWT Implementation in Workers

### JWT Service Architecture

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

interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
}

export class JWTService {
  private secret: string;
  private accessTokenLifetime: number = 600; // 10 minutes
  private refreshTokenLifetime: number = 86400; // 24 hours

  constructor(secret: string) {
    this.secret = secret;
  }

  async generateAccessToken(user: {
    id: number;
    username: string;
    email?: string;
  }): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.accessTokenLifetime;
    const jti = crypto.randomUUID();

    return new SignJWT({
      user_id: user.id,
      username: user.username,
      email: user.email,
      token_type: 'access',
      jti,
      exp,
      iat: now
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(exp)
      .setJti(jti)
      .sign(new TextEncoder().encode(this.secret));
  }

  async generateRefreshToken(user: {
    id: number;
    username: string;
    email?: string;
  }): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.refreshTokenLifetime;
    const jti = crypto.randomUUID();

    return new SignJWT({
      user_id: user.id,
      username: user.username,
      email: user.email,
      token_type: 'refresh',
      jti,
      exp,
      iat: now
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(exp)
      .setJti(jti)
      .sign(new TextEncoder().encode(this.secret));
  }

  async generateTokenPair(user: {
    id: number;
    username: string;
    email?: string;
  }): Promise<TokenPair> {
    const access_token = await this.generateAccessToken(user);
    const refresh_token = await this.generateRefreshToken(user);

    return {
      access_token,
      refresh_token,
      expires_in: this.accessTokenLifetime,
      refresh_expires_in: this.refreshTokenLifetime
    };
  }

  async verifyToken(token: string): Promise<JWTPayload | null> {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(this.secret)
      );
      return payload as JWTPayload;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  }

  async extractTokenFromRequest(request: Request): Promise<string | null> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}
```

### Token Blacklisting System

```typescript
// src/services/auth/blacklist.ts
export class TokenBlacklist {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async addToBlacklist(
    jti: string,
    reason: string,
    expiresAt: number
  ): Promise<void> {
    const blacklistEntry = {
      jti,
      reason,
      blacklisted_at: Date.now(),
      expires_at: expiresAt
    };

    const ttl = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    await this.kv.put(
      `blacklist:${jti}`,
      JSON.stringify(blacklistEntry),
      { expirationTtl: ttl }
    );
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    const entry = await this.kv.get(`blacklist:${jti}`);
    return entry !== null;
  }

  async blacklistRefreshToken(jti: string, expiresAt: number): Promise<void> {
    await this.addToBlacklist(jti, 'token_rotated', expiresAt);
  }

  async blacklistAllUserTokens(userId: number): Promise<void> {
    // Get all refresh tokens for user
    const userTokens = await this.kv.list({ prefix: `refresh_token:user:${userId}:` });
    
    for (const key of userTokens.keys) {
      const tokenData = await this.kv.get(key.name);
      if (tokenData) {
        const token = JSON.parse(tokenData);
        await this.addToBlacklist(token.jti, 'user_logout', token.expires_at);
      }
    }
  }
}
```

---

## 3. Workers KV for Session Storage

### KV Storage Architecture

```typescript
// src/services/auth/session.ts
export interface SessionData {
  user_id: number;
  username: string;
  email?: string;
  created_at: number;
  last_activity: number;
  expires_at: number;
  ip_address?: string;
  user_agent?: string;
  device_fingerprint?: string;
}

export interface RefreshTokenData {
  jti: string;
  user_id: number;
  username: string;
  created_at: number;
  expires_at: number;
  last_used?: number;
  ip_address?: string;
}

export class SessionManager {
  private kv: KVNamespace;
  private refreshTokenTTL: number = 86400; // 24 hours

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async storeRefreshToken(
    jti: string,
    tokenData: RefreshTokenData
  ): Promise<void> {
    const key = `refresh_token:${jti}`;
    const userKey = `refresh_token:user:${tokenData.user_id}:${jti}`;
    
    const ttl = Math.max(0, Math.floor((tokenData.expires_at - Date.now()) / 1000));
    
    // Store by JTI for quick lookup
    await this.kv.put(key, JSON.stringify(tokenData), { expirationTtl: ttl });
    
    // Store by user ID for user-specific operations
    await this.kv.put(userKey, JSON.stringify(tokenData), { expirationTtl: ttl });
  }

  async getRefreshToken(jti: string): Promise<RefreshTokenData | null> {
    const tokenData = await this.kv.get(`refresh_token:${jti}`);
    return tokenData ? JSON.parse(tokenData) : null;
  }

  async updateRefreshTokenActivity(jti: string): Promise<void> {
    const tokenData = await this.getRefreshToken(jti);
    if (tokenData) {
      tokenData.last_used = Date.now();
      await this.storeRefreshToken(jti, tokenData);
    }
  }

  async revokeRefreshToken(jti: string): Promise<void> {
    const tokenData = await this.getRefreshToken(jti);
    if (tokenData) {
      await this.kv.delete(`refresh_token:${jti}`);
      await this.kv.delete(`refresh_token:user:${tokenData.user_id}:${jti}`);
    }
  }

  async createSession(
    userId: number,
    username: string,
    email: string | undefined,
    request: Request
  ): Promise<SessionData> {
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + (this.refreshTokenTTL * 1000);

    const sessionData: SessionData = {
      user_id: userId,
      username,
      email,
      created_at: now,
      last_activity: now,
      expires_at: expiresAt,
      ip_address: request.headers.get('CF-Connecting-IP') || undefined,
      user_agent: request.headers.get('User-Agent') || undefined,
      device_fingerprint: this.generateDeviceFingerprint(request)
    };

    const ttl = Math.floor(this.refreshTokenTTL);
    await this.kv.put(
      `session:${sessionId}`,
      JSON.stringify(sessionData),
      { expirationTtl: ttl }
    );

    return sessionData;
  }

  private generateDeviceFingerprint(request: Request): string {
    const userAgent = request.headers.get('User-Agent') || '';
    const acceptLanguage = request.headers.get('Accept-Language') || '';
    const acceptEncoding = request.headers.get('Accept-Encoding') || '';
    
    const fingerprint = `${userAgent}:${acceptLanguage}:${acceptEncoding}`;
    return btoa(fingerprint).substring(0, 32);
  }

  async getUserSessions(userId: number): Promise<SessionData[]> {
    const sessions: SessionData[] = [];
    const sessionKeys = await this.kv.list({ prefix: `session:` });
    
    for (const key of sessionKeys.keys) {
      const sessionData = await this.kv.get(key.name);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.user_id === userId) {
          sessions.push(session);
        }
      }
    }
    
    return sessions;
  }

  async revokeAllUserSessions(userId: number): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    
    for (const session of sessions) {
      const sessionKey = `session:${session.user_id}`;
      await this.kv.delete(sessionKey);
    }
  }
}
```

---

## 4. Security Headers and CORS Configuration

### Comprehensive Security Headers

```typescript
// src/middleware/security.ts
export interface SecurityConfig {
  contentSecurityPolicy?: string;
  strictTransportSecurity?: boolean;
  xFrameOptions?: string;
  xContentTypeOptions?: boolean;
  referrerPolicy?: string;
  permissionsPolicy?: string;
  crossOriginEmbedderPolicy?: string;
  crossOriginOpenerPolicy?: string;
  crossOriginResourcePolicy?: string;
}

export class SecurityMiddleware {
  private config: SecurityConfig;

  constructor(config: SecurityConfig = {}) {
    this.config = {
      contentSecurityPolicy: 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "connect-src 'self' https://*.cloudflare.com; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'",
      strictTransportSecurity: true,
      xFrameOptions: 'DENY',
      xContentTypeOptions: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: 'camera=(), microphone=(), geolocation=(), payment=()',
      crossOriginEmbedderPolicy: 'require-corp',
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginResourcePolicy: 'same-origin',
      ...config
    };
  }

  apply(response: Response, request: Request): Response {
    const headers = new Headers(response.headers);
    const url = new URL(request.url);
    const isHTTPS = url.protocol === 'https:';

    // Content Security Policy
    if (this.config.contentSecurityPolicy) {
      headers.set('Content-Security-Policy', this.config.contentSecurityPolicy);
    }

    // HSTS (only over HTTPS)
    if (this.config.strictTransportSecurity && isHTTPS) {
      headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // X-Frame-Options
    if (this.config.xFrameOptions) {
      headers.set('X-Frame-Options', this.config.xFrameOptions);
    }

    // X-Content-Type-Options
    if (this.config.xContentTypeOptions) {
      headers.set('X-Content-Type-Options', 'nosniff');
    }

    // XSS Protection (legacy but still useful)
    headers.set('X-XSS-Protection', '1; mode=block');

    // Referrer Policy
    if (this.config.referrerPolicy) {
      headers.set('Referrer-Policy', this.config.referrerPolicy);
    }

    // Permissions Policy
    if (this.config.permissionsPolicy) {
      headers.set('Permissions-Policy', this.config.permissionsPolicy);
    }

    // Cross-Origin Policies
    if (this.config.crossOriginEmbedderPolicy) {
      headers.set('Cross-Origin-Embedder-Policy', this.config.crossOriginEmbedderPolicy);
    }

    if (this.config.crossOriginOpenerPolicy) {
      headers.set('Cross-Origin-Opener-Policy', this.config.crossOriginOpenerPolicy);
    }

    if (this.config.crossOriginResourcePolicy) {
      headers.set('Cross-Origin-Resource-Policy', this.config.crossOriginResourcePolicy);
    }

    // Server identification
    headers.set('Server', 'Cloudflare Workers');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
}
```

### Advanced CORS Configuration

```typescript
// src/middleware/cors.ts
export interface CORSConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  allowCredentials: boolean;
  maxAge: number;
  optionsSuccessStatus: number;
}

export class CORSMiddleware {
  private config: CORSConfig;

  constructor(config: Partial<CORSConfig> = {}) {
    this.config = {
      allowedOrigins: [
        'https://list-cutter.emilyflam.be',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080'
      ],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Cache-Control',
        'X-File-Name'
      ],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      allowCredentials: true,
      maxAge: 86400, // 24 hours
      optionsSuccessStatus: 204,
      ...config
    };
  }

  handlePreflight(request: Request): Response | null {
    if (request.method !== 'OPTIONS') {
      return null;
    }

    const origin = request.headers.get('Origin');
    const requestMethod = request.headers.get('Access-Control-Request-Method');
    const requestHeaders = request.headers.get('Access-Control-Request-Headers');

    // Check if origin is allowed
    if (!this.isOriginAllowed(origin)) {
      return new Response(null, { status: 403 });
    }

    // Check if method is allowed
    if (requestMethod && !this.config.allowedMethods.includes(requestMethod)) {
      return new Response(null, { status: 405 });
    }

    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', origin!);
    headers.set('Access-Control-Allow-Methods', this.config.allowedMethods.join(', '));
    headers.set('Access-Control-Allow-Headers', this.config.allowedHeaders.join(', '));
    headers.set('Access-Control-Max-Age', this.config.maxAge.toString());

    if (this.config.allowCredentials) {
      headers.set('Access-Control-Allow-Credentials', 'true');
    }

    if (this.config.exposedHeaders.length > 0) {
      headers.set('Access-Control-Expose-Headers', this.config.exposedHeaders.join(', '));
    }

    return new Response(null, {
      status: this.config.optionsSuccessStatus,
      headers
    });
  }

  addHeaders(response: Response, request: Request): Response {
    const origin = request.headers.get('Origin');
    
    if (!this.isOriginAllowed(origin)) {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', origin!);

    if (this.config.allowCredentials) {
      headers.set('Access-Control-Allow-Credentials', 'true');
    }

    if (this.config.exposedHeaders.length > 0) {
      headers.set('Access-Control-Expose-Headers', this.config.exposedHeaders.join(', '));
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  private isOriginAllowed(origin: string | null): boolean {
    if (!origin) return false;
    
    return this.config.allowedOrigins.includes(origin) ||
           this.config.allowedOrigins.includes('*');
  }
}
```

---

## 5. Rate Limiting and Abuse Prevention

### Multi-Layer Rate Limiting

```typescript
// src/middleware/rateLimit.ts
export interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (request: Request) => string;
  skipIf?: (request: Request) => boolean;
  onLimitReached?: (request: Request) => void;
}

export class RateLimitMiddleware {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async apply(request: Request, rules: RateLimitRule[]): Promise<Response | null> {
    for (const rule of rules) {
      if (rule.skipIf && rule.skipIf(request)) {
        continue;
      }

      const exceeded = await this.checkLimit(request, rule);
      if (exceeded) {
        if (rule.onLimitReached) {
          rule.onLimitReached(request);
        }
        
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retry_after: Math.ceil(rule.windowMs / 1000)
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(rule.windowMs / 1000).toString(),
            'X-RateLimit-Limit': rule.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + rule.windowMs).toISOString()
          }
        });
      }
    }

    return null;
  }

  private async checkLimit(request: Request, rule: RateLimitRule): Promise<boolean> {
    const key = rule.keyGenerator(request);
    const window = Math.floor(Date.now() / rule.windowMs);
    const rateLimitKey = `rate_limit:${key}:${window}`;

    const currentCountStr = await this.kv.get(rateLimitKey);
    const currentCount = currentCountStr ? parseInt(currentCountStr) : 0;

    if (currentCount >= rule.maxRequests) {
      return true;
    }

    // Increment counter
    await this.kv.put(
      rateLimitKey,
      (currentCount + 1).toString(),
      { expirationTtl: Math.ceil(rule.windowMs / 1000) }
    );

    return false;
  }
}

// Rate limiting configurations
export const RateLimitRules = {
  // IP-based rate limiting
  ipRateLimit: {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    keyGenerator: (request: Request) => {
      const ip = request.headers.get('CF-Connecting-IP') || 
                request.headers.get('X-Forwarded-For') || 
                'unknown';
      return `ip:${ip}`;
    }
  },

  // User-based rate limiting
  userRateLimit: {
    windowMs: 60000, // 1 minute
    maxRequests: 60,
    keyGenerator: (request: Request) => {
      // Extract user ID from JWT token
      const token = request.headers.get('Authorization')?.substring(7);
      if (token) {
        // This would need JWT verification - simplified for example
        return `user:${token}`;
      }
      return `anonymous:${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
    }
  },

  // Authentication endpoint rate limiting
  authRateLimit: {
    windowMs: 300000, // 5 minutes
    maxRequests: 10,
    keyGenerator: (request: Request) => {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      return `auth:${ip}`;
    }
  },

  // Registration rate limiting
  registrationRateLimit: {
    windowMs: 3600000, // 1 hour
    maxRequests: 3,
    keyGenerator: (request: Request) => {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      return `register:${ip}`;
    }
  }
};
```

### Advanced Abuse Detection

```typescript
// src/services/security/abuseDetection.ts
export interface AbusePattern {
  pattern: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'log' | 'warn' | 'block' | 'ban';
  windowMs: number;
  threshold: number;
}

export class AbuseDetectionService {
  private kv: KVNamespace;
  private patterns: AbusePattern[] = [
    {
      pattern: 'rapid_login_attempts',
      description: 'Multiple rapid login attempts',
      severity: 'high',
      action: 'block',
      windowMs: 300000, // 5 minutes
      threshold: 5
    },
    {
      pattern: 'password_spray',
      description: 'Password spray attack detected',
      severity: 'critical',
      action: 'ban',
      windowMs: 3600000, // 1 hour
      threshold: 10
    },
    {
      pattern: 'token_bruteforce',
      description: 'Token brute force attack',
      severity: 'critical',
      action: 'ban',
      windowMs: 1800000, // 30 minutes
      threshold: 20
    }
  ];

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async detectAbuse(request: Request, eventType: string): Promise<boolean> {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    for (const pattern of this.patterns) {
      const key = `abuse:${pattern.pattern}:${ip}`;
      const window = Math.floor(Date.now() / pattern.windowMs);
      const windowKey = `${key}:${window}`;

      const currentCount = await this.kv.get(windowKey);
      const count = currentCount ? parseInt(currentCount) : 0;

      if (count >= pattern.threshold) {
        await this.handleAbuse(request, pattern, count);
        return true;
      }

      // Increment counter
      await this.kv.put(
        windowKey,
        (count + 1).toString(),
        { expirationTtl: Math.ceil(pattern.windowMs / 1000) }
      );
    }

    return false;
  }

  private async handleAbuse(
    request: Request,
    pattern: AbusePattern,
    count: number
  ): Promise<void> {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    switch (pattern.action) {
      case 'log':
        console.log(`Abuse detected: ${pattern.description} - IP: ${ip}, Count: ${count}`);
        break;
      case 'warn':
        console.warn(`Abuse warning: ${pattern.description} - IP: ${ip}, Count: ${count}`);
        break;
      case 'block':
        await this.blockIP(ip, pattern.windowMs);
        break;
      case 'ban':
        await this.banIP(ip, pattern.windowMs * 24); // 24x the window for bans
        break;
    }
  }

  private async blockIP(ip: string, duration: number): Promise<void> {
    await this.kv.put(
      `blocked:${ip}`,
      JSON.stringify({
        blocked_at: Date.now(),
        duration,
        reason: 'abuse_detected'
      }),
      { expirationTtl: Math.ceil(duration / 1000) }
    );
  }

  private async banIP(ip: string, duration: number): Promise<void> {
    await this.kv.put(
      `banned:${ip}`,
      JSON.stringify({
        banned_at: Date.now(),
        duration,
        reason: 'severe_abuse'
      }),
      { expirationTtl: Math.ceil(duration / 1000) }
    );
  }

  async isBlocked(ip: string): Promise<boolean> {
    const blocked = await this.kv.get(`blocked:${ip}`);
    const banned = await this.kv.get(`banned:${ip}`);
    return blocked !== null || banned !== null;
  }
}
```

---

## 6. Password Security and Hashing

### Django-Compatible Password Hashing

```typescript
// src/services/auth/password.ts
export class PasswordService {
  private readonly defaultIterations = 600000; // Django 4.2+ default
  private readonly hashLength = 32;
  private readonly saltLength = 16;

  async hashPassword(password: string, iterations?: number): Promise<string> {
    const actualIterations = iterations || this.defaultIterations;
    const salt = crypto.getRandomValues(new Uint8Array(this.saltLength));
    const encoder = new TextEncoder();

    // Import the password as a key
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    // Derive the hash
    const derived = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: actualIterations,
        hash: 'SHA-256'
      },
      key,
      this.hashLength * 8
    );

    // Convert to base64 (Django format)
    const saltBase64 = btoa(String.fromCharCode(...salt));
    const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(derived)));

    return `pbkdf2_sha256$${actualIterations}$${saltBase64}$${hashBase64}`;
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      const parts = hash.split('$');
      if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') {
        return false;
      }

      const iterations = parseInt(parts[1]);
      const saltBase64 = parts[2];
      const expectedHashBase64 = parts[3];

      // Decode salt
      const saltStr = atob(saltBase64);
      const salt = new Uint8Array(saltStr.length);
      for (let i = 0; i < saltStr.length; i++) {
        salt[i] = saltStr.charCodeAt(i);
      }

      // Hash the provided password
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
        this.hashLength * 8
      );

      const actualHashBase64 = btoa(String.fromCharCode(...new Uint8Array(derived)));
      return actualHashBase64 === expectedHashBase64;
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
    score: number;
  } {
    const errors: string[] = [];
    let score = 0;

    // Length check
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    } else if (password.length >= 12) {
      score += 2;
    } else {
      score += 1;
    }

    // Character variety
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    // Common patterns
    if (password.toLowerCase().includes('password')) {
      errors.push('Password cannot contain the word "password"');
    }
    if (password.toLowerCase().includes('123456')) {
      errors.push('Password cannot contain common sequences');
    }

    // Dictionary check (simplified)
    const commonPasswords = ['password', 'password123', 'admin', 'root', 'user'];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common');
    }

    return {
      isValid: errors.length === 0 && score >= 4,
      errors,
      score
    };
  }

  async migrateFromDjango(djangoHash: string): Promise<boolean> {
    // Check if hash is already in Django format
    const parts = djangoHash.split('$');
    if (parts.length === 4 && parts[0] === 'pbkdf2_sha256') {
      return true; // Already in correct format
    }

    // Handle other Django hash formats if needed
    return false;
  }
}
```

### Password Reset System

```typescript
// src/services/auth/passwordReset.ts
export class PasswordResetService {
  private kv: KVNamespace;
  private db: D1Database;
  private tokenLifetime = 3600; // 1 hour

  constructor(kv: KVNamespace, db: D1Database) {
    this.kv = kv;
    this.db = db;
  }

  async initiatePasswordReset(email: string): Promise<boolean> {
    // Check if user exists
    const user = await this.db.prepare(`
      SELECT id, email, username FROM users WHERE email = ?
    `).bind(email).first();

    if (!user) {
      // Always return true to prevent email enumeration
      return true;
    }

    // Generate reset token
    const token = crypto.randomUUID();
    const resetData = {
      user_id: user.id,
      email: user.email,
      created_at: Date.now(),
      expires_at: Date.now() + (this.tokenLifetime * 1000)
    };

    // Store in KV
    await this.kv.put(
      `password_reset:${token}`,
      JSON.stringify(resetData),
      { expirationTtl: this.tokenLifetime }
    );

    // Send email (implementation depends on email service)
    await this.sendPasswordResetEmail(user.email as string, token);

    return true;
  }

  async validateResetToken(token: string): Promise<{
    valid: boolean;
    user_id?: number;
    email?: string;
  }> {
    const resetData = await this.kv.get(`password_reset:${token}`);
    if (!resetData) {
      return { valid: false };
    }

    const data = JSON.parse(resetData);
    if (data.expires_at < Date.now()) {
      await this.kv.delete(`password_reset:${token}`);
      return { valid: false };
    }

    return {
      valid: true,
      user_id: data.user_id,
      email: data.email
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const validation = await this.validateResetToken(token);
    if (!validation.valid) {
      return false;
    }

    const passwordService = new PasswordService();
    const hashedPassword = await passwordService.hashPassword(newPassword);

    // Update password in database
    await this.db.prepare(`
      UPDATE users SET password = ? WHERE id = ?
    `).bind(hashedPassword, validation.user_id).run();

    // Remove reset token
    await this.kv.delete(`password_reset:${token}`);

    return true;
  }

  private async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    // Implementation depends on email service (e.g., SendGrid, Mailgun)
    // This is a placeholder
    console.log(`Password reset email would be sent to ${email} with token ${token}`);
  }
}
```

---

## 7. Token Rotation and Refresh Mechanisms

### Advanced Token Rotation

```typescript
// src/services/auth/tokenRotation.ts
export class TokenRotationService {
  private jwtService: JWTService;
  private sessionManager: SessionManager;
  private blacklist: TokenBlacklist;

  constructor(
    jwtService: JWTService,
    sessionManager: SessionManager,
    blacklist: TokenBlacklist
  ) {
    this.jwtService = jwtService;
    this.sessionManager = sessionManager;
    this.blacklist = blacklist;
  }

  async rotateRefreshToken(
    oldRefreshToken: string,
    request: Request
  ): Promise<{
    success: boolean;
    tokens?: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    error?: string;
  }> {
    // Verify old refresh token
    const payload = await this.jwtService.verifyToken(oldRefreshToken);
    if (!payload || payload.token_type !== 'refresh') {
      return { success: false, error: 'Invalid refresh token' };
    }

    // Check if token is blacklisted
    if (await this.blacklist.isBlacklisted(payload.jti)) {
      return { success: false, error: 'Token has been revoked' };
    }

    // Check if token exists in KV
    const storedToken = await this.sessionManager.getRefreshToken(payload.jti);
    if (!storedToken) {
      return { success: false, error: 'Token not found' };
    }

    // Verify token hasn't been used recently (prevent replay attacks)
    const now = Date.now();
    if (storedToken.last_used && (now - storedToken.last_used) < 5000) {
      // Token used within last 5 seconds - possible replay attack
      await this.blacklist.blacklistRefreshToken(payload.jti, payload.exp * 1000);
      return { success: false, error: 'Token reuse detected' };
    }

    // Get user data
    const user = await this.getUserById(payload.user_id);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Generate new token pair
    const newTokens = await this.jwtService.generateTokenPair(user);

    // Blacklist old refresh token
    await this.blacklist.blacklistRefreshToken(payload.jti, payload.exp * 1000);

    // Store new refresh token
    const newRefreshPayload = await this.jwtService.verifyToken(newTokens.refresh_token);
    if (newRefreshPayload) {
      await this.sessionManager.storeRefreshToken(newRefreshPayload.jti, {
        jti: newRefreshPayload.jti,
        user_id: user.id,
        username: user.username,
        created_at: now,
        expires_at: newRefreshPayload.exp * 1000,
        ip_address: request.headers.get('CF-Connecting-IP') || undefined
      });
    }

    return {
      success: true,
      tokens: {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_in: newTokens.expires_in
      }
    };
  }

  async revokeAllUserTokens(userId: number): Promise<void> {
    await this.blacklist.blacklistAllUserTokens(userId);
    await this.sessionManager.revokeAllUserSessions(userId);
  }

  async revokeTokenFamily(refreshToken: string): Promise<void> {
    const payload = await this.jwtService.verifyToken(refreshToken);
    if (!payload) return;

    // In a production system, you'd track token families
    // For now, just blacklist the specific token
    await this.blacklist.blacklistRefreshToken(payload.jti, payload.exp * 1000);
  }

  private async getUserById(id: number): Promise<{
    id: number;
    username: string;
    email?: string;
  } | null> {
    // This would query your user database
    // Implementation depends on your database setup
    return null;
  }
}
```

### Token Cleanup Service

```typescript
// src/services/auth/tokenCleanup.ts
export class TokenCleanupService {
  private kv: KVNamespace;
  private db: D1Database;

  constructor(kv: KVNamespace, db: D1Database) {
    this.kv = kv;
    this.db = db;
  }

  async cleanupExpiredTokens(): Promise<{
    refreshTokensRemoved: number;
    blacklistedTokensRemoved: number;
    sessionsRemoved: number;
  }> {
    const now = Date.now();
    let refreshTokensRemoved = 0;
    let blacklistedTokensRemoved = 0;
    let sessionsRemoved = 0;

    // Cleanup expired refresh tokens
    const refreshTokens = await this.kv.list({ prefix: 'refresh_token:' });
    for (const key of refreshTokens.keys) {
      const tokenData = await this.kv.get(key.name);
      if (tokenData) {
        const token = JSON.parse(tokenData);
        if (token.expires_at < now) {
          await this.kv.delete(key.name);
          refreshTokensRemoved++;
        }
      }
    }

    // Cleanup expired blacklisted tokens
    const blacklistedTokens = await this.kv.list({ prefix: 'blacklist:' });
    for (const key of blacklistedTokens.keys) {
      const tokenData = await this.kv.get(key.name);
      if (tokenData) {
        const token = JSON.parse(tokenData);
        if (token.expires_at < now) {
          await this.kv.delete(key.name);
          blacklistedTokensRemoved++;
        }
      }
    }

    // Cleanup expired sessions
    const sessions = await this.kv.list({ prefix: 'session:' });
    for (const key of sessions.keys) {
      const sessionData = await this.kv.get(key.name);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.expires_at < now) {
          await this.kv.delete(key.name);
          sessionsRemoved++;
        }
      }
    }

    return {
      refreshTokensRemoved,
      blacklistedTokensRemoved,
      sessionsRemoved
    };
  }

  async scheduleCleanup(): Promise<void> {
    // This would be called by a cron trigger
    const result = await this.cleanupExpiredTokens();
    console.log('Token cleanup completed:', result);
  }
}
```

---

## 8. Security Auditing and Monitoring

### Security Event Logging

```typescript
// src/services/security/audit.ts
export interface SecurityEvent {
  timestamp: number;
  event_type: string;
  user_id?: number;
  ip_address?: string;
  user_agent?: string;
  details: Record<string, any>;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  country?: string;
  city?: string;
}

export class SecurityAuditService {
  private kv: KVNamespace;
  private logRetentionDays = 90;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const eventId = crypto.randomUUID();
    const eventKey = `security_event:${event.timestamp}:${eventId}`;

    // Store event with TTL
    await this.kv.put(
      eventKey,
      JSON.stringify(event),
      { expirationTtl: this.logRetentionDays * 24 * 60 * 60 }
    );

    // Store in risk-level index for quick filtering
    const riskKey = `risk_${event.risk_level}:${event.timestamp}:${eventId}`;
    await this.kv.put(
      riskKey,
      eventKey,
      { expirationTtl: this.logRetentionDays * 24 * 60 * 60 }
    );

    // Log to console for immediate monitoring
    console.log(`Security Event [${event.risk_level.toUpperCase()}]:`, {
      type: event.event_type,
      user_id: event.user_id,
      ip: event.ip_address,
      details: event.details
    });

    // Alert on high-risk events
    if (event.risk_level === 'high' || event.risk_level === 'critical') {
      await this.sendSecurityAlert(event);
    }
  }

  async getSecurityEvents(
    startTime: number,
    endTime: number,
    riskLevel?: string
  ): Promise<SecurityEvent[]> {
    const events: SecurityEvent[] = [];
    const prefix = riskLevel ? `risk_${riskLevel}:` : 'security_event:';
    
    const eventKeys = await this.kv.list({ prefix });
    
    for (const key of eventKeys.keys) {
      const eventData = await this.kv.get(key.name);
      if (eventData) {
        const event = JSON.parse(eventData);
        if (event.timestamp >= startTime && event.timestamp <= endTime) {
          events.push(event);
        }
      }
    }

    return events.sort((a, b) => b.timestamp - a.timestamp);
  }

  async logLoginAttempt(
    request: Request,
    success: boolean,
    userId?: number,
    username?: string
  ): Promise<void> {
    const event: SecurityEvent = {
      timestamp: Date.now(),
      event_type: success ? 'login_success' : 'login_failure',
      user_id: userId,
      ip_address: request.headers.get('CF-Connecting-IP') || undefined,
      user_agent: request.headers.get('User-Agent') || undefined,
      details: {
        username,
        success
      },
      risk_level: success ? 'low' : 'medium',
      country: request.cf?.country as string,
      city: request.cf?.city as string
    };

    await this.logSecurityEvent(event);
  }

  async logTokenRefresh(
    request: Request,
    userId: number,
    success: boolean
  ): Promise<void> {
    const event: SecurityEvent = {
      timestamp: Date.now(),
      event_type: 'token_refresh',
      user_id: userId,
      ip_address: request.headers.get('CF-Connecting-IP') || undefined,
      user_agent: request.headers.get('User-Agent') || undefined,
      details: {
        success
      },
      risk_level: success ? 'low' : 'medium',
      country: request.cf?.country as string,
      city: request.cf?.city as string
    };

    await this.logSecurityEvent(event);
  }

  async logSuspiciousActivity(
    request: Request,
    activityType: string,
    details: Record<string, any>
  ): Promise<void> {
    const event: SecurityEvent = {
      timestamp: Date.now(),
      event_type: 'suspicious_activity',
      ip_address: request.headers.get('CF-Connecting-IP') || undefined,
      user_agent: request.headers.get('User-Agent') || undefined,
      details: {
        activity_type: activityType,
        ...details
      },
      risk_level: 'high',
      country: request.cf?.country as string,
      city: request.cf?.city as string
    };

    await this.logSecurityEvent(event);
  }

  private async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    // Implementation depends on alerting system
    // Could send to webhook, email, Slack, etc.
    console.warn('SECURITY ALERT:', event);
  }
}
```

### Monitoring Dashboard Data

```typescript
// src/services/security/monitoring.ts
export interface SecurityMetrics {
  totalLoginAttempts: number;
  successfulLogins: number;
  failedLogins: number;
  tokenRefreshes: number;
  blockedRequests: number;
  suspiciousActivity: number;
  uniqueIPs: number;
  topCountries: Array<{ country: string; count: number }>;
  riskLevelDistribution: Record<string, number>;
}

export class SecurityMonitoringService {
  private auditService: SecurityAuditService;

  constructor(auditService: SecurityAuditService) {
    this.auditService = auditService;
  }

  async getSecurityMetrics(
    startTime: number,
    endTime: number
  ): Promise<SecurityMetrics> {
    const events = await this.auditService.getSecurityEvents(startTime, endTime);

    const metrics: SecurityMetrics = {
      totalLoginAttempts: 0,
      successfulLogins: 0,
      failedLogins: 0,
      tokenRefreshes: 0,
      blockedRequests: 0,
      suspiciousActivity: 0,
      uniqueIPs: 0,
      topCountries: [],
      riskLevelDistribution: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      }
    };

    const ipSet = new Set<string>();
    const countryCount = new Map<string, number>();

    for (const event of events) {
      // Track IPs
      if (event.ip_address) {
        ipSet.add(event.ip_address);
      }

      // Track countries
      if (event.country) {
        countryCount.set(event.country, (countryCount.get(event.country) || 0) + 1);
      }

      // Track risk levels
      metrics.riskLevelDistribution[event.risk_level]++;

      // Track event types
      switch (event.event_type) {
        case 'login_success':
          metrics.successfulLogins++;
          metrics.totalLoginAttempts++;
          break;
        case 'login_failure':
          metrics.failedLogins++;
          metrics.totalLoginAttempts++;
          break;
        case 'token_refresh':
          metrics.tokenRefreshes++;
          break;
        case 'suspicious_activity':
          metrics.suspiciousActivity++;
          break;
        case 'rate_limit_exceeded':
          metrics.blockedRequests++;
          break;
      }
    }

    metrics.uniqueIPs = ipSet.size;
    metrics.topCountries = Array.from(countryCount.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return metrics;
  }

  async generateSecurityReport(days: number = 7): Promise<string> {
    const endTime = Date.now();
    const startTime = endTime - (days * 24 * 60 * 60 * 1000);
    
    const metrics = await this.getSecurityMetrics(startTime, endTime);
    
    return `
Security Report (${days} days)
==============================

Login Activity:
- Total login attempts: ${metrics.totalLoginAttempts}
- Successful logins: ${metrics.successfulLogins}
- Failed logins: ${metrics.failedLogins}
- Success rate: ${metrics.totalLoginAttempts > 0 ? 
  ((metrics.successfulLogins / metrics.totalLoginAttempts) * 100).toFixed(1) : 0}%

Token Activity:
- Token refreshes: ${metrics.tokenRefreshes}

Security Events:
- Blocked requests: ${metrics.blockedRequests}
- Suspicious activity: ${metrics.suspiciousActivity}
- Unique IPs: ${metrics.uniqueIPs}

Risk Level Distribution:
- Low: ${metrics.riskLevelDistribution.low}
- Medium: ${metrics.riskLevelDistribution.medium}
- High: ${metrics.riskLevelDistribution.high}
- Critical: ${metrics.riskLevelDistribution.critical}

Top Countries:
${metrics.topCountries.map(c => `- ${c.country}: ${c.count}`).join('\n')}
    `.trim();
  }
}
```

---

## 9. OWASP Security Best Practices

### OWASP Top 10 Implementation

```typescript
// src/security/owasp.ts
export class OWASPSecurityService {
  private kv: KVNamespace;
  private db: D1Database;

  constructor(kv: KVNamespace, db: D1Database) {
    this.kv = kv;
    this.db = db;
  }

  // A01: Broken Access Control
  async validateAccess(
    userId: number,
    resource: string,
    action: string
  ): Promise<boolean> {
    // Implement role-based access control
    const userRole = await this.getUserRole(userId);
    const permissions = await this.getRolePermissions(userRole);
    
    return permissions.some(p => 
      p.resource === resource && 
      p.action === action
    );
  }

  // A02: Cryptographic Failures
  async encryptSensitiveData(data: string): Promise<string> {
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(data);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );
    
    // Store key securely (implementation depends on key management)
    return btoa(JSON.stringify({
      data: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv)
    }));
  }

  // A03: Injection Prevention
  sanitizeInput(input: string): string {
    // Remove potentially dangerous characters
    return input
      .replace(/[<>\"']/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }

  validateSQLInput(input: string): boolean {
    // Check for SQL injection patterns
    const sqlPatterns = [
      /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b)/i,
      /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/i,
      /['"]\s*;\s*--/,
      /\bxp_\w+/i
    ];
    
    return !sqlPatterns.some(pattern => pattern.test(input));
  }

  // A04: Insecure Design Prevention
  async implementSecurityControls(request: Request): Promise<{
    passed: boolean;
    failures: string[];
  }> {
    const failures: string[] = [];
    
    // Check for secure headers
    if (!request.headers.get('User-Agent')) {
      failures.push('Missing User-Agent header');
    }
    
    // Check for suspicious patterns
    const url = new URL(request.url);
    if (url.pathname.includes('..')) {
      failures.push('Path traversal attempt detected');
    }
    
    // Check content type for POST requests
    if (request.method === 'POST') {
      const contentType = request.headers.get('Content-Type');
      if (!contentType || !contentType.includes('application/json')) {
        failures.push('Invalid content type for POST request');
      }
    }
    
    return {
      passed: failures.length === 0,
      failures
    };
  }

  // A05: Security Misconfiguration Prevention
  async validateSecurityConfiguration(): Promise<{
    secure: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    // Check environment variables
    const requiredEnvVars = ['JWT_SECRET', 'DB_URL'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        issues.push(`Missing required environment variable: ${envVar}`);
      }
    }
    
    // Check JWT secret strength
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && jwtSecret.length < 32) {
      issues.push('JWT secret is too short');
    }
    
    return {
      secure: issues.length === 0,
      issues
    };
  }

  // A06: Vulnerable Components
  async checkDependencyVulnerabilities(): Promise<{
    safe: boolean;
    vulnerabilities: string[];
  }> {
    // In a real implementation, this would check against vulnerability databases
    const vulnerabilities: string[] = [];
    
    // Example checks
    const packageVersion = '1.0.0'; // This would be read from package.json
    if (packageVersion < '1.1.0') {
      vulnerabilities.push('Outdated package version detected');
    }
    
    return {
      safe: vulnerabilities.length === 0,
      vulnerabilities
    };
  }

  // A07: Identification and Authentication Failures
  async validateAuthenticationAttempt(
    username: string,
    password: string,
    request: Request
  ): Promise<{
    valid: boolean;
    lockoutUser: boolean;
    reason?: string;
  }> {
    const ip = request.headers.get('CF-Connecting-IP');
    
    // Check for account lockout
    const lockoutKey = `lockout:${username}`;
    const lockoutData = await this.kv.get(lockoutKey);
    if (lockoutData) {
      const lockout = JSON.parse(lockoutData);
      if (lockout.until > Date.now()) {
        return {
          valid: false,
          lockoutUser: false,
          reason: 'Account temporarily locked'
        };
      }
    }
    
    // Check for IP-based rate limiting
    const ipKey = `auth_attempts:${ip}`;
    const ipAttempts = await this.kv.get(ipKey);
    if (ipAttempts && parseInt(ipAttempts) > 10) {
      return {
        valid: false,
        lockoutUser: false,
        reason: 'Too many attempts from this IP'
      };
    }
    
    // Validate credentials
    const user = await this.db.prepare(`
      SELECT id, username, password, failed_attempts 
      FROM users 
      WHERE username = ?
    `).bind(username).first();
    
    if (!user) {
      return {
        valid: false,
        lockoutUser: false,
        reason: 'Invalid credentials'
      };
    }
    
    const passwordService = new PasswordService();
    const isValidPassword = await passwordService.verifyPassword(
      password,
      user.password as string
    );
    
    if (!isValidPassword) {
      // Increment failed attempts
      const failedAttempts = (user.failed_attempts as number) + 1;
      await this.db.prepare(`
        UPDATE users SET failed_attempts = ? WHERE id = ?
      `).bind(failedAttempts, user.id).run();
      
      // Lock account after 5 failed attempts
      if (failedAttempts >= 5) {
        await this.kv.put(
          lockoutKey,
          JSON.stringify({
            until: Date.now() + (30 * 60 * 1000), // 30 minutes
            attempts: failedAttempts
          }),
          { expirationTtl: 30 * 60 }
        );
        
        return {
          valid: false,
          lockoutUser: true,
          reason: 'Account locked due to too many failed attempts'
        };
      }
      
      return {
        valid: false,
        lockoutUser: false,
        reason: 'Invalid credentials'
      };
    }
    
    // Reset failed attempts on successful login
    await this.db.prepare(`
      UPDATE users SET failed_attempts = 0 WHERE id = ?
    `).bind(user.id).run();
    
    return { valid: true, lockoutUser: false };
  }

  // A08: Software and Data Integrity Failures
  async validateDataIntegrity(data: any): Promise<boolean> {
    // Implement data validation and integrity checks
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    
    // Check for required fields
    const requiredFields = ['username', 'email'];
    for (const field of requiredFields) {
      if (!data[field]) {
        return false;
      }
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return false;
    }
    
    return true;
  }

  // A09: Security Logging and Monitoring Failures
  async logSecurityEvent(
    eventType: string,
    details: Record<string, any>,
    request: Request
  ): Promise<void> {
    const event = {
      timestamp: Date.now(),
      event_type: eventType,
      ip_address: request.headers.get('CF-Connecting-IP'),
      user_agent: request.headers.get('User-Agent'),
      details,
      request_id: crypto.randomUUID()
    };
    
    // Store in KV for analysis
    await this.kv.put(
      `security_log:${event.timestamp}:${event.request_id}`,
      JSON.stringify(event),
      { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
    );
    
    // Log to console for immediate monitoring
    console.log('Security Event:', event);
  }

  // A10: Server-Side Request Forgery (SSRF) Prevention
  async validateURL(url: string): Promise<boolean> {
    try {
      const parsedURL = new URL(url);
      
      // Block private IP ranges
      const hostname = parsedURL.hostname;
      const privateRanges = [
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[01])\./,
        /^192\.168\./,
        /^127\./,
        /^169\.254\./,
        /^::1$/,
        /^::ffff:127\./,
        /^fc00::/,
        /^fe80::/
      ];
      
      if (privateRanges.some(range => range.test(hostname))) {
        return false;
      }
      
      // Only allow HTTP/HTTPS
      if (!['http:', 'https:'].includes(parsedURL.protocol)) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  private async getUserRole(userId: number): Promise<string> {
    const user = await this.db.prepare(`
      SELECT role FROM users WHERE id = ?
    `).bind(userId).first();
    
    return user?.role as string || 'user';
  }

  private async getRolePermissions(role: string): Promise<Array<{
    resource: string;
    action: string;
  }>> {
    // In a real implementation, this would query a permissions table
    const permissions = {
      admin: [
        { resource: '*', action: '*' }
      ],
      user: [
        { resource: 'profile', action: 'read' },
        { resource: 'profile', action: 'update' },
        { resource: 'files', action: 'read' },
        { resource: 'files', action: 'create' }
      ]
    };
    
    return permissions[role as keyof typeof permissions] || [];
  }
}
```

---

## 10. Migration from Django Sessions to JWT

### Migration Strategy

```typescript
// src/services/migration/sessionMigration.ts
export class SessionMigrationService {
  private kv: KVNamespace;
  private db: D1Database;
  private jwtService: JWTService;

  constructor(kv: KVNamespace, db: D1Database, jwtService: JWTService) {
    this.kv = kv;
    this.db = db;
    this.jwtService = jwtService;
  }

  async migrateDjangoUser(djangoUserData: {
    id: number;
    username: string;
    email: string;
    password: string;
    is_active: boolean;
    date_joined: string;
    last_login?: string;
  }): Promise<boolean> {
    try {
      // Insert user into D1 database
      await this.db.prepare(`
        INSERT INTO users (id, username, email, password, is_active, created_at, last_login)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        djangoUserData.id,
        djangoUserData.username,
        djangoUserData.email,
        djangoUserData.password, // Django password hash format
        djangoUserData.is_active ? 1 : 0,
        djangoUserData.date_joined,
        djangoUserData.last_login
      ).run();

      return true;
    } catch (error) {
      console.error('Failed to migrate user:', error);
      return false;
    }
  }

  async createCompatibilityLayer(
    djangoSessionKey: string,
    userId: number
  ): Promise<string | null> {
    try {
      // Get user data
      const user = await this.db.prepare(`
        SELECT id, username, email FROM users WHERE id = ?
      `).bind(userId).first();

      if (!user) {
        return null;
      }

      // Generate JWT token pair
      const tokens = await this.jwtService.generateTokenPair({
        id: user.id as number,
        username: user.username as string,
        email: user.email as string
      });

      // Store mapping between Django session and JWT refresh token
      await this.kv.put(
        `django_session:${djangoSessionKey}`,
        JSON.stringify({
          user_id: user.id,
          refresh_token: tokens.refresh_token,
          created_at: Date.now()
        }),
        { expirationTtl: 86400 } // 24 hours
      );

      return tokens.access_token;
    } catch (error) {
      console.error('Failed to create compatibility layer:', error);
      return null;
    }
  }

  async handleDualAuth(request: Request): Promise<{
    user: any;
    authType: 'jwt' | 'django' | null;
  }> {
    // Try JWT first
    const jwtToken = this.jwtService.extractTokenFromRequest(request);
    if (jwtToken) {
      const payload = await this.jwtService.verifyToken(jwtToken);
      if (payload) {
        const user = await this.db.prepare(`
          SELECT id, username, email FROM users WHERE id = ?
        `).bind(payload.user_id).first();
        
        if (user) {
          return { user, authType: 'jwt' };
        }
      }
    }

    // Try Django session
    const sessionKey = request.headers.get('X-Django-Session');
    if (sessionKey) {
      const sessionData = await this.kv.get(`django_session:${sessionKey}`);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        const user = await this.db.prepare(`
          SELECT id, username, email FROM users WHERE id = ?
        `).bind(session.user_id).first();
        
        if (user) {
          return { user, authType: 'django' };
        }
      }
    }

    return { user: null, authType: null };
  }

  async migrateToJWTOnly(): Promise<{
    migrated: number;
    failed: number;
    errors: string[];
  }> {
    const result = {
      migrated: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Get all Django sessions
    const sessions = await this.kv.list({ prefix: 'django_session:' });
    
    for (const sessionKey of sessions.keys) {
      try {
        const sessionData = await this.kv.get(sessionKey.name);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          
          // Delete Django session
          await this.kv.delete(sessionKey.name);
          
          // Session data already includes refresh token
          // No additional migration needed
          result.migrated++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Failed to migrate session ${sessionKey.name}: ${error}`);
      }
    }

    return result;
  }
}
```

### Database Schema Migration

```sql
-- Migration script for user data
-- This would be run as part of the migration process

-- Create users table (if not exists)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    last_login TEXT,
    failed_attempts INTEGER DEFAULT 0,
    role TEXT DEFAULT 'user',
    email_verified INTEGER DEFAULT 0,
    two_factor_enabled INTEGER DEFAULT 0
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Create user sessions table (for session management)
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    last_activity TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Create security events table
CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    event_type TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    details TEXT, -- JSON
    risk_level TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    key_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    permissions TEXT NOT NULL, -- JSON array
    created_at INTEGER NOT NULL,
    last_used INTEGER,
    expires_at INTEGER,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Create rate limit entries table
CREATE TABLE IF NOT EXISTS rate_limit_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT NOT NULL,
    count INTEGER NOT NULL,
    window_start INTEGER NOT NULL,
    window_end INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_rate_limit_entries_key_hash ON rate_limit_entries(key_hash);
CREATE INDEX IF NOT EXISTS idx_rate_limit_entries_window_end ON rate_limit_entries(window_end);
```

---

## 11. Complete Implementation Code

### Main Worker Entry Point

```typescript
// src/index.ts
import { CORSMiddleware } from './middleware/cors';
import { SecurityMiddleware } from './middleware/security';
import { RateLimitMiddleware, RateLimitRules } from './middleware/rateLimit';
import { JWTService } from './services/auth/jwt';
import { SessionManager } from './services/auth/session';
import { TokenBlacklist } from './services/auth/blacklist';
import { PasswordService } from './services/auth/password';
import { SecurityAuditService } from './services/security/audit';
import { OWASPSecurityService } from './security/owasp';
import { AuthenticationRoutes } from './routes/auth';

export interface Env {
  // KV Namespaces
  AUTH_KV: KVNamespace;
  SECURITY_KV: KVNamespace;
  
  // D1 Database
  DB: D1Database;
  
  // Environment variables
  JWT_SECRET: string;
  ENVIRONMENT: string;
  
  // Rate limiting
  RATE_LIMIT_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Initialize services
      const jwtService = new JWTService(env.JWT_SECRET);
      const sessionManager = new SessionManager(env.AUTH_KV);
      const blacklist = new TokenBlacklist(env.AUTH_KV);
      const passwordService = new PasswordService();
      const auditService = new SecurityAuditService(env.SECURITY_KV);
      const owaspService = new OWASPSecurityService(env.AUTH_KV, env.DB);
      
      // Initialize middleware
      const corsMiddleware = new CORSMiddleware();
      const securityMiddleware = new SecurityMiddleware();
      const rateLimitMiddleware = new RateLimitMiddleware(env.RATE_LIMIT_KV);
      
      // Initialize routes
      const authRoutes = new AuthenticationRoutes(
        jwtService,
        sessionManager,
        blacklist,
        passwordService,
        auditService,
        env.DB
      );

      // Handle CORS preflight
      const corsResponse = corsMiddleware.handlePreflight(request);
      if (corsResponse) {
        return corsResponse;
      }

      // OWASP security checks
      const securityCheck = await owaspService.implementSecurityControls(request);
      if (!securityCheck.passed) {
        await auditService.logSecurityEvent({
          timestamp: Date.now(),
          event_type: 'security_check_failed',
          ip_address: request.headers.get('CF-Connecting-IP') || undefined,
          user_agent: request.headers.get('User-Agent') || undefined,
          details: { failures: securityCheck.failures },
          risk_level: 'medium'
        });
        
        return new Response(JSON.stringify({
          error: 'Security check failed',
          details: securityCheck.failures
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Rate limiting
      const url = new URL(request.url);
      const rateLimitRules = [];
      
      // Apply different rate limits based on endpoint
      if (url.pathname.startsWith('/api/accounts/')) {
        rateLimitRules.push(RateLimitRules.authRateLimit);
      }
      
      if (url.pathname === '/api/accounts/register') {
        rateLimitRules.push(RateLimitRules.registrationRateLimit);
      }
      
      rateLimitRules.push(RateLimitRules.ipRateLimit);
      
      const rateLimitResponse = await rateLimitMiddleware.apply(request, rateLimitRules);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      // Route handling
      let response: Response;
      
      if (url.pathname.startsWith('/api/accounts/')) {
        response = await authRoutes.handleRequest(request);
      } else if (url.pathname === '/api/health') {
        response = new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        response = new Response(JSON.stringify({
          error: 'Not Found',
          message: 'The requested endpoint does not exist'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Apply middleware to response
      response = securityMiddleware.apply(response, request);
      response = corsMiddleware.addHeaders(response, request);

      return response;
    } catch (error) {
      console.error('Worker error:', error);
      
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Scheduled event handler for cleanup tasks
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const tokenCleanupService = new TokenCleanupService(env.AUTH_KV, env.DB);
    
    switch (event.cron) {
      case '0 0 * * *': // Daily at midnight
        await tokenCleanupService.cleanupExpiredTokens();
        break;
      case '0 */6 * * *': // Every 6 hours
        // Perform security audits
        const auditService = new SecurityAuditService(env.SECURITY_KV);
        const metrics = await auditService.getSecurityMetrics(
          Date.now() - 6 * 60 * 60 * 1000, // 6 hours ago
          Date.now()
        );
        console.log('Security metrics:', metrics);
        break;
    }
  }
};
```

### Authentication Routes

```typescript
// src/routes/auth.ts
import { JWTService } from '../services/auth/jwt';
import { SessionManager } from '../services/auth/session';
import { TokenBlacklist } from '../services/auth/blacklist';
import { PasswordService } from '../services/auth/password';
import { SecurityAuditService } from '../services/security/audit';

export class AuthenticationRoutes {
  private jwtService: JWTService;
  private sessionManager: SessionManager;
  private blacklist: TokenBlacklist;
  private passwordService: PasswordService;
  private auditService: SecurityAuditService;
  private db: D1Database;

  constructor(
    jwtService: JWTService,
    sessionManager: SessionManager,
    blacklist: TokenBlacklist,
    passwordService: PasswordService,
    auditService: SecurityAuditService,
    db: D1Database
  ) {
    this.jwtService = jwtService;
    this.sessionManager = sessionManager;
    this.blacklist = blacklist;
    this.passwordService = passwordService;
    this.auditService = auditService;
    this.db = db;
  }

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    switch (true) {
      case url.pathname === '/api/accounts/register' && method === 'POST':
        return this.handleRegister(request);
      case url.pathname === '/api/accounts/login' && method === 'POST':
        return this.handleLogin(request);
      case url.pathname === '/api/accounts/token/refresh' && method === 'POST':
        return this.handleTokenRefresh(request);
      case url.pathname === '/api/accounts/user' && method === 'GET':
        return this.handleUserInfo(request);
      case url.pathname === '/api/accounts/logout' && method === 'POST':
        return this.handleLogout(request);
      case url.pathname === '/api/accounts/password/reset' && method === 'POST':
        return this.handlePasswordReset(request);
      case url.pathname === '/api/accounts/password/reset/confirm' && method === 'POST':
        return this.handlePasswordResetConfirm(request);
      default:
        return new Response(JSON.stringify({ error: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  }

  private async handleRegister(request: Request): Promise<Response> {
    try {
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

      // Validate password strength
      const passwordValidation = this.passwordService.validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return new Response(JSON.stringify({
          error: 'Password does not meet security requirements',
          details: passwordValidation.errors
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if user exists
      const existingUser = await this.db.prepare(`
        SELECT id FROM users WHERE username = ? OR email = ?
      `).bind(username, email).first();

      if (existingUser) {
        await this.auditService.logSecurityEvent({
          timestamp: Date.now(),
          event_type: 'registration_attempt_existing_user',
          ip_address: request.headers.get('CF-Connecting-IP') || undefined,
          user_agent: request.headers.get('User-Agent') || undefined,
          details: { username, email },
          risk_level: 'low'
        });

        return new Response(JSON.stringify({
          error: 'User with this username or email already exists'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Hash password
      const passwordHash = await this.passwordService.hashPassword(password);

      // Create user
      const result = await this.db.prepare(`
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
      const tokens = await this.jwtService.generateTokenPair({
        id: result.id as number,
        username: result.username as string,
        email: result.email as string
      });

      // Create session
      await this.sessionManager.createSession(
        result.id as number,
        result.username as string,
        result.email as string,
        request
      );

      // Log successful registration
      await this.auditService.logSecurityEvent({
        timestamp: Date.now(),
        event_type: 'user_registered',
        user_id: result.id as number,
        ip_address: request.headers.get('CF-Connecting-IP') || undefined,
        user_agent: request.headers.get('User-Agent') || undefined,
        details: { username: result.username, email: result.email },
        risk_level: 'low'
      });

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
    } catch (error) {
      console.error('Registration error:', error);
      return new Response(JSON.stringify({
        error: 'Registration failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleLogin(request: Request): Promise<Response> {
    try {
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
      const user = await this.db.prepare(`
        SELECT id, username, email, password, is_active FROM users 
        WHERE username = ? OR email = ?
      `).bind(username, username).first();

      if (!user || !user.is_active) {
        await this.auditService.logSecurityEvent({
          timestamp: Date.now(),
          event_type: 'login_attempt_invalid_user',
          ip_address: request.headers.get('CF-Connecting-IP') || undefined,
          user_agent: request.headers.get('User-Agent') || undefined,
          details: { username },
          risk_level: 'medium'
        });

        return new Response(JSON.stringify({
          error: 'Invalid credentials'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify password
      const isValidPassword = await this.passwordService.verifyPassword(
        password,
        user.password as string
      );

      if (!isValidPassword) {
        await this.auditService.logSecurityEvent({
          timestamp: Date.now(),
          event_type: 'login_attempt_invalid_password',
          user_id: user.id as number,
          ip_address: request.headers.get('CF-Connecting-IP') || undefined,
          user_agent: request.headers.get('User-Agent') || undefined,
          details: { username },
          risk_level: 'medium'
        });

        return new Response(JSON.stringify({
          error: 'Invalid credentials'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Generate tokens
      const tokens = await this.jwtService.generateTokenPair({
        id: user.id as number,
        username: user.username as string,
        email: user.email as string
      });

      // Create session
      await this.sessionManager.createSession(
        user.id as number,
        user.username as string,
        user.email as string,
        request
      );

      // Update last login
      await this.db.prepare(`
        UPDATE users SET last_login = ? WHERE id = ?
      `).bind(new Date().toISOString(), user.id).run();

      // Log successful login
      await this.auditService.logSecurityEvent({
        timestamp: Date.now(),
        event_type: 'login_success',
        user_id: user.id as number,
        ip_address: request.headers.get('CF-Connecting-IP') || undefined,
        user_agent: request.headers.get('User-Agent') || undefined,
        details: { username: user.username },
        risk_level: 'low'
      });

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
    } catch (error) {
      console.error('Login error:', error);
      return new Response(JSON.stringify({
        error: 'Login failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleTokenRefresh(request: Request): Promise<Response> {
    try {
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
      const payload = await this.jwtService.verifyToken(refresh_token);
      if (!payload || payload.token_type !== 'refresh') {
        await this.auditService.logSecurityEvent({
          timestamp: Date.now(),
          event_type: 'token_refresh_invalid',
          ip_address: request.headers.get('CF-Connecting-IP') || undefined,
          user_agent: request.headers.get('User-Agent') || undefined,
          details: { reason: 'invalid_token' },
          risk_level: 'medium'
        });

        return new Response(JSON.stringify({
          error: 'Invalid refresh token'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if token exists in KV and is not blacklisted
      const storedToken = await this.sessionManager.getRefreshToken(payload.jti);
      const isBlacklisted = await this.blacklist.isBlacklisted(payload.jti);

      if (!storedToken || isBlacklisted) {
        await this.auditService.logSecurityEvent({
          timestamp: Date.now(),
          event_type: 'token_refresh_revoked',
          user_id: payload.user_id,
          ip_address: request.headers.get('CF-Connecting-IP') || undefined,
          user_agent: request.headers.get('User-Agent') || undefined,
          details: { jti: payload.jti },
          risk_level: 'high'
        });

        return new Response(JSON.stringify({
          error: 'Refresh token is invalid or has been revoked'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get user from database
      const user = await this.db.prepare(`
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
      await this.blacklist.blacklistRefreshToken(payload.jti, payload.exp * 1000);

      // Generate new tokens
      const tokens = await this.jwtService.generateTokenPair({
        id: user.id as number,
        username: user.username as string,
        email: user.email as string
      });

      // Update refresh token activity
      await this.sessionManager.updateRefreshTokenActivity(payload.jti);

      // Log successful token refresh
      await this.auditService.logSecurityEvent({
        timestamp: Date.now(),
        event_type: 'token_refresh_success',
        user_id: user.id as number,
        ip_address: request.headers.get('CF-Connecting-IP') || undefined,
        user_agent: request.headers.get('User-Agent') || undefined,
        details: { old_jti: payload.jti },
        risk_level: 'low'
      });

      return new Response(JSON.stringify({
        message: 'Token refreshed successfully',
        ...tokens
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      return new Response(JSON.stringify({
        error: 'Token refresh failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleUserInfo(request: Request): Promise<Response> {
    try {
      // Extract and verify JWT token
      const token = this.jwtService.extractTokenFromRequest(request);
      if (!token) {
        return new Response(JSON.stringify({
          error: 'Authorization token required'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const payload = await this.jwtService.verifyToken(token);
      if (!payload || payload.token_type !== 'access') {
        return new Response(JSON.stringify({
          error: 'Invalid access token'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get user from database
      const user = await this.db.prepare(`
        SELECT id, username, email, created_at, last_login 
        FROM users 
        WHERE id = ?
      `).bind(payload.user_id).first();

      if (!user) {
        return new Response(JSON.stringify({
          error: 'User not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          created_at: user.created_at,
          last_login: user.last_login
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('User info error:', error);
      return new Response(JSON.stringify({
        error: 'Failed to get user info'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleLogout(request: Request): Promise<Response> {
    try {
      const token = this.jwtService.extractTokenFromRequest(request);
      if (!token) {
        return new Response(JSON.stringify({
          message: 'Already logged out'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const payload = await this.jwtService.verifyToken(token);
      if (payload) {
        // Blacklist all user tokens
        await this.blacklist.blacklistAllUserTokens(payload.user_id);
        
        // Revoke all user sessions
        await this.sessionManager.revokeAllUserSessions(payload.user_id);

        // Log logout
        await this.auditService.logSecurityEvent({
          timestamp: Date.now(),
          event_type: 'user_logout',
          user_id: payload.user_id,
          ip_address: request.headers.get('CF-Connecting-IP') || undefined,
          user_agent: request.headers.get('User-Agent') || undefined,
          details: { username: payload.username },
          risk_level: 'low'
        });
      }

      return new Response(JSON.stringify({
        message: 'Logout successful'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Logout error:', error);
      return new Response(JSON.stringify({
        error: 'Logout failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handlePasswordReset(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { email } = body;

      if (!email) {
        return new Response(JSON.stringify({
          error: 'Email is required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Always return success to prevent email enumeration
      const passwordResetService = new PasswordResetService(this.auditService.kv, this.db);
      await passwordResetService.initiatePasswordReset(email);

      return new Response(JSON.stringify({
        message: 'If an account with this email exists, a password reset link has been sent'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Password reset error:', error);
      return new Response(JSON.stringify({
        error: 'Password reset failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handlePasswordResetConfirm(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { token, new_password } = body;

      if (!token || !new_password) {
        return new Response(JSON.stringify({
          error: 'Token and new password are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate password strength
      const passwordValidation = this.passwordService.validatePasswordStrength(new_password);
      if (!passwordValidation.isValid) {
        return new Response(JSON.stringify({
          error: 'Password does not meet security requirements',
          details: passwordValidation.errors
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const passwordResetService = new PasswordResetService(this.auditService.kv, this.db);
      const success = await passwordResetService.resetPassword(token, new_password);

      if (!success) {
        return new Response(JSON.stringify({
          error: 'Invalid or expired reset token'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        message: 'Password reset successful'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Password reset confirm error:', error);
      return new Response(JSON.stringify({
        error: 'Password reset confirmation failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
```

---

## 12. Testing and Validation

### Wrangler Configuration

```toml
# wrangler.toml
name = "list-cutter-auth"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# KV Namespaces
[[kv_namespaces]]
binding = "AUTH_KV"
id = "auth-kv-namespace-id"
preview_id = "auth-kv-preview-id"

[[kv_namespaces]]
binding = "SECURITY_KV"
id = "security-kv-namespace-id"
preview_id = "security-kv-preview-id"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "rate-limit-kv-namespace-id"
preview_id = "rate-limit-kv-preview-id"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "list-cutter-db"
database_id = "database-id"

# Environment Variables
[env.production.vars]
ENVIRONMENT = "production"
JWT_SECRET = "your-super-secret-jwt-key-here"

[env.staging.vars]
ENVIRONMENT = "staging"
JWT_SECRET = "staging-jwt-secret"

[env.development.vars]
ENVIRONMENT = "development"
JWT_SECRET = "dev-jwt-secret"

# Cron Triggers
[[triggers]]
crons = ["0 0 * * *"]  # Daily cleanup at midnight

[[triggers]]
crons = ["0 */6 * * *"]  # Security audit every 6 hours

# Build configuration
[build]
command = "npm run build"

[build.upload]
format = "modules"
```

### Testing Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'miniflare',
    globals: true,
    environmentOptions: {
      modules: true,
      kvNamespaces: ['AUTH_KV', 'SECURITY_KV', 'RATE_LIMIT_KV'],
      d1Databases: ['DB'],
      bindings: {
        JWT_SECRET: 'test-secret-key',
        ENVIRONMENT: 'test'
      }
    }
  }
});
```

### Integration Test Suite

```typescript
// tests/integration/auth.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Authentication Integration Tests', () => {
  let worker: UnstableDevWorker;

  beforeEach(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true }
    });
  });

  afterEach(async () => {
    await worker.stop();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const response = await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          email: 'test@example.com',
          password: 'SecurePass123!',
          password2: 'SecurePass123!'
        })
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
      expect(data.user.username).toBe('testuser');
    });

    it('should reject weak passwords', async () => {
      const response = await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser2',
          email: 'test2@example.com',
          password: '123',
          password2: '123'
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Password does not meet security requirements');
    });

    it('should reject duplicate usernames', async () => {
      // Register first user
      await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'duplicate',
          email: 'first@example.com',
          password: 'SecurePass123!',
          password2: 'SecurePass123!'
        })
      });

      // Try to register duplicate username
      const response = await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'duplicate',
          email: 'second@example.com',
          password: 'SecurePass123!',
          password2: 'SecurePass123!'
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('User with this username or email already exists');
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      // Register a test user
      await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'logintest',
          email: 'login@example.com',
          password: 'SecurePass123!',
          password2: 'SecurePass123!'
        })
      });
    });

    it('should login with valid credentials', async () => {
      const response = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'logintest',
          password: 'SecurePass123!'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
      expect(data.user.username).toBe('logintest');
    });

    it('should reject invalid credentials', async () => {
      const response = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'logintest',
          password: 'wrongpassword'
        })
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Invalid credentials');
    });
  });

  describe('Token Management', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login to get tokens
      await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'tokentest',
          email: 'token@example.com',
          password: 'SecurePass123!',
          password2: 'SecurePass123!'
        })
      });

      const loginResponse = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'tokentest',
          password: 'SecurePass123!'
        })
      });

      const loginData = await loginResponse.json();
      refreshToken = loginData.refresh_token;
    });

    it('should refresh tokens successfully', async () => {
      const response = await worker.fetch('/api/accounts/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: refreshToken
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
      expect(data.refresh_token).not.toBe(refreshToken); // Should be rotated
    });

    it('should reject invalid refresh tokens', async () => {
      const response = await worker.fetch('/api/accounts/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: 'invalid-token'
        })
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Invalid refresh token');
    });
  });

  describe('Protected Routes', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Register and login to get access token
      await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'protectedtest',
          email: 'protected@example.com',
          password: 'SecurePass123!',
          password2: 'SecurePass123!'
        })
      });

      const loginResponse = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'protectedtest',
          password: 'SecurePass123!'
        })
      });

      const loginData = await loginResponse.json();
      accessToken = loginData.access_token;
    });

    it('should access user info with valid token', async () => {
      const response = await worker.fetch('/api/accounts/user', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.username).toBe('protectedtest');
    });

    it('should reject requests without token', async () => {
      const response = await worker.fetch('/api/accounts/user', {
        method: 'GET'
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Authorization token required');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on login attempts', async () => {
      const requests = [];
      
      // Make multiple rapid login attempts
      for (let i = 0; i < 15; i++) {
        requests.push(
          worker.fetch('/api/accounts/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'nonexistent',
              password: 'invalid'
            })
          })
        );
      }

      const responses = await Promise.all(requests);
      
      // Should have some 429 responses
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await worker.fetch('/api/health');
      
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await worker.fetch('/api/accounts/login', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://list-cutter.emilyflam.be',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://list-cutter.emilyflam.be');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });
});
```

---

## 13. Deployment and Monitoring

### Deployment Script

```bash
#!/bin/bash
# deploy.sh

set -e

echo "Starting deployment of List Cutter Authentication System..."

# Build the project
echo "Building project..."
npm run build

# Run tests
echo "Running tests..."
npm test

# Deploy to staging first
echo "Deploying to staging..."
wrangler deploy --env staging

# Wait for deployment to be ready
echo "Waiting for staging deployment..."
sleep 30

# Run smoke tests against staging
echo "Running smoke tests against staging..."
npm run test:smoke -- --env staging

# Deploy to production
echo "Deploying to production..."
wrangler deploy --env production

# Run final smoke tests
echo "Running final smoke tests..."
npm run test:smoke -- --env production

echo "Deployment completed successfully!"
```

### Monitoring Setup

```typescript
// src/monitoring/healthcheck.ts
export class HealthCheckService {
  private db: D1Database;
  private kv: KVNamespace;

  constructor(db: D1Database, kv: KVNamespace) {
    this.db = db;
    this.kv = kv;
  }

  async performHealthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    checks: Record<string, boolean>;
    timestamp: number;
  }> {
    const checks = {
      database: await this.checkDatabase(),
      kv: await this.checkKV(),
      jwt: await this.checkJWT()
    };

    const status = Object.values(checks).every(Boolean) ? 'healthy' : 'unhealthy';

    return {
      status,
      checks,
      timestamp: Date.now()
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      const result = await this.db.prepare('SELECT 1').first();
      return result !== null;
    } catch {
      return false;
    }
  }

  private async checkKV(): Promise<boolean> {
    try {
      const testKey = 'health-check-' + Date.now();
      await this.kv.put(testKey, 'test', { expirationTtl: 60 });
      const value = await this.kv.get(testKey);
      await this.kv.delete(testKey);
      return value === 'test';
    } catch {
      return false;
    }
  }

  private async checkJWT(): Promise<boolean> {
    try {
      const jwtService = new JWTService('test-secret');
      const token = await jwtService.generateAccessToken({
        id: 1,
        username: 'test',
        email: 'test@example.com'
      });
      const payload = await jwtService.verifyToken(token);
      return payload !== null;
    } catch {
      return false;
    }
  }
}
```

### Alerting Configuration

```typescript
// src/monitoring/alerts.ts
export class AlertService {
  private webhook: string;

  constructor(webhook: string) {
    this.webhook = webhook;
  }

  async sendAlert(severity: 'info' | 'warning' | 'error' | 'critical', message: string, details?: any): Promise<void> {
    const alert = {
      severity,
      message,
      details,
      timestamp: new Date().toISOString(),
      service: 'list-cutter-auth'
    };

    try {
      await fetch(this.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert)
      });
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  async checkAndAlert(healthCheck: any): Promise<void> {
    if (healthCheck.status === 'unhealthy') {
      await this.sendAlert('error', 'Authentication service is unhealthy', healthCheck.checks);
    }

    // Check specific services
    if (!healthCheck.checks.database) {
      await this.sendAlert('critical', 'Database connection failed');
    }

    if (!healthCheck.checks.kv) {
      await this.sendAlert('critical', 'KV namespace unavailable');
    }
  }
}
```

---

## Implementation Timeline

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Cloudflare Workers environment
- [ ] Create KV namespaces and D1 database
- [ ] Implement JWT service
- [ ] Create password hashing utilities
- [ ] Set up basic authentication routes

### Phase 2: Security (Week 3-4)
- [ ] Implement rate limiting
- [ ] Add CORS middleware
- [ ] Set up security headers
- [ ] Create token blacklisting system
- [ ] Add abuse detection

### Phase 3: Advanced Features (Week 5-6)
- [ ] Implement session management
- [ ] Add password reset functionality
- [ ] Create security audit system
- [ ] Add OWASP compliance checks
- [ ] Implement monitoring and alerting

### Phase 4: Migration (Week 7-8)
- [ ] Create migration scripts
- [ ] Set up dual authentication support
- [ ] Migrate user data from Django
- [ ] Test compatibility with existing frontend
- [ ] Perform load testing

### Phase 5: Deployment (Week 9-10)
- [ ] Deploy to staging environment
- [ ] Perform integration testing
- [ ] Set up monitoring and alerting
- [ ] Deploy to production
- [ ] Monitor and optimize performance

---

## Success Metrics

### Performance Targets
- Authentication response time: < 100ms
- Token generation/validation: < 50ms
- KV operations: < 25ms
- Database queries: < 30ms

### Security Metrics
- Zero successful brute force attacks
- 99.9% JWT token validation accuracy
- < 1% false positive rate for abuse detection
- 100% OWASP Top 10 compliance

### Availability Targets
- 99.9% uptime
- < 5 minutes recovery time
- Zero data loss during migrations
- 24/7 monitoring coverage

This comprehensive implementation plan provides a secure, scalable, and maintainable authentication system that leverages Cloudflare Workers' performance and security capabilities while maintaining compatibility with the existing Django-based frontend.