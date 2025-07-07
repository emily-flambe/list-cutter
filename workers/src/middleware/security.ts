import type { Env } from '../types';
import { verifyJWT, isTokenBlacklisted } from '../services/auth/jwt';

export interface SecurityContext {
  user_id?: number;
  username?: string;
  email?: string;
}

/**
 * Main security middleware that applies comprehensive security checks
 */
export async function securityMiddleware(
  request: Request,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response | null> {
  const url = new URL(request.url);
  
  // 1. Apply rate limiting
  const rateLimitResponse = await applyRateLimit(request, env);
  if (rateLimitResponse) {
    return addSecurityHeaders(rateLimitResponse, url.pathname);
  }
  
  // 2. Check authentication for protected routes
  if (requiresAuth(url.pathname)) {
    const authResponse = await validateAuthentication(request, env);
    if (authResponse) {
      return addSecurityHeaders(authResponse, url.pathname);
    }
  }
  
  // Continue to route handler
  return null;
}

/**
 * Apply rate limiting using Cloudflare Workers native rate limiter
 */
async function applyRateLimit(request: Request, env: Env): Promise<Response | null> {
  try {
    // Get client identifier (IP address or user ID)
    const clientId = getClientId(request);
    
    // Apply rate limiting
    const { success } = await env.RATE_LIMITER.limit({ key: clientId });
    
    if (!success) {
      return new Response(JSON.stringify({ 
        error: 'Too many requests. Please try again later.' 
      }), {
        status: 429,
        headers: { 
          'Content-Type': 'application/json',
          'Retry-After': '60'
        }
      });
    }
    
    return null; // Continue processing
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Don't block on rate limiting errors
    return null;
  }
}

/**
 * Validate JWT authentication for protected routes
 */
async function validateAuthentication(request: Request, env: Env): Promise<Response | null> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="API"'
      }
    });
  }
  
  const token = authHeader.substring(7);
  
  // Verify JWT token
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="API"'
      }
    });
  }
  
  // Check if token is blacklisted
  if (await isTokenBlacklisted(token, env)) {
    return new Response(JSON.stringify({ error: 'Token has been revoked' }), {
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="API"'
      }
    });
  }
  
  // Attach user context to request headers for downstream handlers
  const mutableRequest = new Request(request);
  mutableRequest.headers.set('X-User-ID', payload.user_id.toString());
  mutableRequest.headers.set('X-Username', payload.username);
  if (payload.email) {
    mutableRequest.headers.set('X-User-Email', payload.email);
  }
  
  return null; // Continue processing
}

/**
 * Add comprehensive security headers to response
 */
export function addSecurityHeaders(response: Response, pathname: string): Response {
  const headers = new Headers(response.headers);
  
  // Content security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  headers.set('Content-Security-Policy', generateCSP(pathname));
  
  // HSTS for HTTPS
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Permissions Policy
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Cache control based on route type
  if (pathname.startsWith('/api/')) {
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
  } else if (pathname.startsWith('/assets/')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    headers.set('Cache-Control', 'no-cache');
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Generate Content Security Policy based on route
 */
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
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
}

/**
 * Determine if a route requires authentication
 */
function requiresAuth(pathname: string): boolean {
  const publicPaths = [
    '/api/accounts/register',
    '/api/accounts/login',
    '/api/accounts/token/refresh',
    '/api/cutty/csv_cutter',
    '/api/cutty/export_csv'
  ];
  
  // API routes require auth unless explicitly public
  if (pathname.startsWith('/api/')) {
    return !publicPaths.includes(pathname);
  }
  
  return false;
}

/**
 * Get client identifier for rate limiting
 */
function getClientId(request: Request): string {
  // Try to get user ID from authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // In a real implementation, we'd decode the JWT to get user ID
    // For now, use a hash of the token as identifier
    return `user:${hashString(token)}`;
  }
  
  // Fall back to IP address
  const ip = request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For') || 
           'unknown';
  
  return `ip:${ip}`;
}

/**
 * Simple hash function for string
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Rate limiting configuration for different endpoint types
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (request: Request) => string;
}

/**
 * KV-based rate limiting (alternative implementation)
 */
export async function kvRateLimit(
  request: Request,
  env: Env,
  config: RateLimitConfig
): Promise<Response | null> {
  const key = config.keyGenerator(request);
  const window = Math.floor(Date.now() / config.windowMs);
  const rateLimitKey = `rate_limit:${key}:${window}`;
  
  try {
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
          'Retry-After': (config.windowMs / 1000).toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': (Date.now() + config.windowMs).toString()
        }
      });
    }
    
    // Increment counter
    await env.AUTH_KV.put(
      rateLimitKey,
      (currentCount + 1).toString(),
      { expirationTtl: Math.ceil(config.windowMs / 1000) }
    );
    
    return null; // Continue processing
  } catch (error) {
    console.error('KV rate limiting error:', error);
    return null; // Don't block on errors
  }
}

/**
 * User-specific rate limiting
 */
export const userRateLimit = (request: Request, env: Env) => 
  kvRateLimit(request, env, {
    windowMs: 60000, // 1 minute
    maxRequests: 60,
    keyGenerator: (req) => {
      const authHeader = req.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        return `user:${hashString(authHeader.substring(7))}`;
      }
      return `ip:${req.headers.get('CF-Connecting-IP') || 'unknown'}`;
    }
  });

/**
 * IP-based rate limiting
 */
export const ipRateLimit = (request: Request, env: Env) =>
  kvRateLimit(request, env, {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    keyGenerator: (req) => `ip:${req.headers.get('CF-Connecting-IP') || 'unknown'}`
  });