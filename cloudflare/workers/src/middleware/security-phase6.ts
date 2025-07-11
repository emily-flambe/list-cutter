import type { Env } from '../types';
import { verifyJWT, isTokenBlacklisted } from '../services/auth/jwt';
import { SecurityLogger } from '../services/security/logger';
import { ThreatDetector } from '../services/security/threats';
import { MetricsCollector, RequestTimer } from '../services/security/metrics';

export interface SecurityContext {
  user_id?: number;
  username?: string;
  email?: string;
}

/**
 * Security monitoring middleware for response handling
 */
export async function securityResponseMiddleware(
  request: Request,
  response: Response,
  env: Env
): Promise<Response> {
  // Extract request timer that was attached during request processing
  // This timer tracks request duration and other performance metrics
  const timer = (request as any).securityTimer as RequestTimer | undefined;
  const userId = (timer as any)?.userId;
  
  // Finalize performance metrics collection if timer exists
  // This records response time, status code, and other request metadata
  if (timer) {
    try {
      await timer.finish(request, response, userId);
    } catch (error) {
      // Don't let metrics collection failures break the response
      console.error('Failed to record request metrics:', error);
    }
  }
  
  // Log the completed API request for security monitoring and audit trail
  // This creates entries in the security events table for compliance and analysis
  const logger = new SecurityLogger(env);
  try {
    await logger.logAPIRequest(request, response, userId);
  } catch (error) {
    // Security logging is important but shouldn't break the user experience
    console.error('Failed to log API request:', error);
  }
  
  // Return the original response unchanged - this middleware only observes
  return response;
}

/**
 * Main security middleware that applies comprehensive security checks and monitoring
 */
export async function securityMiddleware(
  request: Request,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response | null> {
  const url = new URL(request.url);
  const logger = new SecurityLogger(env);
  const threatDetector = new ThreatDetector(env, logger);
  const metrics = new MetricsCollector(env);
  const timer = new RequestTimer(metrics);
  
  const ipAddress = getClientIP(request);
  
  try {
    // 1. Check if IP is blocked
    const isBlocked = await threatDetector.isIPBlocked(ipAddress);
    if (isBlocked) {
      await logger.logSecurityViolation('blocked_ip_attempt', request, {
        block_reason: 'IP address is currently blocked'
      });
      
      return addSecurityHeaders(new Response(JSON.stringify({ 
        error: 'Access denied' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }), url.pathname);
    }
    
    // 2. Apply rate limiting with monitoring
    const rateLimitResponse = await applyRateLimit(request, env, logger);
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse, url.pathname);
    }
    
    // 3. Check authentication for protected routes with monitoring
    if (requiresAuth(url.pathname)) {
      const authResponse = await validateAuthentication(request, env, logger);
      if (authResponse) {
        return addSecurityHeaders(authResponse, url.pathname);
      }
    }
    
    // 4. Track active users if authenticated
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = await verifyJWT(token, env.JWT_SECRET);
      if (payload && !await isTokenBlacklisted(token, env)) {
        await metrics.trackActiveUser(payload.user_id);
        
        // Store user context for request timing
        (timer as any).userId = payload.user_id;
      }
    }
    
    // Store timer for later use
    (request as any).securityTimer = timer;
    
    // Continue to route handler
    return null;
    
  } catch (error) {
    await logger.logEvent({
      timestamp: Date.now(),
      event_type: 'security_middleware_error',
      ip_address: ipAddress,
      endpoint: url.pathname,
      method: request.method,
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Don't block on security middleware errors
    console.error('Security middleware error:', error);
    return null;
  }
}

/**
 * Apply rate limiting using Cloudflare Workers native rate limiter with monitoring
 */
async function applyRateLimit(request: Request, env: Env, logger: SecurityLogger): Promise<Response | null> {
  try {
    // Get client identifier (IP address or user ID)
    const clientId = getClientId(request);
    
    // Apply rate limiting
    const { success } = await env.RATE_LIMITER.limit({ key: clientId });
    
    if (!success) {
      // Log rate limit violation
      await logger.logSecurityViolation('rate_limit_exceeded', request, {
        client_id: clientId,
        rate_limiter: 'cloudflare_native'
      });
      
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
    
    // Log rate limiting error
    await logger.logEvent({
      timestamp: Date.now(),
      event_type: 'rate_limit_error',
      ip_address: getClientIP(request),
      endpoint: new URL(request.url).pathname,
      method: request.method,
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Don't block on rate limiting errors
    return null;
  }
}

/**
 * Validate JWT authentication for protected routes with monitoring
 */
async function validateAuthentication(request: Request, env: Env, logger: SecurityLogger): Promise<Response | null> {
  const authHeader = request.headers.get('Authorization');
  const url = new URL(request.url);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await logger.logSecurityViolation('unauthorized_access', request, {
      reason: 'Missing or invalid Authorization header'
    });
    
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
    await logger.logSecurityViolation('invalid_token', request, {
      reason: 'JWT verification failed'
    });
    
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
    await logger.logSecurityViolation('invalid_token', request, {
      reason: 'Token is blacklisted',
      user_id: payload.user_id
    });
    
    return new Response(JSON.stringify({ error: 'Token has been revoked' }), {
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="API"'
      }
    });
  }
  
  // Log successful authentication
  await logger.logEvent({
    timestamp: Date.now(),
    event_type: 'auth_success',
    user_id: payload.user_id,
    ip_address: getClientIP(request),
    user_agent: request.headers.get('User-Agent') || undefined,
    endpoint: url.pathname,
    method: request.method,
    success: true,
    metadata: {
      token_type: payload.token_type,
      username: payload.username
    }
  });
  
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
  
  // API endpoints get minimal CSP to prevent any injection attacks
  // We deny all content loading since APIs should only return JSON
  if (isAPI) {
    return "default-src 'none'; frame-ancestors 'none';";
  }
  
  // Frontend routes get a more permissive CSP that allows React to function
  // Each directive is carefully chosen to balance security with functionality
  return [
    "default-src 'self'",                              // Only load resources from same origin by default
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // React requires inline scripts and eval for development
    "style-src 'self' 'unsafe-inline'",               // Allow inline styles for CSS-in-JS libraries
    "img-src 'self' data: https:",                    // Images from self, data URLs, and HTTPS sources
    "font-src 'self'",                                // Fonts only from same origin
    "connect-src 'self'",                             // XHR/fetch requests only to same origin (API calls)
    "frame-ancestors 'none'",                         // Prevent embedding in frames (clickjacking protection)
    "base-uri 'self'",                                // Restrict <base> tag to same origin
    "form-action 'self'"                              // Forms can only submit to same origin
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
    '/api/list_cutter/csv_cutter',
    '/api/list_cutter/export_csv'
  ];
  
  // API routes require auth unless explicitly public
  if (pathname.startsWith('/api/')) {
    return !publicPaths.includes(pathname);
  }
  
  return false;
}

/**
 * Get client IP address from request headers
 */
function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         request.headers.get('X-Real-IP') ||
         'unknown';
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
  const ip = getClientIP(request);
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