import type { Context, Next } from 'hono';
import type { HonoEnv } from '@/types/env';

export async function requestIdMiddleware(
  c: Context<HonoEnv>,
  next: Next
): Promise<void> {
  // Generate a unique request ID
  const requestId = c.req.header('CF-Ray') || 
                   c.req.header('X-Request-ID') || 
                   generateRequestId();
  
  // Store request ID in context
  c.set('requestId', requestId);
  
  // Add request ID to response headers
  c.header('X-Request-ID', requestId);
  
  return next();
}

function generateRequestId(): string {
  // Generate a random request ID if none provided
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}