import type { Context, Next } from 'hono';
import type { HonoEnv } from '@/types/env';

export async function rateLimitMiddleware(
  c: Context<HonoEnv>,
  next: Next
): Promise<Response | void> {
  // Skip rate limiting in development
  if (c.env.ENVIRONMENT === 'development') {
    return next();
  }

  try {
    // Get client IP
    const clientIP = c.req.header('CF-Connecting-IP') || 
                    c.req.header('X-Forwarded-For') || 
                    c.req.header('X-Real-IP') || 
                    'unknown';

    // Use Cloudflare's rate limiting if available
    if (c.env.RATE_LIMITER) {
      const rateLimitResult = await c.env.RATE_LIMITER.limit({ key: clientIP });
      
      if (!rateLimitResult.success) {
        return c.json(
          {
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            retryAfter: rateLimitResult.retryAfter,
            requestId: c.get('requestId'),
          },
          429,
          {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': (Date.now() + 60000).toString(),
          }
        );
      }

      // Add rate limit headers to successful responses
      c.header('X-RateLimit-Limit', '100');
      c.header('X-RateLimit-Remaining', rateLimitResult.remaining?.toString() || '0');
      c.header('X-RateLimit-Reset', rateLimitResult.resetTime?.toString() || '0');
    } else {
      // Fallback: Simple in-memory rate limiting using KV
      const key = `rate_limit:${clientIP}`;
      const current = await c.env.AUTH_TOKENS.get(key);
      const count = current ? parseInt(current) : 0;
      
      if (count >= 100) { // 100 requests per minute
        return c.json(
          {
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            requestId: c.get('requestId'),
          },
          429,
          {
            'Retry-After': '60',
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': (Date.now() + 60000).toString(),
          }
        );
      }
      
      // Increment counter
      await c.env.AUTH_TOKENS.put(key, (count + 1).toString(), { expirationTtl: 60 });
      
      // Add headers
      c.header('X-RateLimit-Limit', '100');
      c.header('X-RateLimit-Remaining', (99 - count).toString());
      c.header('X-RateLimit-Reset', (Date.now() + 60000).toString());
    }

    return next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Continue without rate limiting if there's an error
    return next();
  }
}