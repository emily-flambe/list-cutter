/**
 * Simplified Security Service
 * 
 * This consolidated security service provides only essential security features:
 * - JWT authentication (via existing jwt.ts service)
 * - Basic rate limiting
 * - Input validation for file uploads
 * 
 * Removed features: threat detection, PII scanning, compliance management,
 * incident response, audit logging, and other enterprise-grade features.
 */

import type { Context } from 'hono';
import type { Env } from '../types';

// Re-export JWT functionality from existing service
export { generateToken, validateToken, refreshAccessToken, blacklistToken } from './auth/jwt';

/**
 * Simple rate limiter using KV storage
 */
export class RateLimiter {
  private readonly kv: KVNamespace;
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(kv: KVNamespace, windowMs = 60000, maxRequests = 60) {
    this.kv = kv;
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  async checkLimit(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get current count
    const data = await this.kv.get(key, 'json') as { count: number; resetAt: number } | null;

    if (!data || data.resetAt < now) {
      // New window
      await this.kv.put(key, JSON.stringify({
        count: 1,
        resetAt: now + this.windowMs
      }), {
        expirationTtl: Math.ceil(this.windowMs / 1000)
      });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    if (data.count >= this.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    // Increment count
    const newCount = data.count + 1;
    await this.kv.put(key, JSON.stringify({
      count: newCount,
      resetAt: data.resetAt
    }), {
      expirationTtl: Math.max(60, Math.ceil((data.resetAt - now) / 1000))
    });

    return { allowed: true, remaining: this.maxRequests - newCount };
  }
}

/**
 * Basic file validation
 */
export interface FileValidationOptions {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): { valid: boolean; error?: string } {
  const {
    maxSizeBytes = 52428800, // 50MB default
    allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
    allowedExtensions = ['.csv', '.txt', '.tsv']
  } = options;

  // Check file size
  if (file.size > maxSizeBytes) {
    return { 
      valid: false, 
      error: `File size ${file.size} bytes exceeds maximum of ${maxSizeBytes} bytes` 
    };
  }

  // Check MIME type
  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: `File type ${file.type} is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}` 
    };
  }

  // Check file extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
  
  if (allowedExtensions.length > 0 && !hasValidExtension) {
    return { 
      valid: false, 
      error: `File extension not allowed. Allowed extensions: ${allowedExtensions.join(', ')}` 
    };
  }

  // Validate filename
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(file.name)) {
    return { 
      valid: false, 
      error: 'Filename contains invalid characters' 
    };
  }

  return { valid: true };
}

/**
 * In-memory rate limiter for development
 * Avoids KV operations to prevent 429 errors
 */
class InMemoryRateLimiter {
  private requests: Map<string, { count: number; resetAt: number }> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs = 60000, maxRequests = 60) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  checkLimit(identifier: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const data = this.requests.get(identifier);

    if (!data || data.resetAt < now) {
      // New window
      this.requests.set(identifier, {
        count: 1,
        resetAt: now + this.windowMs
      });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    if (data.count >= this.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    // Increment count
    data.count++;
    return { allowed: true, remaining: this.maxRequests - data.count };
  }

  // Clean up old entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.requests.entries()) {
      if (data.resetAt < now) {
        this.requests.delete(key);
      }
    }
  }
}

// Global in-memory limiter for development
const devRateLimiter = new InMemoryRateLimiter();

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(options?: { windowMs?: number; maxRequests?: number }) {
  return async (c: Context<{ Bindings: Env }>, next: Function) => {
    // In development, use in-memory rate limiting to avoid KV rate limits
    if (c.env.ENVIRONMENT === 'development') {
      const identifier = c.req.header('CF-Connecting-IP') || 
                       c.req.header('X-Forwarded-For') || 
                       c.req.header('X-Real-IP') ||
                       'dev-' + (c.req.header('User-Agent') || 'unknown');

      const limiter = new InMemoryRateLimiter(options?.windowMs, options?.maxRequests);
      const { allowed, remaining } = limiter.checkLimit(identifier);

      // Set rate limit headers
      c.header('X-RateLimit-Limit', String(options?.maxRequests || 60));
      c.header('X-RateLimit-Remaining', String(remaining));

      if (!allowed) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }

      return next();
    }

    // Production: Use KV-based rate limiting
    const kv = c.env.AUTH_KV;
    if (!kv) {
      console.error('AUTH_KV not configured for rate limiting');
      return next();
    }

    try {
      const limiter = new RateLimiter(kv, options?.windowMs, options?.maxRequests);
      
      // Use IP address or user ID as identifier
      const identifier = c.req.header('CF-Connecting-IP') || 
                       c.req.header('X-Forwarded-For') || 
                       'unknown';

      const { allowed, remaining } = await limiter.checkLimit(identifier);

      // Set rate limit headers
      c.header('X-RateLimit-Limit', String(options?.maxRequests || 60));
      c.header('X-RateLimit-Remaining', String(remaining));

      if (!allowed) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }
    } catch (error) {
      // If KV operations fail, log but don't block the request
      console.error('Rate limiting error:', error);
      // Continue without rate limiting rather than failing the request
    }

    return next();
  };
}

/**
 * Basic input sanitization
 */
export function sanitizeInput(input: string): string {
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000);
  }
  
  return sanitized;
}